const crypto = require('crypto');
const bcrypt = require('bcrypt');

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function generateResetToken() {
    return crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
}

async function hashResetToken(token) {
    return bcrypt.hash(token, 10);
}

async function verifyResetToken(token, hash) {
    if (!token || !hash) return false;
    return bcrypt.compare(token, hash);
}

function getResetTokenExpiry() {
    return new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
}

function isResetTokenExpired(expiresAt) {
    return !expiresAt || expiresAt < new Date();
}

module.exports = {
    generateResetToken,
    hashResetToken,
    verifyResetToken,
    getResetTokenExpiry,
    isResetTokenExpired,
};
