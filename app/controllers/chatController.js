const mongoose = require('mongoose');
const User = require('../models/User');
const BloodBank = require('../models/BloodBank');
const Donor = require('../models/Donor');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { canUsersChat, getInboxForUser } = require('../services/chatService');
const { fetchBloodRequestsForUser } = require('../utils/requestQueries');
const { getUserAnalytics } = require('../services/userAnalyticsService');

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

function conversationKey(a, b) {
    const ids = [a.toString(), b.toString()].sort();
    return ids.join(':');
}

async function ensureConversation(userId, otherUserId) {
    const key = conversationKey(userId, otherUserId);
    let convo = await Conversation.findOne({ participantsKey: key });
    if (!convo) {
        convo = await Conversation.create({
            participants: [userId, otherUserId],
            participantsKey: key,
        });
    }
    return convo;
}

async function showMessagesInbox(req, res) {
    const inbox = await getInboxForUser(req.user._id, { viewerRole: req.user.role });

    if (req.user.role === 'bloodbank') {
        const bloodbank = await BloodBank.findOne({ userId: req.user._id });
        return res.render('messages-bloodbank', { inbox, bloodbank, user: req.user });
    }

    if (req.user.role === 'user') {
        return res.redirect('/dashboard#section-messages');
    }

    if (req.user.role === 'donor') {
        const bloodRequests = await fetchBloodRequestsForUser(req.user);
        const donorProfile = await Donor.findOne({ userId: req.user._id });
        const userAnalytics = await getUserAnalytics(req.user);
        return res.render('messages-donor', { inbox, user: req.user, bloodRequests, donorProfile, userAnalytics });
    }

    if (req.user.role === 'camp') {
        return res.render('messages-camp', { inbox, user: req.user });
    }

    res.render('messages', { inbox });
}

async function showChat(req, res) {
    const { otherUserId } = req.params;
    if (!isValidObjectId(otherUserId)) return res.status(400).send('Invalid user id');

    const otherUser = await User.findById(otherUserId).select('name role emailVerified city phone profileImage');
    if (!otherUser) return res.status(404).send('User not found');

    const allowed = await canUsersChat(req.user, otherUser);
    if (!allowed.ok) return res.status(403).send(allowed.reason || 'Chat not allowed');

    const conversation = await ensureConversation(req.user._id, otherUser._id);
    const messages = await Message.find({ conversationId: conversation._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

    const viewData = {
        user: req.user,
        otherUser,
        conversation,
        messages: messages.reverse(),
    };

    if (req.user.role === 'bloodbank') {
        viewData.bloodbank = await BloodBank.findOne({ userId: req.user._id });
        viewData.user = req.user;
        return res.render('chat-bloodbank', viewData);
    }

    if (req.user.role === 'camp') {
        viewData.user = req.user;
        return res.render('chat-camp', viewData);
    }

    res.render('chat', viewData);
}

async function listConversations(req, res) {
    const conversations = await Conversation.find({ participants: req.user._id })
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean();

    const otherUserIds = conversations.map((c) =>
        c.participants.map((p) => p.toString()).find((id) => id !== req.user._id.toString())
    );
    const users = await User.find({ _id: { $in: otherUserIds } }).select('name role city profileImage').lean();
    const byId = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const payload = conversations.map((c) => {
        const otherId = c.participants.map((p) => p.toString()).find((id) => id !== req.user._id.toString());
        return {
            id: c._id,
            otherUser: byId[otherId] || { _id: otherId, name: 'User' },
            lastMessage: c.lastMessage || null,
            updatedAt: c.updatedAt,
        };
    });

    res.json({ conversations: payload });
}

async function getConversationMessages(req, res) {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid conversation id' });

    const convo = await Conversation.findById(id).lean();
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    const isParticipant = (convo.participants || []).some((p) => p.toString() === req.user._id.toString());
    if (!isParticipant) return res.status(403).json({ error: 'Not allowed' });

    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const messages = await Message.find({ conversationId: id }).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ messages: messages.reverse() });
}

async function getPatientInboxPanel(req, res) {
    if (req.user.role !== 'user') {
        return res.status(403).json({ ok: false, error: 'Only patient accounts can use this inbox' });
    }

    const role = ['all', 'donor', 'bloodbank'].includes(req.query.role) ? req.query.role : 'all';
    const when = ['all', 'today'].includes(req.query.when) ? req.query.when : 'all';
    const search = (req.query.search || '').toString();

    const inbox = await getInboxForUser(req.user._id, {
        role,
        when,
        search,
        requireMessages: true,
    });

    const hasAnyConversation = (await getInboxForUser(req.user._id, { requireMessages: true })).length > 0;

    return res.render(
        'partials/patient/messages-board',
        { inbox, user: req.user, filterEmpty: inbox.length === 0 && hasAnyConversation },
        (err, html) => {
            if (err) {
                console.error('Inbox panel render error:', err);
                return res.status(500).json({ ok: false, error: 'Could not load inbox' });
            }
            return res.json({ ok: true, count: inbox.length, html });
        }
    );
}

module.exports = {
    showMessagesInbox,
    showChat,
    listConversations,
    getConversationMessages,
    getPatientInboxPanel,
};
