const express = require('express');
const router = express.Router();
const { auth, restrictTo } = require('../middlewares/auth');
const { upload } = require('../utils/upload');
const { validate } = require('../middlewares/validate');
const { donorRegisterSchema, availabilitySchema, objectIdParamSchema } = require('../utils/validationSchemas');
const donorController = require('../controllers/donorController');
const campParticipationController = require('../controllers/campParticipationController');

router.post('/register', auth, restrictTo('donor'), upload.fields([
    { name: 'bloodGroupReport', maxCount: 1 },
    { name: 'bloodTestReport', maxCount: 1 },
    { name: 'fitnessCertificate', maxCount: 1 },
    { name: 'identityProof', maxCount: 1 },
]), validate(donorRegisterSchema), donorController.register);

router.patch('/availability', auth, restrictTo('donor'), validate(availabilitySchema), donorController.updateAvailabilityJson);
router.post('/availability', auth, restrictTo('donor'), validate(availabilitySchema), donorController.updateAvailability);
router.get('/history', auth, restrictTo('donor'), donorController.getHistory);
router.post('/camp-participation/:id/accept', auth, restrictTo('donor'), validate(objectIdParamSchema, 'params'), campParticipationController.acceptRequest);
router.post('/camp-participation/:id/reject', auth, restrictTo('donor'), validate(objectIdParamSchema, 'params'), campParticipationController.rejectRequest);

module.exports = router;
