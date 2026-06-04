const express = require('express');
const router = express.Router();
const { auth, restrictTo } = require('../middlewares/auth');
const { profileUpload } = require('../utils/upload');
const { validate } = require('../middlewares/validate');
const { feedbackSubmitSchema } = require('../utils/validationSchemas');
const feedbackController = require('../controllers/feedbackController');

router.post(
    '/',
    auth,
    restrictTo('user', 'donor', 'bloodbank', 'camp'),
    profileUpload.fields([{ name: 'photos', maxCount: 1 }]),
    validate(feedbackSubmitSchema),
    feedbackController.submit,
);

module.exports = router;
