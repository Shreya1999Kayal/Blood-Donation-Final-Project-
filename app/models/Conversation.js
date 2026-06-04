const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
    {
        participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
        /** Stable unique key: sorted participant ids joined by ":" */
        participantsKey: { type: String, required: true, unique: true, index: true },
        lastMessage: {
            text: { type: String, default: '' },
            from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            at: { type: Date, default: null },
        },
    },
    { timestamps: true }
);

conversationSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);

