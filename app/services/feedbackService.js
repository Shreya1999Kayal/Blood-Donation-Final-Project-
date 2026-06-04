const Feedback = require('../models/Feedback');

const ROLE_LABELS = {
    user: 'Patient',
    donor: 'Donor',
    bloodbank: 'Blood Bank',
    camp: 'Camp',
};

const CATEGORY_LABELS = {
    platform: 'RaktaSetu platform',
    emergency_matching: 'Emergency matching',
    communication: 'Messaging & coordination',
    camp: 'Donation camps',
    blood_bank: 'Blood bank services',
    medical_verification: 'Medical verification',
    other: 'Other',
};

async function createFeedback(payload) {
    return Feedback.create(payload);
}

async function getFeedbackByUser(userId, limit = 20) {
    return Feedback.find({ authorId: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
}

async function getAllFeedbackForAdmin() {
    return Feedback.find()
        .populate('authorId', 'name email role city profileImage')
        .sort({ createdAt: -1 })
        .lean();
}

async function getFeedbackStats() {
    const [totals, avgResult, pending] = await Promise.all([
        Feedback.countDocuments(),
        Feedback.aggregate([
            { $match: { status: { $ne: 'hidden' } } },
            { $group: { _id: null, avgRating: { $avg: '$rating' } } },
        ]),
        Feedback.countDocuments({ status: 'pending' }),
    ]);

    return {
        total: totals,
        pending,
        avgRating: avgResult[0]?.avgRating ? Number(avgResult[0].avgRating.toFixed(1)) : 0,
    };
}

async function updateFeedbackStatus(feedbackId, status) {
    return Feedback.findByIdAndUpdate(
        feedbackId,
        { status },
        { new: true, runValidators: true },
    );
}

module.exports = {
    createFeedback,
    getFeedbackByUser,
    getAllFeedbackForAdmin,
    getFeedbackStats,
    updateFeedbackStatus,
    ROLE_LABELS,
    CATEGORY_LABELS,
};
