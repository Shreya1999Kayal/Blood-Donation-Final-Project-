const mongoose = require('mongoose');
const {
    sendParticipationRequest,
    respondToParticipationRequest,
} = require('../services/campService');

async function sendDonorRequest(req, res) {
    try {
        const targetUserId = (req.body.targetUserId || '').toString();
        const targetProfileId = (req.body.targetProfileId || '').toString();
        if (!mongoose.Types.ObjectId.isValid(targetUserId) || !mongoose.Types.ObjectId.isValid(targetProfileId)) {
            return res.redirect('/dashboard?error=invalid_donor#section-donors');
        }
        await sendParticipationRequest(req, req.user._id, {
            targetType: 'donor',
            targetUserId,
            targetProfileId,
        });
        return res.redirect('/dashboard?msg=camp_request_sent#section-donors');
    } catch (error) {
        const code = encodeURIComponent(error.message || 'Could not send request');
        return res.redirect(`/dashboard?error=${code}#section-donors`);
    }
}

async function sendBloodBankRequest(req, res) {
    try {
        const targetUserId = (req.body.targetUserId || '').toString();
        const targetProfileId = (req.body.targetProfileId || '').toString();
        if (!mongoose.Types.ObjectId.isValid(targetUserId) || !mongoose.Types.ObjectId.isValid(targetProfileId)) {
            return res.redirect('/dashboard?error=invalid_bloodbank#section-bloodbanks');
        }
        await sendParticipationRequest(req, req.user._id, {
            targetType: 'bloodbank',
            targetUserId,
            targetProfileId,
        });
        return res.redirect('/dashboard?msg=camp_request_sent#section-bloodbanks');
    } catch (error) {
        const code = encodeURIComponent(error.message || 'Could not send request');
        return res.redirect(`/dashboard?error=${code}#section-bloodbanks`);
    }
}

async function acceptRequest(req, res) {
    try {
        await respondToParticipationRequest(req, req.params.id, req.user._id, 'accepted');
        const hash = req.user.role === 'bloodbank' ? '#section-notifications' : '#section-notifications';
        return res.redirect(`/dashboard?msg=camp_request_accepted${hash}`);
    } catch (error) {
        return res.redirect(`/dashboard?error=${encodeURIComponent(error.message || 'Failed')}${req.user.role === 'bloodbank' ? '#section-notifications' : '#section-notifications'}`);
    }
}

async function rejectRequest(req, res) {
    try {
        await respondToParticipationRequest(req, req.params.id, req.user._id, 'rejected');
        return res.redirect('/dashboard?msg=camp_request_rejected#section-notifications');
    } catch (error) {
        return res.redirect(`/dashboard?error=${encodeURIComponent(error.message || 'Failed')}#section-notifications`);
    }
}

module.exports = {
    sendDonorRequest,
    sendBloodBankRequest,
    acceptRequest,
    rejectRequest,
};
