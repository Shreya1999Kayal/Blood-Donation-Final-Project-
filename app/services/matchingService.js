const geolib = require('geolib');
const Donor = require('../models/Donor');
const BloodBank = require('../models/BloodBank');
const { citiesMatch, placeSearchScore, normalizeCity, matchesPlaceCriteria } = require('../utils/city');
const { userHasFeature } = require('../utils/subscription');

const PRIORITY_LISTING_BONUS = 20;
const USER_POPULATE_FIELDS = 'name email phone city subscription featureFlags profileImage';
const ALL_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const COMPATIBLE_DONORS = {
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'A-': ['A-', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'B-': ['B-', 'O-'],
    'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    'AB-': ['A-', 'B-', 'AB-', 'O-'],
    'O+': ['O+', 'O-'],
    'O-': ['O-'],
};

function toLatLng(location) {
    const coordinates = location?.coordinates || [];
    const latitude = Number(coordinates[1]);
    const longitude = Number(coordinates[0]);
    const hasValidLatitude = Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
    const hasValidLongitude = Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
    return {
        latitude: hasValidLatitude ? latitude : 19.0760,
        longitude: hasValidLongitude ? longitude : 72.8777,
    };
}

function daysSince(date) {
    if (!date) return 999;
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

function isDonationCooldownOver(donor) {
    return daysSince(donor.lastDonationDate) >= 90;
}

function getDonorEligibilityCutoffDate() {
    return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
}

function isEligibleDonor(donor) {
    if (!donor || donor.status !== 'approved') return false;
    if (!donor.isAvailable) return false;
    return isDonationCooldownOver(donor);
}

function eligibleDonorQuery() {
    return {
        status: 'approved',
        isAvailable: true,
        $or: [
            { lastDonationDate: { $exists: false } },
            { lastDonationDate: null },
            { lastDonationDate: { $lte: getDonorEligibilityCutoffDate() } },
        ],
    };
}

function scoreDonor(donor, requestLocation) {
    const distanceMeters = geolib.getDistance(toLatLng(donor.location), toLatLng(requestLocation));
    const distanceKm = distanceMeters / 1000;
    const cooldownDays = daysSince(donor.lastDonationDate);
    const riskScore = donor.aiRiskAnalysis?.riskScore || 0;
    const responseCount = donor.responseCount || 0;

    let score = 100;
    score -= Math.min(distanceKm * 2, 35);
    score += donor.isAvailable ? 18 : -35;
    score += cooldownDays >= 90 ? 12 : -25;
    score -= Math.min(riskScore / 2, 35);
    score += Math.min(responseCount * 3, 15);
    if (donor.userId && userHasFeature(donor.userId, 'canUsePriorityListing')) {
        score += PRIORITY_LISTING_BONUS;
    }

    return {
        score: Math.max(0, Math.round(score)),
        distanceKm: Number(distanceKm.toFixed(2)),
        cooldownDays,
    };
}

function donorMatchesCity(donor, city) {
    if (!city) return true;
    return matchesPlaceCriteria(city, donor.userId?.city, donor.userId?.name);
}

function filterDonorsByBloodGroup(donors, bloodGroup, exactBloodGroup = false) {
    if (!bloodGroup) return donors;
    if (exactBloodGroup) {
        return donors.filter((donor) => donor.bloodGroup === bloodGroup);
    }
    const compatibleGroups = COMPATIBLE_DONORS[bloodGroup] || [bloodGroup];
    return donors.filter((donor) => compatibleGroups.includes(donor.bloodGroup));
}

function filterExactBloodGroupDonors(donors, requestedBloodGroup) {
    if (!requestedBloodGroup || !Array.isArray(donors)) return [];
    return donors.filter((donor) => donor && donor.bloodGroup === requestedBloodGroup);
}

function getCompatibleDonorGroups(requestedBloodGroup) {
    return COMPATIBLE_DONORS[requestedBloodGroup] || [requestedBloodGroup];
}

function isCompatibleDonorForRecipient(requestedBloodGroup, donorBloodGroup) {
    return getCompatibleDonorGroups(requestedBloodGroup).includes(donorBloodGroup);
}

async function getSmartMatchesForRequest(request, options = {}) {
    const limit = Number(options.limit) || 5;
    const bloodGroup = request.bloodGroup;
    const city = request.city;
    const location = request.location || { type: 'Point', coordinates: [72.8777, 19.0760] };

    const recommendedDonors = await recommendDonors({
        bloodGroup,
        location,
        city,
        radiusKm: options.radiusKm || 20,
        limit,
        geoSearch: false,
        exactBloodGroup: true,
    });

    const nearbyBloodBanks = (await findNearbyBloodBanks({
        bloodGroup,
        location,
        city,
        radiusKm: options.radiusKm || 20,
        geoSearch: false,
    })).slice(0, limit);

    return {
        recommendedDonors,
        nearbyBloodBanks,
        donorCount: recommendedDonors.length,
        bankCount: nearbyBloodBanks.length,
    };
}

function buildSmartMatchMessage(bloodGroup, city, donorCount, bankCount) {
    const place = city ? ` in ${city}` : ' in your area';
    if (!donorCount && !bankCount) {
        return `No ${bloodGroup} donors or stocked blood banks found${place} yet.`;
    }
    return `Found ${donorCount} ${bloodGroup} donor(s) and ${bankCount} blood bank(s) with stock${place}.`;
}

async function recommendDonors({ bloodGroup, location, city, radiusKm = 20, limit = 10, geoSearch = false, exactBloodGroup = false }) {
    const compatibleGroups = exactBloodGroup
        ? [bloodGroup]
        : (COMPATIBLE_DONORS[bloodGroup] || [bloodGroup]);
    const donors = await Donor.find({
        status: 'approved',
        isAvailable: true,
        bloodGroup: { $in: compatibleGroups },
    }).populate('userId', USER_POPULATE_FIELDS);

    return donors
        .filter((donor) => geoSearch || donorMatchesCity(donor, city))
        .filter((donor) => isDonationCooldownOver(donor))
        .map((donor) => ({ donor, ...scoreDonor(donor, location) }))
        .filter((item) => !geoSearch || item.distanceKm <= Number(radiusKm))
        .sort((a, b) => b.score - a.score)
        .slice(0, Number(limit));
}

async function searchDonorsByCriteria({ bloodGroup, place, availability, limit = 50 }) {
    const query = { status: 'approved' };
    if (availability === 'available') query.isAvailable = true;
    else if (availability === 'unavailable') query.isAvailable = false;

    let donors = await Donor.find(query).populate('userId', USER_POPULATE_FIELDS);
    const normalizedPlace = place ? normalizeCity(place) : '';

    if (bloodGroup) {
        donors = donors.filter((donor) => donor.bloodGroup === bloodGroup);
    }

    if (normalizedPlace) {
        donors = donors.filter((donor) => matchesPlaceCriteria(
            normalizedPlace,
            donor.userId?.city,
            donor.userId?.name
        ));
    }

    return donors
        .map((donor) => ({
            donor,
            placeScore: normalizedPlace
                ? placeSearchScore(normalizedPlace, donor.userId?.city, donor.userId?.name)
                : 0,
        }))
        .sort((a, b) => {
            if (b.placeScore !== a.placeScore) return b.placeScore - a.placeScore;
            return (a.donor.userId?.name || '').localeCompare(b.donor.userId?.name || '');
        })
        .slice(0, Number(limit));
}

async function searchBloodBanksByCriteria({ bloodGroup, place, limit = 50 }) {
    let bloodBanks = await BloodBank.find({ status: 'approved' }).populate('userId', USER_POPULATE_FIELDS);
    const normalizedPlace = place ? normalizeCity(place) : '';

    if (normalizedPlace) {
        bloodBanks = bloodBanks.filter((bank) => matchesPlaceCriteria(
            normalizedPlace,
            bank.userId?.city,
            bank.hospitalName
        ));
    }

    if (bloodGroup) {
        bloodBanks = bloodBanks.filter((bank) => Number(bank.inventory?.[bloodGroup] || 0) > 0);
    }

    return bloodBanks
        .map((bank) => ({
            bloodBank: bank,
            availableUnits: bloodGroup
                ? Number(bank.inventory?.[bloodGroup] || 0)
                : ALL_BLOOD_GROUPS.reduce(function (sum, group) {
                    return sum + Number(bank.inventory?.[group] || 0);
                }, 0),
            placeScore: normalizedPlace
                ? placeSearchScore(normalizedPlace, bank.userId?.city, bank.hospitalName)
                : 0,
        }))
        .sort((a, b) => {
            if (b.placeScore !== a.placeScore) return b.placeScore - a.placeScore;
            return (a.bloodBank.hospitalName || '').localeCompare(b.bloodBank.hospitalName || '');
        })
        .slice(0, Number(limit));
}

async function searchNearbyDonors({
    bloodGroup,
    location,
    city,
    radiusKm = 20,
    availability = '',
    limit = 50,
    geoSearch = true,
    exactBloodGroup = false,
}) {
    const query = { status: 'approved' };
    if (availability === 'available') query.isAvailable = true;
    else if (availability === 'unavailable') query.isAvailable = false;

    let donors = await Donor.find(query).populate('userId', USER_POPULATE_FIELDS);
    donors = filterDonorsByBloodGroup(donors, bloodGroup, exactBloodGroup);

    if (!geoSearch && city) {
        donors = donors.filter((donor) => matchesPlaceCriteria(city, donor.userId?.city, donor.userId?.name));
    }

    return donors
        .map((donor) => ({
            donor,
            ...scoreDonor(donor, location),
            placeScore: city ? placeSearchScore(city, donor.userId?.city, donor.userId?.name) : 0,
        }))
        .filter((item) => geoSearch && item.distanceKm <= Number(radiusKm))
        .sort((a, b) => {
            if (!geoSearch && city && b.placeScore !== a.placeScore) return b.placeScore - a.placeScore;
            return a.distanceKm - b.distanceKm || b.score - a.score;
        })
        .slice(0, Number(limit));
}

function bloodBankMatchesCity(bank, city) {
    if (!city) return true;
    return matchesPlaceCriteria(city, bank.userId?.city, bank.hospitalName);
}

async function findNearbyBloodBanks({
    bloodGroup,
    location,
    city,
    radiusKm = 20,
    approvedOnly = true,
    geoSearch = false,
}) {
    const query = approvedOnly ? { status: 'approved' } : {};
    const bloodBanks = await BloodBank.find(query).populate('userId', USER_POPULATE_FIELDS);

    return bloodBanks
        .filter((bank) => geoSearch || bloodBankMatchesCity(bank, city))
        .map((bank) => {
            const distanceKm = geolib.getDistance(toLatLng(bank.location), toLatLng(location)) / 1000;
            const priorityBonus = bank.userId && userHasFeature(bank.userId, 'canUsePriorityListing')
                ? PRIORITY_LISTING_BONUS
                : 0;
            const availableUnits = bloodGroup
                ? Number(bank.inventory?.[bloodGroup] || 0)
                : ALL_BLOOD_GROUPS.reduce(function (sum, group) {
                    return sum + Number(bank.inventory?.[group] || 0);
                }, 0);
            const placeScore = city
                ? placeSearchScore(city, bank.userId?.city, bank.hospitalName)
                : 0;
            return {
                bloodBank: bank,
                distanceKm: Number(distanceKm.toFixed(2)),
                availableUnits,
                priorityBonus,
                placeScore,
            };
        })
        .filter((item) => geoSearch && item.distanceKm <= Number(radiusKm))
        .filter((item) => !bloodGroup || item.availableUnits > 0)
        .sort((a, b) => {
            if (!geoSearch && city && b.placeScore !== a.placeScore) return b.placeScore - a.placeScore;
            return a.distanceKm - b.distanceKm || b.priorityBonus - a.priorityBonus || b.availableUnits - a.availableUnits;
        });
}

function sortDonorsForDisplay(donors, requestLocation = null) {
    return [...donors].sort((a, b) => {
        if (requestLocation) {
            const distA = scoreDonor(a, requestLocation).distanceKm;
            const distB = scoreDonor(b, requestLocation).distanceKm;
            if (distA !== distB) return distA - distB;
        }
        const priorityDiff = (userHasFeature(b.userId, 'canUsePriorityListing') ? 1 : 0)
            - (userHasFeature(a.userId, 'canUsePriorityListing') ? 1 : 0);
        if (priorityDiff !== 0) return priorityDiff;
        if (requestLocation) {
            return scoreDonor(b, requestLocation).score - scoreDonor(a, requestLocation).score;
        }
        return 0;
    });
}

function sortBloodBanksForDisplay(banks, requestLocation = null) {
    return [...banks].sort((a, b) => {
        if (requestLocation) {
            const distA = geolib.getDistance(toLatLng(a.location), toLatLng(requestLocation)) / 1000;
            const distB = geolib.getDistance(toLatLng(b.location), toLatLng(requestLocation)) / 1000;
            if (distA !== distB) return distA - distB;
        }
        return (userHasFeature(b.userId, 'canUsePriorityListing') ? 1 : 0)
            - (userHasFeature(a.userId, 'canUsePriorityListing') ? 1 : 0);
    });
}

module.exports = {
    COMPATIBLE_DONORS,
    USER_POPULATE_FIELDS,
    getSmartMatchesForRequest,
    buildSmartMatchMessage,
    recommendDonors,
    filterExactBloodGroupDonors,
    getCompatibleDonorGroups,
    isCompatibleDonorForRecipient,
    searchDonorsByCriteria,
    searchBloodBanksByCriteria,
    searchNearbyDonors,
    findNearbyBloodBanks,
    scoreDonor,
    isDonationCooldownOver,
    isEligibleDonor,
    eligibleDonorQuery,
    sortDonorsForDisplay,
    sortBloodBanksForDisplay,
};
