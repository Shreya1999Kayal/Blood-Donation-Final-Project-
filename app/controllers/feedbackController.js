const { fileToPublicUrl } = require('../utils/upload');
const feedbackService = require('../services/feedbackService');

async function submit(req, res) {
    try {
        const photoUrls = [];
        const file = req.files?.photos?.[0];

        if (file) {
            const url = await fileToPublicUrl(file);
            if (url) photoUrls.push(url);
        }

        await feedbackService.createFeedback({
            authorId: req.user._id,
            authorRole: req.user.role,
            rating: req.body.rating,
            category: req.body.category,
            reviewText: req.body.reviewText,
            photoUrls,
        });

        return res.redirect('/dashboard?msg=feedback_submitted#section-feedback');
    } catch (error) {
        console.error('Feedback submit failed:', error);
        return res.redirect('/dashboard?error=feedback_submit_failed#section-feedback');
    }
}

async function publishFeedback(req, res) {
    try {
        const updated = await feedbackService.updateFeedbackStatus(req.params.id, 'published');
        if (!updated) {
            return res.redirect('/dashboard?error=feedback_not_found#section-feedback');
        }
        return res.redirect('/dashboard?msg=feedback_published#section-feedback');
    } catch (error) {
        console.error('Feedback publish failed:', error);
        return res.redirect('/dashboard?error=feedback_update_failed#section-feedback');
    }
}

async function hideFeedback(req, res) {
    try {
        const updated = await feedbackService.updateFeedbackStatus(req.params.id, 'hidden');
        if (!updated) {
            return res.redirect('/dashboard?error=feedback_not_found#section-feedback');
        }
        return res.redirect('/dashboard?msg=feedback_hidden#section-feedback');
    } catch (error) {
        console.error('Feedback hide failed:', error);
        return res.redirect('/dashboard?error=feedback_update_failed#section-feedback');
    }
}

module.exports = {
    submit,
    publishFeedback,
    hideFeedback,
};
