const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema({
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

module.exports = mongoose.model('RazorpayWebhookEvent', webhookEventSchema);
