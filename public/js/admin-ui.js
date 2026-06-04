(function () {
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('adminOverlay');
    const hamburger = document.getElementById('adminHamburger');
    const pageTitle = document.getElementById('adminPageTitle');
    const links = document.querySelectorAll('[data-admin-section]');
    const sections = document.querySelectorAll('.admin-panel-section');

    function showSection(id, label) {
        sections.forEach(function (el) {
            el.classList.toggle('active', el.id === 'section-' + id);
        });
        links.forEach(function (link) {
            link.classList.toggle('active', link.dataset.adminSection === id);
        });
        if (pageTitle && label) pageTitle.textContent = label;
        sidebar?.classList.remove('open');
        overlay?.classList.remove('show');
        document.body.style.overflow = '';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    links.forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            showSection(link.dataset.adminSection, link.dataset.adminLabel || link.textContent.trim());
            history.replaceState(null, '', '#section-' + link.dataset.adminSection);
        });
    });

    document.querySelectorAll('[data-admin-section]').forEach(function (el) {
        if (el.classList.contains('admin-nav-link')) return;
        el.addEventListener('click', function (e) {
            e.preventDefault();
            const id = el.dataset.adminSection;
            const label = el.dataset.adminLabel || el.textContent.trim();
            showSection(id, label);
            history.replaceState(null, '', '#section-' + id);
        });
    });

    const hash = window.location.hash.replace('#section-', '');
    if (hash) {
        const match = document.querySelector('[data-admin-section="' + hash + '"]');
        if (match) showSection(hash, match.dataset.adminLabel);
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

    window.adminShowSection = showSection;

    /* Emergency requests — filters & view toggle */
    const reqBoard = document.getElementById('reqBoard');
    const reqSearch = document.getElementById('reqSearch');
    const reqVisibleCount = document.getElementById('reqVisibleCount');
    const reqEmptyFilter = document.getElementById('reqEmptyFilter');
    const reqCardsView = document.getElementById('reqCardsView');
    const reqTableView = document.getElementById('reqTableView');
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

    document.getElementById('reqClearFilters')?.addEventListener('click', function () {
        reqStatusFilter = 'all';
        if (reqSearch) reqSearch.value = '';
        setReqPillActive(document.getElementById('reqStatusFilters'), 'reqStatus', 'all');
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

    /* Donor management — filters & view toggle */
    const donBoard = document.getElementById('donBoard');
    const donSearch = document.getElementById('donSearch');
    const donVisibleCount = document.getElementById('donVisibleCount');
    const donEmptyFilter = document.getElementById('donEmptyFilter');
    const donCardsView = document.getElementById('donCardsView');
    const donTableView = document.getElementById('donTableView');
    let donStatusFilter = 'all';
    let donEligFilter = 'all';

    function donItems() {
        return donBoard ? Array.from(donBoard.querySelectorAll('[data-donor-item]')) : [];
    }

    function donMatchesFilters(el, query) {
        const status = el.dataset.status;
        const elig = el.dataset.elig;
        const search = el.dataset.search || '';
        if (query && search.indexOf(query) === -1) return false;
        if (donStatusFilter !== 'all' && status !== donStatusFilter) return false;
        if (donEligFilter !== 'all') {
            if (donEligFilter === 'eligible' && elig !== 'eligible') return false;
            if (donEligFilter === 'cooldown' && elig !== 'cooldown') return false;
            if (donEligFilter === 'unavailable' && elig !== 'unavailable') return false;
        }
        return true;
    }

    function applyDonFilters() {
        const query = (donSearch?.value || '').trim().toLowerCase();
        let visible = 0;
        donItems().forEach(function (card) {
            const show = donMatchesFilters(card, query);
            card.classList.toggle('don-hidden', !show);
            if (show) visible += 1;
        });
        document.querySelectorAll('#donTableView [data-donor-item]').forEach(function (row) {
            row.style.display = donMatchesFilters(row, query) ? '' : 'none';
        });
        if (donVisibleCount) donVisibleCount.textContent = String(visible);
        if (donEmptyFilter && donBoard) {
            const hasItems = donItems().length > 0;
            donEmptyFilter.classList.toggle('d-none', !hasItems || visible > 0);
            donBoard.classList.toggle('d-none', hasItems && visible === 0);
        }
    }

    function setDonPillActive(container, attr, value) {
        container?.querySelectorAll('.don-pill').forEach(function (pill) {
            pill.classList.toggle('active', pill.dataset[attr] === value);
        });
    }

    donSearch?.addEventListener('input', applyDonFilters);

    document.getElementById('donStatusFilters')?.querySelectorAll('.don-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
            donStatusFilter = pill.dataset.donStatus;
            setDonPillActive(document.getElementById('donStatusFilters'), 'donStatus', donStatusFilter);
            applyDonFilters();
        });
    });

    document.getElementById('donEligFilters')?.querySelectorAll('.don-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
            donEligFilter = pill.dataset.donElig;
            setDonPillActive(document.getElementById('donEligFilters'), 'donElig', donEligFilter);
            applyDonFilters();
        });
    });

    document.getElementById('donFilterPending')?.addEventListener('click', function () {
        donStatusFilter = 'pending';
        donEligFilter = 'all';
        setDonPillActive(document.getElementById('donStatusFilters'), 'donStatus', 'pending');
        setDonPillActive(document.getElementById('donEligFilters'), 'donElig', 'all');
        applyDonFilters();
        document.getElementById('section-donors')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('donClearFilters')?.addEventListener('click', function () {
        donStatusFilter = 'all';
        donEligFilter = 'all';
        if (donSearch) donSearch.value = '';
        setDonPillActive(document.getElementById('donStatusFilters'), 'donStatus', 'all');
        setDonPillActive(document.getElementById('donEligFilters'), 'donElig', 'all');
        applyDonFilters();
    });

    document.querySelectorAll('[data-don-view]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const view = btn.dataset.donView;
            document.querySelectorAll('[data-don-view]').forEach(function (b) {
                b.classList.toggle('btn-danger', b.dataset.donView === view);
                b.classList.toggle('active', b.dataset.donView === view);
                b.classList.toggle('btn-outline-secondary', b.dataset.donView !== view);
            });
            donCardsView?.classList.toggle('d-none', view !== 'cards');
            donTableView?.classList.toggle('d-none', view !== 'table');
        });
    });

    /* Blood banks — filters & view toggle */
    const bbBoard = document.getElementById('bbBoard');
    const bbSearch = document.getElementById('bbSearch');
    const bbVisibleCount = document.getElementById('bbVisibleCount');
    const bbEmptyFilter = document.getElementById('bbEmptyFilter');
    const bbCardsView = document.getElementById('bbCardsView');
    const bbTableView = document.getElementById('bbTableView');
    let bbStatusFilter = 'all';
    let bbStockFilter = 'all';

    function bbItems() {
        return bbBoard ? Array.from(bbBoard.querySelectorAll('[data-bb-item]')) : [];
    }

    function bbMatchesFilters(el, query) {
        const status = el.dataset.status;
        const stock = el.dataset.stock;
        const search = el.dataset.search || '';
        if (query && search.indexOf(query) === -1) return false;
        if (bbStatusFilter !== 'all' && status !== bbStatusFilter) return false;
        if (bbStockFilter !== 'all' && stock !== bbStockFilter) return false;
        return true;
    }

    function applyBbFilters() {
        const query = (bbSearch?.value || '').trim().toLowerCase();
        let visible = 0;
        bbItems().forEach(function (card) {
            const show = bbMatchesFilters(card, query);
            card.classList.toggle('bb-hidden', !show);
            if (show) visible += 1;
        });
        document.querySelectorAll('#bbTableView [data-bb-item]').forEach(function (row) {
            row.style.display = bbMatchesFilters(row, query) ? '' : 'none';
        });
        if (bbVisibleCount) bbVisibleCount.textContent = String(visible);
        if (bbEmptyFilter && bbBoard) {
            const hasItems = bbItems().length > 0;
            bbEmptyFilter.classList.toggle('d-none', !hasItems || visible > 0);
            bbBoard.classList.toggle('d-none', hasItems && visible === 0);
        }
    }

    function setBbPillActive(container, attr, value) {
        container?.querySelectorAll('.bb-pill').forEach(function (pill) {
            pill.classList.toggle('active', pill.dataset[attr] === value);
        });
    }

    bbSearch?.addEventListener('input', applyBbFilters);

    document.getElementById('bbStatusFilters')?.querySelectorAll('.bb-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
            bbStatusFilter = pill.dataset.bbStatus;
            setBbPillActive(document.getElementById('bbStatusFilters'), 'bbStatus', bbStatusFilter);
            applyBbFilters();
        });
    });

    document.getElementById('bbStockFilters')?.querySelectorAll('.bb-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
            bbStockFilter = pill.dataset.bbStock;
            setBbPillActive(document.getElementById('bbStockFilters'), 'bbStock', bbStockFilter);
            applyBbFilters();
        });
    });

    document.getElementById('bbFilterPending')?.addEventListener('click', function () {
        bbStatusFilter = 'pending';
        bbStockFilter = 'all';
        setBbPillActive(document.getElementById('bbStatusFilters'), 'bbStatus', 'pending');
        setBbPillActive(document.getElementById('bbStockFilters'), 'bbStock', 'all');
        applyBbFilters();
        document.getElementById('section-bloodbanks')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('bbClearFilters')?.addEventListener('click', function () {
        bbStatusFilter = 'all';
        bbStockFilter = 'all';
        if (bbSearch) bbSearch.value = '';
        setBbPillActive(document.getElementById('bbStatusFilters'), 'bbStatus', 'all');
        setBbPillActive(document.getElementById('bbStockFilters'), 'bbStock', 'all');
        applyBbFilters();
    });

    document.querySelectorAll('[data-bb-view]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const view = btn.dataset.bbView;
            document.querySelectorAll('[data-bb-view]').forEach(function (b) {
                b.classList.toggle('btn-danger', b.dataset.bbView === view);
                b.classList.toggle('active', b.dataset.bbView === view);
                b.classList.toggle('btn-outline-secondary', b.dataset.bbView !== view);
            });
            bbCardsView?.classList.toggle('d-none', view !== 'cards');
            bbTableView?.classList.toggle('d-none', view !== 'table');
        });
    });

    /* Patients — filters & view toggle */
    const ptBoard = document.getElementById('ptBoard');
    const ptSearch = document.getElementById('ptSearch');
    const ptVisibleCount = document.getElementById('ptVisibleCount');
    const ptEmptyFilter = document.getElementById('ptEmptyFilter');
    const ptCardsView = document.getElementById('ptCardsView');
    const ptTableView = document.getElementById('ptTableView');
    let ptAccountFilter = 'all';
    let ptActivityFilter = 'all';

    function ptItems() {
        return ptBoard ? Array.from(ptBoard.querySelectorAll('[data-pt-item]')) : [];
    }

    function ptMatchesFilters(el, query) {
        const account = el.dataset.account;
        const activity = el.dataset.activity;
        const search = el.dataset.search || '';
        if (query && search.indexOf(query) === -1) return false;
        if (ptAccountFilter !== 'all' && account !== ptAccountFilter) return false;
        if (ptActivityFilter !== 'all' && activity !== ptActivityFilter) return false;
        return true;
    }

    function applyPtFilters() {
        const query = (ptSearch?.value || '').trim().toLowerCase();
        let visible = 0;
        ptItems().forEach(function (card) {
            const show = ptMatchesFilters(card, query);
            card.classList.toggle('pt-hidden', !show);
            if (show) visible += 1;
        });
        document.querySelectorAll('#ptTableView [data-pt-item]').forEach(function (row) {
            row.style.display = ptMatchesFilters(row, query) ? '' : 'none';
        });
        if (ptVisibleCount) ptVisibleCount.textContent = String(visible);
        if (ptEmptyFilter && ptBoard) {
            const hasItems = ptItems().length > 0;
            ptEmptyFilter.classList.toggle('d-none', !hasItems || visible > 0);
            ptBoard.classList.toggle('d-none', hasItems && visible === 0);
        }
    }

    function setPtPillActive(container, attr, value) {
        container?.querySelectorAll('.pt-pill').forEach(function (pill) {
            pill.classList.toggle('active', pill.dataset[attr] === value);
        });
    }

    ptSearch?.addEventListener('input', applyPtFilters);

    document.getElementById('ptAccountFilters')?.querySelectorAll('.pt-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
            ptAccountFilter = pill.dataset.ptAccount;
            setPtPillActive(document.getElementById('ptAccountFilters'), 'ptAccount', ptAccountFilter);
            applyPtFilters();
        });
    });

    document.getElementById('ptActivityFilters')?.querySelectorAll('.pt-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
            ptActivityFilter = pill.dataset.ptActivity;
            setPtPillActive(document.getElementById('ptActivityFilters'), 'ptActivity', ptActivityFilter);
            applyPtFilters();
        });
    });

    document.getElementById('ptFilterActive')?.addEventListener('click', function () {
        ptActivityFilter = 'active';
        ptAccountFilter = 'all';
        setPtPillActive(document.getElementById('ptActivityFilters'), 'ptActivity', 'active');
        setPtPillActive(document.getElementById('ptAccountFilters'), 'ptAccount', 'all');
        applyPtFilters();
        document.getElementById('section-patients')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('ptClearFilters')?.addEventListener('click', function () {
        ptAccountFilter = 'all';
        ptActivityFilter = 'all';
        if (ptSearch) ptSearch.value = '';
        setPtPillActive(document.getElementById('ptAccountFilters'), 'ptAccount', 'all');
        setPtPillActive(document.getElementById('ptActivityFilters'), 'ptActivity', 'all');
        applyPtFilters();
    });

    document.querySelectorAll('[data-pt-view]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const view = btn.dataset.ptView;
            document.querySelectorAll('[data-pt-view]').forEach(function (b) {
                b.classList.toggle('btn-danger', b.dataset.ptView === view);
                b.classList.toggle('active', b.dataset.ptView === view);
                b.classList.toggle('btn-outline-secondary', b.dataset.ptView !== view);
            });
            ptCardsView?.classList.toggle('d-none', view !== 'cards');
            ptTableView?.classList.toggle('d-none', view !== 'table');
        });
    });

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
        const badge = document.getElementById('notifBadge');
        if (badge) badge.style.display = 'none';
    });

    applyNtFilters();

    /* Change password — strength meter & visibility toggle */
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

    cpNew?.addEventListener('input', function () {
        updateStrength();
        updateMatch();
    });
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
        updateMatch();
        if (cpNew && cpConfirm && cpConfirm.value !== cpNew.value) {
            e.preventDefault();
            cpConfirm.focus();
        }
    });
})();
