const twilio = require('twilio');
const { toE164Indian } = require('../utils/phone');

function envValue(key) {
    return (process.env[key] || '').trim();
}

function isPlaceholder(value) {
    if (!value) return true;
    const lower = value.toLowerCase();
    return lower.startsWith('your_') || lower.includes('change_me') || lower === 'xxx';
}

function isTwilioConfigured() {
    const accountSid = envValue('TWILIO_ACCOUNT_SID');
    const authToken = envValue('TWILIO_AUTH_TOKEN');
    const fromNumber = envValue('TWILIO_PHONE_NUMBER');

    return Boolean(
        accountSid &&
        authToken &&
        fromNumber &&
        !isPlaceholder(accountSid) &&
        !isPlaceholder(authToken) &&
        !isPlaceholder(fromNumber),
    );
}

function getTwilioClient() {
    if (!isTwilioConfigured()) return null;
    return twilio(envValue('TWILIO_ACCOUNT_SID'), envValue('TWILIO_AUTH_TOKEN'));
}

function shouldAlwaysLogOtpToConsole() {
    if (envValue('SMS_LOG_OTP') === 'true') return true;
    if (envValue('SMS_LOG_OTP') === 'false') return false;
    return process.env.NODE_ENV !== 'production';
}

function logOtpToConsole(to, otp, note) {
    console.log('\n========== SMS OTP ==========');
    if (note) console.log(note);
    console.log(`To: ${to}`);
    console.log(`OTP: ${otp}`);
    console.log('=============================\n');
}

async function sendOtpSms(phone, otp, userName) {
    const to = toE164Indian(phone);
    if (!to) {
        throw new Error('Invalid phone number for SMS delivery');
    }

    const body = `RaktaSetu: Hello ${userName || 'there'}, your phone verification code is ${otp}. Valid for 10 minutes. Do not share this code.`;
    const alwaysLog = shouldAlwaysLogOtpToConsole();

    if (!isTwilioConfigured()) {
        logOtpToConsole(to, otp, 'Twilio not configured — use this code for local testing');
        return { devMode: true, to };
    }

    if (alwaysLog) {
        logOtpToConsole(to, otp, 'Development — OTP below (Twilio SMS also attempted when configured)');
    }

    try {
        const client = getTwilioClient();
        await client.messages.create({
            body,
            from: envValue('TWILIO_PHONE_NUMBER'),
            to,
        });
        return { devMode: false, to };
    } catch (err) {
        console.error('Twilio SMS delivery failed:', err.message);
        if (!alwaysLog) {
            logOtpToConsole(to, otp, 'Twilio failed — use this OTP for local testing');
        }
        if (process.env.NODE_ENV !== 'production' || envValue('SMS_LOG_OTP') === 'true') {
            return { devMode: true, to, twilioError: err.message };
        }
        throw err;
    }
}

module.exports = {
    sendOtpSms,
    isTwilioConfigured,
};
