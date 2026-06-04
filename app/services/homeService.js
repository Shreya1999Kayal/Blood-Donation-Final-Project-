const fs = require('fs');
const path = require('path');
const Donor = require('../models/Donor');
const BloodBank = require('../models/BloodBank');
const Request = require('../models/Request');
const CampEvent = require('../models/CampEvent');
const { USER_POPULATE_FIELDS } = require('./matchingService');

const PUBLIC_ROOT = path.join(__dirname, '../../public');
const CAROUSEL_DIR = path.join(PUBLIC_ROOT, 'uploads/home/carousel');
const GALLERY_DIR = path.join(PUBLIC_ROOT, 'uploads/home/gallery');
const ABOUT_DIR = path.join(PUBLIC_ROOT, 'uploads/home/about');
const ABOUT_IMAGE_BASE = 'about-coordination';
const DEFAULT_ABOUT_IMAGE = 'https://images.unsplash.com/photo-1579684385127-1ef15fd50859?w=900&h=700&fit=crop&q=85';

const DEFAULT_CAROUSEL = [
    {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1615461066159-fa5966998606?w=1600&h=700&fit=crop&q=85',
        title: 'Every drop counts',
        subtitle: 'Join verified donors saving lives across India',
    },
    {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1579684385127-1ef15fd50859?w=1600&h=700&fit=crop&q=85',
        title: 'Emergency blood matching',
        subtitle: 'Real-time coordination between patients, donors, and blood banks',
    },
    {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1519494027932-80aedc1da952?w=1600&h=700&fit=crop&q=85',
        title: 'Hospital blood bank network',
        subtitle: 'Track inventory and respond to critical needs faster',
    },
    {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&h=700&fit=crop&q=85',
        title: 'Organize donation camps',
        subtitle: 'Blood donation camps connecting communities with verified partners',
    },
];

const DEFAULT_GALLERY = [
    { src: 'https://images.unsplash.com/photo-1615461066159-fa5966998606?w=800&h=600&fit=crop&q=80', caption: 'Community blood drive' },
    { src: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=600&fit=crop&q=80', caption: 'Patient care support' },
    { src: 'https://images.unsplash.com/photo-1628348068343-c6a848d2b126?w=800&h=600&fit=crop&q=80', caption: 'Blood bank coordination' },
    { src: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=600&fit=crop&q=80', caption: 'Camp outreach' },
    { src: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800&h=600&fit=crop&q=80', caption: 'Emergency response' },
    { src: 'https://images.unsplash.com/photo-1579684385127-1ef15fd50859?w=800&h=600&fit=crop&q=80', caption: 'Life saved' },
];

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov'];

/** Fixed carousel slots — file base name must match id (any supported extension). */
const CAROUSEL_SLOTS = [
    {
        id: '01-blood-donation',
        kind: 'image',
        title: 'Every drop counts',
        subtitle: 'Join verified donors saving lives across India through RaktaSetu',
    },
    {
        id: '02-donor',
        kind: 'video',
        title: 'Become a blood donor',
        subtitle: 'Watch how donors make a life-saving difference in their communities',
    },
    {
        id: '03-camp',
        kind: 'image',
        title: 'Blood donation camps',
        subtitle: 'Organize and discover camps connecting donors with patients and blood banks',
    },
    {
        id: '04-patient',
        kind: 'video',
        title: 'Patients receive hope',
        subtitle: 'Real-time blood matching when every minute matters for those in need',
    },
];

function mediaTypeFromExtension(ext) {
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
    return null;
}

function findCarouselSlotFile(absDir, slot) {
    if (!fs.existsSync(absDir)) return null;

    const matches = fs.readdirSync(absDir)
        .filter((file) => {
            if (file.startsWith('.') || file.endsWith('.md')) return false;
            const fullPath = path.join(absDir, file);
            return fs.statSync(fullPath).isFile();
        })
        .filter((file) => path.parse(file).name.toLowerCase() === slot.id.toLowerCase())
        .map((file) => {
            const ext = path.extname(file).toLowerCase();
            const type = mediaTypeFromExtension(ext);
            return type ? { file, type } : null;
        })
        .filter(Boolean);

    if (!matches.length) return null;

    const preferred = matches.find((m) => m.type === slot.kind);
    return preferred || matches[0];
}

function readAboutImageSrc() {
    const relativeDir = 'uploads/home/about';
    const absDir = path.join(PUBLIC_ROOT, relativeDir);

    if (!fs.existsSync(absDir)) return DEFAULT_ABOUT_IMAGE;

    const match = fs.readdirSync(absDir)
        .filter((file) => {
            if (file.startsWith('.') || file.endsWith('.md')) return false;
            const fullPath = path.join(absDir, file);
            return fs.statSync(fullPath).isFile();
        })
        .find((file) => path.parse(file).name.toLowerCase() === ABOUT_IMAGE_BASE.toLowerCase()
            && mediaTypeFromExtension(path.extname(file).toLowerCase()) === 'image');

    if (!match) return DEFAULT_ABOUT_IMAGE;

    return `/${relativeDir.replace(/\\/g, '/')}/${match}`;
}

function readCarouselSlides() {
    const relativeDir = 'uploads/home/carousel';
    const absDir = path.join(PUBLIC_ROOT, relativeDir);

    const slides = CAROUSEL_SLOTS.map((slot, index) => {
        const found = findCarouselSlotFile(absDir, slot);
        if (found) {
            return {
                type: found.type,
                src: `/${relativeDir.replace(/\\/g, '/')}/${found.file}`,
                title: slot.title,
                subtitle: slot.subtitle,
                slot: slot.id,
            };
        }
        return DEFAULT_CAROUSEL[index] ? { ...DEFAULT_CAROUSEL[index], slot: slot.id } : null;
    }).filter(Boolean);

    return slides.length ? slides : DEFAULT_CAROUSEL.slice(0, 4);
}

function readMediaFolder(relativeDir, defaults) {
    const absDir = path.join(PUBLIC_ROOT, relativeDir);
    try {
        if (!fs.existsSync(absDir)) return defaults;
        const files = fs.readdirSync(absDir)
            .filter((f) => !f.startsWith('.') && !f.endsWith('.md'))
            .sort();
        if (!files.length) return defaults;

        return files
            .filter((f) => fs.statSync(path.join(absDir, f)).isFile())
            .slice(0, 12)
            .map((file, index) => {
            const ext = path.extname(file).toLowerCase();
            const isVideo = ['.mp4', '.webm', '.ogg', '.mov'].includes(ext);
            return {
                type: isVideo ? 'video' : 'image',
                src: `/${relativeDir.replace(/\\/g, '/')}/${file}`,
                title: isVideo ? `Video ${index + 1}` : `Gallery ${index + 1}`,
                subtitle: 'RaktaSetu community',
                caption: `Our work — ${file.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')}`,
            };
        });
    } catch {
        return defaults;
    }
}

async function getPublicDonors() {
    const donors = await Donor.find({ status: 'approved', isAvailable: true })
        .populate('userId', 'name city profileImage')
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();

    return donors.map((d) => ({
        _id: d._id,
        bloodGroup: d.bloodGroup,
        city: d.userId?.city || '',
        name: d.userId?.name ? d.userId.name.split(' ')[0] + ' •••' : 'Verified donor',
        available: d.isAvailable,
    }));
}

async function getPublicBloodBanks() {
    const banks = await BloodBank.find({ status: 'approved' })
        .populate('userId', 'city phone')
        .sort({ hospitalName: 1 })
        .limit(100)
        .lean();

    return banks.map((b) => {
        const inventory = b.inventory || {};
        const stock = Object.values(inventory).reduce((sum, n) => sum + Number(n || 0), 0);
        return {
            _id: b._id,
            hospitalName: b.hospitalName,
            city: b.userId?.city || '',
            stock,
            phone: b.userId?.phone ? b.userId.phone.replace(/(\d{2})\d{5}(\d{3})/, '$1*****$2') : '',
        };
    });
}

async function getHomeStats() {
    const now = new Date();
    const [
        totalDonors,
        patientsReceivedBlood,
        upcomingCamps,
        campsOrganized,
        totalBloodBanks,
    ] = await Promise.all([
        Donor.countDocuments({ status: 'approved' }),
        Request.countDocuments({ status: { $in: ['received', 'fulfilled'] } }),
        CampEvent.countDocuments({ status: 'scheduled', proposedDate: { $gte: now } }),
        CampEvent.countDocuments({ status: 'completed' }),
        BloodBank.countDocuments({ status: 'approved' }),
    ]);

    return {
        totalDonors,
        patientsReceivedBlood,
        upcomingCamps,
        campsOrganized,
        totalBloodBanks,
    };
}

async function getHomePageData() {
    const [stats, donors, bloodBanks] = await Promise.all([
        getHomeStats(),
        getPublicDonors(),
        getPublicBloodBanks(),
    ]);

    const carouselSlides = readCarouselSlides();
    const galleryItems = readMediaFolder('uploads/home/gallery', DEFAULT_GALLERY);
    const aboutImageSrc = readAboutImageSrc();

    return {
        stats,
        donors,
        bloodBanks,
        carouselSlides,
        galleryItems,
        aboutImageSrc,
    };
}

module.exports = {
    getHomePageData,
    CAROUSEL_DIR,
    GALLERY_DIR,
    ABOUT_DIR,
    readAboutImageSrc,
};
