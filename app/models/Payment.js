const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: {
        type: String,
        enum: ['subscription', 'request_boost', 'donor_verification', 'camp_donor_directory', 'camp_unlock_donor', 'camp_unlock_bloodbank'],
        required: true,
        index: true,
    },
    plan: { type: String, enum: ['premium', 'pro', 'advanced', null], default: null },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
        type: String,
        enum: ['created', 'paid', 'failed', 'refunded'],
        default: 'created',
        index: true,
    },
    orderId: { type: String, required: true, unique: true },
    // Omit until Razorpay returns pay_xxx — do not default to null (breaks sparse unique index).
    paymentId: { type: String, unique: true, sparse: true },
    signature: { type: String },
    receipt: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    paidAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
