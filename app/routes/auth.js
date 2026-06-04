const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, checkAuth, guest } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { profileUpload } = require('../utils/upload');
const { authLimiter, otpLimiter } = require('../middlewares/rateLimit');
const {
    registerSchema,
    loginSchema,
    verifyOtpSchema,
    resendOtpSchema,
    verifyPhoneOtpSchema,
    resendPhoneOtpSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
    profileSchema,
} = require('../utils/validationSchemas');

router.post('/register', authLimiter, profileUpload.single('profileImage'), validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.get('/verify-phone', authController.showVerifyPhone);
router.post('/verify-phone-otp', otpLimiter, validate(verifyPhoneOtpSchema), authController.verifyPhoneOtp);
router.post('/resend-phone-otp', otpLimiter, validate(resendPhoneOtpSchema), authController.resendPhoneOtp);
router.get('/verify-email', authController.showVerifyEmail);
router.post('/verify-otp', otpLimiter, validate(verifyOtpSchema), authController.verifyOtp);
router.post('/resend-otp', otpLimiter, validate(resendOtpSchema), authController.resendOtp);

router.get('/forgot-password', checkAuth, guest, authController.showForgotPassword);
router.post('/forgot-password', authLimiter, checkAuth, guest, validate(forgotPasswordSchema), authController.forgotPassword);
router.get('/reset-password/:token', checkAuth, guest, authController.showResetPassword);
router.post('/reset-password/:token', checkAuth, guest, validate(resetPasswordSchema), authController.resetPassword);

router.get('/change-password', auth, authController.showChangePassword);
router.post('/change-password', auth, validate(changePasswordSchema), authController.changePassword);
router.post('/profile', auth, profileUpload.single('profileImage'), validate(profileSchema), authController.updateProfile);

router.post('/refresh', authController.refresh);
router.get('/logout', authController.logout);

module.exports = router;
