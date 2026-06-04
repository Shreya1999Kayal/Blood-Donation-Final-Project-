const { normalizeCity } = require('../utils/city');
const { parseCoordinates } = require('../utils/sanitizeGeo');
const {
    searchDonorsByCriteria,
    searchBloodBanksByCriteria,
    searchNearbyDonors,
    findNearbyBloodBanks,
} = require('../services/matchingService');

function hasQueryCoords(query) {
    const coords = parseCoordinates(query.longitude ?? query.lng, query.latitude ?? query.lat);
    return Boolean(coords && coords.length === 2 && !Number.isNaN(coords[0]) && !Number.isNaN(coords[1]));
}

function isGeoSearch(query) {
    return query.nearby === '1' && hasQueryCoords(query);
}

function resolveSearchLocation(query) {
    const coords = parseCoordinates(query.longitude ?? query.lng, query.latitude ?? query.lat);
    if (coords && coords.length === 2 && !Number.isNaN(coords[0]) && !Number.isNaN(coords[1])) {
        return { type: 'Point', coordinates: coords };
    }
    return { type: 'Point', coordinates: [72.8777, 19.0760] };
}

function serializeDonorResults(items) {
    return items.map(function (item) {
        const donorDoc = item.donor || item;
        const donor = typeof donorDoc.toObject === 'function' ? donorDoc.toObject() : donorDoc;
        return {
            donor,
            distanceKm: item.distanceKm ?? item._distanceKm ?? null,
            score: item.score ?? item._priorityScore ?? null,
        };
    });
}

function serializeBloodBankResults(items) {
    return items.map(function (item) {
        const bankDoc = item.bloodBank || item;
        const bloodBank = typeof bankDoc.toObject === 'function' ? bankDoc.toObject() : bankDoc;
        return {
            bloodBank,
            distanceKm: item.distanceKm ?? null,
            availableUnits: item.availableUnits,
        };
    });
}

async function searchDonors(req, res) {
    try {
        const { bloodGroup, city, availability, radiusKm = 20 } = req.query;
        const place = city ? normalizeCity(city) : '';
        const geoSearch = isGeoSearch(req.query);

        if (geoSearch) {
            const location = resolveSearchLocation(req.query);
            const results = await searchNearbyDonors({
                bloodGroup: bloodGroup || null,
                city: place || null,
                radiusKm,
                location,
                availability,
                limit: 50,
                geoSearch: true,
                exactBloodGroup: true,
            });

            return res.json({
                donors: serializeDonorResults(results),
                geoSearch: true,
            });
        }

        if (!bloodGroup && !place && !availability) {
            return res.json({
                donors: [],
                geoSearch: false,
                message: 'Choose a blood group and/or enter a city to search.',
            });
        }

        const results = await searchDonorsByCriteria({
            bloodGroup: bloodGroup || null,
            place,
            availability,
            limit: 50,
        });

        return res.json({
            donors: serializeDonorResults(results),
            geoSearch: false,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function searchBloodBanks(req, res) {
    try {
        const { bloodGroup, city, approval = 'approved', radiusKm = 20 } = req.query;
        const place = city ? normalizeCity(city) : '';
        const geoSearch = isGeoSearch(req.query);

        if (geoSearch) {
            const location = resolveSearchLocation(req.query);
            const bloodBanks = await findNearbyBloodBanks({
                bloodGroup: bloodGroup || null,
                city: place || null,
                radiusKm,
                location,
                approvedOnly: approval !== 'all',
                geoSearch: true,
            });
            return res.json({ bloodBanks: serializeBloodBankResults(bloodBanks), geoSearch: true });
        }

        if (!bloodGroup && !place) {
            return res.json({
                bloodBanks: [],
                geoSearch: false,
                message: 'Choose a blood group and/or enter a city to search.',
            });
        }

        const bloodBanks = await searchBloodBanksByCriteria({
            bloodGroup: bloodGroup || null,
            place,
            limit: 50,
        });

        return res.json({
            bloodBanks: serializeBloodBankResults(bloodBanks),
            geoSearch: false,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    searchDonors,
    searchBloodBanks,
};
