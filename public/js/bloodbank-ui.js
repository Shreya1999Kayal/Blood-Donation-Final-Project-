(function () {
    const sidebar = document.getElementById('bbSidebar');
    const overlay = document.getElementById('bbOverlay');
    const hamburger = document.getElementById('bbHamburger');
    const pageTitle = document.getElementById('bbPageTitle');
    const links = document.querySelectorAll('[data-bb-section]');
    const sections = document.querySelectorAll('.admin-panel-section');

    function showSection(id, label) {
        sections.forEach(function (el) {
            el.classList.toggle('active', el.id === 'section-' + id);
        });
        links.forEach(function (link) {
            link.classList.toggle('active', link.dataset.bbSection === id);
        });
        if (pageTitle && label) pageTitle.textContent = label;
        sidebar?.classList.remove('open');
        overlay?.classList.remove('show');
        document.body.style.overflow = '';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        if (id === 'notifications' && typeof window.bbClearMessageAlerts === 'function') {
            window.bbClearMessageAlerts();
        }
    }

    links.forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            showSection(link.dataset.bbSection, link.dataset.bbLabel || link.textContent.trim());
            history.replaceState(null, '', '#section-' + link.dataset.bbSection);
        });
    });

    const hash = window.location.hash.replace('#section-', '');
    if (hash) {
        const match = document.querySelector('[data-bb-section="' + hash + '"]');
        if (match) showSection(hash, match.dataset.bbLabel);
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

    window.bbShowSection = showSection;

    /* Emergency requests — filters & view toggle */
    const reqBoard = document.getElementById('reqBoard');
    const reqSearch = document.getElementById('reqSearch');
    const reqVisibleCount = document.getElementById('reqVisibleCount');
    const reqEmptyFilter = document.getElementById('reqEmptyFilter');
    const reqCardsView = document.getElementById('reqCardsView');
    const reqTableView = document.getElementById('reqTableView');
    let reqStatusFilter = 'all';
    let reqUrgencyFilter = 'all';

    function reqItems() {
        return reqBoard ? Array.from(reqBoard.querySelectorAll('[data-req-item]')) : [];
    }

    function reqMatchesFilters(el, query) {
        const status = el.dataset.status;
        const live = el.dataset.live === '1';
        const urgency = el.dataset.urgency;
        const search = el.dataset.search || '';
        if (query && search.indexOf(query) === -1) return false;
        if (reqStatusFilter === 'live' && !live) return false;
        if (reqStatusFilter !== 'all' && reqStatusFilter !== 'live' && status !== reqStatusFilter) return false;
        if (reqUrgencyFilter !== 'all' && urgency !== reqUrgencyFilter) return false;
        return true;
    }

    function applyReqFilters() {
        const query = (reqSearch?.value || '').trim().toLowerCase();
        let visible = 0;
        reqItems().forEach(function (card) {
            const show = reqMatchesFilters(card, query);
            card.classList.toggle('req-hidden', !show);
            if (show) visible += 1;
        });
        document.querySelectorAll('#reqTableView [data-req-item]').forEach(function (row) {
            row.style.display = reqMatchesFilters(row, query) ? '' : 'none';
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

    document.getElementById('reqUrgencyFilters')?.querySelectorAll('.req-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
            reqUrgencyFilter = pill.dataset.reqUrgency;
            setReqPillActive(document.getElementById('reqUrgencyFilters'), 'reqUrgency', reqUrgencyFilter);
            applyReqFilters();
        });
    });

    document.getElementById('reqFilterCritical')?.addEventListener('click', function () {
        reqUrgencyFilter = 'critical';
        reqStatusFilter = 'live';
        setReqPillActive(document.getElementById('reqUrgencyFilters'), 'reqUrgency', 'critical');
        setReqPillActive(document.getElementById('reqStatusFilters'), 'reqStatus', 'live');
        applyReqFilters();
        showSection('requests', 'Emergency Requests');
    });

    document.getElementById('reqClearFilters')?.addEventListener('click', function () {
        reqStatusFilter = 'all';
        reqUrgencyFilter = 'all';
        if (reqSearch) reqSearch.value = '';
        setReqPillActive(document.getElementById('reqStatusFilters'), 'reqStatus', 'all');
        setReqPillActive(document.getElementById('reqUrgencyFilters'), 'reqUrgency', 'all');
        applyReqFilters();
    });

    document.querySelectorAll('[data-req-view]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const view = btn.dataset.reqView;
            document.querySelectorAll('[data-req-view]').forEach(function (b) {
                b.classList.toggle('btn-danger', b.dataset.reqView === view);
                b.classList.toggle('active', b.dataset.reqView === view);
                b.classList.toggle('btn-outline-secondary', b.dataset.reqView !== view);
            });
            reqCardsView?.classList.toggle('d-none', view !== 'cards');
            reqTableView?.classList.toggle('d-none', view !== 'table');
        });
    });

    applyReqFilters();

    /* Notifications — filters */
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
        if (typeof window.bbClearMessageAlerts === 'function') {
            window.bbClearMessageAlerts();
        } else {
            const badge = document.getElementById('notifBadge');
            if (badge) badge.style.display = 'none';
        }
    });

    applyNtFilters();

    /* Messages inbox — filters */
    const msgBoard = document.getElementById('msgBoard');
    const msgSearch = document.getElementById('msgSearch');
    const msgVisibleCount = document.getElementById('msgVisibleCount');
    const msgEmptyFilter = document.getElementById('msgEmptyFilter');
    let msgRoleFilter = 'all';
    let msgWhenFilter = 'all';

    function msgItems() {
        return msgBoard ? Array.from(msgBoard.querySelectorAll('[data-msg-item]')) : [];
    }

    function msgMatchesFilters(el, query) {
        const role = el.dataset.role;
        const when = el.dataset.when;
        const hasMsg = el.dataset.hasMsg;
        const search = el.dataset.search || '';
        if (query && search.indexOf(query) === -1) return false;
        if (msgRoleFilter !== 'all' && role !== msgRoleFilter) return false;
        if (msgWhenFilter === 'today' && when !== 'today') return false;
        if (msgWhenFilter === 'empty' && hasMsg !== '0') return false;
        return true;
    }

    function applyMsgFilters() {
        const query = (msgSearch?.value || '').trim().toLowerCase();
        let visible = 0;
        msgItems().forEach(function (card) {
            const show = msgMatchesFilters(card, query);
            card.classList.toggle('msg-hidden', !show);
            if (show) visible += 1;
        });
        if (msgVisibleCount) msgVisibleCount.textContent = String(visible);
        if (msgEmptyFilter && msgBoard) {
            const hasItems = msgItems().length > 0;
            msgEmptyFilter.classList.toggle('d-none', !hasItems || visible > 0);
            msgBoard.classList.toggle('d-none', hasItems && visible === 0);
        }
    }

    function setMsgPillActive(container, attr, value) {
        container?.querySelectorAll('.msg-pill').forEach(function (pill) {
            pill.classList.toggle('active', pill.dataset[attr] === value);
        });
    }

    msgSearch?.addEventListener('input', applyMsgFilters);

    document.getElementById('msgRoleFilters')?.querySelectorAll('.msg-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
            msgRoleFilter = pill.dataset.msgRole;
            setMsgPillActive(document.getElementById('msgRoleFilters'), 'msgRole', msgRoleFilter);
            applyMsgFilters();
        });
    });

    document.getElementById('msgWhenFilters')?.querySelectorAll('.msg-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
            msgWhenFilter = pill.dataset.msgWhen;
            setMsgPillActive(document.getElementById('msgWhenFilters'), 'msgWhen', msgWhenFilter);
            applyMsgFilters();
        });
    });

    document.getElementById('msgClearFilters')?.addEventListener('click', function () {
        msgRoleFilter = 'all';
        msgWhenFilter = 'all';
        if (msgSearch) msgSearch.value = '';
        setMsgPillActive(document.getElementById('msgRoleFilters'), 'msgRole', 'all');
        setMsgPillActive(document.getElementById('msgWhenFilters'), 'msgWhen', 'all');
        applyMsgFilters();
    });

    applyMsgFilters();

    /* Blood issue records — search */
    const bbIssueSearch = document.getElementById('bbIssueSearch');
    const bbIssueTableBody = document.getElementById('bbIssueTableBody');
    const bbIssueEmptyFilter = document.getElementById('bbIssueEmptyFilter');
    const bbIssueTableWrap = document.querySelector('.bb-issue-table-wrap');

    function applyBbIssueSearch() {
        if (!bbIssueTableBody) return;
        const query = (bbIssueSearch?.value || '').trim().toLowerCase();
        let visible = 0;
        bbIssueTableBody.querySelectorAll('.bb-issue-row').forEach(function (row) {
            const search = row.dataset.issueSearch || '';
            const show = !query || search.indexOf(query) !== -1;
            row.classList.toggle('bb-issue-hidden', !show);
            if (show) visible += 1;
        });
        if (bbIssueEmptyFilter) {
            bbIssueEmptyFilter.classList.toggle('d-none', visible > 0 || !query);
        }
        if (bbIssueTableWrap) {
            bbIssueTableWrap.classList.toggle('d-none', visible === 0 && !!query);
        }
    }

    bbIssueSearch?.addEventListener('input', applyBbIssueSearch);
    document.getElementById('bbIssueClearSearch')?.addEventListener('click', function () {
        if (bbIssueSearch) bbIssueSearch.value = '';
        applyBbIssueSearch();
        bbIssueSearch?.focus();
    });

    /* Change password */
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

    /* Geo forms */
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

    /* Razorpay payments */
    document.querySelectorAll('.buy-plan-btn').forEach(function (button) {
        button.addEventListener('click', function () {
            const plan = button.dataset.plan;
            if (!plan) return;
            if (!window.RaktaSetuPayments) {
                alert('Payment module failed to load. Please refresh the page (Ctrl+F5) and try again.');
                return;
            }
            window.RaktaSetuPayments.openCheckout({ purpose: 'subscription', plan }, '#0284c7');
        });
    });
})();
