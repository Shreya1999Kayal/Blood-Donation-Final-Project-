const express = require('express');
const router = express.Router();
const { checkAuth, auth } = require('../middlewares/auth');
const pageController = require('../controllers/pageController');

router.get('/', checkAuth, pageController.showHome);
router.get('/auth/login', checkAuth, pageController.showLogin);
router.get('/auth/register', checkAuth, pageController.showRegister);
router.get('/dashboard', auth, pageController.showDashboard);

module.exports = router;
