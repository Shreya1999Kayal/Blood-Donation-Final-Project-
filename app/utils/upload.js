const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
]);

const PROFILE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
]);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../public/uploads'));
    },
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}-${file.originalname.replace(/\s+/g, '_')}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            const error = new Error('Only JPG, PNG, WEBP, and PDF files are allowed');
            error.code = 'INVALID_FILE_TYPE';
            return cb(error);
        }
        cb(null, true);
    },
});

const profileUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!PROFILE_MIME_TYPES.has(file.mimetype)) {
            const error = new Error('Profile photo must be JPG, PNG, or WEBP');
            error.code = 'INVALID_PROFILE_IMAGE';
            return cb(error);
        }
        cb(null, true);
    },
});

function envValue(key) {
    return (process.env[key] || '').trim();
}

function isCloudinaryPlaceholder(value) {
    if (!value) return true;
    const lower = value.toLowerCase();
    return lower.startsWith('your_') || lower.includes('change_me') || lower === 'xxx';
}

function canUseCloudinary() {
    const cloudName = envValue('CLOUDINARY_CLOUD_NAME');
    const apiKey = envValue('CLOUDINARY_API_KEY');
    const apiSecret = envValue('CLOUDINARY_API_SECRET');
    return Boolean(
        cloudName &&
        apiKey &&
        apiSecret &&
        !isCloudinaryPlaceholder(cloudName) &&
        !isCloudinaryPlaceholder(apiKey) &&
        !isCloudinaryPlaceholder(apiSecret)
    );
}

function buildCloudinarySignature(params, apiSecret) {
    const sortedPairs = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
    return crypto.createHash('sha1').update(`${sortedPairs}${apiSecret}`).digest('hex');
}

function isPdfFile(file) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    return file.mimetype === 'application/pdf' || extension === '.pdf';
}

function cloudinaryFolder(subfolder) {
    const configured = envValue('CLOUDINARY_FOLDER');
    const base = configured || 'rakta-setu';
    return subfolder ? `${base}/${subfolder}` : base;
}

async function cloudinaryUpload(file, options = {}) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const folder = options.folder || cloudinaryFolder();
    const timestamp = Math.floor(Date.now() / 1000);
    const pdf = options.resourceType === 'raw' || isPdfFile(file);
    const resourceType = options.resourceType || (pdf ? 'raw' : 'image');

    const signingParams = { folder, timestamp };
    const signature = buildCloudinarySignature(signingParams, apiSecret);

    const fileBuffer = await fs.readFile(file.path);
    const extension = path.extname(file.originalname || '').toLowerCase() || (pdf ? '.pdf' : '.bin');
    const contentType = file.mimetype || (pdf ? 'application/pdf' : 'application/octet-stream');
    const uploadName = file.originalname
        ? file.originalname.replace(/\s+/g, '_')
        : `upload${extension}`;

    const formData = new FormData();
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('folder', folder);
    formData.append('signature', signature);
    formData.append('file', new Blob([fileBuffer], { type: contentType }), uploadName);

    if (options.transformation) {
        formData.append('transformation', options.transformation);
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
    const response = await fetch(endpoint, { method: 'POST', body: formData });
    const data = await response.json();

    if (!response.ok || !data?.secure_url) {
        const message = data?.error?.message || 'Cloudinary upload failed';
        throw new Error(message);
    }

    return {
        url: data.secure_url,
        public_id: data.public_id || '',
    };
}

async function uploadToCloudinary(file) {
    const result = await cloudinaryUpload(file);
    return result.url;
}

async function uploadProfileImage(file) {
    const folder = cloudinaryFolder('profiles');
    if (!canUseCloudinary()) {
        return {
            url: `/uploads/${file.filename}`,
            public_id: '',
        };
    }

    try {
        const result = await cloudinaryUpload(file, {
            folder,
            resourceType: 'image',
            transformation: 'c_fill,g_face,h_400,w_400',
        });
        await fs.unlink(file.path).catch(() => {});
        return result;
    } catch (error) {
        console.error('Cloudinary profile upload failed, using local file:', error.message);
        return {
            url: `/uploads/${file.filename}`,
            public_id: '',
        };
    }
}

async function deleteFromCloudinary(publicId, resourceType = 'image') {
    if (!canUseCloudinary() || !publicId) return;

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const timestamp = Math.floor(Date.now() / 1000);
    const signingParams = { public_id: publicId, timestamp };
    const signature = buildCloudinarySignature(signingParams, apiSecret);

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);

    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`;
    const response = await fetch(endpoint, { method: 'POST', body: formData });
    const data = await response.json();

    if (!response.ok && data?.result !== 'ok' && data?.result !== 'not found') {
        console.error('Cloudinary delete failed:', data?.error?.message || 'Unknown error');
    }
}

async function applyProfileImageUpload(user, file) {
    if (!file || !user) return;

    const previousPublicId = user.profileImage?.public_id;
    const result = await uploadProfileImage(file);

    user.profileImage = {
        url: result.url,
        public_id: result.public_id || '',
    };

    if (previousPublicId && previousPublicId !== result.public_id) {
        await deleteFromCloudinary(previousPublicId, 'image');
    }
}

async function fileToPublicUrl(file) {
    if (!file) return null;
    const localUrl = `/uploads/${file.filename}`;

    if (!canUseCloudinary()) return localUrl;

    try {
        const cloudUrl = await uploadToCloudinary(file);
        await fs.unlink(file.path).catch(() => {});
        return cloudUrl || localUrl;
    } catch (error) {
        console.error('Cloudinary upload failed, using local file:', error.message);
        return localUrl;
    }
}

/** Prefer raw/upload links when opening PDFs uploaded before the raw-upload fix. */
function normalizeDocumentUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('res.cloudinary.com')) return url;
    if (/\.pdf($|\?)/i.test(url) && url.includes('/image/upload/')) {
        return url.replace('/image/upload/', '/raw/upload/');
    }
    return url;
}

function profileImageUrl(user) {
    const url = user?.profileImage?.url;
    if (!url) return '';
    return normalizeDocumentUrl(url);
}

function userInitials(name, fallback = '?') {
    if (!name) return fallback;
    return name.split(' ').map(function (part) { return part[0]; }).slice(0, 2).join('').toUpperCase();
}

module.exports = {
    upload,
    profileUpload,
    fileToPublicUrl,
    normalizeDocumentUrl,
    uploadProfileImage,
    applyProfileImageUpload,
    deleteFromCloudinary,
    profileImageUrl,
    userInitials,
};
