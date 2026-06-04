const Request = require('../models/Request');
const { userHasFeature } = require('../utils/subscription');
const { filterExactBloodGroupDonors } = require('../services/matchingService');

function requestPriorityScore(request) {
    let score = 0;
    if (request.isPriorityBoost && request.boostedUntil && new Date(request.boostedUntil) > new Date()) {
        score += 1000;
    }
    if (request.requestedBy && userHasFeature(request.requestedBy, 'canUsePriorityListing')) {
        score += 100;
    }
    return score;
}

async function fetchBloodRequestsForUser(user, options = {}) {
    const { includeCancelled = true } = options;

    const query = includeCancelled ? {} : { status: { $nin: ['cancelled'] } };

    let requests = await Request.find(query)
        .populate('requestedBy', 'name email phone city subscription featureFlags')
        .populate('contacts.userId', 'name role')
        .populate({
            path: 'matchedDonors',
            populate: { path: 'userId', select: 'name phone city' },
        });

    requests = requests.sort((a, b) => {
        const diff = requestPriorityScore(b) - requestPriorityScore(a);
        if (diff !== 0) return diff;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    if (user.role === 'user') {
        requests = requests.filter(
            (r) => r.requestedBy && r.requestedBy._id.toString() === user._id.toString()
        );
    }

    requests.forEach(function (request) {
        request.matchedDonors = filterExactBloodGroupDonors(request.matchedDonors, request.bloodGroup);
    });

    return requests;
}

module.exports = { fetchBloodRequestsForUser };
