const mongoose = require('mongoose');

const FEEDBACK_CATEGORIES = [
    'platform',
    'emergency_matching',
    'communication',
    'camp',
    'blood_bank',
    'medical_verification',
    'other',
];

const FEEDBACK_STATUSES = ['pending', 'published', 'hidden'];

const feedbackSchema = new mongoose.Schema({
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorRole: {
        type: String,
        enum: ['user', 'donor', 'bloodbank', 'camp'],
        required: true,
        index: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    category: { type: String, enum: FEEDBACK_CATEGORIES, required: true },
    reviewText: { type: String, required: true, trim: true, maxlength: 2000 },
    photoUrls: [{ type: String }],
    status: { type: String, enum: FEEDBACK_STATUSES, default: 'pending', index: true },
}, { timestamps: true });

feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
module.exports.FEEDBACK_CATEGORIES = FEEDBACK_CATEGORIES;
module.exports.FEEDBACK_STATUSES = FEEDBACK_STATUSES;
