function hasActiveSubscription(user) {
    if (!user?.subscription) return false;
    const plan = user.subscription.plan;
    if (!plan || plan === 'free') return false;
    if (['cancelled', 'expired', 'past_due'].includes(user.subscription.status)) return false;
    if (user.subscription.expiresAt && new Date(user.subscription.expiresAt) < new Date()) return false;
    return true;
}

function userHasFeature(user, flag) {
    if (!hasActiveSubscription(user)) return false;
    return Boolean(user.featureFlags?.[flag]);
}

function sortByPriorityListing(items, getUserFn) {
    return [...items].sort((a, b) => {
        const aPriority = userHasFeature(getUserFn(a), 'canUsePriorityListing') ? 1 : 0;
        const bPriority = userHasFeature(getUserFn(b), 'canUsePriorityListing') ? 1 : 0;
        return bPriority - aPriority;
    });
}

module.exports = {
    hasActiveSubscription,
    userHasFeature,
    sortByPriorityListing,
};
