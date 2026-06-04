const Donor = require('../models/Donor');
const DonationHistory = require('../models/DonationHistory');
const { fileToPublicUrl } = require('../utils/upload');
const { parseCoordinates } = require('../utils/sanitizeGeo');
const medicalAnalysisService = require('../services/medicalAnalysisService');

const REQUIRED_DOC_FIELDS = [
    'bloodGroupReport',
    'bloodTestReport',
    'fitnessCertificate',
    'identityProof',
];

function allUploadFieldsPresent(files) {
    return REQUIRED_DOC_FIELDS.every((field) => Boolean(files?.[field]?.[0]));
}

function buildAiRiskPayload(analysis) {
    return {
        riskScore: analysis.riskScore,
        eligibility: analysis.eligibility,
        detectedDiseases: analysis.detectedDiseases || [],
        bloodGroupMismatch: Boolean(analysis.bloodGroupMismatch),
        extractedBloodGroup: analysis.extractedBloodGroup || null,
        analysisSummary: analysis.summary || '',
        analysisNotes: analysis.notes || '',
        analysisProvider: analysis.provider || 'rules',
        analyzedAt: analysis.analyzedAt || new Date(),
        ocrExcerpts: analysis.ocrExcerpts || {},
    };
}

async function register(req, res) {
    try {
        const bloodGroup = req.body.bloodGroup || 'O+';
        const coordinates = parseCoordinates(req.body.longitude, req.body.latitude);

        if (!allUploadFieldsPresent(req.files)) {
            return res.redirect('/dashboard?error=donor_all_docs_required');
        }

        const analysis = await medicalAnalysisService.analyzeDonorUploads({
            files: req.files,
            selectedBloodGroup: bloodGroup,
        });

        const medicalReports = {
            bloodGroupReportUrl: await fileToPublicUrl(req.files.bloodGroupReport[0]),
            bloodTestReportUrl: await fileToPublicUrl(req.files.bloodTestReport[0]),
            fitnessCertificateUrl: await fileToPublicUrl(req.files.fitnessCertificate[0]),
            identityProofUrl: await fileToPublicUrl(req.files.identityProof[0]),
        };

        const aiRiskAnalysis = buildAiRiskPayload(analysis);
        let donor = await Donor.findOne({ userId: req.user._id });

        if (donor) {
            donor.bloodGroup = bloodGroup;
            donor.location = { type: 'Point', coordinates };
            donor.medicalReports = medicalReports;
            donor.status = 'pending';
            donor.aiRiskAnalysis = aiRiskAnalysis;
            await donor.save();
        } else {
            await Donor.create({
                userId: req.user._id,
                bloodGroup,
                location: { type: 'Point', coordinates },
                medicalReports,
                aiRiskAnalysis,
                status: 'pending',
            });
        }

        res.redirect('/dashboard?msg=donor_docs_submitted');
    } catch (error) {
        console.error('Donor register error:', error.message);
        res.redirect('/dashboard?error=upload_processing_failed');
    }
}

async function updateAvailabilityJson(req, res) {
    try {
        const donor = await Donor.findOne({ userId: req.user._id });
        if (!donor) return res.status(404).json({ error: 'Donor profile not found' });

        donor.isAvailable = req.body.isAvailable;
        await donor.save();
        res.json({ success: true, isAvailable: donor.isAvailable });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function updateAvailability(req, res) {
    try {
        const donor = await Donor.findOne({ userId: req.user._id });
        if (!donor) return res.redirect('/dashboard?error=donor_profile_missing');

        donor.isAvailable = req.body.isAvailable;
        await donor.save();
        res.redirect('/dashboard?msg=availability_updated');
    } catch (error) {
        res.status(500).send('Error updating availability: ' + error.message);
    }
}

async function getHistory(req, res) {
    try {
        const donor = await Donor.findOne({ userId: req.user._id });
        if (!donor) return res.json({ donations: [] });

        const donations = await DonationHistory.find({ donorId: donor._id })
            .populate('requestId', 'patientName contactName city')
            .sort({ donatedAt: -1 });

        res.json({ donations });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    register,
    updateAvailabilityJson,
    updateAvailability,
    getHistory,
};
