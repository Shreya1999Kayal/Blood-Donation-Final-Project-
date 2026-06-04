(function () {
    const configs = {
        patient: {
            modalId: 'adminPatientModal',
            formId: 'adminPatientForm',
            titleId: 'adminPatientModalTitle',
            createAction: '/admin/patients/create',
            updateAction: function (id) { return '/admin/patient/' + id + '/update'; },
            createTitle: 'Add patient',
            editTitle: 'Edit patient',
            fields: ['name', 'email', 'phone', 'city', 'password', 'subscriptionPlan', 'emailVerified'],
        },
        donor: {
            modalId: 'adminDonorModal',
            formId: 'adminDonorForm',
            titleId: 'adminDonorModalTitle',
            createAction: '/admin/donors/create',
            updateAction: function (id) { return '/admin/donor/' + id + '/update'; },
            createTitle: 'Add donor',
            editTitle: 'Edit donor',
            fields: ['name', 'email', 'phone', 'city', 'password', 'bloodGroup', 'latitude', 'longitude', 'status', 'isAvailable', 'emailVerified'],
        },
        bloodbank: {
            modalId: 'adminBloodBankModal',
            formId: 'adminBloodBankForm',
            titleId: 'adminBloodBankModalTitle',
            createAction: '/admin/bloodbanks/create',
            updateAction: function (id) { return '/admin/bloodbank/' + id + '/update'; },
            createTitle: 'Add blood bank',
            editTitle: 'Edit blood bank',
            fields: ['hospitalName', 'name', 'email', 'phone', 'city', 'password', 'registrationCertificateUrl', 'status', 'latitude', 'longitude', 'emailVerified'],
        },
        camp: {
            modalId: 'adminCampModal',
            formId: 'adminCampForm',
            titleId: 'adminCampModalTitle',
            createAction: '/admin/camps/create',
            updateAction: function (id) { return '/admin/camp/' + id + '/update'; },
            createTitle: 'Add camp organization',
            editTitle: 'Edit camp organization',
            fields: ['organizationName', 'organizationType', 'name', 'email', 'phone', 'city', 'password', 'organizerName', 'organizerMobile', 'organizerEmail', 'coOrganizerName', 'coOrganizerMobile', 'status', 'emailVerified', 'mobileVerified'],
        },
    };

    function setCheckbox(form, name, checked) {
        const input = form.querySelector('[name="' + name + '"]');
        if (input && input.type === 'checkbox') input.checked = Boolean(checked);
    }

    function setField(form, name, value) {
        const input = form.querySelector('[name="' + name + '"]');
        if (!input) return;
        if (input.type === 'checkbox') {
            input.checked = value === true || value === 'true' || value === '1' || value === 'on';
            return;
        }
        input.value = value == null ? '' : String(value);
    }

    function clearInventoryFields(form) {
        form.querySelectorAll('.admin-inv-field').forEach(function (input) {
            input.value = '0';
        });
    }

    function fillInventory(form, inventory) {
        if (!inventory || typeof inventory !== 'object') return;
        Object.keys(inventory).forEach(function (group) {
            const input = form.querySelector('[name="inventory[' + group + ']"]');
            if (input) input.value = String(inventory[group] || 0);
        });
    }

    function openModal(entity, mode, data) {
        const cfg = configs[entity];
        if (!cfg) return;
        const modalEl = document.getElementById(cfg.modalId);
        const form = document.getElementById(cfg.formId);
        const titleEl = document.getElementById(cfg.titleId);
        if (!modalEl || !form) return;

        form.reset();
        clearInventoryFields(form);

        const pwdField = form.querySelector('.admin-pwd-field');
        if (pwdField) {
            pwdField.required = mode === 'create';
            pwdField.value = '';
        }

        if (mode === 'create') {
            form.action = cfg.createAction;
            if (titleEl) titleEl.textContent = cfg.createTitle;
            if (entity === 'patient') setCheckbox(form, 'emailVerified', true);
            if (entity === 'donor') {
                setCheckbox(form, 'isAvailable', true);
                setCheckbox(form, 'emailVerified', true);
            }
            if (entity === 'bloodbank') setCheckbox(form, 'emailVerified', true);
            if (entity === 'camp') {
                setCheckbox(form, 'emailVerified', true);
                setCheckbox(form, 'mobileVerified', true);
                setField(form, 'status', 'approved');
            }
        } else {
            const id = data.id || data._id;
            form.action = cfg.updateAction(id);
            if (titleEl) titleEl.textContent = cfg.editTitle;
            cfg.fields.forEach(function (field) {
                if (Object.prototype.hasOwnProperty.call(data, field)) {
                    setField(form, field, data[field]);
                }
            });
            if (entity === 'bloodbank' && data.inventory) {
                fillInventory(form, data.inventory);
            }
            if (entity === 'donor' && data.coords) {
                setField(form, 'latitude', data.coords[1]);
                setField(form, 'longitude', data.coords[0]);
            }
            if (entity === 'bloodbank' && data.coords) {
                setField(form, 'latitude', data.coords[1]);
                setField(form, 'longitude', data.coords[0]);
            }
        }

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }

    document.querySelectorAll('[data-admin-create]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            openModal(btn.dataset.adminCreate, 'create', {});
        });
    });

    document.addEventListener('click', function (event) {
        const btn = event.target.closest('[data-admin-edit]');
        if (!btn) return;
        const entity = btn.dataset.adminEdit;
        let payload = {};
        try {
            payload = JSON.parse(btn.dataset.payload || '{}');
        } catch (e) {
            payload = {};
        }
        openModal(entity, 'edit', payload);
    });

    document.addEventListener('submit', function (event) {
        const form = event.target;
        if (!form.matches('[data-admin-delete]')) return;
        const label = form.dataset.confirmLabel || 'this record';
        if (!window.confirm('Delete ' + label + '? This cannot be undone.')) {
            event.preventDefault();
        }
    });
})();
