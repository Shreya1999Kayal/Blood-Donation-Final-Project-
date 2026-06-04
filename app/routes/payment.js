const express = require('express');
const router = express.Router();
const { auth, restrictTo } = require('../middlewares/auth');
const paymentController = require('../controllers/paymentController');

router.post('/create-order', auth, restrictTo('user', 'donor', 'bloodbank', 'camp'), paymentController.createOrder);
router.post('/verify', auth, restrictTo('user', 'donor', 'bloodbank', 'camp'), paymentController.verifyPayment);
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
