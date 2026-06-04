const mongoose = require('mongoose');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const { canUsersChat } = require('../services/chatService');

function conversationKey(userAId, userBId) {
    return [userAId.toString(), userBId.toString()].sort().join(':');
}

async function ensureConversation(userAId, userBId) {
    const key = conversationKey(userAId, userBId);
    let conversation = await Conversation.findOne({ participantsKey: key });
    if (!conversation) {
        conversation = await Conversation.create({
            participants: [userAId, userBId],
            participantsKey: key,
        });
    }
    return conversation;
}

function buildChatPayload(messageDoc, senderName) {
    return {
        id: messageDoc._id,
        conversationId: messageDoc.conversationId,
        fromUserId: messageDoc.from,
        toUserId: messageDoc.to,
        from: messageDoc.from,
        to: messageDoc.to,
        message: messageDoc.text,
        text: messageDoc.text,
        createdAt: messageDoc.createdAt,
        senderName,
    };
}

async function emitChatNotification(io, sender, recipient, text) {
    const trimmed = text.length > 80 ? `${text.slice(0, 77)}...` : text;
    const notification = await Notification.create({
        title: `New message from ${sender.name}`,
        message: trimmed,
        type: 'message',
        userId: recipient._id,
        link: `/chat/${sender._id.toString()}`,
    });

    io.to(`user:${recipient._id.toString()}`).emit('notification:new', {
        id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        city: notification.city,
        roles: notification.roles,
        userId: notification.userId,
        link: notification.link,
        createdAt: notification.createdAt,
    });
}

function registerChatHandlers(io, socket) {
    socket.on('chat:history', async (payload, cb) => {
        try {
            const withUserId = payload?.withUserId;
            const limit = Math.min(Number(payload?.limit || 30), 100);
            const before = payload?.before ? new Date(payload.before) : null;

            if (!withUserId || !mongoose.Types.ObjectId.isValid(withUserId)) {
                return cb?.({ ok: false, error: 'Invalid user' });
            }

            const other = await User.findById(withUserId);
            if (!other) return cb?.({ ok: false, error: 'User not found' });

            const allowed = await canUsersChat(socket.user, other);
            if (!allowed.ok) {
                return cb?.({ ok: false, error: allowed.reason || 'Chat not allowed' });
            }

            const conversation = await ensureConversation(socket.user._id, other._id);
            const query = { conversationId: conversation._id };
            if (before) query.createdAt = { $lt: before };

            const messages = await Message.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();

            messages.reverse();

            return cb?.({
                ok: true,
                conversationId: conversation._id,
                messages: messages.map((m) => ({
                    id: m._id,
                    conversationId: m.conversationId,
                    fromUserId: m.from,
                    toUserId: m.to,
                    from: m.from,
                    to: m.to,
                    message: m.text,
                    text: m.text,
                    createdAt: m.createdAt,
                })),
            });
        } catch (err) {
            return cb?.({ ok: false, error: 'Failed to load history' });
        }
    });

    socket.on('chat:send', async (payload, cb) => {
        try {
            const toUserId = payload?.toUserId;
            const text = (payload?.text || payload?.message || '').toString().trim();

            if (!toUserId || !mongoose.Types.ObjectId.isValid(toUserId)) {
                return cb?.({ ok: false, error: 'Invalid user' });
            }
            if (!text) return cb?.({ ok: false, error: 'Message is empty' });
            if (text.length > 2000) return cb?.({ ok: false, error: 'Message too long' });

            const other = await User.findById(toUserId);
            if (!other) return cb?.({ ok: false, error: 'User not found' });

            const allowed = await canUsersChat(socket.user, other);
            if (!allowed.ok) {
                return cb?.({ ok: false, error: allowed.reason || 'Chat not allowed' });
            }

            const conversation = await ensureConversation(socket.user._id, other._id);
            const msg = await Message.create({
                conversationId: conversation._id,
                from: socket.user._id,
                to: other._id,
                text,
            });

            await Conversation.updateOne(
                { _id: conversation._id },
                {
                    $set: {
                        lastMessage: {
                            text,
                            from: socket.user._id,
                            at: msg.createdAt,
                        },
                        updatedAt: new Date(),
                    },
                }
            );

            const payloadOut = buildChatPayload(msg, socket.user.name);

            // deliver directly to each user's private room
            io.to(`user:${socket.user._id.toString()}`).emit('chat:message', payloadOut);
            io.to(`user:${other._id.toString()}`).emit('chat:message', payloadOut);
            await emitChatNotification(io, socket.user, other, text);

            return cb?.({ ok: true, message: payloadOut });
        } catch (err) {
            return cb?.({ ok: false, error: 'Failed to send' });
        }
    });
}

module.exports = { registerChatHandlers };

