const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const documentOcrService = require('./documentOcrService');

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const RULE_FLAGS = [
    {
        test: (text) => /\bhiv\b|\baids\b/i.test(text) && !/\bhiv\s*(negative|non[\s-]?reactive|not detected|nil)\b/i.test(text),
        disease: 'HIV',
        score: 45,
    },
    {
        test: (text) => /hepatitis\s*b|hbsag\s*positive|anti[\s-]?hcv\s*positive/i.test(text) && !/\b(non[\s-]?reactive|negative|not detected)\b/i.test(text),
        disease: 'Hepatitis',
        score: 40,
    },
    {
        test: (text) => /\bmalaria\b|\bplasmodium\b/i.test(text) && !/\b(negative|not detected|nil)\b/i.test(text),
        disease: 'Malaria',
        score: 35,
    },
    {
        test: (text) => /\btuberculosis\b|\bmantoux\b/i.test(text) && !/\b(negative|not detected)\b/i.test(text),
        disease: 'Tuberculosis',
        score: 35,
    },
    {
        test: (text) => /\bsyphilis\b|\bvdrl\b/i.test(text) && !/\b(non[\s-]?reactive|negative|not detected)\b/i.test(text),
        disease: 'Syphilis',
        score: 30,
    },
    {
        test: (text) => /\bdiabetes\b|\bdiabetic\b|\bhba1c\b|\bfasting glucose\b/i.test(text),
        disease: 'Diabetes',
        score: 18,
    },
    {
        test: (text) => /\bhypertension\b|\bhigh bp\b|\bblood pressure\b/i.test(text),
        disease: 'Hypertension',
        score: 12,
    },
    {
        test: (text) => /\banemia\b|\banaemia\b|\blow hemoglobin\b|\blow haemoglobin\b/i.test(text),
        disease: 'Anemia',
        score: 22,
    },
    {
        test: (text) => /\bpregnan|\blactating\b/i.test(text),
        disease: 'Pregnancy/lactation',
        score: 30,
    },
    {
        test: (text) => /\bcancer\b|\bmalignancy\b|\bchemotherapy\b/i.test(text),
        disease: 'Cancer history',
        score: 40,
    },
];

function geminiClient() {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
    if (!apiKey || apiKey.toLowerCase().startsWith('your_')) return null;
    return new GoogleGenerativeAI(apiKey);
}

function openAiClient() {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey || apiKey.toLowerCase().startsWith('your_')) return null;
    return new OpenAI({ apiKey });
}

function normalizeBloodGroupToken(raw) {
    if (!raw) return null;
    let token = raw.toString().trim().toUpperCase();
    token = token
        .replace(/\s+/g, '')
        .replace(/POSITIVE|POS/gi, '+')
        .replace(/NEGATIVE|NEG/gi, '-')
        .replace(/VE/gi, '');

    if (VALID_BLOOD_GROUPS.includes(token)) return token;

    const compact = token.match(/\b(AB|A|B|O)\s*(\+|−|-)\b/);
    if (compact) {
        const group = `${compact[1]}${compact[2].replace('−', '-')}`;
        if (VALID_BLOOD_GROUPS.includes(group)) return group;
    }

    return null;
}

function extractBloodGroupFromText(text) {
    if (!text) return null;

    const labeled = text.match(/blood\s*group\s*[:\-]?\s*(AB|A|B|O)\s*(\+|−|-|positive|negative|pos|neg)?/i);
    if (labeled) {
        const normalized = normalizeBloodGroupToken(`${labeled[1]} ${labeled[2] || '+'}`);
        if (normalized) return normalized;
    }

    const inlineMatches = text.match(/(?:^|[\s(,;])(AB|A|B|O)\s*(\+|−|-|positive|negative|pos|neg)(?:[\s),;]|$)/gi) || [];
    for (const match of inlineMatches) {
        const normalized = normalizeBloodGroupToken(match.trim());
        if (normalized) return normalized;
    }

    const compactMatches = text.match(/(AB|A|B|O)[+-]/g) || [];
    for (const match of compactMatches) {
        const normalized = normalizeBloodGroupToken(match);
        if (normalized) return normalized;
    }

    return null;
}

function detectLowHemoglobin(text) {
    if (!text) return null;
    const match = text.match(/(?:hemoglobin|haemoglobin|\bhb\b)\s*[:\-=]?\s*(\d+(?:\.\d+)?)/i);
    if (!match) return null;
    const value = Number(match[1]);
    if (Number.isNaN(value)) return null;
    if (value < 12.5) {
        return { value, disease: `Low hemoglobin (${value} g/dL)`, score: value < 10 ? 35 : 22 };
    }
    return null;
}

function analyzeWithRules(text) {
    const detectedDiseases = [];
    let riskScore = 5;
    const notes = [];

    for (const rule of RULE_FLAGS) {
        if (rule.test(text)) {
            detectedDiseases.push(rule.disease);
            riskScore += rule.score;
            notes.push(`Rule flag: ${rule.disease}`);
        }
    }

    const lowHb = detectLowHemoglobin(text);
    if (lowHb) {
        detectedDiseases.push(lowHb.disease);
        riskScore += lowHb.score;
        notes.push(`Detected Hb value ${lowHb.value}`);
    }

    riskScore = Math.min(100, Math.max(0, riskScore));
    const uniqueDiseases = [...new Set(detectedDiseases)];

    let eligibility = 'Recommended';
    if (riskScore >= 45 || uniqueDiseases.some((d) => /HIV|Hepatitis|Malaria|Tuberculosis|Syphilis|Cancer/i.test(d))) {
        eligibility = 'Not Recommended';
    } else if (riskScore >= 25 || uniqueDiseases.length) {
        eligibility = 'Pending';
    }

    return {
        riskScore,
        eligibility,
        detectedDiseases: uniqueDiseases,
        summary: uniqueDiseases.length
            ? `Rule-based scan flagged: ${uniqueDiseases.join(', ')}.`
            : 'No major disqualifying keywords detected in OCR text.',
        notes: notes.join('; '),
        provider: 'rules',
    };
}

function parseJsonFromModel(text) {
    if (!text) return null;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : text.trim();
    try {
        return JSON.parse(candidate);
    } catch (_) {
        const start = candidate.indexOf('{');
        const end = candidate.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(candidate.slice(start, end + 1));
            } catch (__) {
                return null;
            }
        }
        return null;
    }
}

function normalizeAiResult(raw, fallback) {
    const detectedDiseases = Array.isArray(raw?.detectedDiseases)
        ? raw.detectedDiseases.map(String).filter(Boolean)
        : fallback.detectedDiseases;

    let riskScore = Number(raw?.riskScore);
    if (Number.isNaN(riskScore)) riskScore = fallback.riskScore;
    riskScore = Math.min(100, Math.max(0, Math.round(riskScore)));

    let eligibility = raw?.eligibility;
    if (!['Recommended', 'Not Recommended', 'Pending'].includes(eligibility)) {
        eligibility = fallback.eligibility;
    }

    return {
        riskScore,
        eligibility,
        detectedDiseases: [...new Set(detectedDiseases)],
        summary: (raw?.summary || fallback.summary || '').toString().slice(0, 2000),
        notes: (raw?.notes || fallback.notes || '').toString().slice(0, 2000),
        provider: fallback.provider,
    };
}

async function analyzeWithGemini(text, selectedBloodGroup) {
    const genAI = geminiClient();
    if (!genAI) return null;

    const modelName = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `You are a medical document screening assistant for Indian blood donor eligibility.
Analyze the OCR text from uploaded lab/fitness documents. Do NOT diagnose — flag screening concerns only.

Donor selected blood group: ${selectedBloodGroup || 'unknown'}

Return ONLY valid JSON:
{
  "riskScore": number 0-100,
  "eligibility": "Recommended" | "Not Recommended" | "Pending",
  "detectedDiseases": string[],
  "summary": string,
  "notes": string
}

Flag if present: HIV, hepatitis, low hemoglobin (<12.5 g/dL), diabetes, malaria, TB, pregnancy, cancer treatment, blood group inconsistencies.
OCR TEXT:
${text.slice(0, 14000)}`;

    const result = await model.generateContent(prompt);
    const responseText = result?.response?.text?.() || '';
    const parsed = parseJsonFromModel(responseText);
    if (!parsed) return null;

    const fallback = analyzeWithRules(text);
    return normalizeAiResult(parsed, { ...fallback, provider: 'gemini' });
}

async function analyzeWithOpenAI(text, selectedBloodGroup) {
    const client = openAiClient();
    if (!client) return null;

    const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content: 'You screen blood donor medical documents for eligibility flags. Respond with JSON only.',
            },
            {
                role: 'user',
                content: `Selected blood group: ${selectedBloodGroup || 'unknown'}\nAnalyze:\n${text.slice(0, 14000)}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content || '';
    const parsed = parseJsonFromModel(content);
    if (!parsed) return null;

    const fallback = analyzeWithRules(text);
    return normalizeAiResult(parsed, { ...fallback, provider: 'openai' });
}

async function analyzeMedicalText(text, { selectedBloodGroup } = {}) {
    const normalizedText = (text || '').trim();
    if (!normalizedText) {
        return {
            riskScore: 50,
            eligibility: 'Pending',
            detectedDiseases: [],
            summary: 'No readable text extracted from documents. Manual admin review required.',
            notes: 'OCR returned empty text.',
            provider: 'none',
        };
    }

    try {
        const geminiResult = await analyzeWithGemini(normalizedText, selectedBloodGroup);
        if (geminiResult) return geminiResult;
    } catch (error) {
        console.warn('Gemini medical analysis failed:', error.message);
    }

    try {
        const openAiResult = await analyzeWithOpenAI(normalizedText, selectedBloodGroup);
        if (openAiResult) return openAiResult;
    } catch (error) {
        console.warn('OpenAI medical analysis failed:', error.message);
    }

    return analyzeWithRules(normalizedText);
}

function verifyBloodGroup(extractedText, selectedBloodGroup) {
    const extracted = extractBloodGroupFromText(extractedText);
    const normalizedSelected = normalizeBloodGroupToken(selectedBloodGroup);
    const bloodGroupMismatch = Boolean(
        extracted &&
        normalizedSelected &&
        extracted !== normalizedSelected
    );

    return {
        extractedBloodGroup: extracted,
        selectedBloodGroup: normalizedSelected,
        bloodGroupMismatch,
        summary: extracted
            ? (bloodGroupMismatch
                ? `Document shows ${extracted} but donor selected ${normalizedSelected}.`
                : `Document blood group ${extracted} matches selected group.`)
            : 'Could not extract blood group from document text.',
    };
}

async function analyzeDonorUploads({ files, selectedBloodGroup }) {
    const fileMap = {
        bloodGroupReport: files?.bloodGroupReport?.[0],
        bloodTestReport: files?.bloodTestReport?.[0],
        fitnessCertificate: files?.fitnessCertificate?.[0],
        identityProof: files?.identityProof?.[0],
    };

    const sections = await documentOcrService.extractTextFromMulterFiles(fileMap);
    const combinedText = sections.map((s) => s.text).filter(Boolean).join('\n\n');
    const bloodGroupSection = sections.find((s) => s.label === 'bloodGroupReport')?.text || combinedText;

    const analysis = await analyzeMedicalText(combinedText, { selectedBloodGroup });
    const bloodGroupCheck = verifyBloodGroup(bloodGroupSection, selectedBloodGroup);

    const ocrExcerpts = {};
    sections.forEach((section) => {
        ocrExcerpts[section.label] = documentOcrService.truncateExcerpt(section.text);
    });
    ocrExcerpts.combined = documentOcrService.truncateExcerpt(combinedText);

    if (bloodGroupCheck.bloodGroupMismatch) {
        analysis.eligibility = 'Not Recommended';
        analysis.riskScore = Math.min(100, Math.max(analysis.riskScore, 60));
        if (!analysis.detectedDiseases.includes('Blood group mismatch')) {
            analysis.detectedDiseases.push('Blood group mismatch');
        }
        analysis.notes = `${analysis.notes || ''}; ${bloodGroupCheck.summary}`.trim();
    }

    return {
        ...analysis,
        ...bloodGroupCheck,
        ocrExcerpts,
        analyzedAt: new Date(),
    };
}

async function analyzeFromStoredDocuments(medicalReports, selectedBloodGroup) {
    const sections = await documentOcrService.extractTextFromUrls({
        bloodGroupReport: medicalReports?.bloodGroupReportUrl,
        bloodTestReport: medicalReports?.bloodTestReportUrl,
        fitnessCertificate: medicalReports?.fitnessCertificateUrl,
        identityProof: medicalReports?.identityProofUrl,
    });

    const combinedText = sections.map((s) => s.text).filter(Boolean).join('\n\n');
    const bloodGroupSection = sections.find((s) => s.label === 'bloodGroupReport')?.text || combinedText;
    const analysis = await analyzeMedicalText(combinedText, { selectedBloodGroup });
    const bloodGroupCheck = verifyBloodGroup(bloodGroupSection, selectedBloodGroup);

    const ocrExcerpts = {};
    sections.forEach((section) => {
        ocrExcerpts[section.label] = documentOcrService.truncateExcerpt(section.text);
    });
    ocrExcerpts.combined = documentOcrService.truncateExcerpt(combinedText);

    if (bloodGroupCheck.bloodGroupMismatch) {
        analysis.eligibility = 'Not Recommended';
        analysis.riskScore = Math.min(100, Math.max(analysis.riskScore, 60));
        if (!analysis.detectedDiseases.includes('Blood group mismatch')) {
            analysis.detectedDiseases.push('Blood group mismatch');
        }
    }

    return {
        ...analysis,
        ...bloodGroupCheck,
        ocrExcerpts,
        analyzedAt: new Date(),
    };
}

async function analyzeUploadedReportFile(file, { selectedBloodGroup, documentType = 'report' } = {}) {
    const text = await documentOcrService.extractTextFromMulterFile(file);
    const analysis = await analyzeMedicalText(text, { selectedBloodGroup });
    const bloodGroupCheck = documentType === 'bloodGroupReport' || documentType === 'bloodTestReport'
        ? verifyBloodGroup(text, selectedBloodGroup)
        : { extractedBloodGroup: null, bloodGroupMismatch: false, summary: '' };

    return {
        ...analysis,
        ...bloodGroupCheck,
        ocrExcerpt: documentOcrService.truncateExcerpt(text),
        analyzedAt: new Date(),
    };
}

module.exports = {
    VALID_BLOOD_GROUPS,
    extractBloodGroupFromText,
    verifyBloodGroup,
    analyzeMedicalText,
    analyzeDonorUploads,
    analyzeFromStoredDocuments,
    analyzeUploadedReportFile,
    analyzeWithRules,
};
