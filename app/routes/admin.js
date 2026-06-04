const express = require('express');
const router = express.Router();
const { auth, restrictTo, requireHighAuth, checkAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { authLimiter } = require('../middlewares/rateLimit');
const { profileUpload } = require('../utils/upload');
const { sanitizeGeoFields } = require('../utils/sanitizeGeo');
const {
    objectIdParamSchema,
    adminRegisterSchema,
    loginSchema,
    adminCreatePatientSchema,
    adminUpdatePatientSchema,
    adminCreateDonorSchema,
    adminUpdateDonorSchema,
    adminCreateBloodBankSchema,
    adminUpdateBloodBankSchema,
    adminCreateCampSchema,
    adminUpdateCampSchema,
} = require('../utils/validationSchemas');
const adminController = require('../controllers/adminController');
const adminAuthController = require('../controllers/adminAuthController');
const feedbackController = require('../controllers/feedbackController');

router.get('/registration', checkAuth, adminAuthController.showRegister);
router.post('/registration', authLimiter, profileUpload.single('profileImage'), validate(adminRegisterSchema), adminAuthController.register);
router.get('/login', checkAuth, adminAuthController.showLogin);
router.post('/login', authLimiter, validate(loginSchema), adminAuthController.login);

router.use(auth, requireHighAuth, restrictTo('admin'));

router.get('/medical-review/:id', validate(objectIdParamSchema, 'params'), adminController.getMedicalReview);

function geoDefaults(req, res, next) {
    if (req.body) sanitizeGeoFields(req.body, { applyDefaults: true });
    next();
}

router.post('/donor/:id/approve', validate(objectIdParamSchema, 'params'), adminController.approveDonor);
router.patch('/donor/:id/approve', validate(objectIdParamSchema, 'params'), adminController.approveDonor);
router.post('/donor/:id/reject', validate(objectIdParamSchema, 'params'), adminController.rejectDonor);
router.post('/bloodbank/:id/approve', validate(objectIdParamSchema, 'params'), adminController.approveBloodBank);
router.post('/bloodbank/:id/reject', validate(objectIdParamSchema, 'params'), adminController.rejectBloodBank);
router.post('/camp/:id/approve', validate(objectIdParamSchema, 'params'), adminController.approveCamp);
router.post('/camp/:id/reject', validate(objectIdParamSchema, 'params'), adminController.rejectCamp);

router.post('/patients/create', validate(adminCreatePatientSchema), adminController.createPatient);
router.post('/patient/:id/update', validate(objectIdParamSchema, 'params'), validate(adminUpdatePatientSchema), adminController.updatePatient);
router.post('/patient/:id/delete', validate(objectIdParamSchema, 'params'), adminController.deletePatient);

router.post('/donors/create', geoDefaults, validate(adminCreateDonorSchema), adminController.createDonor);
router.post('/donor/:id/update', validate(objectIdParamSchema, 'params'), geoDefaults, validate(adminUpdateDonorSchema), adminController.updateDonor);
router.post('/donor/:id/delete', validate(objectIdParamSchema, 'params'), adminController.deleteDonor);

router.post('/bloodbanks/create', geoDefaults, validate(adminCreateBloodBankSchema), adminController.createBloodBank);
router.post('/bloodbank/:id/update', validate(objectIdParamSchema, 'params'), geoDefaults, validate(adminUpdateBloodBankSchema), adminController.updateBloodBank);
router.post('/bloodbank/:id/delete', validate(objectIdParamSchema, 'params'), adminController.deleteBloodBank);

router.post('/camps/create', validate(adminCreateCampSchema), adminController.createCamp);
router.post('/camp/:id/update', validate(objectIdParamSchema, 'params'), validate(adminUpdateCampSchema), adminController.updateCamp);
router.post('/camp/:id/delete', validate(objectIdParamSchema, 'params'), adminController.deleteCamp);

router.post('/feedback/:id/publish', validate(objectIdParamSchema, 'params'), feedbackController.publishFeedback);
router.post('/feedback/:id/hide', validate(objectIdParamSchema, 'params'), feedbackController.hideFeedback);

module.exports = router;
