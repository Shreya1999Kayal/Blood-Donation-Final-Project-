const Notification = require('../models/Notification');
const { normalizeCity } = require('../utils/city');

function toPayload(notification) {
    return {
        id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        city: notification.city,
        roles: notification.roles,
        userId: notification.userId,
        link: notification.link,
        createdAt: notification.createdAt,
    };
}

function isGlobalNotification(notification) {
    const roles = notification.roles || [];
    return roles.length === 0 && !notification.userId && !notification.city;
}

function isNotificationForUser(notification, user) {
    if (!notification || !user) return false;

    const userId = user._id?.toString();
    const role = user.role;
    const city = normalizeCity(user.city);
    const notifUserId = notification.userId ? notification.userId.toString() : null;
    const roles = notification.roles || [];

    if (notifUserId && notifUserId === userId) return true;
    if (isGlobalNotification(notification)) return true;

    if (role === 'admin') {
        return roles.includes('admin');
    }

    if (role === 'user') {
        return false;
    }

    if (role === 'donor' || role === 'bloodbank') {
        if (roles.includes(role)) return true;
        if (notification.type === 'request' && notification.city && notification.city === city) return true;
        return false;
    }

    if (role === 'camp') {
        return roles.includes('camp');
    }

    return false;
}

function buildNotificationQuery(user) {
    const userId = user._id;
    const role = user.role;
    const city = normalizeCity(user.city);
    const globalClause = { roles: { $size: 0 }, userId: null, city: null };

    if (role === 'admin') {
        return {
            $or: [
                { userId },
                { roles: 'admin' },
                globalClause,
            ],
        };
    }

    if (role === 'user') {
        return {
            $or: [
                { userId },
                globalClause,
            ],
        };
    }

    if (role === 'donor' || role === 'bloodbank') {
        return {
            $or: [
                { userId },
                { roles: role },
                { type: 'request', city },
                globalClause,
            ],
        };
    }

    if (role === 'camp') {
        return {
            $or: [
                { userId },
                { roles: 'camp' },
                globalClause,
            ],
        };
    }

    return { userId };
}

async function createNotification(req, data) {
    const notification = await Notification.create({
        title: data.title,
        message: data.message,
        type: data.type || 'system',
        city: data.city ? normalizeCity(data.city) : null,
        roles: data.roles || [],
        userId: data.userId || null,
        link: data.link || '/dashboard',
    });

    if (req.io) {
        const payload = toPayload(notification);
        req.io.emit('notification:new', payload);

        if (notification.city) {
            req.io.to(`city:${notification.city}`).emit('notification:new', payload);
        }
        (notification.roles || []).forEach((role) => {
            req.io.to(`role:${role}`).emit('notification:new', payload);
        });
        if (notification.userId) {
            req.io.to(`user:${notification.userId}`).emit('notification:new', payload);
        }
    }

    return notification;
}

async function getNotificationsForUser(user, limit = 50) {
    const notifications = await Notification.find(buildNotificationQuery(user))
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit) * 2, 100));

    return notifications
        .filter((notification) => isNotificationForUser(notification, user))
        .slice(0, Number(limit));
}

module.exports = {
    createNotification,
    getNotificationsForUser,
    isNotificationForUser,
    buildNotificationQuery,
};
