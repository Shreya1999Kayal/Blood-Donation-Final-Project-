const nodemailer = require('nodemailer');

let transporter = null;

function envValue(key) {
    return (process.env[key] || '').trim();
}

function isSendGridConfigured() {
    const apiKey = envValue('SENDGRID_API_KEY');
    const from = envValue('SENDGRID_FROM_EMAIL') || envValue('EMAIL_FROM');
    return Boolean(apiKey && apiKey.startsWith('SG.') && from);
}

function isSmtpConfigured() {
    return Boolean(
        envValue('SMTP_HOST') &&
        envValue('SMTP_USER') &&
        envValue('SMTP_PASS')
    );
}

function isEmailConfigured() {
    return isSendGridConfigured() || isSmtpConfigured();
}

function getFromAddress() {
    return (
        envValue('SENDGRID_FROM_EMAIL') ||
        envValue('EMAIL_FROM') ||
        envValue('SMTP_USER') ||
        'noreply@blooddonation.local'
    );
}

function getTransporter() {
    if (transporter) return transporter;

    if (!isSmtpConfigured()) {
        return null;
    }

    transporter = nodemailer.createTransport({
        host: envValue('SMTP_HOST'),
        port: parseInt(envValue('SMTP_PORT') || '587', 10),
        secure: envValue('SMTP_SECURE') === 'true',
        auth: {
            user: envValue('SMTP_USER'),
            pass: envValue('SMTP_PASS'),
        },
    });

    return transporter;
}

function logEmailOtpToConsole(to, otp, note) {
    console.log('\n========== EMAIL OTP (not sent) ==========');
    if (note) console.log(note);
    console.log(`To: ${to}`);
    console.log(`OTP: ${otp}`);
    console.log('==========================================\n');
}

async function sendViaSendGrid({ to, subject, text, html }) {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(envValue('SENDGRID_API_KEY'));

    try {
        await sgMail.send({
            to,
            from: getFromAddress(),
            subject,
            text,
            html,
        });
    } catch (err) {
        const detail = err.response?.body?.errors?.[0]?.message || err.message;
        console.error('SendGrid send failed:', detail, err.response?.body || '');
        throw new Error(`SendGrid: ${detail}`);
    }
}

async function deliverMail({ to, subject, text, html }) {
    if (isSendGridConfigured()) {
        await sendViaSendGrid({ to, subject, text, html });
        return { provider: 'sendgrid', devMode: false };
    }

    const transport = getTransporter();
    if (transport) {
        await transport.sendMail({
            from: getFromAddress(),
            to,
            subject,
            text,
            html,
        });
        return { provider: 'smtp', devMode: false };
    }

    return { provider: 'none', devMode: true };
}

async function sendOtpEmail(to, otp, userName) {
    const subject = 'Verify your email - RaktaSetu';
    const text = `Hello ${userName},\n\nYour email verification code is: ${otp}\n\nThis code expires in 10 minutes. If you did not register, please ignore this email.\n\n— RaktaSetu`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #dc3545;">Email Verification</h2>
            <p>Hello <strong>${userName}</strong>,</p>
            <p>Use this one-time code to verify your email:</p>
            <p style="font-size: 28px; letter-spacing: 6px; font-weight: bold; color: #212529; background: #f8f9fa; padding: 16px; text-align: center; border-radius: 8px;">${otp}</p>
            <p style="color: #6c757d; font-size: 14px;">This code expires in <strong>10 minutes</strong>.</p>
            <p style="color: #6c757d; font-size: 14px;">If you did not register, you can ignore this email.</p>
        </div>
    `;

    const result = await deliverMail({ to, subject, text, html });

    if (result.devMode) {
        logEmailOtpToConsole(
            to,
            otp,
            'Configure SENDGRID_API_KEY + SENDGRID_FROM_EMAIL (or SMTP_*) on Render'
        );
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Email delivery is not configured. Set SendGrid or SMTP environment variables.');
        }
    }

    return result;
}

async function sendWelcomeCredentialsEmail(to, userName, loginEmail, plainPassword, role) {
    const subject = 'Your login credentials - RaktaSetu';
    const text = `Hello ${userName},\n\nYour account has been created.\n\nLogin email: ${loginEmail}\nLogin password: ${plainPassword}\nRole: ${role}\n\nNext, verify your email using the OTP code we sent.\n\n— RaktaSetu`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
            <h2 style="color: #dc3545;">Account Created</h2>
            <p>Hello <strong>${userName}</strong>,</p>
            <p>Your login credentials are below:</p>
            <div style="background:#f8f9fa; padding:16px; border-radius:10px;">
                <p style="margin:0 0 8px;"><strong>Login email:</strong> ${loginEmail}</p>
                <p style="margin:0 0 8px;"><strong>Login password:</strong> ${plainPassword}</p>
                <p style="margin:0;"><strong>Role:</strong> ${role}</p>
            </div>
            <p style="color:#6c757d; font-size:14px; margin-top:14px;">
                Next, verify your email using the OTP code we sent.
            </p>
            <p>— RaktaSetu</p>
        </div>
    `;

    const result = await deliverMail({ to, subject, text, html });

    if (result.devMode) {
        console.log('\n========== WELCOME CREDENTIALS EMAIL (not sent) ==========');
        console.log(`To: ${to}`);
        console.log(`Email: ${loginEmail}`);
        console.log(`Password: ${plainPassword}`);
        console.log(`Role: ${role}`);
        console.log('========================================================\n');
    }

    return result;
}

function getAppBaseUrl() {
    const raw = process.env.APP_URL || 'http://localhost:3000';
    const firstToken = raw.toString().trim().split(/\s+/)[0];
    const match = firstToken.match(/^(https?:\/\/[^/]+)/i);
    const base = match ? match[1] : firstToken;
    return base.replace(/\/$/, '');
}

async function sendPasswordResetEmail(to, userName, resetUrl) {
    const subject = 'Reset your password - RaktaSetu';
    const text = `Hello ${userName},\n\nReset your password using this link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, ignore this email.\n\n— RaktaSetu`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #dc3545;">Password reset</h2>
            <p>Hello <strong>${userName}</strong>,</p>
            <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
            <p style="text-align: center; margin: 24px 0;">
                <a href="${resetUrl}" style="background: #dc3545; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reset password</a>
            </p>
            <p style="color: #6c757d; font-size: 14px;">Or copy this link:<br><a href="${resetUrl}">${resetUrl}</a></p>
            <p style="color: #6c757d; font-size: 14px;">If you did not request a reset, you can ignore this email.</p>
        </div>
    `;

    const result = await deliverMail({ to, subject, text, html });

    if (result.devMode) {
        console.log('\n========== PASSWORD RESET LINK (not sent) ==========');
        console.log(`To: ${to}`);
        console.log(`Link: ${resetUrl}`);
        console.log('====================================================\n');
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Email delivery is not configured.');
        }
    }

    return result;
}

async function sendCriticalRequestAlert({ request, patient }) {
    const User = require('../models/User');
    const admins = await User.find({ role: 'admin' }).select('email name');
    const recipients = admins.map((a) => a.email).filter(Boolean);
    const alertEmail = envValue('ADMIN_ALERT_EMAIL');
    if (alertEmail) recipients.push(alertEmail);
    const uniqueRecipients = [...new Set(recipients)];

    if (!uniqueRecipients.length) {
        console.log('\n========== CRITICAL BLOOD REQUEST (no admin emails configured) ==========');
        console.log(`${request.bloodGroup} at ${request.hospitalName} (${request.city}) — patient ${patient?.name || request.patientName}`);
        console.log('=========================================================================\n');
        return { devMode: true, sent: 0 };
    }

    const subject = `[CRITICAL] ${request.bloodGroup} needed at ${request.hospitalName}`;
    const dashboardUrl = `${getAppBaseUrl()}/dashboard#section-requests`;
    const text = `Critical blood request posted on RaktaSetu.\n\nBlood group: ${request.bloodGroup}\nHospital: ${request.hospitalName}\nCity: ${request.city}\nUnits: ${request.requiredUnits}\nPatient: ${patient?.name || request.patientName}\nPhone: ${request.contactPhone}\n\nReview: ${dashboardUrl}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
            <h2 style="color:#b91c1c;">Critical blood request</h2>
            <p><strong>${request.bloodGroup}</strong> needed at <strong>${request.hospitalName}</strong> (${request.city}).</p>
            <ul>
                <li>Units required: ${request.requiredUnits}</li>
                <li>Patient: ${patient?.name || request.patientName}</li>
                <li>Contact: ${request.contactPhone}</li>
                <li>Urgency: ${request.urgencyLevel}</li>
            </ul>
            <p><a href="${dashboardUrl}" style="background:#dc3545;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;">Open admin dashboard</a></p>
        </div>
    `;

    if (!isEmailConfigured()) {
        console.log('\n========== CRITICAL BLOOD REQUEST (email not configured) ==========');
        console.log(text);
        console.log('=================================================================\n');
        return { devMode: true, sent: 0 };
    }

    await Promise.all(uniqueRecipients.map((to) => deliverMail({ to, subject, text, html })));
    return { devMode: false, sent: uniqueRecipients.length };
}

function getEmailDeliveryStatus() {
    if (isSendGridConfigured()) {
        return { configured: true, provider: 'sendgrid', from: getFromAddress() };
    }
    if (isSmtpConfigured()) {
        return { configured: true, provider: 'smtp', from: getFromAddress() };
    }
    return { configured: false, provider: 'none', from: null };
}

module.exports = {
    sendOtpEmail,
    sendPasswordResetEmail,
    sendWelcomeCredentialsEmail,
    sendCriticalRequestAlert,
    isSmtpConfigured,
    isSendGridConfigured,
    isEmailConfigured,
    getEmailDeliveryStatus,
    getAppBaseUrl,
};
