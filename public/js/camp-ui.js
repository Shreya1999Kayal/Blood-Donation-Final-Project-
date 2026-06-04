(function () {
    const sidebar = document.getElementById('cpSidebar');
    const overlay = document.getElementById('cpOverlay');
    const hamburger = document.getElementById('cpHamburger');
    const pageTitle = document.getElementById('cpPageTitle');
    const links = document.querySelectorAll('[data-cp-section]');
    const sections = document.querySelectorAll('.admin-panel-section');

    function showSection(id, label) {
        sections.forEach(function (el) {
            el.classList.toggle('active', el.id === 'section-' + id);
        });
        links.forEach(function (link) {
            link.classList.toggle('active', link.dataset.cpSection === id);
        });
        if (pageTitle && label) pageTitle.textContent = label;
        sidebar?.classList.remove('open');
        overlay?.classList.remove('show');
        document.body.style.overflow = '';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        bindPaymentButtons(document);
    }

    links.forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            showSection(link.dataset.cpSection, link.dataset.cpLabel || link.textContent.trim());
            history.replaceState(null, '', '#section-' + link.dataset.cpSection);
        });
    });

    const hash = window.location.hash.replace('#section-', '');
    if (hash) {
        const match = document.querySelector('[data-cp-section="' + hash + '"]');
        if (match) showSection(hash, match.dataset.cpLabel);
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
    window.cpShowSection = showSection;

    function bindPaymentButtons(root) {
        (root || document).querySelectorAll('.cp-unlock-btn:not([data-cp-bound]), .cp-directory-unlock-btn:not([data-cp-bound])').forEach(function (btn) {
            btn.setAttribute('data-cp-bound', '1');
            btn.addEventListener('click', function () {
                const purpose = btn.dataset.purpose;
                const targetUserId = btn.dataset.targetUserId;
                const targetProfileId = btn.dataset.targetProfileId;
                if (!purpose) return;
                if (purpose !== 'camp_donor_directory' && (!targetUserId || !targetProfileId)) return;
                if (!window.RaktaSetuPayments) {
                    alert('Payment module not loaded. Refresh the page and try again.');
                    return;
                }
                const payload = { purpose: purpose };
                if (targetUserId) payload.targetUserId = targetUserId;
                if (targetProfileId) payload.targetProfileId = targetProfileId;
                window.RaktaSetuPayments.openCheckout(payload, '#7c3aed');
            });
        });
    }

    bindPaymentButtons(document);

    document.querySelectorAll('.cp-chat-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const userId = btn.dataset.userId;
            if (userId) window.location.href = '/chat/' + userId;
        });
    });

    document.querySelectorAll('.cp-cancel-event-form').forEach(function (form) {
        form.addEventListener('submit', function (e) {
            if (!window.confirm('Cancel this scheduled camp event? This cannot be undone.')) {
                e.preventDefault();
            }
        });
    });

    const stateSelect = document.getElementById('cpStateSelect');
    const districtSelect = document.getElementById('cpDistrictSelect');
    const districtsMap = window.__CAMP_DISTRICTS__ || {};
    if (stateSelect && districtSelect) {
        function fillDistricts(state) {
            districtSelect.innerHTML = '<option value="">Select District</option>';
            (districtsMap[state] || ['Other / Not listed']).forEach(function (d) {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                districtSelect.appendChild(opt);
            });
        }
        stateSelect.addEventListener('change', function () { fillDistricts(stateSelect.value); });
        if (stateSelect.value) fillDistricts(stateSelect.value);
    }
})();
