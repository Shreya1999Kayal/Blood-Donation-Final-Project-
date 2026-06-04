const rateLimit = require('express-rate-limit');

function jsonLimiter(message) {
    return rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
        message: { ok: false, error: message },
    });
}

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'Too many authentication attempts. Please try again later.' },
});

const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res) {
        const message = 'Too many OTP requests. Please wait before trying again.';
        if (req.originalUrl === '/auth/resend-phone-otp' || req.originalUrl === '/auth/verify-phone-otp') {
            const email = encodeURIComponent(req.body?.email || req.query?.email || '');
            return res.redirect(`/auth/verify-phone?email=${email}&error=${encodeURIComponent(message)}`);
        }
        if (req.originalUrl === '/auth/resend-otp' || req.originalUrl === '/auth/verify-otp') {
            const email = encodeURIComponent(req.body?.email || req.query?.email || '');
            return res.redirect(`/auth/verify-email?email=${email}&error=${encodeURIComponent(message)}`);
        }
        return res.status(429).json({ ok: false, error: message });
    },
});

const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'Too many AI requests. Please slow down and try again.' },
});

const apiLimiter = jsonLimiter('Too many API requests. Please try again later.');

module.exports = {
    authLimiter,
    otpLimiter,
    aiLimiter,
    apiLimiter,
};
