const User = require('../models/User');
const Donor = require('../models/Donor');
const BloodBank = require('../models/BloodBank');
const Request = require('../models/Request');
const DonationHistory = require('../models/DonationHistory');
const Notification = require('../models/Notification');

function countBy(items, keyGetter) {
    return items.reduce((acc, item) => {
        const key = keyGetter(item) || 'Unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
}

function bucketRiskScore(score) {
    const value = Number(score || 0);
    if (value < 20) return '0-19 (Low)';
    if (value < 45) return '20-44 (Moderate)';
    if (value < 70) return '45-69 (Elevated)';
    return '70+ (High)';
}

function averageEmergencyResponseMinutes(requests) {
    const durations = [];
    requests.forEach((request) => {
        if (!request.createdAt) return;
        const firstContact = (request.contacts || [])
            .map((c) => c.createdAt)
            .filter(Boolean)
            .sort((a, b) => new Date(a) - new Date(b))[0];
        const endTime = firstContact || request.receivedAt;
        if (!endTime) return;
        const minutes = (new Date(endTime) - new Date(request.createdAt)) / 60000;
        if (minutes >= 0 && minutes < 7 * 24 * 60) durations.push(minutes);
    });
    if (!durations.length) return null;
    const avg = durations.reduce((sum, n) => sum + n, 0) / durations.length;
    return Math.round(avg);
}

async function getAdminAnalytics() {
    const [users, donors, bloodBanks, requests, donations, recentNotifications] = await Promise.all([
        User.find(),
        Donor.find(),
        BloodBank.find(),
        Request.find(),
        DonationHistory.find(),
        Notification.find().sort({ createdAt: -1 }).limit(200),
    ]);

    const inventoryTotals = {};
    bloodBanks.forEach((bank) => {
        Object.entries(bank.inventory || {}).forEach(([group, count]) => {
            inventoryTotals[group] = (inventoryTotals[group] || 0) + Number(count || 0);
        });
    });

    const aiEligibilityCounts = countBy(donors, (d) => d.aiRiskAnalysis?.eligibility || 'Pending');
    const aiRiskDistribution = countBy(donors, (d) => bucketRiskScore(d.aiRiskAnalysis?.riskScore));
    const avgEmergencyResponseMinutes = averageEmergencyResponseMinutes(requests);

    return {
        totals: {
            patients: users.filter((u) => u.role === 'user').length,
            donors: donors.length,
            verifiedDonors: donors.filter((d) => d.status === 'approved').length,
            bloodBanks: bloodBanks.length,
            activeBloodBanks: bloodBanks.filter((b) => b.status === 'approved').length,
            activeRequests: requests.filter((r) => ['active', 'contacted'].includes(r.status)).length,
            donations: donations.length,
            aiFlaggedDonors: donors.filter((d) => (d.aiRiskAnalysis?.riskScore || 0) >= 45).length,
            bloodGroupMismatches: donors.filter((d) => d.aiRiskAnalysis?.bloodGroupMismatch).length,
        },
        donorsByStatus: countBy(donors, (d) => d.status),
        bloodbanksByStatus: countBy(bloodBanks, (b) => b.status),
        requestsByUrgency: countBy(requests, (r) => r.urgencyLevel),
        requestsByStatus: countBy(requests, (r) => r.status),
        inventoryTotals,
        aiEligibilityCounts,
        aiRiskDistribution,
        avgEmergencyResponseMinutes,
        patientsByPlan: countBy(
            users.filter((u) => u.role === 'user'),
            (u) => (u.subscription && u.subscription.plan) || 'free',
        ),
        notificationsByType: countBy(recentNotifications, (n) => n.type || 'system'),
    };
}

module.exports = { getAdminAnalytics };
