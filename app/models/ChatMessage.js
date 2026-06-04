const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
    {
        conversationId: { type: String, required: true, index: true },

        fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

        fromRole: { type: String, enum: ['user', 'donor', 'bloodbank'], required: true },
        toRole: { type: String, enum: ['user', 'donor', 'bloodbank'], required: true },

        message: { type: String, required: true, maxlength: 2000 },
    },
    { timestamps: true }
);

chatMessageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);

