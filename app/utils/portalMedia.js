const fs = require('fs');
const path = require('path');

const PUBLIC_ROOT = path.join(__dirname, '../../public');
const PATIENT_NOTIF_DIR = 'uploads/patient/notifications';
const PATIENT_MESSAGES_DIR = 'uploads/patient/messages';
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const NOTIFICATION_DEFAULTS = {
    request: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=120&h=120&fit=crop&q=80',
    critical: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=120&h=120&fit=crop&q=80',
    message: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=120&h=120&fit=crop&q=80',
    contact: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=120&h=120&fit=crop&q=80',
    match: 'https://images.unsplash.com/photo-1615461066159-fa5966998606?w=120&h=120&fit=crop&q=80',
    approval: 'https://images.unsplash.com/photo-1579684385127-1ef15fd50859?w=120&h=120&fit=crop&q=80',
    received: 'https://images.unsplash.com/photo-1628348068343-c6a848d2b126?w=120&h=120&fit=crop&q=80',
    system: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=120&h=120&fit=crop&q=80',
};

/** File base name (no extension) → place image in public/uploads/patient/notifications/ */
const NOTIFICATION_FILE_BASES = {
    request: 'emergency-request',
    critical: 'critical-alert',
    message: 'donor-message',
    contact: 'donor-message',
    match: 'smart-match',
    approval: 'account-update',
    received: 'request-received',
    system: 'system-alert',
};

const MESSAGES_HERO_BASE = 'inbox-hero';
const MESSAGES_HERO_DEFAULT = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1400&h=420&fit=crop&q=85';

function normalizeNotificationType(type) {
    if (type === 'contact') return 'message';
    return type || 'system';
}

function readLocalImage(relativeDir, baseName) {
    if (!baseName) return null;
    const absDir = path.join(PUBLIC_ROOT, relativeDir);
    if (!fs.existsSync(absDir)) return null;

    const files = fs.readdirSync(absDir).filter(function (file) {
        if (file.startsWith('.') || file.endsWith('.md')) return false;
        return fs.statSync(path.join(absDir, file)).isFile();
    });

    const match = files.find(function (file) {
        const parsed = path.parse(file);
        return parsed.name.toLowerCase() === baseName.toLowerCase()
            && IMAGE_EXTENSIONS.includes(parsed.ext.toLowerCase());
    });

    if (!match) return null;
    return `/${relativeDir.replace(/\\/g, '/')}/${match}`;
}

function notificationImageSrc(type) {
    const key = normalizeNotificationType(type);
    const local = readLocalImage(PATIENT_NOTIF_DIR, NOTIFICATION_FILE_BASES[key] || NOTIFICATION_FILE_BASES.system);
    if (local) return local;
    return NOTIFICATION_DEFAULTS[key] || NOTIFICATION_DEFAULTS.system;
}

function notificationTypeMeta(type) {
    const key = normalizeNotificationType(type);
    const map = {
        request: { icon: 'siren', tone: 'danger', label: 'Request' },
        critical: { icon: 'alert-triangle', tone: 'danger', label: 'Critical' },
        message: { icon: 'messages-square', tone: 'blue', label: 'Message' },
        match: { icon: 'heart-handshake', tone: 'success', label: 'Match' },
        approval: { icon: 'badge-check', tone: 'blue', label: 'Approval' },
        contact: { icon: 'messages-square', tone: 'blue', label: 'Message' },
        received: { icon: 'check-circle', tone: 'green', label: 'Received' },
        system: { icon: 'bell', tone: 'slate', label: 'System' },
    };
    const meta = map[key] || map.system;
    return Object.assign({}, meta, { img: notificationImageSrc(type) });
}

function notificationFilterType(type) {
    const key = normalizeNotificationType(type);
    if (key === 'request' || key === 'critical') return key;
    if (key === 'message') return 'message';
    if (key === 'match') return 'match';
    if (key === 'approval' || key === 'received') return 'approval';
    return 'system';
}

function getNotificationMetaMap() {
    const keys = Object.keys(NOTIFICATION_DEFAULTS);
    const out = {};
    keys.forEach(function (key) {
        out[key] = notificationTypeMeta(key);
    });
    return out;
}

function messagesHeroSrc() {
    const local = readLocalImage(PATIENT_MESSAGES_DIR, MESSAGES_HERO_BASE);
    return local || MESSAGES_HERO_DEFAULT;
}

module.exports = {
    PATIENT_NOTIF_DIR,
    PATIENT_MESSAGES_DIR,
    NOTIFICATION_FILE_BASES,
    MESSAGES_HERO_BASE,
    normalizeNotificationType,
    notificationImageSrc,
    notificationTypeMeta,
    notificationFilterType,
    getNotificationMetaMap,
    messagesHeroSrc,
};
