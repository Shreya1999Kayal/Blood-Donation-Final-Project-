const express = require('express');
const router = express.Router();
const { auth, checkAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { upload } = require('../utils/upload');
const { aiLimiter } = require('../middlewares/rateLimit');
const {
    aiRecommendSchema,
    prioritySchema,
    helpChatSchema,
    analyzeMedicalReportSchema,
    verifyBloodGroupSchema,
} = require('../utils/validationSchemas');
const aiController = require('../controllers/aiController');

router.use(aiLimiter);

router.post('/help', checkAuth, validate(helpChatSchema), aiController.helpChat);
router.post('/chat', auth, validate(helpChatSchema), aiController.aiChat);
router.post(
    '/analyze-medical-report',
    auth,
    upload.single('report'),
    validate(analyzeMedicalReportSchema),
    aiController.analyzeMedicalReport
);
router.post(
    '/verify-blood-group',
    auth,
    upload.single('report'),
    validate(verifyBloodGroupSchema),
    aiController.verifyBloodGroupApi
);
router.get('/recommend-donors', auth, validate(aiRecommendSchema, 'query'), aiController.recommendDonorsApi);
router.post('/predict-priority', auth, validate(prioritySchema), aiController.predictPriority);

module.exports = router;
