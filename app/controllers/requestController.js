const Request = require('../models/Request');
const Donor = require('../models/Donor');
const BloodBank = require('../models/BloodBank');
const DonationHistory = require('../models/DonationHistory');
const { recordBloodIssue, getIssueHistoryForBloodBank } = require('../services/bloodBankIssueService');
const { normalizeCity } = require('../utils/city');
const { parseCoordinates } = require('../utils/sanitizeGeo');
const { fetchBloodRequestsForUser } = require('../utils/requestQueries');
const { getNotificationsForUser, createNotification } = require('../services/notificationService');
const { fileToPublicUrl } = require('../utils/upload');
const { getSmartMatchesForRequest, buildSmartMatchMessage } = require('../services/matchingService');
const { sendCriticalRequestAlert } = require('../services/emailService');

function canDonateNow(donor) {
    if (!donor.lastDonationDate) return true;
    const days = Math.floor((Date.now() - new Date(donor.lastDonationDate).getTime()) / (1000 * 60 * 60 * 24));
    return days >= 90;
}

function emitRequestUpdate(req, event, payload) {
    if (req.io) {
        req.io.emit(event, payload);
        if (payload.city) {
            const city = payload.city.toLowerCase();
            req.io.to(city).emit(event, payload);
            req.io.to(`city:${city}`).emit(event, payload);
        }
    }
}

async function createRequest(req, res) {
    try {
        const { bloodGroup, hospitalName, requiredUnits, urgencyLevel } = req.body;
        const coordinates = parseCoordinates(req.body.longitude, req.body.latitude);

        if (!req.files?.bloodTestReport?.[0] || !req.files?.prescription?.[0]) {
            return res.redirect('/dashboard?error=patient_docs_required');
        }

        const newRequest = await Request.create({
            patientName: req.user.name,
            bloodGroup,
            hospitalName,
            contactName: req.user.name,
            contactPhone: req.user.phone,
            requiredUnits,
            location: { type: 'Point', coordinates },
            city: normalizeCity(req.user.city),
            requestedBy: req.user._id,
            status: 'active',
            patientDocuments: {
                bloodTestReportUrl: await fileToPublicUrl(req.files.bloodTestReport[0]),
                prescriptionUrl: await fileToPublicUrl(req.files.prescription[0]),
            },
            ...(urgencyLevel ? { urgencyLevel } : {}),
        });

        const smartMatches = await getSmartMatchesForRequest(newRequest, { limit: 5 });
        const { recommendedDonors, nearbyBloodBanks, donorCount, bankCount } = smartMatches;

        newRequest.matchedDonors = recommendedDonors.map((item) => item.donor._id);
        await newRequest.save();

        const matchMessage = buildSmartMatchMessage(
            newRequest.bloodGroup,
            newRequest.city,
            donorCount,
            bankCount
        );

        const payload = {
            requestId: newRequest._id,
            requestedBy: req.user._id,
            patientName: newRequest.patientName,
            bloodGroup: newRequest.bloodGroup,
            hospitalName: newRequest.hospitalName,
            requiredUnits: newRequest.requiredUnits,
            city: newRequest.city,
            status: newRequest.status,
            contactPhone: newRequest.contactPhone,
            matchedDonors: donorCount,
            nearbyBloodBanks: bankCount,
        };

        emitRequestUpdate(req, 'request_created', payload);
        emitRequestUpdate(req, 'new_blood_request', payload);
        emitRequestUpdate(req, 'donor_matched', payload);
        await createNotification(req, {
            title: 'Emergency blood request',
            message: `${newRequest.bloodGroup} needed at ${newRequest.hospitalName} in ${newRequest.city}.`,
            type: 'request',
            city: newRequest.city,
            roles: ['donor', 'bloodbank', 'admin'],
            link: '/request',
        });
        await createNotification(req, {
            title: 'Smart match complete',
            message: matchMessage,
            type: 'match',
            userId: req.user._id,
            link: '/dashboard#section-matches',
        });

        if (newRequest.urgencyLevel === 'Critical') {
            sendCriticalRequestAlert({ request: newRequest, patient: req.user }).catch((err) => {
                console.warn('Critical alert email failed:', err.message);
            });
        }

        res.redirect('/dashboard?msg=request_created');
    } catch (error) {
        res.redirect('/dashboard?error=upload_processing_failed');
    }
}

async function recordContact(req, res) {
    try {
        if (req.user.role === 'donor') {
            const donor = await Donor.findOne({ userId: req.user._id, status: 'approved' });
            if (!donor) {
                return res.redirect('/dashboard?error=donor_not_approved');
            }
            if (!canDonateNow(donor)) {
                return res.redirect('/dashboard?error=donor_cooldown');
            }
        }

        if (req.user.role === 'bloodbank') {
            const bloodbank = await BloodBank.findOne({ userId: req.user._id, status: 'approved' });
            if (!bloodbank) {
                return res.redirect('/dashboard?error=bloodbank_not_approved');
            }
        }

        const { note } = req.body;
        const bloodRequest = await Request.findById(req.params.id);

        if (!bloodRequest) {
            return res.status(404).send('Request not found');
        }

        if (['received', 'fulfilled', 'cancelled'].includes(bloodRequest.status)) {
            return res.redirect('/dashboard?error=request_closed');
        }

        const alreadyContacted = bloodRequest.contacts.some(
            (c) => c.userId && c.userId.toString() === req.user._id.toString()
        );

        if (!alreadyContacted) {
            bloodRequest.contacts.push({
                userId: req.user._id,
                role: req.user.role,
                name: req.user.name,
                phone: req.user.phone,
                note: note || '',
            });

            if (req.user.role === 'donor') {
                await Donor.findOneAndUpdate(
                    { userId: req.user._id },
                    { $inc: { responseCount: 1 } }
                );
            }
        }

        if (bloodRequest.status === 'active') {
            bloodRequest.status = 'contacted';
        }

        await bloodRequest.save();

        emitRequestUpdate(req, 'request_contacted', {
            requestId: bloodRequest._id,
            bloodGroup: bloodRequest.bloodGroup,
            hospitalName: bloodRequest.hospitalName,
            city: bloodRequest.city,
            status: bloodRequest.status,
            contactName: req.user.name,
            contactRole: req.user.role,
        });
        await createNotification(req, {
            title: 'Responder contacted patient',
            message: `${req.user.name} (${req.user.role}) contacted for ${bloodRequest.bloodGroup} at ${bloodRequest.hospitalName}.`,
            type: 'contact',
            userId: bloodRequest.requestedBy,
            roles: ['admin'],
            city: bloodRequest.city,
            link: '/dashboard',
        });

        res.redirect('/dashboard?msg=contact_recorded');
    } catch (error) {
        res.status(500).send('Error recording contact: ' + error.message);
    }
}

async function markReceived(req, res) {
    try {
        const bloodRequest = await Request.findById(req.params.id);

        if (!bloodRequest) {
            return res.status(404).send('Request not found');
        }

        if (bloodRequest.requestedBy.toString() !== req.user._id.toString()) {
            return res.status(403).send('You can only update your own requests');
        }

        if (['received', 'fulfilled', 'cancelled'].includes(bloodRequest.status)) {
            return res.redirect('/dashboard?error=already_received');
        }

        const selectedContact = bloodRequest.contacts.find(
            (contact) => contact.userId && contact.userId.toString() === req.body.responderUserId
        );

        if (!selectedContact || !['donor', 'bloodbank'].includes(selectedContact.role)) {
            return res.redirect('/dashboard?error=select_responder');
        }

        bloodRequest.status = 'received';
        bloodRequest.receivedAt = new Date();
        bloodRequest.fulfilledBy = {
            userId: selectedContact.userId,
            role: selectedContact.role,
            name: selectedContact.name,
            phone: selectedContact.phone,
        };
        await bloodRequest.save();

        if (selectedContact.role === 'donor') {
            const donor = await Donor.findOne({ userId: selectedContact.userId });
            if (!donor) {
                return res.redirect('/dashboard?error=donor_profile_missing');
            }

            donor.lastDonationDate = new Date();
            donor.isAvailable = false;
            await donor.save();

            await DonationHistory.create({
                donorId: donor._id,
                requestId: bloodRequest._id,
                hospitalName: bloodRequest.hospitalName,
                bloodGroup: bloodRequest.bloodGroup,
                units: bloodRequest.requiredUnits,
                verifiedBy: req.user._id,
            });
        } else if (selectedContact.role === 'bloodbank') {
            const bloodbank = await BloodBank.findOne({ userId: selectedContact.userId });
            if (!bloodbank) {
                return res.redirect('/dashboard?error=bloodbank_not_found');
            }

            await recordBloodIssue({
                bloodbank,
                bloodRequest,
                patientUserId: bloodRequest.requestedBy,
                verifiedByUserId: req.user._id,
            });
        }

        emitRequestUpdate(req, 'request_received', {
            requestId: bloodRequest._id,
            patientName: bloodRequest.patientName,
            bloodGroup: bloodRequest.bloodGroup,
            hospitalName: bloodRequest.hospitalName,
            city: bloodRequest.city,
            status: bloodRequest.status,
        });
        emitRequestUpdate(req, 'request_resolved', {
            requestId: bloodRequest._id,
            requestedBy: bloodRequest.requestedBy,
            bloodGroup: bloodRequest.bloodGroup,
            hospitalName: bloodRequest.hospitalName,
            city: bloodRequest.city,
            status: bloodRequest.status,
        });
        await createNotification(req, {
            title: 'Blood request fulfilled',
            message: `Your ${bloodRequest.bloodGroup} request at ${bloodRequest.hospitalName} was marked received from ${bloodRequest.fulfilledBy.name}.`,
            type: 'received',
            userId: bloodRequest.requestedBy,
            link: '/dashboard#section-requests',
        });
        await createNotification(req, {
            title: 'Blood request received',
            message: `${bloodRequest.bloodGroup} request at ${bloodRequest.hospitalName} was marked received from ${bloodRequest.fulfilledBy.name}.`,
            type: 'received',
            city: bloodRequest.city,
            roles: ['admin'],
            userId: bloodRequest.fulfilledBy.userId,
            link: '/dashboard',
        });

        res.redirect('/dashboard?msg=marked_received');
    } catch (error) {
        res.status(500).send('Error updating request: ' + error.message);
    }
}

async function listRequests(req, res) {
    try {
        const requests = await fetchBloodRequestsForUser(req.user, { includeCancelled: false });
        const notifications = await getNotificationsForUser(req.user);

        if (req.user.role === 'user') {
            return res.render('patient-requests-list', { requests, user: req.user, notifications });
        }

        const donorProfile = req.user.role === 'donor'
            ? await Donor.findOne({ userId: req.user._id })
            : null;
        const bloodbank = req.user.role === 'bloodbank'
            ? await BloodBank.findOne({ userId: req.user._id })
            : null;
        res.render('requests', { requests, user: req.user, donorProfile, bloodbank, notifications });
    } catch (error) {
        res.status(500).send('Error fetching requests: ' + error.message);
    }
}

module.exports = {
    createRequest,
    recordContact,
    markReceived,
    listRequests,
};
