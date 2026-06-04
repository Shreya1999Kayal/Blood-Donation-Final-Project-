const express = require('express');
const router = express.Router();
const { auth, restrictTo } = require('../middlewares/auth');
const { upload } = require('../utils/upload');
const { validate } = require('../middlewares/validate');
const { requestCreateSchema, contactSchema, receivedSchema } = require('../utils/validationSchemas');
const requestController = require('../controllers/requestController');

router.post('/create', auth, restrictTo('user'), upload.fields([
    { name: 'bloodTestReport', maxCount: 1 },
    { name: 'prescription', maxCount: 1 },
]), validate(requestCreateSchema), requestController.createRequest);

router.post('/:id/contact', auth, restrictTo('donor', 'bloodbank', 'admin'), validate(contactSchema), requestController.recordContact);
router.post('/:id/received', auth, restrictTo('user'), validate(receivedSchema), requestController.markReceived);
router.get('/', auth, requestController.listRequests);

module.exports = router;
