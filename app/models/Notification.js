const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
        type: String,
        enum: ['request', 'match', 'approval', 'contact', 'message', 'received', 'system'],
        default: 'system',
    },
    city: { type: String, default: null },
    roles: [{ type: String, enum: ['user', 'donor', 'bloodbank', 'admin', 'camp'] }],
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    link: { type: String, default: '/dashboard' },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

notificationSchema.index({ city: 1, createdAt: -1 });
notificationSchema.index({ roles: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
