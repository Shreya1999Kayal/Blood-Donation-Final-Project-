function normalizeCity(city) {
    if (!city || typeof city !== 'string') return '';
    return city.trim().toLowerCase().replace(/[,./_-]+/g, ' ').replace(/\s+/g, ' ');
}

function citiesMatch(cityA, cityB) {
    const a = normalizeCity(cityA);
    const b = normalizeCity(cityB);
    if (!a || !b) return false;
    if (a === b) return true;
    return a.includes(b) || b.includes(a);
}

function placeSearchScore(searchPlace, entityCity, entityName) {
    const query = normalizeCity(searchPlace);
    if (!query) return 0;

    const city = normalizeCity(entityCity);
    const name = (entityName || '').toLowerCase().replace(/[,./_-]+/g, ' ');
    let score = 0;

    if (city === query) score += 120;
    else if (city && (city.includes(query) || query.includes(city))) score += 90;

    if (name.includes(query)) score += 80;

    query.split(' ').filter(function (token) { return token.length > 2; }).forEach(function (token) {
        if (city.includes(token)) score += 15;
        if (name.includes(token)) score += 25;
    });

    return score;
}

function matchesPlaceCriteria(searchPlace, entityCity, entityName) {
    const query = normalizeCity(searchPlace);
    if (!query) return true;

    const city = normalizeCity(entityCity);
    const name = normalizeCity(entityName || '');

    if (citiesMatch(query, city)) return true;
    if (name && (name.includes(query) || query.includes(name))) return true;

    const tokens = query.split(' ').filter(function (token) { return token.length > 2; });
    if (!tokens.length) return citiesMatch(query, city);

    const cityHits = tokens.filter(function (token) { return city && city.includes(token); }).length;
    const nameHits = tokens.filter(function (token) { return name && name.includes(token); }).length;
    const requiredHits = tokens.length === 1 ? 1 : Math.min(2, tokens.length);

    return (cityHits + nameHits) >= requiredHits;
}

module.exports = { normalizeCity, citiesMatch, placeSearchScore, matchesPlaceCriteria };
