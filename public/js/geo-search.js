(function () {
    'use strict';

    const DEFAULT_COORDS = { latitude: 19.076, longitude: 72.8777 };
    let cachedCoords = null;
    let usingDeviceLocation = false;

    function ensureHiddenInputs(form) {
        let latInput = form.querySelector('[data-geo-lat]');
        let lngInput = form.querySelector('[data-geo-lng]');
        if (!latInput) {
            latInput = document.createElement('input');
            latInput.type = 'hidden';
            latInput.name = 'latitude';
            latInput.setAttribute('data-geo-lat', '');
            form.appendChild(latInput);
        }
        if (!lngInput) {
            lngInput = document.createElement('input');
            lngInput.type = 'hidden';
            lngInput.name = 'longitude';
            lngInput.setAttribute('data-geo-lng', '');
            form.appendChild(lngInput);
        }
        return { latInput, lngInput };
    }

    function fillFormCoords(form, coords) {
        const { latInput, lngInput } = ensureHiddenInputs(form);
        latInput.value = String(coords.latitude);
        lngInput.value = String(coords.longitude);
    }

    function getCoords() {
        return cachedCoords || DEFAULT_COORDS;
    }

    function isDeviceLocation() {
        return usingDeviceLocation;
    }

    function refreshGeolocation() {
        return new Promise(function (resolve) {
            if (!navigator.geolocation) {
                cachedCoords = DEFAULT_COORDS;
                usingDeviceLocation = false;
                resolve(cachedCoords);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                function (pos) {
                    cachedCoords = {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                    };
                    usingDeviceLocation = true;
                    resolve(cachedCoords);
                },
                function () {
                    cachedCoords = DEFAULT_COORDS;
                    usingDeviceLocation = false;
                    resolve(cachedCoords);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        });
    }

    function initGeolocation(callback) {
        if (cachedCoords) {
            callback(cachedCoords);
            return;
        }
        refreshGeolocation().then(callback);
    }

    function initSearchForms(selector) {
        const forms = document.querySelectorAll(selector || '[data-search-geo-form]');
        forms.forEach(function (form) {
            initGeolocation(function (coords) {
                fillFormCoords(form, coords);
            });
        });
    }

    function initRadiusPresets(containerSelector) {
        document.querySelectorAll(containerSelector || '[data-radius-presets]').forEach(function (wrap) {
            const form = wrap.closest('form') || wrap.querySelector('form');
            const input = wrap.querySelector('[data-radius-input]') || (form && form.querySelector('[name="radiusKm"]'));
            if (!input) return;

            wrap.querySelectorAll('[data-radius-km]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const km = btn.getAttribute('data-radius-km');
                    input.value = km;
                    wrap.querySelectorAll('[data-radius-km]').forEach(function (b) {
                        b.classList.toggle('active', b === btn);
                    });
                });
            });
        });
    }

    function updateStatusElement(el, coords) {
        if (!el) return;
        if (usingDeviceLocation) {
            el.textContent = 'Using your location · ' + coords.latitude.toFixed(4) + ', ' + coords.longitude.toFixed(4);
            el.classList.remove('text-warning');
            el.classList.add('text-success');
        } else {
            el.textContent = 'Location unavailable — showing default area. Allow location for accurate near-me results.';
            el.classList.remove('text-success');
            el.classList.add('text-warning');
        }
    }

    window.RaktaSetuGeoSearch = {
        getCoords,
        isDeviceLocation,
        refreshGeolocation,
        initSearchForms,
        initRadiusPresets,
        fillFormCoords,
        updateStatusElement,
    };

    document.addEventListener('DOMContentLoaded', function () {
        initSearchForms('[data-search-geo-form]');
        initRadiusPresets('[data-radius-presets]');
        refreshGeolocation().then(function (coords) {
            document.querySelectorAll('[data-geo-status]').forEach(function (el) {
                updateStatusElement(el, coords);
            });
        });
    });
})();
