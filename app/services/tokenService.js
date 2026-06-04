const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';
const LEGACY_COOKIE = 'token';

function getSecrets() {
    const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const authSecret = process.env.JWT_AUTH_SECRET || process.env.JWT_SECRET;

    if (!accessSecret || !refreshSecret || !authSecret) {
        throw new Error('JWT secrets are not configured');
    }

    return { accessSecret, refreshSecret, authSecret };
}

function getAccessExpiresIn() {
    return process.env.JWT_ACCESS_EXPIRES || '15m';
}

function getRefreshExpiresMs() {
    const days = parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || '7', 10);
    return days * 24 * 60 * 60 * 1000;
}

function buildAuthProof(user) {
    const { authSecret } = getSecrets();
    const version = user.tokenVersion || 0;
    return crypto
        .createHmac('sha256', authSecret)
        .update(`${user._id}:${user.role}:${version}`)
        .digest('hex');
}

function verifyAuthProof(decoded) {
    const { authSecret } = getSecrets();
    const expected = crypto
        .createHmac('sha256', authSecret)
        .update(`${decoded.id}:${decoded.role}:${decoded.tokenVersion || 0}`)
        .digest('hex');
    return decoded.authProof === expected;
}

function createAccessToken(user) {
    const { accessSecret } = getSecrets();
    const payload = {
        id: user._id.toString(),
        role: user.role,
        tokenVersion: user.tokenVersion || 0,
        type: 'access',
        authProof: buildAuthProof(user),
    };
    return jwt.sign(payload, accessSecret, { expiresIn: getAccessExpiresIn() });
}

async function generateRefreshTokenValue() {
    return crypto.randomBytes(48).toString('hex');
}

async function hashRefreshToken(token) {
    return bcrypt.hash(token, 12);
}

async function verifyRefreshTokenHash(token, hash) {
    if (!token || !hash) return false;
    return bcrypt.compare(token, hash);
}

function formatRefreshCookie(userId, token) {
    return `${userId}.${token}`;
}

function parseRefreshCookie(cookieValue) {
    if (!cookieValue || typeof cookieValue !== 'string') return null;
    const dot = cookieValue.indexOf('.');
    if (dot <= 0) return null;
    const userId = cookieValue.slice(0, dot);
    const token = cookieValue.slice(dot + 1);
    if (!userId || !token) return null;
    return { userId, token };
}

function cookieBaseOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    };
}

function setAuthCookies(res, accessToken, refreshCookieValue) {
    const base = cookieBaseOptions();
    const refreshMaxAge = getRefreshExpiresMs();

    res.cookie(ACCESS_COOKIE, accessToken, {
        ...base,
        maxAge: 15 * 60 * 1000,
    });
    res.cookie(REFRESH_COOKIE, refreshCookieValue, {
        ...base,
        maxAge: refreshMaxAge,
    });
    res.clearCookie(LEGACY_COOKIE);
}

function clearAuthCookies(res) {
    const base = cookieBaseOptions();
    res.clearCookie(ACCESS_COOKIE, base);
    res.clearCookie(REFRESH_COOKIE, base);
    res.clearCookie(LEGACY_COOKIE, base);
}

async function persistRefreshToken(user, plainRefreshToken) {
    user.refreshTokenHash = await hashRefreshToken(plainRefreshToken);
    user.refreshTokenExpires = new Date(Date.now() + getRefreshExpiresMs());
    await user.save();
}

async function revokeRefreshToken(user) {
    user.refreshTokenHash = null;
    user.refreshTokenExpires = null;
    user.previousRefreshTokenHash = null;
    await user.save();
}

async function revokeAllSessions(user) {
    user.refreshTokenHash = null;
    user.refreshTokenExpires = null;
    user.previousRefreshTokenHash = null;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
}

async function issueTokenPair(user, res) {
    const plainRefresh = await generateRefreshTokenValue();
    await persistRefreshToken(user, plainRefresh);

    const accessToken = createAccessToken(user);
    const refreshCookie = formatRefreshCookie(user._id.toString(), plainRefresh);
    setAuthCookies(res, accessToken, refreshCookie);

    return { accessToken, refreshToken: plainRefresh };
}

function verifyAccessToken(token) {
    const { accessSecret } = getSecrets();
    const decoded = jwt.verify(token, accessSecret);

    if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
    }
    if (!verifyAuthProof(decoded)) {
        throw new Error('Invalid authorization proof');
    }

    return decoded;
}

async function loadUserForToken(decoded) {
    const user = await User.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpires +previousRefreshTokenHash');
    if (!user) throw new Error('User not found');
    if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
        throw new Error('Token version mismatch');
    }
    return user;
}

async function rotateRefreshToken(refreshCookieValue, res) {
    const parsed = parseRefreshCookie(refreshCookieValue);
    if (!parsed) throw new Error('Invalid refresh cookie');

    const user = await User.findById(parsed.userId).select(
        '+refreshTokenHash +refreshTokenExpires +previousRefreshTokenHash'
    );
    if (!user) throw new Error('User not found');

    if (!user.refreshTokenHash || !user.refreshTokenExpires || user.refreshTokenExpires < new Date()) {
        throw new Error('Refresh token expired');
    }

    const isValid = await verifyRefreshTokenHash(parsed.token, user.refreshTokenHash);

    if (!isValid) {
        if (
            user.previousRefreshTokenHash &&
            (await verifyRefreshTokenHash(parsed.token, user.previousRefreshTokenHash))
        ) {
            await revokeAllSessions(user);
            throw new Error('Refresh token reuse detected');
        }
        throw new Error('Invalid refresh token');
    }

    user.previousRefreshTokenHash = user.refreshTokenHash;
    const newPlain = await generateRefreshTokenValue();
    user.refreshTokenHash = await hashRefreshToken(newPlain);
    user.refreshTokenExpires = new Date(Date.now() + getRefreshExpiresMs());
    await user.save();

    const accessToken = createAccessToken(user);
    const refreshCookie = formatRefreshCookie(user._id.toString(), newPlain);
    setAuthCookies(res, accessToken, refreshCookie);

    return user;
}

async function authenticateFromRequest(req, res, { allowRefresh = true } = {}) {
    const accessToken = req.cookies[ACCESS_COOKIE] || req.header('Authorization')?.replace('Bearer ', '');
    const legacyToken = req.cookies[LEGACY_COOKIE];

    if (accessToken) {
        try {
            const decoded = verifyAccessToken(accessToken);
            return await loadUserForToken(decoded);
        } catch (err) {
            if (err.name !== 'TokenExpiredError' || !allowRefresh) {
                throw err;
            }
        }
    } else if (legacyToken) {
        try {
            const decoded = jwt.verify(legacyToken, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);
            if (user) return user;
        } catch (_) {
            /* fall through */
        }
    }

    if (!allowRefresh) return null;

    const refreshCookie = req.cookies[REFRESH_COOKIE];
    if (!refreshCookie) return null;

    return rotateRefreshToken(refreshCookie, res);
}

class TokenError extends Error {
    constructor(message, status = 401) {
        super(message);
        this.status = status;
    }
}

module.exports = {
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    TokenError,
    issueTokenPair,
    rotateRefreshToken,
    revokeRefreshToken,
    revokeAllSessions,
    verifyAccessToken,
    authenticateFromRequest,
    clearAuthCookies,
    createAccessToken,
    buildAuthProof,
    parseRefreshCookie,
};
