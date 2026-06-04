const mongoose = require('mongoose');

const campContactUnlockSchema = new mongoose.Schema({
    campUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, enum: ['donor', 'bloodbank'], required: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetProfileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    unlockedAt: { type: Date, default: Date.now },
}, { timestamps: true });

campContactUnlockSchema.index({ campUserId: 1, targetType: 1, targetUserId: 1 }, { unique: true });

module.exports = mongoose.model('CampContactUnlock', campContactUnlockSchema);
