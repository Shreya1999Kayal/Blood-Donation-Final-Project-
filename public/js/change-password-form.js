(function () {
    const form = document.getElementById('cpForm');
    if (!form) return;

    const submitBtn = document.getElementById('cpSubmit') || form.querySelector('button[type="submit"]');

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getFlashMount() {
        let mount = document.getElementById('cpFlashAlert');
        if (!mount) {
            mount = document.createElement('div');
            mount.id = 'cpFlashAlert';
            mount.className = 'mb-3';
            form.parentElement.insertBefore(mount, form);
        }
        return mount;
    }

    function showFlash(type, message) {
        const mount = getFlashMount();
        const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
        const icon = type === 'success' ? 'check-circle' : 'alert-circle';
        mount.innerHTML =
            '<div class="alert ' + alertClass + ' alert-dismissible fade show cp-flash" role="alert">' +
            '<i data-lucide="' + icon + '" style="width:18px;height:18px;"></i> ' +
            escapeHtml(message) +
            '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
            '</div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        mount.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function setSubmitting(active) {
        if (!submitBtn) return;
        submitBtn.disabled = active;
        if (active) {
            submitBtn.dataset.cpOriginalHtml = submitBtn.innerHTML;
            submitBtn.innerHTML = 'Updating…';
        } else if (submitBtn.dataset.cpOriginalHtml) {
            submitBtn.innerHTML = submitBtn.dataset.cpOriginalHtml;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const newPassword = form.querySelector('[name="newPassword"]');
        const confirmPassword = form.querySelector('[name="confirmPassword"]');
        const currentPassword = form.querySelector('[name="currentPassword"]');

        if (!currentPassword?.value || !newPassword?.value || !confirmPassword?.value) {
            showFlash('error', 'All fields are required');
            return;
        }

        if (currentPassword.value === newPassword.value) {
            showFlash('error', 'New password cannot be the same as your old password');
            newPassword.focus();
            return;
        }

        if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
            showFlash('error', 'New passwords do not match');
            confirmPassword.focus();
            return;
        }

        const payload = new URLSearchParams();
        payload.set('currentPassword', currentPassword.value);
        payload.set('newPassword', newPassword.value);
        payload.set('confirmPassword', confirmPassword.value);
        setSubmitting(true);

        fetch('/auth/change-password', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: payload.toString(),
            credentials: 'same-origin',
        })
            .then(function (response) {
                return response.text().then(function (text) {
                    let data = {};
                    if (text) {
                        try {
                            data = JSON.parse(text);
                        } catch (_) {
                            data = {};
                        }
                    }
                    return { response: response, data: data };
                });
            })
            .then(function (result) {
                if (result.response.ok && result.data.ok) {
                    showFlash('success', result.data.message || 'Your password has been updated successfully.');
                    form.reset();
                    form.dispatchEvent(new CustomEvent('cp-form-reset'));
                    return;
                }
                showFlash(
                    'error',
                    result.data.error || result.data.message || 'Could not change password. Try again.'
                );
            })
            .catch(function () {
                showFlash('error', 'Could not change password. Check your connection and try again.');
            })
            .finally(function () {
                setSubmitting(false);
            });
    });
})();
