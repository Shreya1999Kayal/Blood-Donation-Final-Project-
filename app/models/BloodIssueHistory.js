const mongoose = require('mongoose');

const bloodIssueHistorySchema = new mongoose.Schema({
    bloodBankId: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodBank', required: true, index: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true, unique: true },
    patientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    patientName: { type: String, required: true },
    hospitalName: { type: String, required: true },
    city: { type: String, default: '' },
    bloodGroup: { type: String, required: true },
    units: { type: Number, required: true, min: 1 },
    previousStock: { type: Number, default: 0 },
    remainingStock: { type: Number, default: 0 },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    issuedAt: { type: Date, default: Date.now },
}, { timestamps: true });

bloodIssueHistorySchema.index({ bloodBankId: 1, issuedAt: -1 });

module.exports = mongoose.model('BloodIssueHistory', bloodIssueHistorySchema);
