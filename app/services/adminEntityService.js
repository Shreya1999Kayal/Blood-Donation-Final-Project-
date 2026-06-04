const User = require('../models/User');
const Donor = require('../models/Donor');
const BloodBank = require('../models/BloodBank');
const Camp = require('../models/Camp');
const CampEvent = require('../models/CampEvent');
const CampContactUnlock = require('../models/CampContactUnlock');
const DonationHistory = require('../models/DonationHistory');
const Request = require('../models/Request');
const Notification = require('../models/Notification');
const ChatMessage = require('../models/ChatMessage');
const Conversation = require('../models/Conversation');
const { buildLocationFromBody } = require('../utils/sanitizeGeo');

async function assertUniqueEmail(email, excludeUserId = null) {
    const query = { email: email.toLowerCase().trim() };
    if (excludeUserId) query._id = { $ne: excludeUserId };
    const existing = await User.findOne(query).select('_id');
    if (existing) {
        const err = new Error('Email is already registered');
        err.code = 'DUPLICATE_EMAIL';
        throw err;
    }
}

function syncVerifiedFlag(status) {
    return status === 'approved';
}

async function cleanupUserRelations(userId) {
    const uid = userId.toString();
    await Promise.all([
        Notification.deleteMany({ userId }),
        ChatMessage.deleteMany({ $or: [{ fromUserId: userId }, { toUserId: userId }] }),
        Conversation.deleteMany({ participants: userId }),
        Request.deleteMany({ requestedBy: userId }),
    ]);
}

async function createPatient(data) {
    await assertUniqueEmail(data.email);
    const user = new User({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        city: data.city,
        role: 'user',
        emailVerified: Boolean(data.emailVerified),
        subscription: {
            plan: data.subscriptionPlan || 'free',
            status: 'active',
        },
    });
    await user.save();
    return user;
}

async function updatePatient(userId, data) {
    const user = await User.findById(userId);
    if (!user || user.role !== 'user') {
        const err = new Error('Patient not found');
        err.code = 'NOT_FOUND';
        throw err;
    }
    await assertUniqueEmail(data.email, user._id);
    user.name = data.name;
    user.email = data.email;
    user.phone = data.phone;
    user.city = data.city;
    user.emailVerified = Boolean(data.emailVerified);
    user.subscription = user.subscription || {};
    user.subscription.plan = data.subscriptionPlan;
    if (data.password) user.password = data.password;
    await user.save();
    return user;
}

async function deletePatient(userId) {
    const user = await User.findById(userId);
    if (!user || user.role !== 'user') {
        const err = new Error('Patient not found');
        err.code = 'NOT_FOUND';
        throw err;
    }
    await cleanupUserRelations(user._id);
    await User.deleteOne({ _id: user._id });
}

async function createDonor(data) {
    await assertUniqueEmail(data.email);
    const user = new User({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        city: data.city,
        role: 'donor',
        emailVerified: Boolean(data.emailVerified),
        isVerified: syncVerifiedFlag(data.status),
    });
    await user.save();

    const donor = await Donor.create({
        userId: user._id,
        bloodGroup: data.bloodGroup,
        location: buildLocationFromBody(data),
        status: data.status || 'pending',
        isAvailable: Boolean(data.isAvailable),
    });
    return { user, donor };
}

async function updateDonor(donorId, data) {
    const donor = await Donor.findById(donorId);
    if (!donor) {
        const err = new Error('Donor not found');
        err.code = 'NOT_FOUND';
        throw err;
    }
    const user = await User.findById(donor.userId);
    if (!user || user.role !== 'donor') {
        const err = new Error('Donor not found');
        err.code = 'NOT_FOUND';
        throw err;
    }

    await assertUniqueEmail(data.email, user._id);
    user.name = data.name;
    user.email = data.email;
    user.phone = data.phone;
    user.city = data.city;
    user.emailVerified = Boolean(data.emailVerified);
    user.isVerified = syncVerifiedFlag(data.status);
    if (data.password) user.password = data.password;
    await user.save();

    donor.bloodGroup = data.bloodGroup;
    donor.location = buildLocationFromBody(data);
    donor.status = data.status;
    donor.isAvailable = Boolean(data.isAvailable);
    await donor.save();
    return { user, donor };
}

async function deleteDonor(donorId) {
    const donor = await Donor.findById(donorId);
    if (!donor) {
        const err = new Error('Donor not found');
        err.code = 'NOT_FOUND';
        throw err;
    }
    const user = await User.findById(donor.userId);
    await DonationHistory.deleteMany({ donorId: donor._id });
    await donor.deleteOne();
    if (user) {
        await cleanupUserRelations(user._id);
        await user.deleteOne();
    }
}

async function createBloodBank(data) {
    await assertUniqueEmail(data.email);
    const user = new User({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        city: data.city,
        role: 'bloodbank',
        emailVerified: Boolean(data.emailVerified),
        isVerified: syncVerifiedFlag(data.status),
    });
    await user.save();

    const bloodbank = await BloodBank.create({
        userId: user._id,
        hospitalName: data.hospitalName,
        location: buildLocationFromBody(data),
        status: data.status || 'pending',
        registrationCertificateUrl: data.registrationCertificateUrl || null,
        inventory: data.inventory || undefined,
    });
    return { user, bloodbank };
}

async function updateBloodBank(bloodbankId, data) {
    const bloodbank = await BloodBank.findById(bloodbankId);
    if (!bloodbank) {
        const err = new Error('Blood bank not found');
        err.code = 'NOT_FOUND';
        throw err;
    }
    const user = await User.findById(bloodbank.userId);
    if (!user || user.role !== 'bloodbank') {
        const err = new Error('Blood bank not found');
        err.code = 'NOT_FOUND';
        throw err;
    }

    await assertUniqueEmail(data.email, user._id);
    user.name = data.name;
    user.email = data.email;
    user.phone = data.phone;
    user.city = data.city;
    user.emailVerified = Boolean(data.emailVerified);
    user.isVerified = syncVerifiedFlag(data.status);
    if (data.password) user.password = data.password;
    await user.save();

    bloodbank.hospitalName = data.hospitalName;
    bloodbank.location = buildLocationFromBody(data);
    bloodbank.status = data.status;
    if (data.registrationCertificateUrl !== undefined) {
        bloodbank.registrationCertificateUrl = data.registrationCertificateUrl || null;
    }
    if (data.inventory) bloodbank.inventory = data.inventory;
    await bloodbank.save();
    return { user, bloodbank };
}

async function deleteBloodBank(bloodbankId) {
    const bloodbank = await BloodBank.findById(bloodbankId);
    if (!bloodbank) {
        const err = new Error('Blood bank not found');
        err.code = 'NOT_FOUND';
        throw err;
    }
    const user = await User.findById(bloodbank.userId);
    await bloodbank.deleteOne();
    if (user) {
        await cleanupUserRelations(user._id);
        await user.deleteOne();
    }
}

async function createCamp(data) {
    await assertUniqueEmail(data.email);
    const user = new User({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        city: data.city,
        role: 'camp',
        emailVerified: Boolean(data.emailVerified),
        isVerified: syncVerifiedFlag(data.status),
    });
    await user.save();

    const camp = await Camp.create({
        userId: user._id,
        organizationType: data.organizationType,
        organizationName: data.organizationName,
        organizerName: data.organizerName,
        organizerMobile: data.organizerMobile,
        organizerEmail: data.organizerEmail,
        coOrganizerName: data.coOrganizerName || '',
        coOrganizerMobile: data.coOrganizerMobile || '',
        mobileVerified: Boolean(data.mobileVerified),
        status: data.status || 'approved',
    });
    return { user, camp };
}

async function updateCamp(campId, data) {
    const camp = await Camp.findById(campId);
    if (!camp) {
        const err = new Error('Camp organization not found');
        err.code = 'NOT_FOUND';
        throw err;
    }
    const user = await User.findById(camp.userId);
    if (!user || user.role !== 'camp') {
        const err = new Error('Camp organization not found');
        err.code = 'NOT_FOUND';
        throw err;
    }

    await assertUniqueEmail(data.email, user._id);
    user.name = data.name;
    user.email = data.email;
    user.phone = data.phone;
    user.city = data.city;
    user.emailVerified = Boolean(data.emailVerified);
    user.isVerified = syncVerifiedFlag(data.status);
    if (data.password) user.password = data.password;
    await user.save();

    camp.organizationType = data.organizationType;
    camp.organizationName = data.organizationName;
    camp.organizerName = data.organizerName;
    camp.organizerMobile = data.organizerMobile;
    camp.organizerEmail = data.organizerEmail;
    camp.coOrganizerName = data.coOrganizerName || '';
    camp.coOrganizerMobile = data.coOrganizerMobile || '';
    camp.mobileVerified = Boolean(data.mobileVerified);
    camp.status = data.status;
    await camp.save();
    return { user, camp };
}

async function deleteCamp(campId) {
    const camp = await Camp.findById(campId);
    if (!camp) {
        const err = new Error('Camp organization not found');
        err.code = 'NOT_FOUND';
        throw err;
    }
    const userId = camp.userId;
    await CampEvent.deleteMany({ campId: camp._id });
    await CampContactUnlock.deleteMany({ campUserId: userId });
    await camp.deleteOne();
    const user = await User.findById(userId);
    if (user) {
        await cleanupUserRelations(user._id);
        await user.deleteOne();
    }
}

module.exports = {
    createPatient,
    updatePatient,
    deletePatient,
    createDonor,
    updateDonor,
    deleteDonor,
    createBloodBank,
    updateBloodBank,
    deleteBloodBank,
    createCamp,
    updateCamp,
    deleteCamp,
};
