(function () {
    const sidebar = document.getElementById('ptSidebar');
    const overlay = document.getElementById('ptOverlay');
    const hamburger = document.getElementById('ptHamburger');
    const pageTitle = document.getElementById('ptPageTitle');
    const links = document.querySelectorAll('[data-pt-section]');
    const sections = document.querySelectorAll('.admin-panel-section');

    function showSection(id, label) {
        sections.forEach(function (el) {
            el.classList.toggle('active', el.id === 'section-' + id);
        });
        links.forEach(function (link) {
            link.classList.toggle('active', link.dataset.ptSection === id);
        });
        if (pageTitle && label) pageTitle.textContent = label;
        sidebar?.classList.remove('open');
        overlay?.classList.remove('show');
        document.body.style.overflow = '';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        if (id === 'notifications' && typeof window.ptClearMessageAlerts === 'function') {
            window.ptClearMessageAlerts();
        }
        if (id === 'messages' && typeof window.ptReloadInbox === 'function') {
            window.ptReloadInbox();
        }
    }

    links.forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            showSection(link.dataset.ptSection, link.dataset.ptLabel || link.textContent.trim());
            history.replaceState(null, '', '#section-' + link.dataset.ptSection);
        });
    });

    const hash = window.location.hash.replace('#section-', '');
    if (hash) {
        const match = document.querySelector('[data-pt-section="' + hash + '"]');
        if (match) showSection(hash, match.dataset.ptLabel);
    }

    hamburger?.addEventListener('click', function () {
        sidebar?.classList.add('open');
        overlay?.classList.add('show');
        document.body.style.overflow = 'hidden';
    });

    overlay?.addEventListener('click', function () {
        sidebar?.classList.remove('open');
        overlay.classList.remove('show');
        document.body.style.overflow = '';
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();

    window.ptShowSection = showSection;

    const reqBoard = document.getElementById('reqBoard');
    const reqSearch = document.getElementById('reqSearch');
    const reqVisibleCount = document.getElementById('reqVisibleCount');
    const reqEmptyFilter = document.getElementById('reqEmptyFilter');
    let reqStatusFilter = 'all';

    function reqItems() {
        return reqBoard ? Array.from(reqBoard.querySelectorAll('[data-req-item]')) : [];
    }

    function reqMatchesFilters(el, query) {
        const status = el.dataset.status;
        const live = el.dataset.live === '1';
        const search = el.dataset.search || '';
        if (query && search.indexOf(query) === -1) return false;
        if (reqStatusFilter === 'live' && !live) return false;
        if (reqStatusFilter !== 'all' && reqStatusFilter !== 'live' && status !== reqStatusFilter) return false;
        return true;
    }

    function applyReqFilters() {
        const query = (reqSearch?.value || '').trim().toLowerCase();
        let visible = 0;
        reqItems().forEach(function (row) {
            const show = reqMatchesFilters(row, query);
            row.style.display = show ? '' : 'none';
            if (show) visible += 1;
        });
        if (reqVisibleCount) reqVisibleCount.textContent = String(visible);
        if (reqEmptyFilter && reqBoard) {
            const hasItems = reqItems().length > 0;
            reqEmptyFilter.classList.toggle('d-none', !hasItems || visible > 0);
            reqBoard.classList.toggle('d-none', hasItems && visible === 0);
        }
    }

    function setReqPillActive(container, attr, value) {
        container?.querySelectorAll('.req-pill').forEach(function (pill) {
            pill.classList.toggle('active', pill.dataset[attr] === value);
        });
    }

    reqSearch?.addEventListener('input', applyReqFilters);

    document.getElementById('reqStatusFilters')?.querySelectorAll('.req-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
            reqStatusFilter = pill.dataset.reqStatus;
            setReqPillActive(document.getElementById('reqStatusFilters'), 'reqStatus', reqStatusFilter);
            applyReqFilters();
        });
    });

    document.getElementById('reqClearFilters')?.addEventListener('click', function () {
        reqStatusFilter = 'all';
        if (reqSearch) reqSearch.value = '';
        setReqPillActive(document.getElementById('reqStatusFilters'), 'reqStatus', 'all');
        applyReqFilters();
    });

    applyReqFilters();

    const ntBoard = document.getElementById('ntBoard');
    const ntSearch = document.getElementById('ntSearch');
    const ntVisibleCount = document.getElementById('ntVisibleCount');
    const ntEmptyFilter = document.getElementById('ntEmptyFilter');
    let ntTypeFilter = 'all';
    let ntWhenFilter = 'all';

    function ntItems() {
        return ntBoard ? Array.from(ntBoard.querySelectorAll('[data-notif-item]')) : [];
    }

    function ntMatchesFilters(el, query) {
        const type = el.dataset.type;
        const when = el.dataset.when;
        const search = el.dataset.search || '';
        if (query && search.indexOf(query) === -1) return false;
        if (ntTypeFilter !== 'all' && type !== ntTypeFilter) return false;
        if (ntWhenFilter === 'today' && when !== 'today') return false;
        return true;
    }

    function applyNtFilters() {
        const query = (ntSearch?.value || '').trim().toLowerCase();
        let visible = 0;
        ntItems().forEach(function (card) {
            const show = ntMatchesFilters(card, query);
            card.classList.toggle('nt-hidden', !show);
            if (show) visible += 1;
        });
        if (ntVisibleCount) ntVisibleCount.textContent = String(visible);
        if (ntEmptyFilter && ntBoard) {
            const hasItems = ntItems().length > 0;
            ntEmptyFilter.classList.toggle('d-none', !hasItems || visible > 0);
            ntBoard.classList.toggle('d-none', hasItems && visible === 0);
        }
    }

    window.applyNtFilters = applyNtFilters;

    function setNtPillActive(container, attr, value) {
        container?.querySelectorAll('.nt-pill').forEach(function (pill) {
            pill.classList.toggle('active', pill.dataset[attr] === value);
        });
    }

    ntSearch?.addEventListener('input', applyNtFilters);

    document.getElementById('ntTypeFilters')?.querySelectorAll('.nt-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
            ntTypeFilter = pill.dataset.ntType;
            setNtPillActive(document.getElementById('ntTypeFilters'), 'ntType', ntTypeFilter);
            applyNtFilters();
        });
    });

    document.getElementById('ntWhenFilters')?.querySelectorAll('.nt-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
            ntWhenFilter = pill.dataset.ntWhen;
            setNtPillActive(document.getElementById('ntWhenFilters'), 'ntWhen', ntWhenFilter);
            applyNtFilters();
        });
    });

    document.getElementById('ntClearFilters')?.addEventListener('click', function () {
        ntTypeFilter = 'all';
        ntWhenFilter = 'all';
        if (ntSearch) ntSearch.value = '';
        setNtPillActive(document.getElementById('ntTypeFilters'), 'ntType', 'all');
        setNtPillActive(document.getElementById('ntWhenFilters'), 'ntWhen', 'all');
        applyNtFilters();
    });

    document.getElementById('ntMarkRead')?.addEventListener('click', function () {
        if (typeof window.ptClearMessageAlerts === 'function') {
            window.ptClearMessageAlerts();
        } else {
            const badge = document.getElementById('notifBadge');
            if (badge) badge.style.display = 'none';
        }
    });

    applyNtFilters();

    const msgInboxBody = document.getElementById('msgInboxBody');
    const msgSearch = document.getElementById('msgSearch');
    const msgVisibleCount = document.getElementById('msgVisibleCount');
    const msgEmptyFilter = document.getElementById('msgEmptyFilter');
    const msgPanel = document.getElementById('ptMsgPanel');
    let msgRoleFilter = 'all';
    let msgWhenFilter = 'all';
    let msgSearchTimer = null;

    function setMsgPillActive(container, attr, value) {
        container?.querySelectorAll('.msg-pill').forEach(function (pill) {
            pill.classList.toggle('active', pill.dataset[attr] === value);
        });
    }

    function bindInboxInteractions() {
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function loadPatientInbox() {
        if (!msgInboxBody) return Promise.resolve();

        const params = new URLSearchParams({
            role: msgRoleFilter,
            when: msgWhenFilter,
            search: (msgSearch?.value || '').trim(),
        });

        if (msgEmptyFilter) msgEmptyFilter.classList.remove('d-none');
        msgInboxBody.classList.add('opacity-50');

        return fetch('/api/chat/inbox-panel?' + params.toString(), {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
        })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (!data.ok) throw new Error(data.error || 'Could not load inbox');
                msgInboxBody.innerHTML = data.html || '';
                if (msgVisibleCount) msgVisibleCount.textContent = String(data.count || 0);
                const msgFeedTotal = document.getElementById('msgFeedTotal');
                if (msgFeedTotal && msgRoleFilter === 'all' && msgWhenFilter === 'all' && !(msgSearch?.value || '').trim()) {
                    msgFeedTotal.textContent = String(data.count || 0);
                }
                bindInboxInteractions();
            })
            .catch(function () {
                if (msgInboxBody) {
                    msgInboxBody.innerHTML =
                        '<div class="msg-empty-state p-4 text-center text-danger small">Could not load conversations. Refresh and try again.</div>';
                }
            })
            .finally(function () {
                msgInboxBody?.classList.remove('opacity-50');
                if (msgEmptyFilter) msgEmptyFilter.classList.add('d-none');
            });
    }

    msgSearch?.addEventListener('input', function () {
        clearTimeout(msgSearchTimer);
        msgSearchTimer = setTimeout(loadPatientInbox, 300);
    });

    document.getElementById('msgRoleFilters')?.querySelectorAll('.msg-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
            msgRoleFilter = pill.dataset.msgRole || 'all';
            setMsgPillActive(document.getElementById('msgRoleFilters'), 'msgRole', msgRoleFilter);
            loadPatientInbox();
        });
    });

    document.getElementById('msgWhenFilters')?.querySelectorAll('.msg-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
            msgWhenFilter = pill.dataset.msgWhen || 'all';
            setMsgPillActive(document.getElementById('msgWhenFilters'), 'msgWhen', msgWhenFilter);
            loadPatientInbox();
        });
    });

    msgInboxBody?.addEventListener('click', function (e) {
        const callBtn = e.target.closest('[data-phone-call]');
        if (callBtn) {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = 'tel:' + callBtn.getAttribute('data-phone-call');
            return;
        }
        const card = e.target.closest('[data-chat-open]');
        if (!card) return;
        e.preventDefault();
        if (typeof window.ptOpenChat === 'function') {
            window.ptOpenChat(
                card.dataset.chatUserId,
                card.dataset.chatUserName || 'Contact',
                card.dataset.chatUserRole || 'donor'
            );
        }
    });

    window.ptReloadInbox = loadPatientInbox;

    if (window.location.hash === '#section-messages' || document.getElementById('section-messages')?.classList.contains('active')) {
        loadPatientInbox();
    }

    if (msgPanel) bindInboxInteractions();

    const cpNew = document.getElementById('cpNew');
    const cpConfirm = document.getElementById('cpConfirm');
    const cpStrengthFill = document.getElementById('cpStrengthFill');
    const cpStrengthLabel = document.getElementById('cpStrengthLabel');
    const cpMatchHint = document.getElementById('cpMatchHint');
    const cpForm = document.getElementById('cpForm');

    function scorePassword(pw) {
        if (!pw) return { level: '', label: 'Password strength', score: 0 };
        let score = 0;
        if (pw.length >= 6) score += 1;
        if (pw.length >= 10) score += 1;
        if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
        if (/\d/.test(pw)) score += 1;
        if (/[^A-Za-z0-9]/.test(pw)) score += 1;
        if (score <= 1) return { level: 'weak', label: 'Weak — add length and variety', score };
        if (score === 2) return { level: 'fair', label: 'Fair — could be stronger', score };
        if (score === 3) return { level: 'good', label: 'Good password', score };
        return { level: 'strong', label: 'Strong password', score };
    }

    function updateStrength() {
        if (!cpNew || !cpStrengthFill) return;
        const result = scorePassword(cpNew.value);
        cpStrengthFill.className = result.level;
        if (cpStrengthLabel) {
            cpStrengthLabel.textContent = result.label;
            cpStrengthLabel.className = result.level ? 'text-' + (result.level === 'weak' ? 'danger' : result.level === 'fair' ? 'warning' : result.level === 'good' ? 'primary' : 'success') : 'text-muted';
        }
    }

    function updateMatch() {
        if (!cpConfirm || !cpMatchHint) return;
        const mismatch = cpConfirm.value && cpNew && cpConfirm.value !== cpNew.value;
        cpMatchHint.classList.toggle('d-none', !mismatch);
        cpConfirm.classList.toggle('is-invalid', mismatch);
    }

    cpNew?.addEventListener('input', function () { updateStrength(); updateMatch(); });
    cpConfirm?.addEventListener('input', updateMatch);

    document.querySelectorAll('.cp-toggle-pw').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const input = document.getElementById(btn.dataset.target);
            if (!input) return;
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            const icon = btn.querySelector('i');
            if (icon) icon.setAttribute('data-lucide', show ? 'eye-off' : 'eye');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    });

    cpForm?.addEventListener('submit', function (e) {
        if (cpNew && cpConfirm && cpNew.value !== cpConfirm.value) {
            e.preventDefault();
            updateMatch();
        }
    });

    (function () {
        const geoForms = document.querySelectorAll('[data-geo-form]');
        if (!geoForms.length) return;

        function fillGeoForms(lat, lng) {
            geoForms.forEach(function (form) {
                const latInput = form.querySelector('[data-geo-lat]');
                const lngInput = form.querySelector('[data-geo-lng]');
                if (latInput) latInput.value = String(lat);
                if (lngInput) lngInput.value = String(lng);
            });
        }

        function omitGeoFields() {
            geoForms.forEach(function (form) {
                form.querySelectorAll('[data-geo-lat], [data-geo-lng]').forEach(function (input) {
                    input.removeAttribute('name');
                    input.value = '';
                });
            });
        }

        if (!navigator.geolocation) {
            omitGeoFields();
            return;
        }

        geoForms.forEach(function (form) {
            form.addEventListener('submit', function () {
                const latInput = form.querySelector('[data-geo-lat]');
                const lngInput = form.querySelector('[data-geo-lng]');
                const lat = (latInput?.value || '').trim();
                const lng = (lngInput?.value || '').trim();
                if (!lat || !lng || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
                    if (latInput) latInput.removeAttribute('name');
                    if (lngInput) lngInput.removeAttribute('name');
                }
            });
        });

        navigator.geolocation.getCurrentPosition(
            function (pos) { fillGeoForms(pos.coords.latitude, pos.coords.longitude); },
            function () { omitGeoFields(); },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    })();

    document.querySelectorAll('.buy-plan-btn').forEach(function (button) {
        button.addEventListener('click', function () {
            const plan = button.dataset.plan;
            if (!plan) return;
            if (!window.RaktaSetuPayments) {
                alert('Payment module failed to load. Please refresh the page (Ctrl+F5) and try again.');
                return;
            }
            window.RaktaSetuPayments.openCheckout({ purpose: 'subscription', plan }, '#dc2626');
        });
    });

    document.querySelectorAll('.pay-action-btn').forEach(function (button) {
        button.addEventListener('click', function () {
            const purpose = button.dataset.purpose;
            if (!purpose) return;
            if (!window.RaktaSetuPayments) {
                alert('Payment module failed to load. Please refresh the page (Ctrl+F5) and try again.');
                return;
            }
            const payload = { purpose: purpose };
            if (button.dataset.requestId) payload.requestId = button.dataset.requestId;
            window.RaktaSetuPayments.openCheckout(payload, '#dc2626');
        });
    });

    async function runPatientSearch(formId, endpoint, targetId, render, options) {
        const form = document.getElementById(formId);
        const target = document.getElementById(targetId);
        if (!form || !target) return;

        const nearMe = options && options.nearMe;
        target.innerHTML = nearMe
            ? '<div class="text-muted small py-2"><span class="spinner-border spinner-border-sm me-1"></span>Locating and searching…</div>'
            : '<div class="text-muted small py-2"><span class="spinner-border spinner-border-sm me-1"></span>Searching…</div>';

        try {
            if (nearMe && window.RaktaSetuGeoSearch) {
                form.classList.add('pt-search-near-me');
                const coords = await window.RaktaSetuGeoSearch.refreshGeolocation();
                window.RaktaSetuGeoSearch.fillFormCoords(form, coords);
                const statusEl = form.closest('.overview-panel-body')?.querySelector('[data-geo-status]');
                window.RaktaSetuGeoSearch.updateStatusElement(statusEl, coords);
            }

            const params = new URLSearchParams(new FormData(form));
            params.delete('latitude');
            params.delete('longitude');
            params.delete('lat');
            params.delete('lng');
            params.delete('nearby');

            if (nearMe) {
                params.set('nearby', '1');
                if (window.RaktaSetuGeoSearch) {
                    const coords = window.RaktaSetuGeoSearch.getCoords();
                    params.set('latitude', String(coords.latitude));
                    params.set('longitude', String(coords.longitude));
                }
            } else {
                form.classList.remove('pt-search-near-me');
                params.delete('radiusKm');
            }

            const response = await fetch(endpoint + '?' + params.toString(), {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Search failed');
            }
            target.innerHTML = render(data);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (err) {
            target.innerHTML = '<div class="text-danger small">' + (err.message || 'Search failed. Please try again.') + '</div>';
        }
    }

    function submitSearch(formId, endpoint, targetId, render) {
        const form = document.getElementById(formId);
        if (!form) return;
        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            await runPatientSearch(formId, endpoint, targetId, render, { nearMe: false });
        });
    }

    document.querySelectorAll('[data-near-me-search]').forEach(function (button) {
        button.addEventListener('click', async function () {
            const formId = button.getAttribute('data-near-me-search');
            if (formId === 'donorSearchForm') {
                await runPatientSearch(formId, '/search/donors', 'donorSearchResults', renderDonorResults, { nearMe: true });
            } else if (formId === 'bloodBankSearchForm') {
                await runPatientSearch(formId, '/search/bloodbanks', 'bloodBankSearchResults', renderBloodBankResults, { nearMe: true });
            }
        });
    });

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function searchInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(function (part) { return part[0]; }).slice(0, 2).join('').toUpperCase();
    }

    function searchProfilePhoto(user) {
        const url = user && user.profileImage && user.profileImage.url;
        return url ? escapeHtml(url) : '';
    }

    function renderSearchEmpty(message, icon) {
        return '<div class="pt-search-empty">' +
            '<div class="pt-search-empty__icon"><i data-lucide="' + (icon || 'search-x') + '"></i></div>' +
            '<p>No matches found</p>' +
            '<span>' + escapeHtml(message) + '</span>' +
            '</div>';
    }

    function renderSearchHeader(title, icon, count) {
        return '<div class="pt-search-results-head">' +
            '<h6 class="pt-search-results-title"><i data-lucide="' + icon + '"></i> ' + escapeHtml(title) + '</h6>' +
            '<span class="pt-search-results-count">' + count + ' found</span>' +
            '</div>';
    }

    function renderDonorResults(data) {
        const donors = data.donors || [];
        const heading = data.geoSearch ? 'Nearest donors' : 'Matching donors';
        if (!donors.length) {
            return renderSearchEmpty(
                data.message || 'No donors match your blood group and city. Try another city or leave city blank to search by blood group only.',
                'users'
            );
        }

        const cards = donors.map(function (item) {
            const donor = item.donor || item;
            const donorUser = donor.userId || {};
            const name = donorUser.name || 'Donor';
            const photo = searchProfilePhoto(donorUser);
            const distanceKm = item.distanceKm ?? donor._distanceKm;
            const lastDonation = donor.lastDonationDate ? new Date(donor.lastDonationDate).getTime() : 0;
            const cooldownDays = lastDonation ? Math.floor((Date.now() - lastDonation) / 86400000) : 999;
            const remaining = Math.max(0, 90 - cooldownDays);
            const eligible = donor.status === 'approved' && donor.isAvailable && remaining === 0;
            const eligClass = eligible ? 'success' : (donor.isAvailable ? 'warn' : 'muted');
            const eligLabel = eligible
                ? 'Eligible'
                : (!donor.isAvailable ? 'Unavailable' : 'Not eligible' + (remaining ? ' (' + remaining + 'd)' : ''));
            const avatar = photo
                ? '<img src="' + photo + '" alt="" class="pt-search-hit__avatar pt-search-hit__avatar--photo">'
                : '<span class="pt-search-hit__avatar pt-search-hit__avatar--initials">' + escapeHtml(searchInitials(name)) + '</span>';
            const distanceTag = data.geoSearch && distanceKm != null
                ? '<span class="pt-search-hit__tag pt-search-hit__tag--distance"><i data-lucide="navigation"></i> ' + distanceKm + ' km</span>'
                : '';
            const phone = donorUser.phone || '';
            const phoneMeta = phone
                ? '<span><i data-lucide="phone"></i> <a href="tel:' + escapeHtml(phone) + '">' + escapeHtml(phone) + '</a></span>'
                : '<span><i data-lucide="phone"></i> —</span>';
            const chatBtn = donorUser._id
                ? '<button type="button" class="pt-search-hit__chat chat-btn" data-user-id="' + escapeHtml(donorUser._id) + '" data-user-name="' + escapeHtml(name) + '" data-user-role="donor"><i data-lucide="message-circle"></i> Chat</button>'
                : '';
            const callBtn = phone
                ? '<a class="pt-search-hit__call" href="tel:' + escapeHtml(phone) + '"><i data-lucide="phone-call"></i> Call</a>'
                : '';

            return '<article class="pt-search-hit pt-search-hit--donor">' +
                '<div class="pt-search-hit__main">' + avatar +
                '<div class="pt-search-hit__body">' +
                '<div class="pt-search-hit__top">' +
                '<h6 class="pt-search-hit__name">' + escapeHtml(name) + '</h6>' +
                '<span class="pt-search-hit__blood">' + escapeHtml(donor.bloodGroup || '—') + '</span>' +
                '</div>' +
                '<div class="pt-search-hit__tags">' +
                '<span class="pt-search-hit__tag pt-search-hit__tag--' + eligClass + '">' + escapeHtml(eligLabel) + '</span>' +
                distanceTag +
                '</div>' +
                '<div class="pt-search-hit__meta">' +
                '<span><i data-lucide="map-pin"></i> ' + escapeHtml(donorUser.city || '—') + '</span>' +
                phoneMeta +
                '</div></div></div>' +
                '<div class="pt-search-hit__actions">' + callBtn + chatBtn + '</div>' +
                '</article>';
        }).join('');

        return '<div class="pt-search-results">' +
            renderSearchHeader(heading, 'heart-handshake', donors.length) +
            '<div class="pt-search-results-list">' + cards + '</div></div>';
    }

    function renderBloodBankResults(data) {
        const banks = data.bloodBanks || [];
        const heading = data.geoSearch ? 'Nearest blood banks' : 'Matching blood banks';
        if (!banks.length) {
            return renderSearchEmpty(
                data.message || 'No blood banks match your blood group and city. Try another city or leave city blank to search by blood group only.',
                'building-2'
            );
        }

        const cards = banks.map(function (item) {
            const bank = item.bloodBank || item;
            const bankUser = bank.userId || {};
            const hospitalName = bank.hospitalName || 'Blood bank';
            const photo = searchProfilePhoto(bankUser);
            const distanceKm = item.distanceKm;
            const units = item.availableUnits;
            const stockLabel = units !== undefined ? units + ' units' : 'Stock available';
            const distanceTag = data.geoSearch && distanceKm != null
                ? '<span class="pt-search-hit__tag pt-search-hit__tag--distance"><i data-lucide="navigation"></i> ' + distanceKm + ' km</span>'
                : '';
            const phone = bankUser.phone || '';
            const phoneMeta = phone
                ? '<span><i data-lucide="phone"></i> <a href="tel:' + escapeHtml(phone) + '">' + escapeHtml(phone) + '</a></span>'
                : '<span><i data-lucide="phone"></i> —</span>';
            const chatBtn = bankUser._id
                ? '<button type="button" class="pt-search-hit__chat chat-btn" data-user-id="' + escapeHtml(bankUser._id) + '" data-user-name="' + escapeHtml(hospitalName) + '" data-user-role="bloodbank"><i data-lucide="message-circle"></i> Chat</button>'
                : '';
            const callBtn = phone
                ? '<a class="pt-search-hit__call" href="tel:' + escapeHtml(phone) + '"><i data-lucide="phone-call"></i> Call</a>'
                : '';
            const avatar = photo
                ? '<img src="' + photo + '" alt="" class="pt-search-hit__avatar pt-search-hit__avatar--photo">'
                : '<span class="pt-search-hit__avatar pt-search-hit__avatar--icon"><i data-lucide="building-2"></i></span>';

            return '<article class="pt-search-hit pt-search-hit--bank">' +
                '<div class="pt-search-hit__main">' + avatar +
                '<div class="pt-search-hit__body">' +
                '<div class="pt-search-hit__top">' +
                '<h6 class="pt-search-hit__name">' + escapeHtml(hospitalName) + '</h6>' +
                '<span class="pt-search-hit__stock"><i data-lucide="droplets"></i> ' + escapeHtml(stockLabel) + '</span>' +
                '</div>' +
                '<div class="pt-search-hit__tags">' + distanceTag + '</div>' +
                '<div class="pt-search-hit__meta">' +
                '<span><i data-lucide="map-pin"></i> ' + escapeHtml(bankUser.city || '—') + '</span>' +
                phoneMeta +
                (bankUser.name ? '<span><i data-lucide="user"></i> ' + escapeHtml(bankUser.name) + '</span>' : '') +
                '</div></div></div>' +
                '<div class="pt-search-hit__actions">' + callBtn + chatBtn + '</div>' +
                '</article>';
        }).join('');

        return '<div class="pt-search-results">' +
            renderSearchHeader(heading, 'building-2', banks.length) +
            '<div class="pt-search-results-list">' + cards + '</div></div>';
    }

    submitSearch('donorSearchForm', '/search/donors', 'donorSearchResults', renderDonorResults);
    submitSearch('bloodBankSearchForm', '/search/bloodbanks', 'bloodBankSearchResults', renderBloodBankResults);
})();
