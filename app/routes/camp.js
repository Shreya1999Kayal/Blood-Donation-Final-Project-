const express = require('express');
const router = express.Router();
const { auth, restrictTo } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const campController = require('../controllers/campController');
const campParticipationController = require('../controllers/campParticipationController');
const {
    campSetupSchema,
    campEventSchema,
    campSetupOtpSchema,
    objectIdParamSchema,
} = require('../utils/validationSchemas');

router.use(auth, restrictTo('camp'));

router.get('/setup', campController.showSetup);
router.post('/setup', validate(campSetupSchema), campController.submitSetup);
router.get('/verify-setup', campController.showVerifySetup);
router.post('/verify-setup', validate(campSetupOtpSchema), campController.verifySetupOtp);
router.post('/events', validate(campEventSchema), campController.createEvent);
router.post('/events/:id/complete', validate(objectIdParamSchema, 'params'), campController.completeEvent);
router.post('/events/:id/cancel', validate(objectIdParamSchema, 'params'), campController.cancelEvent);
router.post('/participation/donor', campParticipationController.sendDonorRequest);
router.post('/participation/bloodbank', campParticipationController.sendBloodBankRequest);

module.exports = router;
