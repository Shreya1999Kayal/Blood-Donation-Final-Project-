const User = require('../models/User');
const {
    authenticateFromRequest,
    verifyAccessToken,
    clearAuthCookies,
} = require('../services/tokenService');
const { grandfatherLegacyPhoneVerification } = require('../utils/phoneVerification');

/** JSON/fetch clients (payment verify, AI chat, etc.) must not get HTML login redirects. */
function wantsJsonResponse(req) {
    if (req.originalUrl.startsWith('/api')) return true;
    if (req.originalUrl.startsWith('/payment/')) return true;
    if (req.originalUrl.startsWith('/ai/')) return true;
    const accept = req.headers.accept || '';
    const contentType = req.headers['content-type'] || '';
    if (accept.includes('application/json')) return true;
    if (contentType.includes('application/json')) return true;
    return false;
}

const auth = async (req, res, next) => {
    try {
        const user = await authenticateFromRequest(req, res, { allowRefresh: true });

        if (!user) {
            throw new Error('Not authenticated');
        }

        await grandfatherLegacyPhoneVerification(user);

        if (!user.phoneVerified) {
            clearAuthCookies(res);
            if (wantsJsonResponse(req)) {
                return res.status(403).json({ error: 'Please verify your phone number to continue.' });
            }
            const email = encodeURIComponent(user.email);
            return res.redirect(
                `/auth/verify-phone?email=${email}&error=${encodeURIComponent('Please verify your phone number to continue.')}`
            );
        }

        if (!user.emailVerified) {
            clearAuthCookies(res);
            if (wantsJsonResponse(req)) {
                return res.status(403).json({ error: 'Please verify your email to continue.' });
            }
            const email = encodeURIComponent(user.email);
            return res.redirect(
                `/auth/verify-email?email=${email}&error=${encodeURIComponent('Please verify your email to continue.')}`
            );
        }

        req.user = user;
        res.locals.user = user;
        next();
    } catch (error) {
        clearAuthCookies(res);
        if (wantsJsonResponse(req)) {
            return res.status(401).json({ error: 'Please log in again and retry payment.' });
        }
        return res.redirect('/auth/login');
    }
};

const checkAuth = async (req, res, next) => {
    try {
        const accessToken = req.cookies.accessToken;
        if (!accessToken) {
            res.locals.user = null;
            return next();
        }

        const decoded = verifyAccessToken(accessToken);
        const user = await User.findById(decoded.id);

        if (user && user.phoneVerified && user.emailVerified && (user.tokenVersion || 0) === (decoded.tokenVersion || 0)) {
            req.user = user;
            res.locals.user = user;
        } else {
            if (user && (!user.phoneVerified || !user.emailVerified)) {
                clearAuthCookies(res);
            }
            res.locals.user = null;
        }
    } catch {
        clearAuthCookies(res);
        res.locals.user = null;
    }
    next();
};

const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            if (wantsJsonResponse(req)) {
                return res.status(403).json({ error: 'You do not have permission to perform this action' });
            }
            return res.status(403).send('You do not have permission to perform this action');
        }
        next();
    };
};

/** Requires valid access token with high-level auth proof (JWT_AUTH_SECRET HMAC). */
const requireHighAuth = async (req, res, next) => {
    try {
        const accessToken = req.cookies.accessToken || req.header('Authorization')?.replace('Bearer ', '');
        if (!accessToken) {
            throw new Error('Missing access token');
        }

        const decoded = verifyAccessToken(accessToken);
        const user = await User.findById(decoded.id);

        if (!user || !user.phoneVerified || !user.emailVerified) {
            throw new Error('Invalid user');
        }
        if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
            throw new Error('Token revoked');
        }

        req.user = user;
        res.locals.user = user;
        next();
    } catch (error) {
        if (wantsJsonResponse(req)) {
            return res.status(401).json({ error: 'High-level authorization required.' });
        }
        return res.redirect('/auth/login');
    }
};

const guest = (req, res, next) => {
    if (req.user?.phoneVerified && req.user?.emailVerified) {
        return res.redirect('/dashboard');
    }
    next();
};

module.exports = { auth, checkAuth, restrictTo, requireHighAuth, guest };
