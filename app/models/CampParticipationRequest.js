const mongoose = require('mongoose');

const campParticipationRequestSchema = new mongoose.Schema({
    campUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    campId: { type: mongoose.Schema.Types.ObjectId, ref: 'Camp', required: true },
    campEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampEvent', required: true },
    targetType: { type: String, enum: ['donor', 'bloodbank'], required: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetProfileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    campName: { type: String, required: true },
    campDate: { type: Date, default: null },
    campCity: { type: String, default: '' },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
        index: true,
    },
    message: { type: String, default: '' },
    respondedAt: { type: Date, default: null },
}, { timestamps: true });

campParticipationRequestSchema.index(
    { campUserId: 1, targetUserId: 1, campEventId: 1 },
    { unique: true }
);

module.exports = mongoose.model('CampParticipationRequest', campParticipationRequestSchema);
