const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    city: { type: String, required: true },
    role: { type: String, enum: ['user', 'donor', 'bloodbank', 'admin', 'camp'], default: 'user' },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    otpHash: { type: String, select: false },
    otpExpiresAt: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
    phoneOtpHash: { type: String, select: false },
    phoneOtpExpiresAt: { type: Date, select: false },
    phoneOtpAttempts: { type: Number, default: 0, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    refreshTokenHash: { type: String, select: false, default: null },
    refreshTokenExpires: { type: Date, select: false, default: null },
    previousRefreshTokenHash: { type: String, select: false, default: null },
    tokenVersion: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false }, // For admins to verify donors/bloodbanks
    subscription: {
        plan: { type: String, enum: ['free', 'premium', 'pro', 'advanced'], default: 'free' },
        status: { type: String, enum: ['inactive', 'active', 'expired', 'past_due', 'cancelled'], default: 'active' },
        startedAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, default: null },
        lastOrderId: { type: String, default: null },
        lastPaymentId: { type: String, default: null },
        razorpayCustomerId: { type: String, default: null },
        razorpaySubscriptionId: { type: String, default: null },
        currentPeriodEnd: { type: Date, default: null },
    },
    featureFlags: {
        canUseAdvancedAnalytics: { type: Boolean, default: false },
        canUsePriorityListing: { type: Boolean, default: false },
        canUseApiExport: { type: Boolean, default: false },
    },
    donorVerificationFeePaid: { type: Boolean, default: false },
    profileImage: {
        url: { type: String, default: '' },
        public_id: { type: String, default: '' },
    },
}, { timestamps: true });

const { normalizeCity } = require('../utils/city');

userSchema.pre('save', function () {
    if (this.isModified('email') && this.email) {
        this.email = this.email.toLowerCase().trim();
    }
    if (this.isModified('city') && this.city) {
        this.city = normalizeCity(this.city);
    }
});

// Password hashing
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
