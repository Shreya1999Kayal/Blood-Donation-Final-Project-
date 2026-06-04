(function () {
    function initStarRating(container) {
        const input = container.querySelector('[data-fb-rating-input]');
        const label = container.querySelector('[data-fb-star-label]');
        const stars = Array.from(container.querySelectorAll('.fb-star'));
        if (!input || !stars.length) return;

        function setRating(value) {
            input.value = String(value);
            stars.forEach(function (star) {
                const active = Number(star.dataset.value) <= value;
                star.classList.toggle('is-active', active);
            });
            if (label) {
                label.textContent = value + ' out of 5';
            }
        }

        stars.forEach(function (star) {
            star.addEventListener('click', function () {
                setRating(Number(star.dataset.value));
            });
            star.addEventListener('mouseenter', function () {
                const hoverValue = Number(star.dataset.value);
                stars.forEach(function (s) {
                    s.classList.toggle('is-active', Number(s.dataset.value) <= hoverValue);
                });
            });
        });

        container.addEventListener('mouseleave', function () {
            const current = Number(input.value || 0);
            if (current) setRating(current);
        });

        if (input.value) setRating(Number(input.value));
    }

    function initPhotoPreview(input) {
        const preview = input.closest('.fb-form')?.querySelector('[data-fb-photo-preview]');
        if (!preview) return;

        input.addEventListener('change', function () {
            preview.innerHTML = '';
            const file = (input.files && input.files[0]) || null;
            if (!file) {
                preview.hidden = true;
                return;
            }

            if (!file.type.startsWith('image/')) {
                preview.hidden = true;
                input.value = '';
                alert('Please choose a JPG, PNG, or WEBP image.');
                return;
            }

            preview.hidden = false;
            const col = document.createElement('div');
            col.className = 'col-auto';
            const img = document.createElement('img');
            img.alt = file.name;
            img.src = URL.createObjectURL(file);
            col.appendChild(img);
            preview.appendChild(col);
        });
    }

    document.querySelectorAll('[data-fb-stars]').forEach(initStarRating);
    document.querySelectorAll('[data-fb-photo-input]').forEach(initPhotoPreview);

    document.querySelectorAll('.fb-form').forEach(function (form) {
        form.addEventListener('submit', function (event) {
            const ratingInput = form.querySelector('[data-fb-rating-input]');
            if (ratingInput && !ratingInput.value) {
                event.preventDefault();
                alert('Please select a star rating before submitting.');
            }
        });
    });
})();
