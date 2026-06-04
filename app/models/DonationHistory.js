const mongoose = require('mongoose');

const donationHistorySchema = new mongoose.Schema({
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donor', required: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
    hospitalName: { type: String, required: true },
    bloodGroup: { type: String, required: true },
    units: { type: Number, default: 1 },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    donatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('DonationHistory', donationHistorySchema);
