const User = require('../models/User');
const {
    sendOtpEmail,
    sendPasswordResetEmail,
    sendWelcomeCredentialsEmail,
    getAppBaseUrl,
} = require('../services/emailService');
const { sendOtpSms } = require('../services/smsService');
const {
    issueTokenPair,
    revokeRefreshToken,
    revokeAllSessions,
    clearAuthCookies,
    rotateRefreshToken,
    parseRefreshCookie,
    REFRESH_COOKIE,
} = require('../services/tokenService');
const {
    generateResetToken,
    hashResetToken,
    verifyResetToken,
    getResetTokenExpiry,
} = require('../utils/resetToken');
const {
    generateOtpCode,
    hashOtp,
    verifyOtpHash,
    getOtpExpiry,
    isOtpExpired,
    MAX_OTP_ATTEMPTS,
} = require('../utils/otp');
const { applyProfileImageUpload } = require('../utils/upload');
const { maskPhone, normalizeIndianPhone } = require('../utils/phone');
const { grandfatherLegacyPhoneVerification } = require('../utils/phoneVerification');

const PUBLIC_REGISTER_ROLES = ['user', 'donor', 'bloodbank', 'camp'];
const OTP_USER_SELECT = '+otpHash +otpExpiresAt +otpAttempts +phoneOtpHash +phoneOtpExpiresAt +phoneOtpAttempts';

function adminPortalSuffix(user) {
    return user?.role === 'admin' ? '&portal=admin' : '';
}

async function assignAndSendEmailOtp(user) {
    const otp = generateOtpCode();
    user.otpHash = await hashOtp(otp);
    user.otpExpiresAt = getOtpExpiry();
    user.otpAttempts = 0;
    await user.save();

    await sendOtpEmail(user.email, otp, user.name);
    return user;
}

async function assignAndSendPhoneOtp(user) {
    const otp = generateOtpCode();
    user.phoneOtpHash = await hashOtp(otp);
    user.phoneOtpExpiresAt = getOtpExpiry();
    user.phoneOtpAttempts = 0;
    await user.save();

    await sendOtpSms(user.phone, otp, user.name);
    return user;
}

async function redirectAfterVerification(user, res) {
    await issueTokenPair(user, res);

    if (user.role === 'bloodbank') {
        return res.redirect('/bloodbank/setup');
    }
    if (user.role === 'camp') {
        return res.redirect('/camp/setup');
    }
    return res.redirect('/dashboard');
}

exports.register = async (req, res) => {
    try {
        const { name, email, password, phone, city, role } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        if (!PUBLIC_REGISTER_ROLES.includes(role)) {
            return res.status(400).render('register', {
                error: 'Invalid role selected. Admin accounts cannot be created through registration.',
                defaultRole: '',
            });
        }

        if (!normalizeIndianPhone(phone)) {
            return res.status(400).render('register', {
                error: 'Enter a valid 10-digit Indian mobile number.',
                defaultRole: role,
            });
        }

        let user = await User.findOne({ email: normalizedEmail }).select(OTP_USER_SELECT);

        if (user && user.emailVerified) {
            return res.status(400).render('register', {
                error: 'An account with this email already exists. Please log in.',
            });
        }

        if (user && !user.emailVerified) {
            user.name = name;
            user.password = password;
            user.phone = phone;
            user.city = city;
            user.role = role;
            user.phoneVerified = false;
        } else {
            user = new User({
                name,
                email: normalizedEmail,
                password,
                phone,
                city,
                role,
                emailVerified: false,
                phoneVerified: false,
            });
        }

        if (req.file) {
            await applyProfileImageUpload(user, req.file);
        }

        await assignAndSendPhoneOtp(user);

        // Send login credentials email (includes the plain password the user typed).
        // SECURITY NOTE: Sending passwords by email is insecure; this is implemented
        // exactly as requested.
        try {
            await sendWelcomeCredentialsEmail(
                user.email,
                user.name,
                normalizedEmail,
                password,
                role
            );
        } catch (emailErr) {
            console.error('Welcome credentials email error:', emailErr);
        }

        return res.redirect(`/auth/verify-phone?email=${encodeURIComponent(normalizedEmail)}&sent=1`);
    } catch (error) {
        console.error('Register error:', error);
        if (error.code === 'INVALID_PROFILE_IMAGE') {
            return res.status(400).render('register', { error: error.message });
        }
        if (error.message && error.message.includes('phone')) {
            return res.status(400).render('register', {
                error: 'Could not send SMS verification code. Check your phone number and Twilio settings.',
                defaultRole: req.body.role || '',
            });
        }
        res.status(500).render('register', { error: 'Registration failed. Please try again.' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail }).select(OTP_USER_SELECT);

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).render('login', { error: 'Invalid email or password' });
        }

        if (user.role === 'admin') {
            return res.status(403).render('login', {
                error: 'Admin accounts must sign in at /admin/login.',
                verifyEmail: null,
                verifyPhone: null,
                success: null,
            });
        }

        await grandfatherLegacyPhoneVerification(user);

        if (!user.phoneVerified) {
            await assignAndSendPhoneOtp(user);
            return res.status(403).render('login', {
                error: 'Your phone number is not verified yet. Check your SMS for the OTP, or use the link below.',
                verifyPhone: normalizedEmail,
                verifyEmail: null,
            });
        }

        if (!user.emailVerified) {
            await assignAndSendEmailOtp(user);
            return res.status(403).render('login', {
                error: 'Your email is not verified yet. Check your inbox for the OTP, or use the link below to verify.',
                verifyEmail: normalizedEmail,
                verifyPhone: null,
            });
        }

        await issueTokenPair(user, res);
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).render('login', { error: 'Login failed. Please try again.' });
    }
};

exports.showVerifyEmail = async (req, res) => {
    const email = (req.query.email || '').toString();
    const sent = req.query.sent === '1';
    const verified = req.query.verified === '1';
    const phoneVerified = req.query.phone_verified === '1';
    const error = req.query.error ? decodeURIComponent(req.query.error) : null;
    const success = req.query.success ? decodeURIComponent(req.query.success) : null;
    const portal = req.query.portal === 'admin' ? 'admin' : '';

    let loginUrl = '/auth/login';
    if (portal === 'admin') {
        loginUrl = '/admin/login';
    } else if (email) {
        const account = await User.findOne({ email: email.toLowerCase().trim() }).select('role');
        if (account?.role === 'admin') loginUrl = '/admin/login';
    }

    res.render('verify-email', { email, sent, verified, phoneVerified, error, success, loginUrl, portal });
};

exports.showVerifyPhone = async (req, res) => {
    const email = (req.query.email || '').toString().toLowerCase().trim();
    const sent = req.query.sent === '1';
    const verified = req.query.verified === '1';
    const error = req.query.error ? decodeURIComponent(req.query.error) : null;
    const success = req.query.success ? decodeURIComponent(req.query.success) : null;
    const portal = req.query.portal === 'admin' ? 'admin' : '';

    let maskedPhone = '';
    let phoneDisplay = '';
    if (email) {
        const user = await User.findOne({ email }).select('phone phoneVerified');
        if (user?.phone) {
            maskedPhone = maskPhone(user.phone);
            const normalized = normalizeIndianPhone(user.phone);
            phoneDisplay = normalized ? ('+91 ' + normalized) : String(user.phone);
        }
    }

    let loginUrl = '/auth/login';
    if (portal === 'admin') {
        loginUrl = '/admin/login';
    } else if (email) {
        const account = await User.findOne({ email }).select('role');
        if (account?.role === 'admin') loginUrl = '/admin/login';
    }

    res.render('verify-phone', { email, sent, verified, maskedPhone, phoneDisplay, error, success, loginUrl, portal });
};

exports.verifyPhoneOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.redirect(`/auth/verify-phone?email=${encodeURIComponent(email || '')}&error=${encodeURIComponent('Enter the 6-digit SMS code sent to your phone')}`);
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail }).select(OTP_USER_SELECT);

        if (!user) {
            return res.redirect(`/auth/verify-phone?email=${encodeURIComponent(normalizedEmail)}&error=${encodeURIComponent('Account not found')}`);
        }

        if (user.phoneVerified) {
            if (user.emailVerified) {
                return await redirectAfterVerification(user, res);
            }
            await assignAndSendEmailOtp(user);
            return res.redirect(`/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}&phone_verified=1&sent=1${adminPortalSuffix(user)}`);
        }

        if (user.phoneOtpAttempts >= MAX_OTP_ATTEMPTS) {
            return res.redirect(`/auth/verify-phone?email=${encodeURIComponent(normalizedEmail)}&error=${encodeURIComponent('Too many failed attempts. Please request a new code.')}${adminPortalSuffix(user)}`);
        }

        if (isOtpExpired(user.phoneOtpExpiresAt)) {
            return res.redirect(`/auth/verify-phone?email=${encodeURIComponent(normalizedEmail)}&error=${encodeURIComponent('OTP has expired. Please request a new code.')}${adminPortalSuffix(user)}`);
        }

        const isValid = await verifyOtpHash(otp.trim(), user.phoneOtpHash);

        if (!isValid) {
            user.phoneOtpAttempts += 1;
            await user.save();
            const remaining = MAX_OTP_ATTEMPTS - user.phoneOtpAttempts;
            const msg = remaining > 0
                ? `Invalid OTP. ${remaining} attempt(s) remaining.`
                : 'Too many failed attempts. Please request a new code.';
            return res.redirect(`/auth/verify-phone?email=${encodeURIComponent(normalizedEmail)}&error=${encodeURIComponent(msg)}${adminPortalSuffix(user)}`);
        }

        user.phoneVerified = true;
        user.phoneOtpHash = undefined;
        user.phoneOtpExpiresAt = undefined;
        user.phoneOtpAttempts = 0;
        await user.save();

        await assignAndSendEmailOtp(user);

        return res.redirect(`/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}&phone_verified=1&sent=1${adminPortalSuffix(user)}`);
    } catch (error) {
        console.error('Verify phone OTP error:', error);
        const email = req.body.email || '';
        res.redirect(`/auth/verify-phone?email=${encodeURIComponent(email)}&error=${encodeURIComponent('Verification failed. Please try again.')}`);
    }
};

exports.resendPhoneOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.redirect('/auth/verify-phone?error=' + encodeURIComponent('Email is required'));
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail }).select(OTP_USER_SELECT);

        if (!user) {
            return res.redirect(`/auth/verify-phone?email=${encodeURIComponent(normalizedEmail)}&error=${encodeURIComponent('Account not found')}`);
        }

        if (user.phoneVerified) {
            const portal = adminPortalSuffix(user);
            return res.redirect(`/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}&phone_verified=1${portal}`);
        }

        await assignAndSendPhoneOtp(user);

        return res.redirect(`/auth/verify-phone?email=${encodeURIComponent(normalizedEmail)}&sent=1&success=${encodeURIComponent('A new SMS verification code has been sent.')}${adminPortalSuffix(user)}`);
    } catch (error) {
        console.error('Resend phone OTP error:', error);
        const email = req.body.email || '';
        res.redirect(`/auth/verify-phone?email=${encodeURIComponent(email)}&error=${encodeURIComponent('Could not resend SMS code. Please try again.')}`);
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.redirect(`/auth/verify-email?email=${encodeURIComponent(email || '')}&error=${encodeURIComponent('Email and OTP are required')}`);
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail }).select(OTP_USER_SELECT);

        if (!user) {
            return res.redirect(`/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}&error=${encodeURIComponent('Account not found')}`);
        }

        if (!user.phoneVerified) {
            return res.redirect(`/auth/verify-phone?email=${encodeURIComponent(normalizedEmail)}&error=${encodeURIComponent('Please verify your phone number first.')}${adminPortalSuffix(user)}`);
        }

        if (user.emailVerified) {
            if (user.role === 'admin') {
                return res.redirect('/admin/login?verified=1');
            }
            return res.redirect(`/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}&verified=1`);
        }

        if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
            return res.redirect(`/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}&error=${encodeURIComponent('Too many failed attempts. Please request a new code.')}${adminPortalSuffix(user)}`);
        }

        if (isOtpExpired(user.otpExpiresAt)) {
            return res.redirect(`/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}&error=${encodeURIComponent('OTP has expired. Please request a new code.')}${adminPortalSuffix(user)}`);
        }

        const isValid = await verifyOtpHash(otp.trim(), user.otpHash);

        if (!isValid) {
            user.otpAttempts += 1;
            await user.save();
            const remaining = MAX_OTP_ATTEMPTS - user.otpAttempts;
            const msg = remaining > 0
                ? `Invalid OTP. ${remaining} attempt(s) remaining.`
                : 'Too many failed attempts. Please request a new code.';
            return res.redirect(`/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}&error=${encodeURIComponent(msg)}${adminPortalSuffix(user)}`);
        }

        user.emailVerified = true;
        user.otpHash = undefined;
        user.otpExpiresAt = undefined;
        user.otpAttempts = 0;
        await user.save();

        if (user.role === 'admin') {
            return res.redirect('/admin/login?msg=email_verified');
        }
        return res.redirect('/auth/login?msg=email_verified');
    } catch (error) {
        console.error('Verify OTP error:', error);
        const email = req.body.email || '';
        res.redirect(`/auth/verify-email?email=${encodeURIComponent(email)}&error=${encodeURIComponent('Verification failed. Please try again.')}`);
    }
};

exports.resendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.redirect(`/auth/verify-email?error=${encodeURIComponent('Email is required')}`);
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() }).select(OTP_USER_SELECT);

        if (!user) {
            return res.redirect(`/auth/verify-email?email=${encodeURIComponent(email)}&error=${encodeURIComponent('Account not found')}`);
        }

        if (!user.phoneVerified) {
            return res.redirect(`/auth/verify-phone?email=${encodeURIComponent(email)}&error=${encodeURIComponent('Please verify your phone number first.')}${adminPortalSuffix(user)}`);
        }

        if (user.emailVerified) {
            if (user.role === 'admin') {
                return res.redirect('/admin/login?verified=1');
            }
            return res.redirect(`/auth/verify-email?email=${encodeURIComponent(email)}&verified=1`);
        }

        await assignAndSendEmailOtp(user);

        return res.redirect(`/auth/verify-email?email=${encodeURIComponent(email)}&sent=1&success=${encodeURIComponent('A new verification code has been sent.')}${adminPortalSuffix(user)}`);
    } catch (error) {
        console.error('Resend OTP error:', error);
        const email = req.body.email || '';
        const msg = error.message && /sendgrid|email delivery|smtp/i.test(error.message)
            ? 'Could not send email. Check SendGrid sender verification and Render environment variables.'
            : 'Could not resend code. Please try again.';
        res.redirect(`/auth/verify-email?email=${encodeURIComponent(email)}&error=${encodeURIComponent(msg)}`);
    }
};

exports.refresh = async (req, res) => {
    try {
        const refreshCookie = req.cookies[REFRESH_COOKIE];
        if (!refreshCookie) {
            return res.status(401).json({ error: 'Refresh token missing' });
        }

        const user = await rotateRefreshToken(refreshCookie, res);

        if (!user.emailVerified) {
            clearAuthCookies(res);
            return res.status(403).json({ error: 'Email not verified' });
        }

        if (!user.phoneVerified) {
            clearAuthCookies(res);
            return res.status(403).json({ error: 'Phone not verified' });
        }

        if (req.headers.accept?.includes('application/json')) {
            return res.json({ success: true, message: 'Tokens rotated' });
        }

        return res.redirect(req.get('Referer') || '/dashboard');
    } catch (error) {
        console.error('Refresh token error:', error);
        clearAuthCookies(res);
        if (req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }
        return res.redirect('/auth/login');
    }
};

exports.logout = async (req, res) => {
    try {
        let user = req.user;

        if (!user) {
            const refreshCookie = req.cookies[REFRESH_COOKIE];
            const parsed = parseRefreshCookie(refreshCookie);
            if (parsed) {
                user = await User.findById(parsed.userId).select('+refreshTokenHash');
            }
        } else {
            user = await User.findById(user._id).select('+refreshTokenHash');
        }

        if (user) {
            await revokeRefreshToken(user);
        }
    } catch (error) {
        console.error('Logout error:', error);
    }

    clearAuthCookies(res);
    res.redirect('/');
};

async function findUserByResetToken(token) {
    const candidates = await User.find({
        resetPasswordExpires: { $gt: new Date() },
        resetPasswordToken: { $exists: true, $ne: null },
    }).select('+resetPasswordToken +resetPasswordExpires');

    for (const user of candidates) {
        if (await verifyResetToken(token, user.resetPasswordToken)) {
            return user;
        }
    }
    return null;
}

exports.showForgotPassword = (req, res) => {
    res.render('forgot-password', { error: null, success: null });
};

exports.forgotPassword = async (req, res) => {
    try {
        const normalizedEmail = (req.body.email || '').toLowerCase().trim();
        const genericSuccess = 'If an account exists with that email, a password reset link has been sent.';

        if (!normalizedEmail) {
            return res.render('forgot-password', { error: 'Email is required', success: null });
        }

        const user = await User.findOne({ email: normalizedEmail }).select(
            '+resetPasswordToken +resetPasswordExpires'
        );

        if (user && user.emailVerified) {
            const token = generateResetToken();
            user.resetPasswordToken = await hashResetToken(token);
            user.resetPasswordExpires = getResetTokenExpiry();
            await user.save();

            const resetUrl = `${getAppBaseUrl()}/auth/reset-password/${token}`;
            await sendPasswordResetEmail(user.email, user.name, resetUrl);
        }

        res.render('forgot-password', { error: null, success: genericSuccess });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.render('forgot-password', { error: 'Could not process request. Try again.', success: null });
    }
};

exports.showResetPassword = async (req, res) => {
    const { token } = req.params;
    const user = await findUserByResetToken(token);

    if (!user) {
        return res.render('reset-password', {
            token: null,
            error: 'This reset link is invalid or has expired. Request a new one.',
        });
    }

    res.render('reset-password', { token, error: null });
};

exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;

        if (!password || !confirmPassword) {
            return res.render('reset-password', { token, error: 'Both password fields are required' });
        }

        if (password !== confirmPassword) {
            return res.render('reset-password', { token, error: 'Passwords do not match' });
        }

        if (password.length < 6) {
            return res.render('reset-password', { token, error: 'Password must be at least 6 characters' });
        }

        const user = await findUserByResetToken(token);

        if (!user) {
            return res.render('reset-password', {
                token: null,
                error: 'This reset link is invalid or has expired. Request a new one.',
            });
        }

        if (await user.comparePassword(password)) {
            return res.render('reset-password', {
                token,
                error: 'New password must be different from your current password',
            });
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        await revokeAllSessions(user);
        clearAuthCookies(res);

        res.redirect('/auth/login?msg=password_reset');
    } catch (error) {
        console.error('Reset password error:', error);
        res.render('reset-password', {
            token: req.params.token,
            error: 'Could not reset password. Try again.',
        });
    }
};

function wantsJsonResponse(req) {
    const accept = req.get('Accept') || '';
    return accept.includes('application/json') || req.get('X-Requested-With') === 'XMLHttpRequest';
}

function isDashboardPasswordUser(role) {
    return ['admin', 'user', 'donor', 'bloodbank', 'camp'].includes(role);
}

exports.showChangePassword = (req, res) => {
    if (req.user) {
        return res.redirect('/dashboard#section-password');
    }
    return res.redirect('/auth/login');
};

function respondChangePassword(req, res, { error, success }) {
    if (wantsJsonResponse(req)) {
        if (success) {
            return res.json({ ok: true, message: success });
        }
        return res.status(400).json({ ok: false, error: error || 'Could not change password' });
    }
    if (req.user && isDashboardPasswordUser(req.user.role)) {
        if (success) {
            return res.redirect(`/dashboard?pwd_success=${encodeURIComponent(success)}#section-password`);
        }
        if (error) {
            return res.redirect(`/dashboard?pwd_error=${encodeURIComponent(error)}#section-password`);
        }
        return res.redirect('/dashboard#section-password');
    }
    return res.render('change-password', { error: error || null, success: success || null });
}

exports.changePassword = async (req, res) => {
    try {
        const body = req.body || {};
        const currentPassword = body.currentPassword;
        const newPassword = body.newPassword;
        const confirmPassword = body.confirmPassword;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return respondChangePassword(req, res, { error: 'All fields are required' });
        }

        if (newPassword !== confirmPassword) {
            return respondChangePassword(req, res, { error: 'New passwords do not match' });
        }

        if (currentPassword === newPassword) {
            return respondChangePassword(req, res, {
                error: 'New password cannot be the same as your old password',
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return respondChangePassword(req, res, { error: 'Account not found. Please log in again.' });
        }

        const matches = await user.comparePassword(currentPassword);

        if (!matches) {
            return respondChangePassword(req, res, { error: 'Your current password is not correct' });
        }

        if (await user.comparePassword(newPassword)) {
            return respondChangePassword(req, res, {
                error: 'New password cannot be the same as your old password',
            });
        }

        user.password = newPassword;
        await user.save();

        const sessionUser = await User.findById(req.user._id).select(
            '+refreshTokenHash +refreshTokenExpires +previousRefreshTokenHash'
        );
        await revokeAllSessions(sessionUser);
        await issueTokenPair(sessionUser, res);

        respondChangePassword(req, res, {
            success: 'Your password has been updated successfully.',
        });
    } catch (error) {
        console.error('Change password error:', error);
        respondChangePassword(req, res, {
            error: error.message || 'Could not change password. Try again.',
        });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { name, phone, city } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) return res.redirect('/auth/login');

        user.name = name;
        user.phone = phone;
        user.city = city;

        if (req.file) {
            await applyProfileImageUpload(user, req.file);
        }

        await user.save();

        res.redirect('/dashboard?msg=profile_updated');
    } catch (error) {
        console.error('Profile update error:', error);
        if (error.code === 'INVALID_PROFILE_IMAGE') {
            return res.redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
        }
        res.redirect(`/dashboard?error=${encodeURIComponent('Could not update profile')}`);
    }
};
