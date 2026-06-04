const User = require('../models/User');
const BloodBank = require('../models/BloodBank');
const Donor = require('../models/Donor');
const Camp = require('../models/Camp');
const CampEvent = require('../models/CampEvent');
const DonationHistory = require('../models/DonationHistory');
const { getIssueHistoryForBloodBank } = require('../services/bloodBankIssueService');
const { fetchBloodRequestsForUser } = require('../utils/requestQueries');
const { getSmartMatchesForRequest, sortDonorsForDisplay, sortBloodBanksForDisplay, USER_POPULATE_FIELDS } = require('../services/matchingService');
const { getAdminAnalytics } = require('../services/analyticsService');
const { getNotificationsForUser } = require('../services/notificationService');
const { getUserAnalytics } = require('../services/userAnalyticsService');
const { getInboxForUser } = require('../services/chatService');
const {
    getDonorDirectoryForCamp,
    getBloodBankDirectoryForCamp,
    getCampPaymentHistory,
    getCampPaymentSummary,
    hasDonorDirectoryAccess,
    getApprovedDonorCount,
    getPendingParticipationRequestsForUser,
    getLatestScheduledCampEvent,
    CAMP_UNLOCK_FEES,
} = require('../services/campService');
const { INDIAN_STATES, ORGANIZATION_TYPES, districtsForState, DISTRICTS_BY_STATE } = require('../config/indiaLocations');
const { PLAN_BENEFITS_BY_ROLE, PLAN_CONFIG, ONE_TIME_PAYMENTS } = require('../config/plans');
const { userHasFeature, hasActiveSubscription } = require('../utils/subscription');
const { getHomePageData } = require('../services/homeService');
const bloodBankStock = require('../utils/bloodBankStock');
const {
    getFeedbackByUser,
    getAllFeedbackForAdmin,
    getFeedbackStats,
    ROLE_LABELS: feedbackRoleLabels,
    CATEGORY_LABELS: feedbackCategoryLabels,
} = require('../services/feedbackService');

async function showHome(req, res) {
    const homeData = await getHomePageData();
    res.render('index', {
        user: res.locals.user || null,
        ...homeData,
    });
}

function showLogin(req, res) {
    if (req.user?.emailVerified) return res.redirect('/dashboard');
    let success = null;
    if (req.query.msg === 'password_reset') {
        success = 'Password updated successfully. Please log in with your new password.';
    } else if (req.query.msg === 'email_verified') {
        success = 'Email verified successfully. Please log in to continue.';
    }
    res.render('login', { error: null, verifyEmail: null, verifyPhone: null, success, user: res.locals.user || null });
}

function showRegister(req, res) {
    if (req.user?.emailVerified) return res.redirect('/dashboard');
    const allowedRoles = ['user', 'donor', 'bloodbank', 'camp'];
    const roleParam = (req.query.role || '').toString().toLowerCase();
    const defaultRole = allowedRoles.includes(roleParam) ? roleParam : '';
    res.render('register', { defaultRole, user: res.locals.user || null });
}

async function showDashboard(req, res) {
    let bloodbank = null;
    let donorProfile = null;
    let allBloodBanks = null;
    let allUsers = null;
    let allDonors = null;
    let allCamps = null;
    let campProfile = null;
    let approvedDonors = null;
    let approvedBloodBanks = null;
    let campEvents = [];
    let campDonors = [];
    let campBloodBanks = [];
    let campPayments = [];
    let campPaymentSummary = { totalSpent: 0, donorUnlocks: 0, bankUnlocks: 0, directoryUnlocked: false, transactionCount: 0 };
    let campDonorDirectoryAccess = false;
    let campDonorDirectoryCount = 0;
    let approvedBloodBanksForCamp = [];
    let recommendedDonors = null;
    let nearbyBloodBanks = null;
    let donationHistory = null;
    let bloodIssueHistory = [];
    let analytics = null;
    let userAnalytics = null;
    let notifications = [];
    let inbox = [];
    let userFeedback = [];
    let allFeedback = [];
    let feedbackStats = { total: 0, pending: 0, avgRating: 0 };
    let campParticipationRequests = [];
    let campScheduledEvent = null;

    const bloodRequests = await fetchBloodRequestsForUser(req.user);
    notifications = await getNotificationsForUser(req.user);

    if (req.user.role === 'user') {
        approvedDonors = await Donor.find({ status: 'approved' })
            .populate('userId', USER_POPULATE_FIELDS);
        approvedDonors = sortDonorsForDisplay(approvedDonors);

        approvedBloodBanks = await BloodBank.find({ status: 'approved' })
            .populate('userId', USER_POPULATE_FIELDS);
        approvedBloodBanks = sortBloodBanksForDisplay(approvedBloodBanks);
        const latestNeed = bloodRequests.find((r) => ['active', 'contacted'].includes(r.status));
        if (latestNeed) {
            const smartMatches = await getSmartMatchesForRequest(latestNeed, { limit: 5 });
            recommendedDonors = smartMatches.recommendedDonors;
            nearbyBloodBanks = smartMatches.nearbyBloodBanks;
        }
        inbox = await getInboxForUser(req.user._id, { requireMessages: true });
    } else if (req.user.role === 'donor') {
        donorProfile = await Donor.findOne({ userId: req.user._id });
        inbox = await getInboxForUser(req.user._id, { viewerRole: 'donor' });
        campParticipationRequests = await getPendingParticipationRequestsForUser(req.user._id);
        if (donorProfile) {
            donationHistory = await DonationHistory.find({ donorId: donorProfile._id })
                .populate('requestId', 'patientName city')
                .sort({ donatedAt: -1 });
        }
    } else if (req.user.role === 'bloodbank') {
        bloodbank = await BloodBank.findOne({ userId: req.user._id });
        inbox = await getInboxForUser(req.user._id);
        campParticipationRequests = await getPendingParticipationRequestsForUser(req.user._id);
        if (bloodbank) {
            bloodIssueHistory = await getIssueHistoryForBloodBank(bloodbank._id, req.user._id);
            bloodbank = await BloodBank.findOne({ userId: req.user._id });
        }
    } else if (req.user.role === 'camp') {
        campProfile = await Camp.findOne({ userId: req.user._id }).lean();
        if (campProfile && campProfile.status === 'pending_verification') {
            return res.redirect('/camp/verify-setup');
        }
        if (!campProfile) {
            return res.redirect('/camp/setup');
        }
        campEvents = await CampEvent.find({ userId: req.user._id })
            .populate('linkedBloodBankId', 'hospitalName')
            .sort({ proposedDate: -1 })
            .lean();
        if (campProfile.status === 'approved') {
            campDonorDirectoryAccess = await hasDonorDirectoryAccess(req.user._id);
            campDonorDirectoryCount = await getApprovedDonorCount();
            campDonors = await getDonorDirectoryForCamp(req.user._id);
            campBloodBanks = await getBloodBankDirectoryForCamp(req.user._id);
            campScheduledEvent = await getLatestScheduledCampEvent(req.user._id);
        } else {
            campDonorDirectoryCount = await getApprovedDonorCount();
        }
        approvedBloodBanksForCamp = await BloodBank.find({ status: 'approved' })
            .select('hospitalName _id')
            .sort({ hospitalName: 1 })
            .lean();
        campPayments = await getCampPaymentHistory(req.user._id);
        campPaymentSummary = await getCampPaymentSummary(req.user._id);
        inbox = await getInboxForUser(req.user._id);
    } else if (req.user.role === 'admin') {
        allBloodBanks = await BloodBank.find().populate('userId', 'name email phone city profileImage');
        allUsers = await User.find({ role: 'user' }).select('name email phone city role emailVerified subscription profileImage createdAt');
        allDonors = await Donor.find().populate('userId', 'name email phone city donorVerificationFeePaid profileImage');
        allCamps = await Camp.find().populate('userId', 'name email phone city profileImage').sort({ createdAt: -1 }).lean();
        analytics = await getAdminAnalytics();
        allFeedback = await getAllFeedbackForAdmin();
        feedbackStats = await getFeedbackStats();
    }

    if (['user', 'donor', 'bloodbank', 'camp'].includes(req.user.role)) {
        userFeedback = await getFeedbackByUser(req.user._id);
    }

    if (userHasFeature(req.user, 'canUseAdvancedAnalytics')) {
        userAnalytics = await getUserAnalytics(req.user);
    }

    const flash = {
        msg: req.query.msg || null,
        error: req.query.error || null,
        pwdError: req.query.pwd_error || null,
        pwdSuccess: req.query.pwd_success || null,
    };

    const viewData = {
        bloodbank,
        donorProfile,
        allBloodBanks,
        allUsers,
        allDonors,
        allCamps,
        campProfile,
        campEvents,
        campDonors,
        campBloodBanks,
        campPayments,
        campPaymentSummary,
        campDonorDirectoryAccess,
        campDonorDirectoryCount,
        campScheduledEvent,
        campUnlockFees: CAMP_UNLOCK_FEES,
        campStates: INDIAN_STATES,
        campOrgTypes: ORGANIZATION_TYPES,
        districtsForState,
        districtsByState: DISTRICTS_BY_STATE,
        approvedBloodBanksForCamp,
        approvedDonors,
        approvedBloodBanks,
        recommendedDonors,
        nearbyBloodBanks,
        donationHistory,
        bloodIssueHistory,
        analytics,
        notifications,
        inbox,
        bloodRequests,
        flash,
        planBenefits: PLAN_BENEFITS_BY_ROLE[req.user.role] || {},
        planPrices: PLAN_CONFIG,
        oneTimePayments: ONE_TIME_PAYMENTS,
        userAnalytics,
        hasActiveSubscription: hasActiveSubscription(req.user),
        canExportData: userHasFeature(req.user, 'canUseApiExport'),
        user: req.user,
        userFeedback,
        allFeedback,
        feedbackStats,
        feedbackRoleLabels,
        feedbackCategoryLabels,
        campParticipationRequests,
        bloodBankStock,
    };

    if (req.user.role === 'admin') {
        return res.render('dashboard-admin', viewData);
    }

    if (req.user.role === 'user') {
        return res.render('dashboard-patient', viewData);
    }

    if (req.user.role === 'bloodbank') {
        if (!bloodbank) {
            return res.redirect('/bloodbank/setup');
        }
        return res.render('dashboard-bloodbank', viewData);
    }

    if (req.user.role === 'donor') {
        return res.render('dashboard-donor', viewData);
    }

    if (req.user.role === 'camp') {
        return res.render('dashboard-camp', viewData);
    }

    res.render('dashboard', viewData);
}

module.exports = {
    showHome,
    showLogin,
    showRegister,
    showDashboard,
};
