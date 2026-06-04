const mongoose = require('mongoose');

const campSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    organizationType: {
        type: String,
        enum: ['NGO', 'Hospital', 'Government', 'Corporate', 'Red Cross', 'Educational', 'Other'],
        required: true,
    },
    organizationName: { type: String, required: true },
    organizerName: { type: String, required: true },
    organizerMobile: { type: String, required: true },
    organizerEmail: { type: String, required: true },
    coOrganizerName: { type: String, default: '' },
    coOrganizerMobile: { type: String, default: '' },
    mobileVerified: { type: Boolean, default: false },
    setupOtpHash: { type: String, select: false },
    setupOtpExpiresAt: { type: Date, select: false },
    setupOtpAttempts: { type: Number, default: 0, select: false },
    status: {
        type: String,
        enum: ['pending_verification', 'pending', 'approved', 'rejected'],
        default: 'pending_verification',
    },
}, { timestamps: true });

module.exports = mongoose.model('Camp', campSchema);
