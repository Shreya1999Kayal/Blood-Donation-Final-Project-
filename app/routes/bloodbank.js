const express = require('express');
const router = express.Router();
const { auth, restrictTo } = require('../middlewares/auth');
const { upload } = require('../utils/upload');
const { validate } = require('../middlewares/validate');
const { bloodBankSetupSchema, inventorySchema, objectIdParamSchema } = require('../utils/validationSchemas');
const bloodbankController = require('../controllers/bloodbankController');
const campParticipationController = require('../controllers/campParticipationController');

router.get('/setup', auth, restrictTo('bloodbank'), bloodbankController.showSetup);

router.post('/setup', auth, restrictTo('bloodbank'), upload.fields([
    { name: 'registrationCertificate', maxCount: 1 },
]), validate(bloodBankSetupSchema), bloodbankController.setup);

router.post('/profile', auth, restrictTo('bloodbank'), validate(bloodBankSetupSchema), bloodbankController.updateProfile);

router.post('/certificate', auth, restrictTo('bloodbank'), upload.fields([
    { name: 'registrationCertificate', maxCount: 1 },
]), bloodbankController.updateCertificate);

router.post('/update-inventory', auth, restrictTo('bloodbank'), validate(inventorySchema), bloodbankController.updateInventory);

router.get('/inventory', auth, restrictTo('bloodbank'), bloodbankController.getInventory);
router.post('/camp-participation/:id/accept', auth, restrictTo('bloodbank'), validate(objectIdParamSchema, 'params'), campParticipationController.acceptRequest);
router.post('/camp-participation/:id/reject', auth, restrictTo('bloodbank'), validate(objectIdParamSchema, 'params'), campParticipationController.rejectRequest);

module.exports = router;
