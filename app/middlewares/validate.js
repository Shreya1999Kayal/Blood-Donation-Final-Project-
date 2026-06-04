const { sanitizeGeoFields } = require('../utils/sanitizeGeo');

function validate(schema, property = 'body') {
    return (req, res, next) => {
        if (property === 'body' && req[property]) {
            sanitizeGeoFields(req[property]);
        }

        const source = req[property] || {};
        const { value, error } = schema.validate(source, {
            abortEarly: false,
            stripUnknown: true,
            convert: true,
        });

        if (error) {
            const message = error.details.map((detail) => detail.message).join(', ');
            if (req.originalUrl === '/auth/change-password') {
                const wantsJson = (req.get('Accept') || '').includes('application/json')
                    || req.get('X-Requested-With') === 'XMLHttpRequest';
                if (wantsJson) {
                    return res.status(400).json({ ok: false, error: message });
                }
                const dashboardRoles = ['admin', 'user', 'donor', 'bloodbank', 'camp'];
                if (req.user && dashboardRoles.includes(req.user.role)) {
                    return res.redirect(`/dashboard?pwd_error=${encodeURIComponent(message)}#section-password`);
                }
                return res.status(400).render('change-password', { error: message, success: null });
            }
            if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/search') || req.headers.accept?.includes('application/json')) {
                return res.status(400).json({ error: message });
            }
            if (req.originalUrl === '/auth/register') {
                return res.status(400).render('register', { error: message });
            }
            if (req.originalUrl === '/admin/registration') {
                return res.status(400).render('admin-register', { error: message });
            }
            if (req.originalUrl === '/auth/login') {
                return res.status(400).render('login', { error: message, verifyEmail: null, success: null });
            }
            if (req.originalUrl === '/admin/login') {
                return res.status(400).render('admin-login', {
                    error: message,
                    success: null,
                    verifyEmail: null,
                    verifyPhone: null,
                });
            }
            if (req.originalUrl === '/auth/verify-otp' || req.originalUrl === '/auth/resend-otp') {
                const email = encodeURIComponent(req.body.email || '');
                return res.redirect(`/auth/verify-email?email=${email}&error=${encodeURIComponent(message)}`);
            }
            if (req.originalUrl === '/auth/verify-phone-otp' || req.originalUrl === '/auth/resend-phone-otp') {
                const email = encodeURIComponent(req.body.email || '');
                return res.redirect(`/auth/verify-phone?email=${email}&error=${encodeURIComponent(message)}`);
            }
            if (req.originalUrl === '/auth/forgot-password') {
                return res.status(400).render('forgot-password', { error: message, success: null });
            }
            if (req.originalUrl.startsWith('/auth/reset-password/')) {
                return res.status(400).render('reset-password', { token: req.params.token, error: message });
            }
            if (req.originalUrl === '/feedback' || req.originalUrl.startsWith('/feedback/')) {
                return res.redirect(`/dashboard?error=${encodeURIComponent(message)}#section-feedback`);
            }
            return res.redirect(`/dashboard?error=${encodeURIComponent(message)}`);
        }

        req[property] = value;
        next();
    };
}

module.exports = { validate };
