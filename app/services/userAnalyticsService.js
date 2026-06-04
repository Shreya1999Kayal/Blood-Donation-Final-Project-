const Request = require('../models/Request');
const DonationHistory = require('../models/DonationHistory');
const Donor = require('../models/Donor');
const BloodBank = require('../models/BloodBank');

function countBy(items, keyGetter) {
    return items.reduce((acc, item) => {
        const key = keyGetter(item) || 'Unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
}

async function getUserAnalytics(user) {
    if (user.role === 'user') {
        const requests = await Request.find({ requestedBy: user._id }).lean();
        const withContacts = requests.filter((r) => (r.contacts || []).length > 0);
        return {
            role: 'user',
            totalRequests: requests.length,
            activeRequests: requests.filter((r) => ['active', 'contacted'].includes(r.status)).length,
            receivedRequests: requests.filter((r) => r.status === 'received').length,
            totalResponses: requests.reduce((sum, r) => sum + (r.contacts || []).length, 0),
            requestsByStatus: countBy(requests, (r) => r.status),
            requestsByUrgency: countBy(requests, (r) => r.urgencyLevel),
            responseRate: requests.length
                ? Math.round((withContacts.length / requests.length) * 100)
                : 0,
        };
    }

    if (user.role === 'donor') {
        const donor = await Donor.findOne({ userId: user._id }).lean();
        if (!donor) {
            return { role: 'donor', message: 'Complete donor registration to see analytics.' };
        }
        const donations = await DonationHistory.find({ donorId: donor._id }).lean();
        const lastDonation = donor.lastDonationDate ? new Date(donor.lastDonationDate) : null;
        const cooldownDays = lastDonation
            ? Math.max(0, 90 - Math.floor((Date.now() - lastDonation.getTime()) / 86400000))
            : 0;
        return {
            role: 'donor',
            bloodGroup: donor.bloodGroup,
            status: donor.status,
            isAvailable: donor.isAvailable,
            responseCount: donor.responseCount || 0,
            totalDonations: donations.length,
            cooldownDaysRemaining: cooldownDays,
            eligibleNow: donor.status === 'approved' && donor.isAvailable && cooldownDays === 0,
        };
    }

    if (user.role === 'bloodbank') {
        const bank = await BloodBank.findOne({ userId: user._id }).lean();
        if (!bank) {
            return { role: 'bloodbank', message: 'Complete blood bank setup to see analytics.' };
        }
        const respondedRequests = await Request.find({ 'contacts.userId': user._id }).lean();
        const totalUnits = Object.values(bank.inventory || {}).reduce((s, n) => s + Number(n || 0), 0);
        return {
            role: 'bloodbank',
            hospitalName: bank.hospitalName,
            status: bank.status,
            totalInventoryUnits: totalUnits,
            inventory: bank.inventory || {},
            requestsContacted: respondedRequests.length,
            activeEmergencies: respondedRequests.filter((r) => ['active', 'contacted'].includes(r.status)).length,
            fulfilledRequests: respondedRequests.filter((r) => r.status === 'received').length,
        };
    }

    return null;
}

module.exports = { getUserAnalytics };
