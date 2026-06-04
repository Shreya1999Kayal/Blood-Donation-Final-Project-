const DEFAULT_LAT = 19.0760;
const DEFAULT_LNG = 72.8777;

function isValidLatitude(value) {
    return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
    return Number.isFinite(value) && value >= -180 && value <= 180;
}

/**
 * Normalize or remove latitude/longitude from request body before Joi validation.
 * Empty hidden inputs submit "" which Joi rejects as non-numbers.
 */
function sanitizeGeoFields(body, { applyDefaults = false } = {}) {
    if (!body || typeof body !== 'object') return body;

    const latRaw = body.latitude;
    const lngRaw = body.longitude;

    const latStr = latRaw === undefined || latRaw === null ? '' : String(latRaw).trim();
    const lngStr = lngRaw === undefined || lngRaw === null ? '' : String(lngRaw).trim();

    const latNum = latStr === '' ? NaN : Number(latStr);
    const lngNum = lngStr === '' ? NaN : Number(lngStr);

    if (isValidLatitude(latNum) && isValidLongitude(lngNum)) {
        body.latitude = latNum;
        body.longitude = lngNum;
        return body;
    }

    delete body.latitude;
    delete body.longitude;

    if (applyDefaults) {
        body.latitude = DEFAULT_LAT;
        body.longitude = DEFAULT_LNG;
    }

    return body;
}

function parseCoordinates(longitudeRaw, latitudeRaw) {
    const longitude = Number(longitudeRaw);
    const latitude = Number(latitudeRaw);
    if (isValidLongitude(longitude) && isValidLatitude(latitude)) return [longitude, latitude];
    return [DEFAULT_LNG, DEFAULT_LAT];
}

function buildLocationFromBody(body) {
    const [longitude, latitude] = parseCoordinates(body?.longitude, body?.latitude);
    return { type: 'Point', coordinates: [longitude, latitude] };
}

module.exports = {
    sanitizeGeoFields,
    parseCoordinates,
    buildLocationFromBody,
    DEFAULT_LAT,
    DEFAULT_LNG,
};
