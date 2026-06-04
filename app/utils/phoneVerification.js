const User = require('../models/User');

/**
 * Accounts that verified email before phone SMS verification existed
 * are treated as phone-verified when no phone OTP was ever issued.
 */
async function grandfatherLegacyPhoneVerification(user) {
    if (!user || user.phoneVerified || !user.emailVerified) {
        return user;
    }

    const record = await User.findById(user._id).select('+phoneOtpHash');
    if (!record || record.phoneOtpHash) {
        return user;
    }

    record.phoneVerified = true;
    await record.save();
    user.phoneVerified = true;
    return user;
}

module.exports = {
    grandfatherLegacyPhoneVerification,
};
