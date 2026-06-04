(function () {
    function initialsFromName(name, fallback) {
        if (!name || !String(name).trim()) return fallback || '?';
        return String(name).trim().split(/\s+/).map(function (part) {
            return part[0];
        }).slice(0, 2).join('').toUpperCase();
    }

    document.querySelectorAll('.profile-photo-input').forEach(function (input) {
        input.addEventListener('change', function () {
            const file = input.files && input.files[0];
            const imgId = input.dataset.previewImg;
            const initialId = input.dataset.previewInitial;
            const img = imgId ? document.getElementById(imgId) : null;
            const initial = initialId ? document.getElementById(initialId) : null;

            if (!file) return;

            if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
                alert('Please choose a JPG, PNG, or WEBP image.');
                input.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function (event) {
                if (img) {
                    img.src = event.target.result;
                    img.classList.remove('d-none');
                }
                if (initial) initial.classList.add('d-none');
            };
            reader.readAsDataURL(file);
        });
    });

    const registerNameInput = document.querySelector('#registerForm input[name="name"]');
    const registerInitial = document.getElementById('registerPhotoInitial');
    const registerImg = document.getElementById('registerPhotoImg');
    if (registerNameInput && registerInitial) {
        registerNameInput.addEventListener('input', function () {
            if (registerImg && !registerImg.classList.contains('d-none') && registerImg.src) return;
            registerInitial.textContent = initialsFromName(registerNameInput.value, 'U');
            registerInitial.classList.remove('d-none');
            if (registerImg) registerImg.classList.add('d-none');
        });
    }
})();
