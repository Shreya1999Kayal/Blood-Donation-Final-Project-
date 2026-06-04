const Donor = require('../models/Donor');
const { normalizeCity } = require('../utils/city');
const { recommendDonors } = require('../services/matchingService');
const helpChatService = require('../services/helpChatService');
const medicalAnalysisService = require('../services/medicalAnalysisService');
const documentOcrService = require('../services/documentOcrService');

async function aiChat(req, res) {
    const message = req.body?.message;
    const history = req.body?.history;
    const userRole = req.body?.userRole;
    const context = req.body?.context;
    const role = userRole || req.user?.role || null;

    try {
        if (context === 'medical' && req.user?.role === 'admin') {
            return res.json({
                ok: true,
                reply: 'Use POST /ai/analyze-medical-report or the admin medical review screen for document screening. I can still answer general RaktaSetu questions if you switch context to help.',
            });
        }

        const reply = await helpChatService.chat({ message, history, userRole: role });
        const usedFallback = reply.includes('Built-in RaktaSetu help');
        res.json({ ok: true, reply, fallback: usedFallback });
    } catch (error) {
        const local = helpChatService.findLocalFaqAnswer(message, role);
        if (local?.answer) {
            return res.json({
                ok: true,
                reply: `${local.answer}\n\n---\nBuilt-in RaktaSetu help · Live AI is temporarily unavailable.`,
                fallback: true,
            });
        }
        console.error('AI chat error:', error.message);
        res.status(503).json({
            ok: false,
            error: 'Help assistant is busy right now. Please try again in a minute or browse the home page FAQ.',
        });
    }
}

async function helpChat(req, res) {
    return aiChat(req, res);
}

async function analyzeMedicalReport(req, res) {
    try {
        const { donorId, bloodGroup, documentType } = req.body;
        let selectedBloodGroup = bloodGroup;
        let donor = null;

        if (donorId) {
            donor = await Donor.findById(donorId);
            if (!donor) return res.status(404).json({ ok: false, error: 'Donor not found' });
            if (req.user.role !== 'admin' && donor.userId.toString() !== req.user._id.toString()) {
                return res.status(403).json({ ok: false, error: 'Not allowed to analyze this donor' });
            }
            selectedBloodGroup = selectedBloodGroup || donor.bloodGroup;
        }

        let analysis;
        if (req.file) {
            analysis = await medicalAnalysisService.analyzeUploadedReportFile(req.file, {
                selectedBloodGroup,
                documentType: documentType || 'report',
            });
        } else if (donor) {
            analysis = await medicalAnalysisService.analyzeFromStoredDocuments(
                donor.medicalReports,
                selectedBloodGroup
            );
        } else {
            return res.status(400).json({
                ok: false,
                error: 'Upload a report file or provide donorId to re-analyze stored documents.',
            });
        }

        if (donor) {
            donor.aiRiskAnalysis = {
                riskScore: analysis.riskScore,
                eligibility: analysis.eligibility,
                detectedDiseases: analysis.detectedDiseases || [],
                bloodGroupMismatch: Boolean(analysis.bloodGroupMismatch),
                extractedBloodGroup: analysis.extractedBloodGroup || null,
                analysisSummary: analysis.summary || '',
                analysisNotes: analysis.notes || '',
                analysisProvider: analysis.provider || 'rules',
                analyzedAt: analysis.analyzedAt || new Date(),
                ocrExcerpts: analysis.ocrExcerpts || {
                    combined: analysis.ocrExcerpt || '',
                },
            };
            await donor.save();
        }

        res.json({
            ok: true,
            analysis: {
                riskScore: analysis.riskScore,
                eligibility: analysis.eligibility,
                detectedDiseases: analysis.detectedDiseases,
                bloodGroupMismatch: analysis.bloodGroupMismatch,
                extractedBloodGroup: analysis.extractedBloodGroup,
                summary: analysis.summary,
                notes: analysis.notes,
                provider: analysis.provider,
                analyzedAt: analysis.analyzedAt,
                ocrExcerpt: analysis.ocrExcerpt,
                ocrExcerpts: analysis.ocrExcerpts,
            },
            donorId: donor?._id || null,
        });
    } catch (error) {
        console.error('Analyze medical report error:', error.message);
        res.status(500).json({ ok: false, error: error.message || 'Medical analysis failed' });
    }
}

async function verifyBloodGroupApi(req, res) {
    try {
        const { bloodGroup, text, donorId } = req.body;
        let selectedBloodGroup = bloodGroup;
        let extractedText = text || '';

        if (req.file) {
            extractedText = await documentOcrService.extractTextFromMulterFile(req.file);
        } else if (donorId) {
            const donor = await Donor.findById(donorId);
            if (!donor) return res.status(404).json({ ok: false, error: 'Donor not found' });
            if (req.user.role !== 'admin' && donor.userId.toString() !== req.user._id.toString()) {
                return res.status(403).json({ ok: false, error: 'Not allowed' });
            }
            selectedBloodGroup = selectedBloodGroup || donor.bloodGroup;
            extractedText = await documentOcrService.extractTextFromUrl(donor.medicalReports?.bloodGroupReportUrl);
            if (!extractedText) {
                extractedText = await documentOcrService.extractTextFromUrl(donor.medicalReports?.bloodTestReportUrl);
            }
        }

        if (!selectedBloodGroup) {
            return res.status(400).json({ ok: false, error: 'bloodGroup is required' });
        }
        if (!extractedText) {
            return res.status(400).json({
                ok: false,
                error: 'Provide OCR text, upload a report, or donorId with stored documents.',
            });
        }

        const verification = medicalAnalysisService.verifyBloodGroup(extractedText, selectedBloodGroup);

        if (donorId) {
            const donor = await Donor.findById(donorId);
            if (donor) {
                donor.aiRiskAnalysis = donor.aiRiskAnalysis || {};
                donor.aiRiskAnalysis.bloodGroupMismatch = verification.bloodGroupMismatch;
                donor.aiRiskAnalysis.extractedBloodGroup = verification.extractedBloodGroup;
                if (verification.bloodGroupMismatch) {
                    donor.aiRiskAnalysis.eligibility = 'Not Recommended';
                    donor.aiRiskAnalysis.riskScore = Math.max(donor.aiRiskAnalysis.riskScore || 0, 60);
                    const diseases = new Set(donor.aiRiskAnalysis.detectedDiseases || []);
                    diseases.add('Blood group mismatch');
                    donor.aiRiskAnalysis.detectedDiseases = [...diseases];
                }
                await donor.save();
            }
        }

        res.json({ ok: true, verification, ocrExcerpt: documentOcrService.truncateExcerpt(extractedText) });
    } catch (error) {
        console.error('Verify blood group error:', error.message);
        res.status(500).json({ ok: false, error: error.message || 'Blood group verification failed' });
    }
}

async function recommendDonorsApi(req, res) {
    try {
        const {
            bloodGroup,
            city,
            radiusKm = 20,
            longitude = 72.8777,
            latitude = 19.0760,
        } = req.query;

        if (!bloodGroup) {
            return res.status(400).json({ error: 'bloodGroup is required' });
        }

        const donors = await recommendDonors({
            bloodGroup,
            city: city ? normalizeCity(city) : null,
            radiusKm,
            location: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
        });

        res.json({ donors });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

function predictPriority(req, res) {
    const urgency = req.body.urgencyLevel || 'High';
    const units = Number(req.body.requiredUnits || 1);
    const score = (urgency === 'Critical' ? 80 : urgency === 'High' ? 55 : 25) + Math.min(units * 5, 20);
    res.json({
        priorityScore: Math.min(score, 100),
        priority: score >= 80 ? 'Critical' : score >= 55 ? 'High' : 'Normal',
    });
}

module.exports = {
    aiChat,
    helpChat,
    analyzeMedicalReport,
    verifyBloodGroupApi,
    recommendDonorsApi,
    predictPriority,
};
