const Donor = require('../models/Donor');
const BloodBank = require('../models/BloodBank');
const Camp = require('../models/Camp');
const CampContactUnlock = require('../models/CampContactUnlock');
const CampParticipationRequest = require('../models/CampParticipationRequest');
const CampEvent = require('../models/CampEvent');
const Payment = require('../models/Payment');
const { USER_POPULATE_FIELDS, isEligibleDonor, eligibleDonorQuery } = require('./matchingService');
const { createNotification } = require('./notificationService');
const { citiesMatch } = require('../utils/city');

const CAMP_UNLOCK_FEES = {
    donorDirectory: 500,
    donorContact: 5,
    bloodbank: 1000,
};

async function getCampProfile(userId) {
    return Camp.findOne({ userId }).lean();
}

async function isCampApproved(userId) {
    const camp = await Camp.findOne({ userId, status: 'approved' }).select('_id');
    return !!camp;
}

async function hasDonorDirectoryAccess(campUserId) {
    const paid = await Payment.findOne({
        userId: campUserId,
        purpose: 'camp_donor_directory',
        status: 'paid',
    }).select('_id');
    return !!paid;
}

async function getApprovedDonorCount() {
    return Donor.countDocuments(eligibleDonorQuery());
}

async function getUnlockMap(campUserId) {
    const unlocks = await CampContactUnlock.find({ campUserId }).lean();
    const byUserId = {};
    unlocks.forEach((u) => {
        byUserId[u.targetUserId.toString()] = u;
    });
    return byUserId;
}

function maskField(value, minStars = 4) {
    if (value === null || value === undefined) return '—';
    const s = String(value).trim();
    if (!s) return '—';
    if (s.length <= 2) {
        return s.charAt(0) + '*'.repeat(Math.max(2, s.length));
    }
    const visible = s.slice(0, 2);
    const starCount = Math.max(minStars, s.length - 2);
    return visible + '*'.repeat(starCount);
}

function maskDonorForCamp(donor, user, unlocked, directoryAccess) {
    const contactOpen = !!unlocked || !!directoryAccess;
    const base = {
        _id: donor._id,
        userId: user?._id,
        bloodGroup: donor.bloodGroup,
        city: user?.city || '',
        status: donor.status,
        isAvailable: donor.isAvailable,
        eligible: isEligibleDonor(donor),
        unlocked: contactOpen,
    };
    if (contactOpen && user) {
        return {
            ...base,
            name: user.name,
            phone: user.phone,
            email: user.email,
            profileImage: user.profileImage,
            chatUserId: user._id,
        };
    }
    return {
        ...base,
        name: maskField(user?.name || 'Donor'),
        bloodGroup: maskField(donor.bloodGroup, 3),
        city: maskField(user?.city),
        phone: maskField('0000000000'),
        email: maskField('user@email.com'),
        profileImage: user?.profileImage,
    };
}

function maskBloodBankForCamp(bloodbank, user, unlocked) {
    const base = {
        _id: bloodbank._id,
        userId: user?._id,
        hospitalName: bloodbank.hospitalName,
        city: user?.city || '',
        status: bloodbank.status,
        inventory: bloodbank.inventory,
        unlocked: !!unlocked,
    };
    if (unlocked && user) {
        return {
            ...base,
            organizerName: user.name,
            phone: user.phone,
            email: user.email,
            profileImage: user.profileImage,
            chatUserId: user._id,
        };
    }
    return {
        ...base,
        organizerName: 'Blood bank',
        phone: null,
        email: null,
        profileImage: user?.profileImage,
    };
}

async function getParticipationRequestMap(campUserId) {
    const requests = await CampParticipationRequest.find({ campUserId })
        .sort({ updatedAt: -1 })
        .lean();
    const byTarget = {};
    requests.forEach((r) => {
        const key = r.targetUserId.toString();
        if (!byTarget[key]) byTarget[key] = r;
    });
    return byTarget;
}

async function getLatestScheduledCampEvent(campUserId) {
    return CampEvent.findOne({ userId: campUserId, status: 'scheduled' })
        .sort({ proposedDate: 1 })
        .lean();
}

function attachParticipationMeta(entry, requestMap, uid) {
    const reqDoc = requestMap[uid] || null;
    return {
        ...entry,
        campRequestId: reqDoc?._id || null,
        campRequestStatus: reqDoc?.status || null,
        campRequestCampName: reqDoc?.campName || null,
    };
}

async function getDonorDirectoryForCamp(campUserId) {
    const directoryAccess = await hasDonorDirectoryAccess(campUserId);
    const unlockMap = await getUnlockMap(campUserId);
    const requestMap = await getParticipationRequestMap(campUserId);
    const donors = await Donor.find(eligibleDonorQuery())
        .populate('userId', USER_POPULATE_FIELDS)
        .sort({ updatedAt: -1 })
        .lean();
    return donors.map((d) => {
        const user = d.userId || {};
        const uid = user._id ? user._id.toString() : '';
        const unlocked = !!unlockMap[uid];
        return attachParticipationMeta(
            maskDonorForCamp(d, user, unlocked, directoryAccess),
            requestMap,
            uid
        );
    });
}

async function getBloodBankDirectoryForCamp(campUserId) {
    const unlockMap = await getUnlockMap(campUserId);
    const requestMap = await getParticipationRequestMap(campUserId);
    const banks = await BloodBank.find({ status: 'approved' })
        .populate('userId', USER_POPULATE_FIELDS)
        .sort({ updatedAt: -1 })
        .lean();
    return banks.map((b) => {
        const user = b.userId || {};
        const uid = user._id ? user._id.toString() : '';
        const unlock = unlockMap[uid];
        const unlocked = !!(unlock && unlock.targetType === 'bloodbank');
        return attachParticipationMeta(
            maskBloodBankForCamp(b, user, unlocked),
            requestMap,
            uid
        );
    });
}

async function hasDonorContactUnlock(campUserId, targetUserId) {
    if (await hasDonorDirectoryAccess(campUserId)) return true;
    const unlock = await CampContactUnlock.findOne({
        campUserId,
        targetUserId,
        targetType: 'donor',
    }).select('_id');
    return !!unlock;
}

async function hasBloodBankContactUnlock(campUserId, targetUserId) {
    const unlock = await CampContactUnlock.findOne({
        campUserId,
        targetUserId,
        targetType: 'bloodbank',
    }).select('_id');
    return !!unlock;
}

/** @deprecated Prefer hasDonorContactUnlock / hasBloodBankContactUnlock */
async function hasContactUnlock(campUserId, targetUserId, targetType) {
    if (targetType === 'bloodbank') return hasBloodBankContactUnlock(campUserId, targetUserId);
    if (targetType === 'donor') return hasDonorContactUnlock(campUserId, targetUserId);
    return hasDonorContactUnlock(campUserId, targetUserId)
        || hasBloodBankContactUnlock(campUserId, targetUserId);
}

async function recordContactUnlock(campUserId, targetType, targetUserId, targetProfileId, paymentId) {
    return CampContactUnlock.findOneAndUpdate(
        { campUserId, targetUserId },
        {
            campUserId,
            targetType,
            targetUserId,
            targetProfileId,
            paymentId,
            unlockedAt: new Date(),
        },
        { upsert: true, new: true }
    );
}

async function getCampPaymentHistory(campUserId) {
    const payments = await Payment.find({
        userId: campUserId,
        purpose: { $in: ['camp_donor_directory', 'camp_unlock_donor', 'camp_unlock_bloodbank'] },
    })
        .sort({ paidAt: -1, createdAt: -1 })
        .limit(100)
        .lean();

    const donorProfileIds = [];
    const bankProfileIds = [];
    payments.forEach((p) => {
        const profileId = p.metadata?.targetProfileId?.toString();
        if (!profileId) return;
        if (p.purpose === 'camp_unlock_donor') donorProfileIds.push(profileId);
        if (p.purpose === 'camp_unlock_bloodbank') bankProfileIds.push(profileId);
    });

    const [donors, banks] = await Promise.all([
        donorProfileIds.length
            ? Donor.find({ _id: { $in: donorProfileIds } }).populate('userId', 'name').lean()
            : [],
        bankProfileIds.length
            ? BloodBank.find({ _id: { $in: bankProfileIds } }).select('hospitalName').lean()
            : [],
    ]);

    const donorById = Object.fromEntries(donors.map((d) => [d._id.toString(), d]));
    const bankById = Object.fromEntries(banks.map((b) => [b._id.toString(), b]));

    return payments.map((p) => {
        const meta = p.metadata || {};
        const profileId = meta.targetProfileId?.toString();
        const isDonor = p.purpose === 'camp_unlock_donor';
        let targetLabel = '—';
        if (p.purpose === 'camp_donor_directory') {
            targetLabel = 'Full donor directory';
        } else if (isDonor && profileId && donorById[profileId]) {
            const d = donorById[profileId];
            targetLabel = `${d.userId?.name || 'Donor'} · ${d.bloodGroup || ''}`.trim();
        } else if (!isDonor && profileId && bankById[profileId]) {
            targetLabel = bankById[profileId].hospitalName;
        }

        let purposeLabel = 'Payment';
        if (p.purpose === 'camp_donor_directory') purposeLabel = 'Donor directory access';
        else if (isDonor) purposeLabel = 'Donor contact unlock';
        else purposeLabel = 'Blood bank contact unlock';

        return {
            _id: p._id,
            purpose: p.purpose,
            purposeLabel,
            targetType: p.purpose === 'camp_donor_directory' ? 'directory' : (isDonor ? 'donor' : 'bloodbank'),
            targetLabel,
            amount: p.amount,
            currency: p.currency || 'INR',
            status: p.status,
            orderId: p.orderId,
            paymentId: p.paymentId || null,
            paidAt: p.paidAt,
            createdAt: p.createdAt,
        };
    });
}

async function getCampPaymentSummary(campUserId) {
    const paid = await Payment.find({
        userId: campUserId,
        purpose: { $in: ['camp_donor_directory', 'camp_unlock_donor', 'camp_unlock_bloodbank'] },
        status: 'paid',
    }).select('amount purpose').lean();

    const totalSpent = paid.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const donorUnlocks = paid.filter((p) => p.purpose === 'camp_unlock_donor').length;
    const bankUnlocks = paid.filter((p) => p.purpose === 'camp_unlock_bloodbank').length;
    const directoryUnlocked = paid.some((p) => p.purpose === 'camp_donor_directory');

    return { totalSpent, donorUnlocks, bankUnlocks, directoryUnlocked, transactionCount: paid.length };
}

async function getPendingParticipationRequestsForUser(targetUserId) {
    return CampParticipationRequest.find({
        targetUserId,
        status: 'pending',
    })
        .populate('campId', 'organizationName organizerName')
        .populate('campUserId', 'name city')
        .sort({ createdAt: -1 })
        .lean();
}

async function sendParticipationRequest(req, campUserId, { targetType, targetUserId, targetProfileId }) {
    const camp = await Camp.findOne({ userId: campUserId, status: 'approved' });
    if (!camp) throw new Error('Camp organization must be approved');

    const event = await getLatestScheduledCampEvent(campUserId);
    if (!event) throw new Error('Schedule a camp event first under Organize camp');

    if (targetType === 'donor') {
        if (!(await hasDonorContactUnlock(campUserId, targetUserId))) {
            throw new Error('Pay ₹5 to unlock this donor contact before sending a camp request');
        }
        const donor = await Donor.findById(targetProfileId).populate('userId', '_id');
        if (!donor || !isEligibleDonor(donor) || donor.userId?._id?.toString() !== targetUserId) {
            throw new Error('This donor is not verified, available, and eligible for camp participation');
        }
    } else {
        if (!(await hasBloodBankContactUnlock(campUserId, targetUserId))) {
            throw new Error(`Pay ₹${CAMP_UNLOCK_FEES.bloodbank} to unlock this blood bank contact before sending a camp request`);
        }
        const bank = await BloodBank.findById(targetProfileId).populate('userId', '_id');
        if (!bank || bank.status !== 'approved' || bank.userId?._id?.toString() !== targetUserId) {
            throw new Error('Invalid blood bank selected');
        }
    }

    let request = await CampParticipationRequest.findOne({
        campUserId,
        targetUserId,
        campEventId: event._id,
    });

    if (request?.status === 'pending') throw new Error('Request already pending');
    if (request?.status === 'accepted') throw new Error('Participation already accepted');

    const campDate = event.proposedDate ? new Date(event.proposedDate) : null;
    const dateLabel = campDate
        ? campDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })
        : 'the scheduled date';

    if (request?.status === 'rejected') {
        request.status = 'pending';
        request.respondedAt = null;
        request.message = '';
        await request.save();
    } else if (!request) {
        request = await CampParticipationRequest.create({
            campUserId,
            campId: camp._id,
            campEventId: event._id,
            targetType,
            targetUserId,
            targetProfileId,
            campName: event.campName,
            campDate,
            campCity: event.city || '',
            status: 'pending',
        });
    }

    const targetUser = await User.findById(targetUserId).select('name role');
    const inviteTitle = targetType === 'donor'
        ? `Blood camp invitation — ${event.campName}`
        : `Camp blood collection request — ${event.campName}`;
    const inviteMessage = targetType === 'donor'
        ? `${camp.organizationName} invited you to donate blood at camp "${event.campName}" on ${dateLabel} in ${event.city}. Accept to participate or decline to opt out.`
        : `${camp.organizationName} requests your blood bank to receive units collected at camp "${event.campName}" on ${dateLabel} in ${event.city}. Accept to coordinate collection or decline to reject.`;

    await createNotification(req, {
        title: inviteTitle,
        message: inviteMessage,
        type: 'approval',
        userId: targetUserId,
        link: '/dashboard#section-notifications',
    });

    return request;
}

async function respondToParticipationRequest(req, requestId, responderUserId, decision) {
    if (!['accepted', 'rejected'].includes(decision)) {
        throw new Error('Invalid response');
    }

    const request = await CampParticipationRequest.findById(requestId);
    if (!request || request.targetUserId.toString() !== responderUserId.toString()) {
        throw new Error('Camp request not found');
    }
    if (request.status !== 'pending') {
        throw new Error('This request was already answered');
    }

    request.status = decision;
    request.respondedAt = new Date();
    await request.save();

    const camp = await Camp.findById(request.campId).lean();
    const responder = await User.findById(responderUserId).select('name role');
    const orgName = camp?.organizationName || 'Camp organization';
    const responderLabel = responder?.name || 'Contact';
    const accepted = decision === 'accepted';

    let campMessage;
    if (request.targetType === 'donor') {
        campMessage = accepted
            ? `${responderLabel} accepted your camp invitation and will donate blood at "${request.campName}".`
            : `${responderLabel} declined your camp invitation and will not participate in "${request.campName}".`;
    } else {
        campMessage = accepted
            ? `${responderLabel} accepted your request. Collected blood from "${request.campName}" can be sent to this blood bank.`
            : `${responderLabel} declined your camp blood collection request for "${request.campName}". Units will not be sent.`;
    }

    await createNotification(req, {
        title: accepted ? 'Camp request accepted' : 'Camp request declined',
        message: campMessage,
        type: 'system',
        userId: request.campUserId,
        link: request.targetType === 'donor' ? '/dashboard#section-donors' : '/dashboard#section-bloodbanks',
    });

    await createNotification(req, {
        title: accepted ? 'You accepted the camp request' : 'You declined the camp request',
        message: accepted
            ? `You confirmed participation with ${orgName} for camp "${request.campName}".`
            : `You opted out of camp "${request.campName}" organized by ${orgName}.`,
        type: 'system',
        userId: responderUserId,
        link: '/dashboard#section-notifications',
    });

    return request;
}

async function notifyCampEventStatusChange(req, event, campProfile, status) {
    const orgName = campProfile?.organizationName || 'Camp organization';
    const campName = event.campName || 'Blood donation camp';
    const dateStr = event.proposedDate
        ? new Date(event.proposedDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })
        : 'the scheduled date';
    const location = [event.city, event.district, event.state].filter(Boolean).join(', ') || 'your area';
    const isCompleted = status === 'completed';

    const title = isCompleted
        ? `Camp completed: ${campName}`
        : `Camp cancelled: ${campName}`;
    const message = isCompleted
        ? `${orgName} marked the blood donation camp "${campName}" on ${dateStr} in ${location} as completed.`
        : `${orgName} cancelled the blood donation camp "${campName}" that was scheduled for ${dateStr} in ${location}.`;

    const notifiedUserIds = new Set();

    async function notifyUser(userId) {
        const id = userId?.toString?.();
        if (!id || notifiedUserIds.has(id)) return;
        notifiedUserIds.add(id);
        await createNotification(req, {
            title,
            message,
            type: 'system',
            userId,
            link: '/dashboard',
        });
    }

    if (event.linkedBloodBankId) {
        const bank = await BloodBank.findById(event.linkedBloodBankId)
            .populate('userId', '_id')
            .select('userId hospitalName')
            .lean();
        if (bank?.userId?._id) {
            await notifyUser(bank.userId._id);
        }
    }

    const donors = await Donor.find({ status: 'approved' })
        .populate('userId', '_id city')
        .select('userId')
        .lean();

    await Promise.all(
        donors
            .filter((d) => d.userId?._id && citiesMatch(d.userId.city, event.city))
            .map((d) => notifyUser(d.userId._id))
    );
}

module.exports = {
    CAMP_UNLOCK_FEES,
    getCampProfile,
    isCampApproved,
    hasDonorDirectoryAccess,
    getApprovedDonorCount,
    getUnlockMap,
    getDonorDirectoryForCamp,
    getBloodBankDirectoryForCamp,
    hasDonorContactUnlock,
    hasBloodBankContactUnlock,
    hasContactUnlock,
    recordContactUnlock,
    getCampPaymentHistory,
    getCampPaymentSummary,
    notifyCampEventStatusChange,
    getPendingParticipationRequestsForUser,
    sendParticipationRequest,
    respondToParticipationRequest,
    getLatestScheduledCampEvent,
};
