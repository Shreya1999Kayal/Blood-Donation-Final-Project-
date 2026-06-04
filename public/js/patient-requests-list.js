(function () {
    'use strict';

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
            reqEmptyFilter.classList.toggle('hidden', !hasItems || visible > 0);
            reqBoard.classList.toggle('hidden', hasItems && visible === 0);
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

    if (typeof lucide !== 'undefined') lucide.createIcons();
})();
