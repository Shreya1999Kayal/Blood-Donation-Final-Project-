const Camp = require('../models/Camp');
const CampEvent = require('../models/CampEvent');
const BloodBank = require('../models/BloodBank');
const User = require('../models/User');
const { parseCoordinates } = require('../utils/sanitizeGeo');
const { createNotification } = require('../services/notificationService');
const { notifyCampEventStatusChange } = require('../services/campService');
const {
    generateOtpCode,
    hashOtp,
    verifyOtpHash,
    getOtpExpiry,
    isOtpExpired,
    MAX_OTP_ATTEMPTS,
} = require('../utils/otp');
const { sendOtpEmail } = require('../services/emailService');
const { INDIAN_STATES, ORGANIZATION_TYPES, districtsForState, DISTRICTS_BY_STATE } = require('../config/indiaLocations');

async function loadSetupContext(userId) {
    const approvedBanks = await BloodBank.find({ status: 'approved' })
        .populate('userId', 'name city')
        .sort({ hospitalName: 1 })
        .lean();
    return {
        states: INDIAN_STATES,
        organizationTypes: ORGANIZATION_TYPES,
        approvedBloodBanks: approvedBanks,
        districtsForState,
        districtsByState: DISTRICTS_BY_STATE,
    };
}

async function showSetup(req, res) {
    const existing = await Camp.findOne({ userId: req.user._id });
    const allowEdit = req.query.edit === '1';

    if (existing) {
        if (existing.status === 'approved' || existing.status === 'pending') {
            return res.redirect('/dashboard');
        }
        if (existing.status === 'pending_verification' && !allowEdit) {
            return res.redirect('/camp/verify-setup');
        }
    }

    const ctx = await loadSetupContext(req.user._id);
    res.render('camp-setup', { user: req.user, error: null, campProfile: existing, ...ctx });
}

async function submitSetup(req, res) {
    try {
        const existing = await Camp.findOne({ userId: req.user._id });
        if (existing && (existing.status === 'approved' || existing.status === 'pending')) {
            return res.redirect('/dashboard');
        }

        const body = req.body;
        const coordinates = parseCoordinates(body.longitude, body.latitude);
        const linkedBloodBankId = (body.linkedBloodBankId || '').trim() || null;

        let camp = existing;
        if (!camp) {
            camp = new Camp({ userId: req.user._id });
        }

        camp.organizationType = body.organizationType;
        camp.organizationName = body.organizationName;
        camp.organizerName = body.organizerName;
        camp.organizerMobile = body.organizerMobile;
        camp.organizerEmail = body.organizerEmail.toLowerCase().trim();
        camp.coOrganizerName = body.coOrganizerName || '';
        camp.coOrganizerMobile = body.coOrganizerMobile || '';
        camp.status = 'pending_verification';
        camp.mobileVerified = false;

        const otp = generateOtpCode();
        camp.setupOtpHash = await hashOtp(otp);
        camp.setupOtpExpiresAt = getOtpExpiry();
        camp.setupOtpAttempts = 0;
        await camp.save();

        await CampEvent.findOneAndDelete({ campId: camp._id, status: 'scheduled' });
        await CampEvent.create({
            campId: camp._id,
            userId: req.user._id,
            campName: body.campName,
            campAddress: body.campAddress,
            state: body.state,
            district: body.district,
            city: body.city,
            linkedBloodBankId: linkedBloodBankId || undefined,
            proposedDate: new Date(body.proposedDate),
            startTime: body.startTime,
            endTime: body.endTime,
            location: { type: 'Point', coordinates },
            estimatedParticipants: Number(body.estimatedParticipants),
            referenceSupporter: body.referenceSupporter || '',
            remarks: body.remarks || '',
            status: 'scheduled',
        });

        await sendOtpEmail(camp.organizerEmail, otp, camp.organizerName);

        return res.redirect('/camp/verify-setup?sent=1');
    } catch (error) {
        console.error('Camp setup error:', error);
        const ctx = await loadSetupContext(req.user._id);
        return res.render('camp-setup', {
            user: req.user,
            error: 'Could not submit camp registration. Please check all fields and try again.',
            ...ctx,
        });
    }
}

async function showVerifySetup(req, res) {
    const camp = await Camp.findOne({ userId: req.user._id });
    if (!camp) return res.redirect('/camp/setup');
    if (camp.status !== 'pending_verification') return res.redirect('/dashboard');

    res.render('camp-verify-setup', {
        user: req.user,
        camp,
        sent: req.query.sent === '1',
        error: req.query.error ? decodeURIComponent(req.query.error) : null,
    });
}

async function verifySetupOtp(req, res) {
    try {
        const camp = await Camp.findOne({ userId: req.user._id })
            .select('+setupOtpHash +setupOtpExpiresAt +setupOtpAttempts');
        if (!camp) return res.redirect('/camp/setup');
        if (camp.status !== 'pending_verification') return res.redirect('/dashboard');

        const { otp } = req.body;
        if (camp.setupOtpAttempts >= MAX_OTP_ATTEMPTS) {
            return res.redirect(`/camp/verify-setup?error=${encodeURIComponent('Too many attempts. Resubmit camp registration.')}`);
        }
        if (isOtpExpired(camp.setupOtpExpiresAt)) {
            return res.redirect(`/camp/verify-setup?error=${encodeURIComponent('OTP expired. Resubmit camp registration.')}`);
        }

        const valid = await verifyOtpHash(otp.trim(), camp.setupOtpHash);
        if (!valid) {
            camp.setupOtpAttempts += 1;
            await camp.save();
            return res.redirect(`/camp/verify-setup?error=${encodeURIComponent('Invalid OTP. Try again.')}`);
        }

        camp.mobileVerified = true;
        camp.status = 'pending';
        camp.setupOtpHash = undefined;
        camp.setupOtpExpiresAt = undefined;
        camp.setupOtpAttempts = 0;
        await camp.save();

        await createNotification(req, {
            title: 'New camp organization registration',
            message: `${camp.organizationName} submitted a blood donation camp profile for admin review.`,
            type: 'approval',
            roles: ['admin'],
            link: '/dashboard#section-camps',
        });

        return res.redirect('/dashboard?msg=camp_submitted');
    } catch (error) {
        console.error('Camp verify setup error:', error);
        return res.redirect(`/camp/verify-setup?error=${encodeURIComponent('Verification failed')}`);
    }
}

async function createEvent(req, res) {
    try {
        const camp = await Camp.findOne({ userId: req.user._id, status: 'approved' });
        if (!camp) return res.redirect('/dashboard?error=camp_not_approved');

        const body = req.body;
        const coordinates = parseCoordinates(body.longitude, body.latitude);

        await CampEvent.create({
            campId: camp._id,
            userId: req.user._id,
            campName: body.campName,
            campAddress: body.campAddress,
            state: body.state,
            district: body.district,
            city: body.city,
            linkedBloodBankId: body.linkedBloodBankId || undefined,
            proposedDate: new Date(body.proposedDate),
            startTime: body.startTime,
            endTime: body.endTime,
            location: { type: 'Point', coordinates },
            estimatedParticipants: Number(body.estimatedParticipants),
            referenceSupporter: body.referenceSupporter || '',
            remarks: body.remarks || '',
            status: 'scheduled',
        });

        res.redirect('/dashboard?msg=camp_event_created#section-organize');
    } catch (error) {
        res.redirect('/dashboard?error=camp_event_failed#section-organize');
    }
}

async function completeEvent(req, res) {
    try {
        const event = await CampEvent.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });
        if (!event) return res.redirect('/dashboard?error=event_not_found#section-history');
        if (event.status !== 'scheduled') {
            return res.redirect('/dashboard?error=event_not_scheduled#section-history');
        }
        event.status = 'completed';
        await event.save();

        const campProfile = await Camp.findOne({ userId: req.user._id }).lean();
        await notifyCampEventStatusChange(req, event, campProfile, 'completed');

        res.redirect('/dashboard?msg=camp_event_completed#section-history');
    } catch (error) {
        res.redirect('/dashboard?error=event_update_failed#section-history');
    }
}

async function cancelEvent(req, res) {
    try {
        const event = await CampEvent.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });
        if (!event) return res.redirect('/dashboard?error=event_not_found#section-history');
        if (event.status !== 'scheduled') {
            return res.redirect('/dashboard?error=event_not_scheduled#section-history');
        }
        event.status = 'cancelled';
        await event.save();

        const campProfile = await Camp.findOne({ userId: req.user._id }).lean();
        await notifyCampEventStatusChange(req, event, campProfile, 'cancelled');

        res.redirect('/dashboard?msg=camp_event_cancelled#section-history');
    } catch (error) {
        res.redirect('/dashboard?error=event_update_failed#section-history');
    }
}

module.exports = {
    showSetup,
    submitSetup,
    showVerifySetup,
    verifySetupOtp,
    createEvent,
    completeEvent,
    cancelEvent,
    loadSetupContext,
};
