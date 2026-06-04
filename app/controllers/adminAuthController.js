const User = require('../models/User');
const { sendWelcomeCredentialsEmail, sendOtpEmail } = require('../services/emailService');
const { issueTokenPair } = require('../services/tokenService');
const { applyProfileImageUpload } = require('../utils/upload');
const { normalizeIndianPhone } = require('../utils/phone');
const { grandfatherLegacyPhoneVerification } = require('../utils/phoneVerification');
const {
    generateOtpCode,
    hashOtp,
    getOtpExpiry,
} = require('../utils/otp');
const { sendOtpSms } = require('../services/smsService');

const OTP_USER_SELECT = '+otpHash +otpExpiresAt +otpAttempts +phoneOtpHash +phoneOtpExpiresAt +phoneOtpAttempts';

async function assignAndSendPhoneOtp(user) {
    const otp = generateOtpCode();
    user.phoneOtpHash = await hashOtp(otp);
    user.phoneOtpExpiresAt = getOtpExpiry();
    user.phoneOtpAttempts = 0;
    await user.save();
    await sendOtpSms(user.phone, otp, user.name);
    return user;
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

exports.showRegister = (req, res) => {
    if (req.user?.role === 'admin' && req.user?.emailVerified) {
        return res.redirect('/dashboard');
    }
    res.render('admin-register', { error: null, user: res.locals.user || null });
};

exports.register = async (req, res) => {
    try {
        const { name, email, password, phone, city } = req.body;
        const normalizedEmail = email.toLowerCase().trim();
        const role = 'admin';

        if (!normalizeIndianPhone(phone)) {
            return res.status(400).render('admin-register', {
                error: 'Enter a valid 10-digit Indian mobile number.',
            });
        }

        let user = await User.findOne({ email: normalizedEmail }).select(OTP_USER_SELECT);

        if (user && user.emailVerified) {
            return res.status(400).render('admin-register', {
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

        try {
            await sendWelcomeCredentialsEmail(
                user.email,
                user.name,
                normalizedEmail,
                password,
                role
            );
        } catch (emailErr) {
            console.error('Admin welcome credentials email error:', emailErr);
        }

        return res.redirect(`/auth/verify-phone?email=${encodeURIComponent(normalizedEmail)}&sent=1&portal=admin`);
    } catch (error) {
        console.error('Admin register error:', error);
        if (error.code === 'INVALID_PROFILE_IMAGE') {
            return res.status(400).render('admin-register', { error: error.message });
        }
        if (error.message && error.message.includes('phone')) {
            return res.status(400).render('admin-register', {
                error: 'Could not send SMS verification code. Check your phone number and Twilio settings.',
            });
        }
        res.status(500).render('admin-register', { error: 'Registration failed. Please try again.' });
    }
};

exports.showLogin = (req, res) => {
    if (req.user?.role === 'admin' && req.user?.emailVerified) {
        return res.redirect('/dashboard');
    }

    let success = null;
    if (req.query.msg === 'email_verified') {
        success = 'Email verified successfully. Please log in to continue.';
    } else if (req.query.msg === 'password_reset') {
        success = 'Password updated successfully. Please log in with your new password.';
    } else if (req.query.verified === '1') {
        success = 'Your admin account is verified. Please log in.';
    }

    res.render('admin-login', {
        error: null,
        success,
        verifyEmail: null,
        verifyPhone: null,
        user: res.locals.user || null,
    });
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail }).select(OTP_USER_SELECT);

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).render('admin-login', {
                error: 'Invalid email or password',
                success: null,
                verifyEmail: null,
                verifyPhone: null,
            });
        }

        if (user.role !== 'admin') {
            return res.status(403).render('admin-login', {
                error: 'This login is for admin accounts only. Use the main login page for other roles.',
                success: null,
                verifyEmail: null,
                verifyPhone: null,
            });
        }

        await grandfatherLegacyPhoneVerification(user);

        if (!user.phoneVerified) {
            await assignAndSendPhoneOtp(user);
            return res.status(403).render('admin-login', {
                error: 'Your phone number is not verified yet. Check your SMS for the OTP, or use the link below.',
                verifyPhone: normalizedEmail,
                verifyEmail: null,
                success: null,
            });
        }

        if (!user.emailVerified) {
            await assignAndSendEmailOtp(user);
            return res.status(403).render('admin-login', {
                error: 'Your email is not verified yet. Check your inbox for the OTP, or use the link below.',
                verifyEmail: normalizedEmail,
                verifyPhone: null,
                success: null,
            });
        }

        await issueTokenPair(user, res);
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).render('admin-login', {
            error: 'Login failed. Please try again.',
            success: null,
            verifyEmail: null,
            verifyPhone: null,
        });
    }
};
