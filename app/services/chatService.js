const Donor = require('../models/Donor');
const BloodBank = require('../models/BloodBank');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { isCampApproved, hasDonorContactUnlock, hasBloodBankContactUnlock } = require('./campService');

function conversationKey(userAId, userBId) {
    return [userAId.toString(), userBId.toString()].sort().join(':');
}

async function findExistingConversation(userAId, userBId) {
    return Conversation.findOne({ participantsKey: conversationKey(userAId, userBId) }).select('_id').lean();
}

async function isApprovedProvider(user) {
    if (!user) return false;
    if (user.role === 'donor') {
        const donor = await Donor.findOne({ userId: user._id, status: 'approved' }).select('_id');
        return !!donor;
    }
    if (user.role === 'bloodbank') {
        const bank = await BloodBank.findOne({ userId: user._id, status: 'approved' }).select('_id');
        return !!bank;
    }
    return false;
}

async function isVerifiedAccount(user) {
    if (!user) return false;
    if (user.role === 'user') return true;
    if (user.role === 'camp') {
        return isCampApproved(user._id);
    }
    return isApprovedProvider(user);
}

/**
 * Chat rules:
 * - Patients ↔ verified donors/blood banks (existing rules)
 * - Camps ↔ donors/blood banks after admin approval + contact unlock payment
 * - Camps cannot chat with patients
 * - Donors/blood banks cannot initiate chats with camps
 */
async function canUsersChat(a, b) {
    if (!a || !b) return { ok: false, reason: 'Missing user' };
    if (!a.emailVerified || !b.emailVerified) {
        return { ok: false, reason: 'Both users must verify their email before chatting' };
    }
    if (a._id.toString() === b._id.toString()) {
        return { ok: false, reason: 'Cannot chat with yourself' };
    }

    const aIsPatient = a.role === 'user';
    const bIsPatient = b.role === 'user';
    const aIsCamp = a.role === 'camp';
    const bIsCamp = b.role === 'camp';
    const aIsProvider = a.role === 'donor' || a.role === 'bloodbank';
    const bIsProvider = b.role === 'donor' || b.role === 'bloodbank';

    if (a.role === 'admin' || b.role === 'admin') {
        return { ok: false, reason: 'Admin accounts cannot use chat' };
    }

    if ((aIsCamp && bIsPatient) || (bIsCamp && aIsPatient)) {
        return { ok: false, reason: 'Blood donation camps cannot chat with patients' };
    }

    const existing = await findExistingConversation(a._id, b._id);

    if (aIsCamp || bIsCamp) {
        const campUser = aIsCamp ? a : b;
        const other = aIsCamp ? b : a;
        if (!(await isCampApproved(campUser._id))) {
            return { ok: false, reason: 'Your camp organization must be approved by admin before chatting' };
        }
        if (other.role !== 'donor' && other.role !== 'bloodbank') {
            return { ok: false, reason: 'Camps can only chat with donors or blood banks' };
        }
        if (existing) {
            return { ok: true };
        }
        if (aIsCamp && bIsProvider) {
            const unlocked = other.role === 'bloodbank'
                ? await hasBloodBankContactUnlock(a._id, b._id)
                : await hasDonorContactUnlock(a._id, b._id);
            if (!unlocked) {
                return { ok: false, reason: 'Pay the contact unlock fee before starting a chat with this donor or blood bank' };
            }
            return { ok: true };
        }
        return { ok: false, reason: 'Donors and blood banks cannot start chats with camps. Wait for the camp to unlock your contact.' };
    }

    if (aIsProvider && bIsProvider) {
        return { ok: false, reason: 'Donors and blood banks cannot chat with each other' };
    }
    if (!(aIsPatient && bIsProvider) && !(bIsPatient && aIsProvider)) {
        return { ok: false, reason: 'Only patients can chat with donors or blood banks' };
    }

    if (existing) {
        return { ok: true };
    }

    const provider = aIsProvider ? a : b;
    const patient = aIsPatient ? a : b;

    if (patient.role !== 'user') {
        return { ok: false, reason: 'Chat partner must be a registered patient account' };
    }

    const providerApproved = await isApprovedProvider(provider);
    if (!providerApproved) {
        const label = provider.role === 'bloodbank' ? 'blood bank' : 'donor';
        return {
            ok: false,
            reason: `Your ${label} account must be approved by admin before starting new chats with patients`,
        };
    }

    return { ok: true };
}

async function getLatestMessagesByConversation(conversationIds) {
    if (!conversationIds.length) return {};

    const rows = await Message.aggregate([
        { $match: { conversationId: { $in: conversationIds } } },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: '$conversationId',
                text: { $first: '$text' },
                from: { $first: '$from' },
                at: { $first: '$createdAt' },
            },
        },
    ]);

    const byId = {};
    rows.forEach((row) => {
        byId[row._id.toString()] = {
            text: row.text,
            from: row.from,
            at: row.at,
        };
    });
    return byId;
}

async function getInboxForUser(userId, options = {}) {
    const role = options.role || 'all';
    const when = options.when || 'all';
    const requireMessages = options.requireMessages === true;
    const search = (options.search || '').trim().toLowerCase();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let conversations = await Conversation.find({ participants: userId })
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();

    const latestByConvo = await getLatestMessagesByConversation(conversations.map((c) => c._id));

    conversations = conversations
        .map((c) => {
            const cid = c._id.toString();
            const stored = c.lastMessage && c.lastMessage.text ? c.lastMessage : null;
            const latest = latestByConvo[cid] || null;
            if (requireMessages && !latest && !stored?.text) {
                return null;
            }
            const lastMessage = stored?.text
                ? stored
                : latest
                    ? { text: latest.text, from: latest.from, at: latest.at }
                    : null;
            const activityAt = lastMessage?.at || c.updatedAt;
            return {
                ...c,
                lastMessage,
                updatedAt: activityAt,
            };
        })
        .filter(Boolean);

    if (when === 'today') {
        conversations = conversations.filter((c) => c.updatedAt && new Date(c.updatedAt) >= todayStart);
    }

    const otherUserIds = conversations
        .map((c) => c.participants.map((p) => p.toString()).find((id) => id !== userId.toString()))
        .filter(Boolean);

    const users = await User.find({ _id: { $in: otherUserIds } })
        .select('name role city phone profileImage')
        .lean();
    const byId = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    let items = conversations.map((c) => {
        const otherId = c.participants.map((p) => p.toString()).find((id) => id !== userId.toString());
        const otherUser = byId[otherId] || { _id: otherId, name: 'User', role: 'unknown' };
        return {
            id: c._id,
            otherUser,
            lastMessage: c.lastMessage || null,
            updatedAt: c.updatedAt,
        };
    });

    if (options.viewerRole === 'donor') {
        items = items.filter((item) => item.otherUser?.role === 'user');
    }

    if (role === 'donor') {
        items = items.filter((item) => item.otherUser?.role === 'donor');
    } else if (role === 'bloodbank') {
        items = items.filter((item) => item.otherUser?.role === 'bloodbank');
    }

    if (search) {
        items = items.filter((item) => {
            const other = item.otherUser || {};
            const preview = item.lastMessage?.text || '';
            const haystack = [other.name, other.city, other.phone, other.role, preview]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(search);
        });
    }

    items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    return items;
}

module.exports = { isVerifiedAccount, canUsersChat, getInboxForUser };
