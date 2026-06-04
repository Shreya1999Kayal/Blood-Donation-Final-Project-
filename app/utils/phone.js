/**
 * Normalize Indian mobile numbers to E.164 (+91XXXXXXXXXX).
 */
function normalizeIndianPhone(phone) {
    if (!phone || typeof phone !== 'string') return null;

    const digits = phone.replace(/\D/g, '');

    if (digits.length === 10 && /^[6-9]/.test(digits)) {
        return digits;
    }

    if (digits.length === 12 && digits.startsWith('91') && /^91[6-9]/.test(digits)) {
        return digits.slice(2);
    }

    if (digits.length === 13 && digits.startsWith('091') && /^091[6-9]/.test(digits)) {
        return digits.slice(3);
    }

    return null;
}

function toE164Indian(phone) {
    const normalized = normalizeIndianPhone(phone);
    if (!normalized) return null;
    return `+91${normalized}`;
}

function maskPhone(phone) {
    const normalized = normalizeIndianPhone(phone);
    if (!normalized) return phone || '';
    return `+91 ${normalized.slice(0, 2)}****${normalized.slice(-4)}`;
}

module.exports = {
    normalizeIndianPhone,
    toE164Indian,
    maskPhone,
};
