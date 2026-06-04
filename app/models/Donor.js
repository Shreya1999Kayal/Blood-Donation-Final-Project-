const mongoose = require('mongoose');

const donorSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], required: true },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true } // [longitude, latitude]
    },
    medicalReports: {
        bloodGroupReportUrl: String,
        bloodTestReportUrl: String,
        fitnessCertificateUrl: String,
        identityProofUrl: String
    },
    aiRiskAnalysis: {
        riskScore: { type: Number, default: 0 },
        eligibility: { type: String, enum: ['Pending', 'Recommended', 'Not Recommended'], default: 'Pending' },
        detectedDiseases: [String],
        bloodGroupMismatch: { type: Boolean, default: false },
        extractedBloodGroup: String,
        analysisSummary: String,
        analysisNotes: String,
        analysisProvider: String,
        analyzedAt: Date,
        ocrExcerpts: {
            bloodGroupReport: String,
            bloodTestReport: String,
            fitnessCertificate: String,
            identityProof: String,
            combined: String,
        },
    },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    isAvailable: { type: Boolean, default: true },
    responseCount: { type: Number, default: 0 },
    lastDonationDate: { type: Date }
}, { timestamps: true });

donorSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Donor', donorSchema);
