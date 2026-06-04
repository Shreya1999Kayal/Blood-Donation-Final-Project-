const BloodBank = require('../models/BloodBank');
const User = require('../models/User');
const { fileToPublicUrl } = require('../utils/upload');
const { parseCoordinates } = require('../utils/sanitizeGeo');
const { createNotification } = require('../services/notificationService');

async function showSetup(req, res) {
    const existing = await BloodBank.findOne({ userId: req.user._id });
    if (existing) return res.redirect('/dashboard');
    const error = req.query.error === 'certificate_required' ? 'certificate_required' : null;
    res.render('bloodbank-setup', { error });
}

async function setup(req, res) {
    try {
        if (!req.files?.registrationCertificate?.[0]) {
            return res.redirect('/bloodbank/setup?error=certificate_required');
        }

        const { hospitalName } = req.body;
        const coordinates = parseCoordinates(req.body.longitude, req.body.latitude);
        const certificateUrl = await fileToPublicUrl(req.files.registrationCertificate[0]);

        await BloodBank.create({
            userId: req.user._id,
            hospitalName,
            registrationCertificateUrl: certificateUrl,
            location: { type: 'Point', coordinates },
            status: 'pending',
        });
        await createNotification(req, {
            title: 'New blood bank registration',
            message: `${hospitalName} submitted registration certificate for review.`,
            type: 'approval',
            roles: ['admin'],
            link: '/dashboard',
        });
        res.redirect('/dashboard?msg=bloodbank_submitted');
    } catch (error) {
        res.redirect('/dashboard?error=upload_processing_failed');
    }
}

async function updateProfile(req, res) {
    try {
        const bloodbank = await BloodBank.findOne({ userId: req.user._id });
        if (!bloodbank) return res.redirect('/bloodbank/setup');

        bloodbank.hospitalName = req.body.hospitalName;
        bloodbank.location = {
            type: 'Point',
            coordinates: parseCoordinates(req.body.longitude, req.body.latitude),
        };
        await bloodbank.save();
        res.redirect('/dashboard?msg=bloodbank_profile_updated');
    } catch (error) {
        res.status(500).send('Error updating blood bank profile: ' + error.message);
    }
}

async function updateCertificate(req, res) {
    try {
        const bloodbank = await BloodBank.findOne({ userId: req.user._id });
        if (!bloodbank) return res.redirect('/bloodbank/setup');

        if (!req.files?.registrationCertificate?.[0]) {
            return res.redirect('/dashboard?error=bloodbank_certificate_required');
        }

        const newUrl = await fileToPublicUrl(req.files.registrationCertificate[0]);
        if (!newUrl) {
            return res.redirect('/dashboard?error=upload_processing_failed');
        }

        const previousUrl = bloodbank.registrationCertificateUrl;
        const wasApproved = bloodbank.status === 'approved';

        bloodbank.registrationCertificateUrl = newUrl;
        if (newUrl !== previousUrl && wasApproved) {
            bloodbank.status = 'pending';
            await User.findByIdAndUpdate(bloodbank.userId, { isVerified: false });
            await bloodbank.save();
            await createNotification(req, {
                title: 'Blood bank certificate updated',
                message: `${bloodbank.hospitalName} uploaded a new certificate and needs admin re-verification.`,
                type: 'approval',
                roles: ['admin'],
                link: '/dashboard',
            });
            return res.redirect('/dashboard?msg=bloodbank_certificate_reverify');
        }

        if (!previousUrl) {
            bloodbank.status = 'pending';
        }

        await bloodbank.save();
        res.redirect('/dashboard?msg=bloodbank_certificate_updated');
    } catch (error) {
        res.redirect('/dashboard?error=upload_processing_failed');
    }
}

async function updateInventory(req, res) {
    try {
        const bloodbank = await BloodBank.findOne({ userId: req.user._id });
        if (!bloodbank) return res.redirect('/bloodbank/setup');
        if (bloodbank.status !== 'approved') {
            return res.redirect('/dashboard?error=bloodbank_not_approved');
        }

        bloodbank.inventory = {
            'A+': req.body['A+'] || 0,
            'A-': req.body['A-'] || 0,
            'B+': req.body['B+'] || 0,
            'B-': req.body['B-'] || 0,
            'AB+': req.body['AB+'] || 0,
            'AB-': req.body['AB-'] || 0,
            'O+': req.body['O+'] || 0,
            'O-': req.body['O-'] || 0,
        };
        await bloodbank.save();
        res.redirect('/dashboard');
    } catch (error) {
        res.status(500).send('Error updating inventory: ' + error.message);
    }
}

async function getInventory(req, res) {
    try {
        const bloodbank = await BloodBank.findOne({ userId: req.user._id });
        if (!bloodbank) {
            return res.status(404).json({ ok: false, error: 'Blood bank profile not found' });
        }

        const inventory = bloodbank.inventory || {};
        const totalUnits = Object.values(inventory).reduce((sum, count) => sum + Number(count || 0), 0);

        res.json({
            ok: true,
            hospitalName: bloodbank.hospitalName,
            status: bloodbank.status,
            inventory,
            totalUnits,
            updatedAt: bloodbank.updatedAt,
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
}

module.exports = {
    showSetup,
    setup,
    updateProfile,
    updateCertificate,
    updateInventory,
    getInventory,
};
