const cookie = require('cookie');
const User = require('../models/User');
const { verifyAccessToken } = require('../services/tokenService');

function extractAccessToken(socket) {
    const authToken = socket.handshake.auth?.token;
    if (authToken && typeof authToken === 'string') return authToken;

    const header = socket.handshake.headers?.authorization;
    if (header && typeof header === 'string' && header.startsWith('Bearer ')) {
        return header.replace('Bearer ', '').trim();
    }

    const cookieHeader = socket.handshake.headers?.cookie;
    if (cookieHeader) {
        const cookies = cookie.parse(cookieHeader);
        if (cookies.accessToken) return cookies.accessToken;
        // legacy cookie name support
        if (cookies.token) return cookies.token;
    }

    return null;
}

function attachSocketAuth(io) {
    io.use(async (socket, next) => {
        try {
            const token = extractAccessToken(socket);
            if (!token) return next(new Error('UNAUTHORIZED'));

            const decoded = verifyAccessToken(token);
            const user = await User.findById(decoded.id);

            if (!user || !user.emailVerified) return next(new Error('UNAUTHORIZED'));
            if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) return next(new Error('UNAUTHORIZED'));

            socket.user = user;
            next();
        } catch (err) {
            next(new Error('UNAUTHORIZED'));
        }
    });
}

module.exports = { attachSocketAuth };

