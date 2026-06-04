(function () {
    'use strict';

    const carousel = document.getElementById('homeCarousel');
    const track = document.getElementById('homeCarouselTrack');
    const dotsWrap = document.getElementById('homeCarouselDots');
    const prevBtn = document.getElementById('homeCarouselPrev');
    const nextBtn = document.getElementById('homeCarouselNext');

    let slideIndex = 0;
    let slideCount = 0;
    let trackIndex = 0;
    let autoplayTimer = null;
    let infiniteLoop = false;

    function initCarousel() {
        if (!track) return;
        slideCount = track.children.length;
        if (!slideCount) return;

        infiniteLoop = slideCount > 1;
        if (infiniteLoop) {
            setupInfiniteTrack();
        } else {
            trackIndex = 0;
            slideIndex = 0;
        }

        if (dotsWrap) {
            dotsWrap.innerHTML = '';
            for (let i = 0; i < slideCount; i += 1) {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'home-carousel-dot' + (i === 0 ? ' active' : '');
                dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
                dot.addEventListener('click', function () {
                    goToSlide(i);
                    restartAutoplay();
                });
                dotsWrap.appendChild(dot);
            }
        }

        if (prevBtn) prevBtn.addEventListener('click', function () { goPrev(); restartAutoplay(); });
        if (nextBtn) nextBtn.addEventListener('click', function () { goNext(); restartAutoplay(); });

        track.addEventListener('transitionend', handleTrackTransitionEnd);

        carousel.addEventListener('mouseenter', stopAutoplay);
        carousel.addEventListener('mouseleave', startAutoplay);
        applyTrackPosition(false);
        updateDots();
        syncCarouselVideos();
        startAutoplay();
    }

    function setupInfiniteTrack() {
        const slides = Array.from(track.querySelectorAll('.home-carousel-slide'));
        if (slides.length !== slideCount) return;

        const firstClone = slides[0].cloneNode(true);
        const lastClone = slides[slideCount - 1].cloneNode(true);
        firstClone.setAttribute('data-carousel-clone', 'first');
        lastClone.setAttribute('data-carousel-clone', 'last');

        track.insertBefore(lastClone, slides[0]);
        track.appendChild(firstClone);
        trackIndex = 1;
        slideIndex = 0;
    }

    function logicalIndexFromTrack() {
        if (!infiniteLoop) return trackIndex;
        if (trackIndex === 0) return slideCount - 1;
        if (trackIndex === slideCount + 1) return 0;
        return trackIndex - 1;
    }

    function applyTrackPosition(animate) {
        if (!track) return;
        if (animate) {
            track.style.transition = '';
        } else {
            track.style.transition = 'none';
        }
        track.style.transform = 'translateX(-' + (trackIndex * 100) + '%)';
        if (!animate) {
            track.offsetHeight;
            track.style.transition = '';
        }
        slideIndex = logicalIndexFromTrack();
    }

    function handleTrackTransitionEnd(e) {
        if (!infiniteLoop || e.target !== track) return;
        if (trackIndex === slideCount + 1) {
            trackIndex = 1;
            applyTrackPosition(false);
            updateDots();
            syncCarouselVideos();
        } else if (trackIndex === 0) {
            trackIndex = slideCount;
            applyTrackPosition(false);
            updateDots();
            syncCarouselVideos();
        }
    }

    function goNext() {
        if (!track || !slideCount) return;
        if (infiniteLoop) {
            trackIndex += 1;
        } else {
            trackIndex = (trackIndex + 1) % slideCount;
        }
        applyTrackPosition(true);
        updateDots();
        syncCarouselVideos();
    }

    function goPrev() {
        if (!track || !slideCount) return;
        if (infiniteLoop) {
            trackIndex -= 1;
        } else {
            trackIndex = ((trackIndex - 1) + slideCount) % slideCount;
        }
        applyTrackPosition(true);
        updateDots();
        syncCarouselVideos();
    }

    function goToSlide(index) {
        if (!track || !slideCount) return;
        const target = ((index % slideCount) + slideCount) % slideCount;
        if (infiniteLoop) {
            trackIndex = target + 1;
        } else {
            trackIndex = target;
        }
        applyTrackPosition(true);
        updateDots();
        syncCarouselVideos();
    }

    function updateDots() {
        if (!dotsWrap) return;
        const active = logicalIndexFromTrack();
        dotsWrap.querySelectorAll('.home-carousel-dot').forEach(function (dot, i) {
            dot.classList.toggle('active', i === active);
        });
    }

    function syncCarouselVideos() {
        if (!track) return;
        track.querySelectorAll('.home-carousel-slide').forEach(function (slide, i) {
            const video = slide.querySelector('[data-carousel-video]');
            if (!video) return;
            if (i === trackIndex) {
                const playPromise = video.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(function () {
                        video.muted = true;
                        video.play().catch(function () {});
                    });
                }
            } else {
                video.pause();
                video.currentTime = 0;
            }
        });
    }

    function startAutoplay() {
        stopAutoplay();
        autoplayTimer = setInterval(function () {
            goNext();
        }, 6000);
    }

    function stopAutoplay() {
        if (autoplayTimer) clearInterval(autoplayTimer);
    }

    function restartAutoplay() {
        stopAutoplay();
        startAutoplay();
    }

    /* Dropdowns */
    document.querySelectorAll('[data-home-dropdown]').forEach(function (wrap) {
        const toggle = wrap.querySelector('[data-home-dropdown-toggle]');
        if (!toggle) return;

        toggle.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = wrap.classList.contains('open');
            closeAllDropdowns();
            if (!isOpen) wrap.classList.add('open');
        });
    });

    function closeAllDropdowns() {
        document.querySelectorAll('.home-dropdown.open').forEach(function (el) {
            el.classList.remove('open');
        });
    }

    document.addEventListener('click', closeAllDropdowns);

    /* Mobile subnav */
    const mobileToggle = document.getElementById('homeMobileNavToggle');
    const mobileNav = document.getElementById('homeMobileNav');
    if (mobileToggle && mobileNav) {
        mobileToggle.addEventListener('click', function () {
            mobileNav.classList.toggle('open');
        });
    }

    /* Find blood tabs */
    const tabBtns = document.querySelectorAll('[data-find-tab]');
    const tabPanels = document.querySelectorAll('[data-find-panel]');

    function activateFindTab(tab) {
        tabBtns.forEach(function (btn) {
            const isActive = btn.getAttribute('data-find-tab') === tab;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        tabPanels.forEach(function (panel) {
            panel.classList.toggle('hidden', panel.getAttribute('data-find-panel') !== tab);
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    tabBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            activateFindTab(btn.getAttribute('data-find-tab'));
        });
    });

    document.querySelectorAll('[data-find-search]').forEach(function (input) {
        input.addEventListener('input', function () {
            const panel = input.closest('[data-find-panel]');
            if (!panel) return;
            const query = input.value.trim().toLowerCase();
            const rows = panel.querySelectorAll('[data-find-row]');
            let visible = 0;
            rows.forEach(function (row) {
                const haystack = (row.getAttribute('data-search') || '').toLowerCase();
                const match = !query || haystack.indexOf(query) !== -1;
                row.classList.toggle('hidden', !match);
                if (match) visible += 1;
            });
            const countEl = panel.querySelector('[data-find-count]');
            if (countEl) countEl.textContent = String(visible);
        });
    });

    document.querySelectorAll('[data-scroll-find]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            const tab = el.getAttribute('data-scroll-find');
            if (tab) activateFindTab(tab);
            closeAllDropdowns();
            if (mobileNav) mobileNav.classList.remove('open');
            const target = document.getElementById('find-blood');
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    document.querySelectorAll('[data-scroll-top]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            closeAllDropdowns();
            if (mobileNav) mobileNav.classList.remove('open');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    /* Smooth scroll anchors */
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            const id = link.getAttribute('href').slice(1);
            if (!id) return;
            const el = document.getElementById(id);
            if (!el) return;
            e.preventDefault();
            closeAllDropdowns();
            if (mobileNav) mobileNav.classList.remove('open');
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    /* Stats counter animation */
    const statValues = document.querySelectorAll('[data-stat-value]');
    let statsAnimated = false;

    function animateStats() {
        if (statsAnimated) return;
        const section = document.getElementById('accessibility-stats');
        if (!section) return;
        const rect = section.getBoundingClientRect();
        if (rect.top > window.innerHeight * 0.85) return;

        statsAnimated = true;
        statValues.forEach(function (el) {
            const target = parseInt(el.getAttribute('data-stat-value'), 10) || 0;
            const duration = 1200;
            const start = performance.now();

            function tick(now) {
                const progress = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                el.textContent = Math.round(target * eased).toLocaleString('en-IN');
                if (progress < 1) requestAnimationFrame(tick);
            }

            requestAnimationFrame(tick);
        });
    }

    window.addEventListener('scroll', animateStats, { passive: true });
    animateStats();

    /* Gallery lightbox */
    const lightbox = document.getElementById('homeLightbox');
    const lightboxMedia = document.getElementById('homeLightboxMedia');
    const lightboxCaption = document.getElementById('homeLightboxCaption');
    const lightboxClose = document.getElementById('homeLightboxClose');

    function openLightbox(src, type, caption) {
        if (!lightbox || !lightboxMedia) return;
        lightboxMedia.innerHTML = '';
        if (type === 'video') {
            const video = document.createElement('video');
            video.src = src;
            video.controls = true;
            video.autoplay = true;
            lightboxMedia.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = src;
            img.alt = caption || 'Gallery image';
            lightboxMedia.appendChild(img);
        }
        if (lightboxCaption) lightboxCaption.textContent = caption || '';
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        if (!lightbox) return;
        lightbox.classList.remove('open');
        if (lightboxMedia) lightboxMedia.innerHTML = '';
        document.body.style.overflow = '';
    }

    document.querySelectorAll('[data-gallery-item]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            openLightbox(
                btn.getAttribute('data-src'),
                btn.getAttribute('data-type') || 'image',
                btn.getAttribute('data-caption') || ''
            );
        });
    });

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightbox) {
        lightbox.addEventListener('click', function (e) {
            if (e.target === lightbox) closeLightbox();
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeLightbox();
    });

    /* Deep link on load */
    if (window.location.hash === '#find-blood') {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab === 'donors' || tab === 'bloodbanks') {
            activateFindTab(tab);
        }
    }

    initCarousel();
    if (typeof lucide !== 'undefined') lucide.createIcons();
})();
