const crypto = require('crypto');
const bcrypt = require('bcrypt');

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;

function generateOtpCode() {
    const max = Math.pow(10, OTP_LENGTH);
    const num = crypto.randomInt(0, max);
    return String(num).padStart(OTP_LENGTH, '0');
}

async function hashOtp(code) {
    return bcrypt.hash(code, 10);
}

async function verifyOtpHash(code, hash) {
    if (!hash) return false;
    return bcrypt.compare(code, hash);
}

function getOtpExpiry() {
    return new Date(Date.now() + OTP_EXPIRY_MS);
}

function isOtpExpired(expiresAt) {
    return !expiresAt || expiresAt < new Date();
}

module.exports = {
    OTP_LENGTH,
    OTP_EXPIRY_MS,
    MAX_OTP_ATTEMPTS,
    generateOtpCode,
    hashOtp,
    verifyOtpHash,
    getOtpExpiry,
    isOtpExpired,
};
