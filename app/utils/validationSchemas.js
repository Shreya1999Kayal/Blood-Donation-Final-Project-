const Joi = require('joi');

const { ORGANIZATION_TYPES } = require('../config/indiaLocations');

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const roles = ['user', 'donor', 'bloodbank', 'admin', 'camp'];
const publicRegisterRoles = ['user', 'donor', 'bloodbank', 'camp'];
const phone = Joi.string().pattern(/^[6-9]\d{9}$/).required()
    .messages({ 'string.pattern.base': 'Phone number must be a valid 10 digit Indian mobile number' });
const optionalPhone = Joi.string().pattern(/^[6-9]\d{9}$/).allow('').optional()
    .messages({ 'string.pattern.base': 'Phone number must be a valid 10 digit Indian mobile number' });

// Optional coordinates; empty/invalid values are stripped in sanitizeGeoFields() before validation.
const optionalLatitude = Joi.number().min(-90).max(90).optional();
const optionalLongitude = Joi.number().min(-180).max(180).optional();

const registerSchema = Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    email: Joi.string().trim().lowercase().email().required(),
    password: Joi.string().min(6).max(128).required(),
    phone,
    city: Joi.string().trim().min(2).max(80).required(),
    role: Joi.string().valid(...publicRegisterRoles).required(),
});

const adminRegisterSchema = Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    email: Joi.string().trim().lowercase().email().required(),
    password: Joi.string().min(6).max(128).required(),
    phone,
    city: Joi.string().trim().min(2).max(80).required(),
});

const loginSchema = Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
    password: Joi.string().required(),
});

const verifyOtpSchema = Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
    otp: Joi.string().pattern(/^\d{6}$/).required()
        .messages({ 'string.pattern.base': 'OTP must be a 6 digit code' }),
});

const resendOtpSchema = Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
});

const verifyPhoneOtpSchema = Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
    otp: Joi.string().pattern(/^\d{6}$/).required()
        .messages({ 'string.pattern.base': 'OTP must be a 6 digit code' }),
});

const resendPhoneOtpSchema = Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
});

const forgotPasswordSchema = Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
});

const resetPasswordSchema = Joi.object({
    password: Joi.string().min(6).max(128).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
        .messages({ 'any.only': 'Passwords do not match' }),
});

const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
        .messages({ 'any.only': 'New passwords do not match' }),
}).custom((value, helpers) => {
    if (value.currentPassword === value.newPassword) {
        return helpers.message('New password cannot be the same as your old password');
    }
    return value;
});

const profileSchema = Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    phone,
    city: Joi.string().trim().min(2).max(80).required(),
});

const donorRegisterSchema = Joi.object({
    bloodGroup: Joi.string().valid(...bloodGroups).required(),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
});

const availabilitySchema = Joi.object({
    isAvailable: Joi.boolean().truthy('true').falsy('false').required(),
});

const bloodBankSetupSchema = Joi.object({
    hospitalName: Joi.string().trim().min(2).max(120).required(),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
});

const objectIdParamSchema = Joi.object({
    id: Joi.string().hex().length(24).required(),
});

const inventorySchema = Joi.object(
    Object.fromEntries(bloodGroups.map((group) => [group, Joi.number().integer().min(0).max(10000).required()]))
);

const requestCreateSchema = Joi.object({
    bloodGroup: Joi.string().valid(...bloodGroups).required(),
    hospitalName: Joi.string().trim().min(2).max(120).required(),
    requiredUnits: Joi.number().integer().min(1).max(50).required(),
    urgencyLevel: Joi.string().valid('Normal', 'High', 'Critical').optional(),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
});

const contactSchema = Joi.object({
    note: Joi.string().trim().allow('').max(300).default(''),
});

const receivedSchema = Joi.object({
    responderUserId: Joi.string().hex().length(24).required()
        .messages({ 'any.required': 'Select the donor or blood bank that provided blood before marking received' }),
});

const searchDonorSchema = Joi.object({
    bloodGroup: Joi.string().valid(...bloodGroups).allow(''),
    city: Joi.string().trim().max(80).allow(''),
    availability: Joi.string().valid('', 'available', 'unavailable').default(''),
    approval: Joi.string().valid('all', 'pending', 'approved', 'rejected').default('approved'),
    radiusKm: Joi.number().min(1).max(200).default(20),
    ranked: Joi.string().valid('0', '1').default('0'),
    nearby: Joi.string().valid('0', '1').default('0'),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
    lat: optionalLatitude,
    lng: optionalLongitude,
});

const searchBloodBankSchema = Joi.object({
    bloodGroup: Joi.string().valid(...bloodGroups).allow(''),
    city: Joi.string().trim().max(80).allow(''),
    approval: Joi.string().valid('all', 'pending', 'approved', 'rejected').default('approved'),
    radiusKm: Joi.number().min(1).max(200).default(20),
    nearby: Joi.string().valid('0', '1').default('0'),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
    lat: optionalLatitude,
    lng: optionalLongitude,
});

const aiRecommendSchema = Joi.object({
    bloodGroup: Joi.string().valid(...bloodGroups).required(),
    city: Joi.string().trim().max(80).allow(''),
    radiusKm: Joi.number().min(1).max(200).default(20),
    longitude: Joi.number().min(-180).max(180).default(72.8777),
    latitude: Joi.number().min(-90).max(90).default(19.0760),
});

const prioritySchema = Joi.object({
    urgencyLevel: Joi.string().valid('Normal', 'High', 'Critical').default('High'),
    requiredUnits: Joi.number().integer().min(1).max(50).default(1),
});

const campSetupSchema = Joi.object({
    organizationType: Joi.string().valid(...ORGANIZATION_TYPES).required(),
    organizationName: Joi.string().trim().min(2).max(160).required(),
    organizerName: Joi.string().trim().min(2).max(80).required(),
    organizerMobile: phone,
    organizerEmail: Joi.string().trim().lowercase().email().required(),
    coOrganizerName: Joi.string().trim().max(80).allow('').optional(),
    coOrganizerMobile: optionalPhone,
    campName: Joi.string().trim().min(2).max(160).required(),
    campAddress: Joi.string().trim().min(5).max(300).required(),
    state: Joi.string().trim().min(2).max(80).required(),
    district: Joi.string().trim().min(2).max(80).required(),
    city: Joi.string().trim().min(2).max(80).required(),
    linkedBloodBankId: Joi.string().hex().length(24).allow('').optional(),
    proposedDate: Joi.date().iso().required(),
    startTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
    endTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
    estimatedParticipants: Joi.number().integer().min(1).max(100000).required(),
    referenceSupporter: Joi.string().trim().max(160).allow('').optional(),
    remarks: Joi.string().trim().max(500).allow('').optional(),
});

const campEventSchema = Joi.object({
    campName: Joi.string().trim().min(2).max(160).required(),
    campAddress: Joi.string().trim().min(5).max(300).required(),
    state: Joi.string().trim().min(2).max(80).required(),
    district: Joi.string().trim().min(2).max(80).required(),
    city: Joi.string().trim().min(2).max(80).required(),
    linkedBloodBankId: Joi.string().hex().length(24).allow('').optional(),
    proposedDate: Joi.date().iso().required(),
    startTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
    endTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
    estimatedParticipants: Joi.number().integer().min(1).max(100000).required(),
    referenceSupporter: Joi.string().trim().max(160).allow('').optional(),
    remarks: Joi.string().trim().max(500).allow('').optional(),
});

const campSetupOtpSchema = Joi.object({
    otp: Joi.string().pattern(/^\d{6}$/).required()
        .messages({ 'string.pattern.base': 'OTP must be a 6 digit code' }),
});

const campUnlockSchema = Joi.object({
    targetType: Joi.string().valid('donor', 'bloodbank').required(),
    targetUserId: Joi.string().hex().length(24).required(),
    targetProfileId: Joi.string().hex().length(24).required(),
});

const helpChatSchema = Joi.object({
    message: Joi.string().trim().min(1).max(2000).required(),
    history: Joi.array().items(
        Joi.object({
            role: Joi.string().valid('user', 'model').required(),
            text: Joi.string().trim().max(4000).required(),
        })
    ).max(20).optional(),
    userRole: Joi.string().valid('user', 'donor', 'bloodbank', 'admin', 'camp').allow('', null).optional(),
    context: Joi.string().valid('help', 'medical').optional(),
});

const analyzeMedicalReportSchema = Joi.object({
    donorId: Joi.string().hex().length(24).optional(),
    bloodGroup: Joi.string().valid(...bloodGroups).optional(),
    documentType: Joi.string().valid('bloodGroupReport', 'bloodTestReport', 'fitnessCertificate', 'identityProof', 'report', 'combined').optional(),
});

const verifyBloodGroupSchema = Joi.object({
    donorId: Joi.string().hex().length(24).optional(),
    bloodGroup: Joi.string().valid(...bloodGroups).optional(),
    text: Joi.string().trim().max(20000).allow('').optional(),
});

const adminUserFields = {
    name: Joi.string().trim().min(2).max(80).required(),
    email: Joi.string().trim().lowercase().email().required(),
    phone,
    city: Joi.string().trim().min(2).max(80).required(),
};

const adminCreatePatientSchema = Joi.object({
    ...adminUserFields,
    password: Joi.string().min(6).max(128).required(),
    emailVerified: Joi.boolean().truthy('true', '1', 'on').falsy('false', '0', '').default(true),
    subscriptionPlan: Joi.string().valid('free', 'premium', 'pro', 'advanced').default('free'),
});

const adminUpdatePatientSchema = Joi.object({
    ...adminUserFields,
    password: Joi.string().min(6).max(128).allow('').optional(),
    emailVerified: Joi.boolean().truthy('true', '1', 'on').falsy('false', '0', '').default(false),
    subscriptionPlan: Joi.string().valid('free', 'premium', 'pro', 'advanced').required(),
});

const adminCreateDonorSchema = Joi.object({
    ...adminUserFields,
    password: Joi.string().min(6).max(128).required(),
    bloodGroup: Joi.string().valid(...bloodGroups).required(),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
    status: Joi.string().valid('pending', 'approved', 'rejected').default('pending'),
    isAvailable: Joi.boolean().truthy('true', '1', 'on').falsy('false', '0', '').default(true),
    emailVerified: Joi.boolean().truthy('true', '1', 'on').falsy('false', '0', '').default(true),
});

const adminUpdateDonorSchema = Joi.object({
    ...adminUserFields,
    password: Joi.string().min(6).max(128).allow('').optional(),
    bloodGroup: Joi.string().valid(...bloodGroups).required(),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
    status: Joi.string().valid('pending', 'approved', 'rejected').required(),
    isAvailable: Joi.boolean().truthy('true', '1', 'on').falsy('false', '0', '').default(false),
    emailVerified: Joi.boolean().truthy('true', '1', 'on').falsy('false', '0', '').default(false),
});

const adminCreateBloodBankSchema = Joi.object({
    ...adminUserFields,
    password: Joi.string().min(6).max(128).required(),
    hospitalName: Joi.string().trim().min(2).max(120).required(),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
    status: Joi.string().valid('pending', 'approved', 'rejected').default('pending'),
    emailVerified: Joi.boolean().truthy('true', '1', 'on').falsy('false', '0', '').default(true),
    registrationCertificateUrl: Joi.string().trim().uri().allow('').optional(),
    inventory: inventorySchema.optional(),
});

const adminUpdateBloodBankSchema = Joi.object({
    ...adminUserFields,
    password: Joi.string().min(6).max(128).allow('').optional(),
    hospitalName: Joi.string().trim().min(2).max(120).required(),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
    status: Joi.string().valid('pending', 'approved', 'rejected').required(),
    emailVerified: Joi.boolean().truthy('true', '1', 'on').falsy('false', '0', '').default(false),
    registrationCertificateUrl: Joi.string().trim().uri().allow('').optional(),
    inventory: inventorySchema.optional(),
});

const adminCreateCampSchema = Joi.object({
    ...adminUserFields,
    password: Joi.string().min(6).max(128).required(),
    organizationType: Joi.string().valid(...ORGANIZATION_TYPES).required(),
    organizationName: Joi.string().trim().min(2).max(160).required(),
    organizerName: Joi.string().trim().min(2).max(80).required(),
    organizerMobile: phone,
    organizerEmail: Joi.string().trim().lowercase().email().required(),
    coOrganizerName: Joi.string().trim().max(80).allow('').optional(),
    coOrganizerMobile: optionalPhone,
    status: Joi.string().valid('pending_verification', 'pending', 'approved', 'rejected').default('approved'),
    emailVerified: Joi.boolean().truthy('true', '1', 'on').falsy('false', '0', '').default(true),
    mobileVerified: Joi.boolean().truthy('true', '1', 'on').falsy('false', '0', '').default(true),
});

const feedbackSubmitSchema = Joi.object({
    rating: Joi.number().integer().min(1).max(5).required(),
    category: Joi.string().valid(
        'platform',
        'emergency_matching',
        'communication',
        'camp',
        'blood_bank',
        'medical_verification',
        'other',
    ).required(),
    reviewText: Joi.string().trim().min(10).max(2000).required(),
});

const adminUpdateCampSchema = Joi.object({
    ...adminUserFields,
    password: Joi.string().min(6).max(128).allow('').optional(),
    organizationType: Joi.string().valid(...ORGANIZATION_TYPES).required(),
    organizationName: Joi.string().trim().min(2).max(160).required(),
    organizerName: Joi.string().trim().min(2).max(80).required(),
    organizerMobile: phone,
    organizerEmail: Joi.string().trim().lowercase().email().required(),
    coOrganizerName: Joi.string().trim().max(80).allow('').optional(),
    coOrganizerMobile: optionalPhone,
    status: Joi.string().valid('pending_verification', 'pending', 'approved', 'rejected').required(),
    emailVerified: Joi.boolean().truthy('true', '1', 'on').falsy('false', '0', '').default(false),
    mobileVerified: Joi.boolean().truthy('true', '1', 'on').falsy('false', '0', '').default(false),
});

module.exports = {
    registerSchema,
    adminRegisterSchema,
    loginSchema,
    verifyOtpSchema,
    resendOtpSchema,
    verifyPhoneOtpSchema,
    resendPhoneOtpSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
    profileSchema,
    donorRegisterSchema,
    availabilitySchema,
    bloodBankSetupSchema,
    objectIdParamSchema,
    inventorySchema,
    requestCreateSchema,
    contactSchema,
    receivedSchema,
    searchDonorSchema,
    searchBloodBankSchema,
    aiRecommendSchema,
    prioritySchema,
    campSetupSchema,
    campEventSchema,
    campSetupOtpSchema,
    campUnlockSchema,
    helpChatSchema,
    analyzeMedicalReportSchema,
    verifyBloodGroupSchema,
    adminCreatePatientSchema,
    adminUpdatePatientSchema,
    adminCreateDonorSchema,
    adminUpdateDonorSchema,
    adminCreateBloodBankSchema,
    adminUpdateBloodBankSchema,
    adminCreateCampSchema,
    adminUpdateCampSchema,
    feedbackSubmitSchema,
};
