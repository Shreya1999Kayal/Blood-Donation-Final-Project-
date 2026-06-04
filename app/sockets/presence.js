const mongoose = require('mongoose');

const onlineCounts = new Map();
const watchers = new Map();
const socketWatches = new Map();

function isUserOnline(userId) {
    return (onlineCounts.get(String(userId)) || 0) > 0;
}

function notifyWatchers(io, userId, online) {
    const set = watchers.get(String(userId));
    if (!set || !set.size) return;

    const payload = { userId: String(userId), online: !!online };
    for (const socketId of set) {
        io.to(socketId).emit('presence:update', payload);
    }
}

function unwatchSocket(socketId, userId) {
    const uid = String(userId);
    watchers.get(uid)?.delete(socketId);
    if (watchers.get(uid)?.size === 0) watchers.delete(uid);
    socketWatches.get(socketId)?.delete(uid);
    if (socketWatches.get(socketId)?.size === 0) socketWatches.delete(socketId);
}

function clearSocketWatches(io, socketId) {
    const watched = socketWatches.get(socketId);
    if (!watched) return;

    for (const uid of watched) {
        watchers.get(uid)?.delete(socketId);
        if (watchers.get(uid)?.size === 0) watchers.delete(uid);
    }
    socketWatches.delete(socketId);
}

function addOnlineUser(io, userId) {
    const id = String(userId);
    const prev = onlineCounts.get(id) || 0;
    onlineCounts.set(id, prev + 1);
    if (prev === 0) notifyWatchers(io, id, true);
}

function removeOnlineUser(io, userId) {
    const id = String(userId);
    const prev = onlineCounts.get(id) || 0;
    if (prev <= 1) {
        onlineCounts.delete(id);
        notifyWatchers(io, id, false);
    } else {
        onlineCounts.set(id, prev - 1);
    }
}

function registerPresenceHandlers(io, socket) {
    addOnlineUser(io, socket.user._id);

    socket.on('presence:watch', (payload, cb) => {
        const userId = payload?.userId;
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return cb?.({ ok: false, error: 'Invalid user' });
        }

        const uid = String(userId);
        if (!watchers.has(uid)) watchers.set(uid, new Set());
        watchers.get(uid).add(socket.id);

        if (!socketWatches.has(socket.id)) socketWatches.set(socket.id, new Set());
        socketWatches.get(socket.id).add(uid);

        return cb?.({ ok: true, online: isUserOnline(uid) });
    });

    socket.on('presence:unwatch', (payload) => {
        const userId = payload?.userId;
        if (!userId) return;
        unwatchSocket(socket.id, userId);
    });

    socket.on('disconnect', () => {
        clearSocketWatches(io, socket.id);
        removeOnlineUser(io, socket.user._id);
    });
}

module.exports = { registerPresenceHandlers, isUserOnline };
