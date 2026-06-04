const Donor = require('../models/Donor');
const BloodBank = require('../models/BloodBank');
const Camp = require('../models/Camp');
const User = require('../models/User');
const { createNotification } = require('../services/notificationService');
const adminEntityService = require('../services/adminEntityService');

function adminRedirect(res, section, { msg, error } = {}) {
    const params = new URLSearchParams();
    if (msg) params.set('msg', msg);
    if (error) params.set('error', error);
    const query = params.toString();
    res.redirect(`/dashboard${query ? `?${query}` : ''}#section-${section}`);
}

function handleAdminError(res, section, error) {
    if (error.code === 'DUPLICATE_EMAIL') {
        return adminRedirect(res, section, { error: error.message });
    }
    if (error.code === 'NOT_FOUND') {
        return adminRedirect(res, section, { error: error.message });
    }
    return adminRedirect(res, section, { error: error.message || 'Operation failed' });
}

async function approveDonor(req, res) {
    try {
        const donor = await Donor.findByIdAndUpdate(
            req.params.id,
            { status: 'approved' },
            { new: true }
        );
        if (!donor) return res.status(404).send('Donor not found');
        await User.findByIdAndUpdate(donor.userId, { isVerified: true });
        await createNotification(req, {
            title: 'Donor approved',
            message: 'Your donor profile has been approved. You can now respond to eligible requests.',
            type: 'approval',
            userId: donor.userId,
            link: '/dashboard',
        });
        adminRedirect(res, 'donors', { msg: 'donor_approved' });
    } catch (error) {
        res.status(500).send('Error approving donor: ' + error.message);
    }
}

async function rejectDonor(req, res) {
    try {
        const donor = await Donor.findByIdAndUpdate(
            req.params.id,
            { status: 'rejected' },
            { new: true }
        );
        if (!donor) return res.status(404).send('Donor not found');
        await User.findByIdAndUpdate(donor.userId, { isVerified: false });
        await createNotification(req, {
            title: 'Donor rejected',
            message: 'Your donor profile was rejected. Please review and update your documents.',
            type: 'approval',
            userId: donor.userId,
            link: '/dashboard',
        });
        adminRedirect(res, 'donors', { msg: 'donor_rejected' });
    } catch (error) {
        res.status(500).send('Error rejecting donor: ' + error.message);
    }
}

async function approveBloodBank(req, res) {
    try {
        const bloodbank = await BloodBank.findById(req.params.id);
        if (!bloodbank) return res.status(404).send('Blood bank not found');
        if (!bloodbank.registrationCertificateUrl) {
            return adminRedirect(res, 'bloodbanks', { error: 'bloodbank_certificate_missing' });
        }

        bloodbank.status = 'approved';
        await bloodbank.save();
        await User.findByIdAndUpdate(bloodbank.userId, { isVerified: true });
        await createNotification(req, {
            title: 'Blood bank approved',
            message: 'Your blood bank profile has been approved. You can now respond to requests and manage inventory.',
            type: 'approval',
            userId: bloodbank.userId,
            link: '/dashboard',
        });
        adminRedirect(res, 'bloodbanks', { msg: 'bloodbank_approved' });
    } catch (error) {
        res.status(500).send('Error approving blood bank: ' + error.message);
    }
}

async function rejectBloodBank(req, res) {
    try {
        const bloodbank = await BloodBank.findByIdAndUpdate(
            req.params.id,
            { status: 'rejected' },
            { new: true }
        );
        if (!bloodbank) return res.status(404).send('Blood bank not found');
        await User.findByIdAndUpdate(bloodbank.userId, { isVerified: false });
        await createNotification(req, {
            title: 'Blood bank rejected',
            message: 'Your blood bank profile was rejected. Please contact admin or update your details.',
            type: 'approval',
            userId: bloodbank.userId,
            link: '/dashboard',
        });
        adminRedirect(res, 'bloodbanks', { msg: 'bloodbank_rejected' });
    } catch (error) {
        res.status(500).send('Error rejecting blood bank: ' + error.message);
    }
}

async function approveCamp(req, res) {
    try {
        const camp = await Camp.findByIdAndUpdate(
            req.params.id,
            { status: 'approved' },
            { new: true }
        );
        if (!camp) return res.status(404).send('Camp organization not found');
        await User.findByIdAndUpdate(camp.userId, { isVerified: true });
        await createNotification(req, {
            title: 'Camp organization approved',
            message: 'Your blood donation camp profile has been approved. You can now browse donors and blood banks.',
            type: 'approval',
            userId: camp.userId,
            link: '/dashboard',
        });
        adminRedirect(res, 'camps', { msg: 'camp_approved' });
    } catch (error) {
        res.status(500).send('Error approving camp: ' + error.message);
    }
}

async function rejectCamp(req, res) {
    try {
        const camp = await Camp.findByIdAndUpdate(
            req.params.id,
            { status: 'rejected' },
            { new: true }
        );
        if (!camp) return res.status(404).send('Camp organization not found');
        await User.findByIdAndUpdate(camp.userId, { isVerified: false });
        await createNotification(req, {
            title: 'Camp organization rejected',
            message: 'Your camp registration was rejected. Please update details or contact admin.',
            type: 'approval',
            userId: camp.userId,
            link: '/dashboard',
        });
        adminRedirect(res, 'camps', { msg: 'camp_rejected' });
    } catch (error) {
        res.status(500).send('Error rejecting camp: ' + error.message);
    }
}

async function createPatient(req, res) {
    try {
        await adminEntityService.createPatient(req.body);
        adminRedirect(res, 'patients', { msg: 'patient_created' });
    } catch (error) {
        handleAdminError(res, 'patients', error);
    }
}

async function updatePatient(req, res) {
    try {
        await adminEntityService.updatePatient(req.params.id, req.body);
        adminRedirect(res, 'patients', { msg: 'patient_updated' });
    } catch (error) {
        handleAdminError(res, 'patients', error);
    }
}

async function deletePatient(req, res) {
    try {
        await adminEntityService.deletePatient(req.params.id);
        adminRedirect(res, 'patients', { msg: 'patient_deleted' });
    } catch (error) {
        handleAdminError(res, 'patients', error);
    }
}

async function createDonor(req, res) {
    try {
        await adminEntityService.createDonor(req.body);
        adminRedirect(res, 'donors', { msg: 'donor_created' });
    } catch (error) {
        handleAdminError(res, 'donors', error);
    }
}

async function updateDonor(req, res) {
    try {
        await adminEntityService.updateDonor(req.params.id, req.body);
        adminRedirect(res, 'donors', { msg: 'donor_updated' });
    } catch (error) {
        handleAdminError(res, 'donors', error);
    }
}

async function deleteDonor(req, res) {
    try {
        await adminEntityService.deleteDonor(req.params.id);
        adminRedirect(res, 'donors', { msg: 'donor_deleted' });
    } catch (error) {
        handleAdminError(res, 'donors', error);
    }
}

async function createBloodBank(req, res) {
    try {
        await adminEntityService.createBloodBank(req.body);
        adminRedirect(res, 'bloodbanks', { msg: 'bloodbank_created' });
    } catch (error) {
        handleAdminError(res, 'bloodbanks', error);
    }
}

async function updateBloodBank(req, res) {
    try {
        await adminEntityService.updateBloodBank(req.params.id, req.body);
        adminRedirect(res, 'bloodbanks', { msg: 'bloodbank_updated' });
    } catch (error) {
        handleAdminError(res, 'bloodbanks', error);
    }
}

async function deleteBloodBank(req, res) {
    try {
        await adminEntityService.deleteBloodBank(req.params.id);
        adminRedirect(res, 'bloodbanks', { msg: 'bloodbank_deleted' });
    } catch (error) {
        handleAdminError(res, 'bloodbanks', error);
    }
}

async function createCamp(req, res) {
    try {
        await adminEntityService.createCamp(req.body);
        adminRedirect(res, 'camps', { msg: 'camp_created' });
    } catch (error) {
        handleAdminError(res, 'camps', error);
    }
}

async function updateCamp(req, res) {
    try {
        await adminEntityService.updateCamp(req.params.id, req.body);
        adminRedirect(res, 'camps', { msg: 'camp_updated' });
    } catch (error) {
        handleAdminError(res, 'camps', error);
    }
}

async function deleteCamp(req, res) {
    try {
        await adminEntityService.deleteCamp(req.params.id);
        adminRedirect(res, 'camps', { msg: 'camp_deleted' });
    } catch (error) {
        handleAdminError(res, 'camps', error);
    }
}

async function getMedicalReview(req, res) {
    try {
        const donor = await Donor.findById(req.params.id).populate('userId', 'name email phone city profileImage');
        if (!donor) {
            if (req.accepts('json')) return res.status(404).json({ ok: false, error: 'Donor not found' });
            return res.status(404).send('Donor not found');
        }

        const ai = donor.aiRiskAnalysis || {};
        const payload = {
            ok: true,
            donor: {
                id: donor._id,
                bloodGroup: donor.bloodGroup,
                status: donor.status,
                isAvailable: donor.isAvailable,
                medicalReports: donor.medicalReports,
                createdAt: donor.createdAt,
                updatedAt: donor.updatedAt,
            },
            user: donor.userId,
            aiAnalysis: {
                riskScore: ai.riskScore,
                eligibility: ai.eligibility,
                detectedDiseases: ai.detectedDiseases || [],
                bloodGroupMismatch: ai.bloodGroupMismatch,
                extractedBloodGroup: ai.extractedBloodGroup,
                summary: ai.analysisSummary,
                notes: ai.analysisNotes,
                provider: ai.analysisProvider,
                analyzedAt: ai.analyzedAt,
            },
            ocrExcerpts: ai.ocrExcerpts || {},
        };

        if (req.query.format === 'json' || (req.get('accept') || '').includes('application/json')) {
            return res.json(payload);
        }

        res.render('admin-medical-review', {
            user: req.user,
            donor,
            donorUser: donor.userId,
            ai,
            payload,
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
}

module.exports = {
    approveDonor,
    rejectDonor,
    approveBloodBank,
    rejectBloodBank,
    approveCamp,
    rejectCamp,
    createPatient,
    updatePatient,
    deletePatient,
    createDonor,
    updateDonor,
    deleteDonor,
    createBloodBank,
    updateBloodBank,
    deleteBloodBank,
    createCamp,
    updateCamp,
    deleteCamp,
    getMedicalReview,
};
