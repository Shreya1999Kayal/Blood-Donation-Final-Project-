const PLAN_CONFIG = {
    premium: { label: 'Premium', amountInr: 199, durationDays: 30 },
    pro: { label: 'Pro', amountInr: 499, durationDays: 30 },
    advanced: { label: 'Advanced', amountInr: 999, durationDays: 30 },
};

const PLAN_FEATURES = {
    premium: {
        canUsePriorityListing: true,
        canUseAdvancedAnalytics: false,
        canUseApiExport: false,
    },
    pro: {
        canUsePriorityListing: true,
        canUseAdvancedAnalytics: true,
        canUseApiExport: false,
    },
    advanced: {
        canUsePriorityListing: true,
        canUseAdvancedAnalytics: true,
        canUseApiExport: true,
    },
};

/** Human-readable benefits shown on dashboard, by role */
const PLAN_BENEFITS_BY_ROLE = {
    user: {
        premium: [
            'Emergency requests shown higher to donors & blood banks',
            'More visibility when you need blood urgently',
        ],
        pro: [
            'Everything in Premium',
            'Request analytics: responses, status breakdown, match stats',
        ],
        advanced: [
            'Everything in Pro',
            'Download your request & contact history (PDF report)',
        ],
    },
    donor: {
        premium: [
            'Rank higher in patient search & AI donor recommendations',
            'Get noticed faster when patients need your blood group',
        ],
        pro: [
            'Everything in Premium',
            'Personal analytics: responses, cooldown, donation history stats',
        ],
        advanced: [
            'Everything in Pro',
            'Export your full donation history (PDF report)',
        ],
    },
    bloodbank: {
        premium: [
            'Rank higher in nearby blood bank results for patients',
            'More visibility when stock is available',
        ],
        pro: [
            'Everything in Premium',
            'Inventory & request-response analytics dashboard',
        ],
        advanced: [
            'Everything in Pro',
            'Export inventory & request activity (PDF report — Advanced only)',
        ],
    },
    camp: {
        premium: [
            'Priority listing when coordinating donation camps',
            'Faster visibility to verified donors & blood banks',
        ],
        pro: [
            'Everything in Premium',
            'Camp analytics: unlocks, outreach, event history',
        ],
        advanced: [
            'Everything in Pro',
            'Export camp coordination reports (PDF)',
        ],
    },
};

const ONE_TIME_PAYMENTS = {
    request_boost: {
        label: 'Emergency request boost',
        amountInr: 49,
        roles: ['user'],
        description: 'Pin one active request to the top for 24 hours (all donors & blood banks see it first).',
    },
    donor_verification: {
        label: 'Donor verification fee',
        amountInr: 99,
        roles: ['donor'],
        description: 'One-time KYC processing fee. Shows a “fee paid” badge to admin for faster review.',
    },
    camp_unlock_donor: {
        label: 'Unlock donor contact',
        amountInr: 5,
        roles: ['camp'],
        description: 'Reveal one donor phone/email and enable chat (or pay ₹500 once for the full directory).',
    },
    camp_unlock_bloodbank: {
        label: 'Unlock blood bank contact',
        amountInr: 1000,
        roles: ['camp'],
        description: 'Reveal blood bank contact details and enable chat for this hospital.',
    },
};

function computeFeatureFlags(plan) {
    return { ...(PLAN_FEATURES[plan] || {
        canUsePriorityListing: false,
        canUseAdvancedAnalytics: false,
        canUseApiExport: false,
    }) };
}

module.exports = {
    PLAN_CONFIG,
    PLAN_FEATURES,
    PLAN_BENEFITS_BY_ROLE,
    ONE_TIME_PAYMENTS,
    computeFeatureFlags,
};
