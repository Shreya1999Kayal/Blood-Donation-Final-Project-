const crypto = require('crypto');
const Razorpay = require('razorpay');
const User = require('../models/User');
const Request = require('../models/Request');
const Donor = require('../models/Donor');
const BloodBank = require('../models/BloodBank');
const Payment = require('../models/Payment');
const RazorpayWebhookEvent = require('../models/RazorpayWebhookEvent');
const { createNotification } = require('../services/notificationService');
const { normalizeIndianPhone } = require('../utils/phone');

const { PLAN_CONFIG, ONE_TIME_PAYMENTS, computeFeatureFlags } = require('../config/plans');
const { recordContactUnlock, CAMP_UNLOCK_FEES, isCampApproved, hasDonorContactUnlock, hasBloodBankContactUnlock, hasDonorDirectoryAccess } = require('../services/campService');
const { isEligibleDonor } = require('../services/matchingService');

const DONOR_VERIFICATION_FEE = ONE_TIME_PAYMENTS.donor_verification.amountInr;
const REQUEST_BOOST_FEE = ONE_TIME_PAYMENTS.request_boost.amountInr;

function buildReceipt(prefix) {
    return `${prefix}${Date.now()}`.slice(0, 40);
}

function getRazorpayErrorMessage(error, fallback) {
    return error?.error?.description || error?.description || error?.message || fallback;
}

function getRazorpayKeyId() {
    return (process.env.RAZORPAY_KEY_ID || '').trim();
}

function getRazorpay() {
    const keyId = getRazorpayKeyId();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!keyId || !keySecret) return null;
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function isRazorpayConfigured() {
    return Boolean(getRazorpayKeyId() && (process.env.RAZORPAY_KEY_SECRET || '').trim());
}

function buildCheckoutCustomer(user) {
    const customer = {
        name: user.name || 'RaktaSetu User',
        email: user.email || undefined,
    };
    const phone = normalizeIndianPhone(user.phone);
    if (phone) customer.contact = phone;
    return customer;
}

function dashboardHashForPurpose(user, purpose) {
    if (purpose === 'camp_donor_directory') {
        return '#section-donors';
    }
    if (purpose === 'camp_unlock_donor' || purpose === 'camp_unlock_bloodbank') {
        return '#section-payments';
    }
    if (['subscription', 'request_boost', 'donor_verification'].includes(purpose)) {
        return '#section-subscription';
    }
    return '';
}

function computeExpiryFromNow(days) {
    const ms = Number(days) * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ms);
}

async function applyPaymentEffect(payment, req) {
    const user = await User.findById(payment.userId);
    if (!user) return;

    if (payment.purpose === 'subscription') {
        const plan = payment.plan;
        const planConfig = PLAN_CONFIG[plan];
        const expiresAt = computeExpiryFromNow(planConfig.durationDays);
        user.subscription.plan = plan;
        user.subscription.status = 'active';
        user.subscription.startedAt = new Date();
        user.subscription.expiresAt = expiresAt;
        user.subscription.currentPeriodEnd = expiresAt;
        user.subscription.lastOrderId = payment.orderId;
        user.subscription.lastPaymentId = payment.paymentId;
        user.featureFlags = computeFeatureFlags(plan);
        await user.save();
        await createNotification(req || {}, {
            title: 'Subscription activated',
            message: `${planConfig.label} plan activated successfully.`,
            type: 'approval',
            userId: user._id,
            link: '/dashboard',
        });
        return;
    }

    if (payment.purpose === 'request_boost') {
        const requestId = payment.metadata?.requestId;
        const requestDoc = await Request.findById(requestId);
        if (!requestDoc) return;
        requestDoc.boostedUntil = computeExpiryFromNow(1);
        requestDoc.isPriorityBoost = true;
        await requestDoc.save();
        await createNotification(req || {}, {
            title: 'Request boosted',
            message: `Your request ${requestDoc.bloodGroup} at ${requestDoc.hospitalName} is now boosted.`,
            type: 'match',
            userId: user._id,
            link: '/dashboard',
        });
        return;
    }

    if (payment.purpose === 'donor_verification') {
        user.donorVerificationFeePaid = true;
        await user.save();
        await createNotification(req || {}, {
            title: 'Verification fee paid',
            message: 'Your donor verification fee was recorded successfully.',
            type: 'approval',
            userId: user._id,
            link: '/dashboard',
        });
        return;
    }

    if (payment.purpose === 'camp_donor_directory') {
        await createNotification(req || {}, {
            title: 'Donor directory unlocked',
            message: 'All verified donor contacts are now unlocked — view details, chat, and send camp participation requests.',
            type: 'approval',
            userId: user._id,
            link: '/dashboard#section-donors',
        });
        return;
    }

    if (payment.purpose === 'camp_unlock_donor' || payment.purpose === 'camp_unlock_bloodbank') {
        const meta = payment.metadata || {};
        if (meta.targetUserId && meta.targetProfileId && meta.targetType) {
            await recordContactUnlock(
                user._id,
                meta.targetType,
                meta.targetUserId,
                meta.targetProfileId,
                payment._id
            );
        }
        await createNotification(req || {}, {
            title: 'Contact unlocked',
            message: `You can now view contact details and chat with this ${meta.targetType === 'bloodbank' ? 'blood bank' : 'donor'}.`,
            type: 'approval',
            userId: user._id,
            link: '/dashboard#section-payments',
        });
    }
}

function getPaymentSuccessRedirect(user, purpose) {
    const hash = dashboardHashForPurpose(user, purpose);
    if (purpose === 'subscription') {
        return `/dashboard?msg=subscription_activated${hash}`;
    }
    if (purpose === 'request_boost' || purpose === 'donor_verification') {
        return `/dashboard?msg=payment_success${hash}`;
    }
    if (purpose === 'camp_donor_directory') {
        return `/dashboard?msg=donor_directory_unlocked${hash}`;
    }
    if (purpose === 'camp_unlock_donor' || purpose === 'camp_unlock_bloodbank') {
        return `/dashboard?msg=contact_unlocked${hash}`;
    }
    return '/dashboard?msg=payment_success';
}

function verifyOrderSignature(orderId, paymentId, signature) {
    const secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!secret || !orderId || !paymentId || !signature) return false;
    const expected = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    try {
        const a = Buffer.from(expected, 'utf8');
        const b = Buffer.from(signature, 'utf8');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return expected === signature;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function confirmPaymentWithRazorpay(orderId, paymentId, { maxAttempts = 8, delayMs = 500 } = {}) {
    const razorpay = getRazorpay();
    if (!razorpay) return { ok: false, error: 'Razorpay is not configured' };

    let lastError = 'Payment is not completed yet';

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const remote = await razorpay.payments.fetch(paymentId);
            if (remote.order_id !== orderId) {
                return { ok: false, error: 'Payment does not match this order' };
            }
            if (['captured', 'authorized'].includes(remote.status)) {
                return { ok: true, payment: remote };
            }
            if (remote.status === 'failed') {
                return { ok: false, error: 'Payment failed at Razorpay. Use test UPI success@razorpay or complete card OTP.' };
            }
            lastError = `Payment status: ${remote.status}. Waiting for confirmation…`;
        } catch (error) {
            lastError = getRazorpayErrorMessage(error, 'Could not confirm payment with Razorpay');
            if (/invalid|bad_request|not found/i.test(lastError) && attempt >= 2) {
                return { ok: false, error: lastError };
            }
        }

        if (attempt < maxAttempts) {
            await sleep(delayMs * attempt);
        }
    }

    return {
        ok: false,
        error: lastError,
        retryable: true,
    };
}

async function markPaymentAsPaid(payment, details, req) {
    if (payment.status === 'paid') return payment;

    payment.status = 'paid';
    payment.paymentId = details.paymentId;
    payment.signature = details.signature;
    payment.paidAt = new Date();
    payment.failedAt = null;

    try {
        await payment.save();
    } catch (saveErr) {
        if (saveErr.code === 11000 && details.paymentId) {
            const existing = await Payment.findOne({ paymentId: details.paymentId });
            if (existing && existing.orderId === payment.orderId) {
                return existing;
            }
        }
        throw saveErr;
    }

    try {
        await applyPaymentEffect(payment, req);
    } catch (err) {
        console.error('applyPaymentEffect error:', err);
    }
    return payment;
}

async function markPaymentAsFailed(payment) {
    if (!payment || payment.status === 'failed') return;
    payment.status = 'failed';
    payment.failedAt = new Date();
    await payment.save();
}

async function abandonStaleCreatedPayments(userId, purpose, plan) {
    const query = {
        userId,
        purpose,
        status: 'created',
    };
    if (purpose === 'subscription' && plan) {
        query.plan = plan;
    }

    await Payment.updateMany(query, {
        $set: { status: 'failed', failedAt: new Date() },
        $unset: { paymentId: '' },
    });

    // One-time hygiene: legacy rows stored paymentId: null and block the unique index.
    await Payment.updateMany({ paymentId: null }, { $unset: { paymentId: '' } });
}

async function createOrder(req, res) {
    try {
        const razorpay = getRazorpay();
        if (!razorpay) {
            return res.status(500).json({ ok: false, error: 'Razorpay is not configured on server' });
        }

        const purpose = (req.body.purpose || '').toString().toLowerCase();
        const plan = (req.body.plan || '').toString().toLowerCase() || null;

        let amountInr = 0;
        let receiptPrefix = 'pay';
        const metadata = {};

        if (purpose === 'subscription') {
            const config = PLAN_CONFIG[plan];
            if (!config) return res.status(400).json({ ok: false, error: 'Invalid plan selected' });
            amountInr = config.amountInr;
            receiptPrefix = 'sub';
            metadata.planLabel = config.label;
        } else if (purpose === 'request_boost') {
            if (req.user.role !== 'user') return res.status(403).json({ ok: false, error: 'Only patients can boost requests' });
            const requestId = (req.body.requestId || '').toString();
            const requestDoc = await Request.findById(requestId);
            if (!requestDoc || requestDoc.requestedBy.toString() !== req.user._id.toString()) {
                return res.status(400).json({ ok: false, error: 'Invalid request selected for boost' });
            }
            amountInr = REQUEST_BOOST_FEE;
            receiptPrefix = 'boost';
            metadata.requestId = requestId;
            metadata.requestBloodGroup = requestDoc.bloodGroup;
        } else if (purpose === 'donor_verification') {
            if (req.user.role !== 'donor') return res.status(403).json({ ok: false, error: 'Only donors can pay this fee' });
            const user = await User.findById(req.user._id).select('donorVerificationFeePaid');
            if (user?.donorVerificationFeePaid) {
                return res.status(400).json({ ok: false, error: 'Donor verification fee already paid' });
            }
            amountInr = DONOR_VERIFICATION_FEE;
            receiptPrefix = 'dvrfy';
        } else if (purpose === 'camp_donor_directory') {
            if (req.user.role !== 'camp') return res.status(403).json({ ok: false, error: 'Only camp organizations can unlock the donor directory' });
            if (!(await isCampApproved(req.user._id))) {
                return res.status(403).json({ ok: false, error: 'Camp organization must be admin-approved before unlocking the donor directory' });
            }
            if (await hasDonorDirectoryAccess(req.user._id)) {
                return res.status(400).json({ ok: false, error: 'Donor directory is already unlocked' });
            }
            amountInr = CAMP_UNLOCK_FEES.donorDirectory;
            receiptPrefix = 'campdir';
        } else if (purpose === 'camp_unlock_donor') {
            if (req.user.role !== 'camp') return res.status(403).json({ ok: false, error: 'Only camp organizations can unlock donor contacts' });
            if (!(await isCampApproved(req.user._id))) {
                return res.status(403).json({ ok: false, error: 'Camp organization must be admin-approved before unlocking contacts' });
            }
            const targetUserId = (req.body.targetUserId || '').toString();
            const targetProfileId = (req.body.targetProfileId || '').toString();
            if (await hasDonorContactUnlock(req.user._id, targetUserId)) {
                return res.status(400).json({ ok: false, error: 'Donor contact is already unlocked' });
            }
            const donor = await Donor.findById(targetProfileId).populate('userId', '_id');
            if (!donor || !isEligibleDonor(donor) || donor.userId?._id?.toString() !== targetUserId) {
                return res.status(400).json({ ok: false, error: 'This donor is not verified, available, and eligible for camp contact' });
            }
            amountInr = CAMP_UNLOCK_FEES.donorContact;
            receiptPrefix = 'campdn';
            metadata.targetType = 'donor';
            metadata.targetUserId = targetUserId;
            metadata.targetProfileId = targetProfileId;
        } else if (purpose === 'camp_unlock_bloodbank') {
            if (req.user.role !== 'camp') return res.status(403).json({ ok: false, error: 'Only camp organizations can unlock blood bank contacts' });
            if (!(await isCampApproved(req.user._id))) {
                return res.status(403).json({ ok: false, error: 'Camp organization must be admin-approved before unlocking contacts' });
            }
            const targetUserId = (req.body.targetUserId || '').toString();
            const targetProfileId = (req.body.targetProfileId || '').toString();
            if (await hasBloodBankContactUnlock(req.user._id, targetUserId)) {
                return res.status(400).json({ ok: false, error: 'Blood bank contact is already unlocked' });
            }
            const bank = await BloodBank.findById(targetProfileId).populate('userId', '_id');
            if (!bank || bank.status !== 'approved' || bank.userId?._id?.toString() !== targetUserId) {
                return res.status(400).json({ ok: false, error: 'Invalid blood bank selected' });
            }
            amountInr = CAMP_UNLOCK_FEES.bloodbank;
            receiptPrefix = 'campbb';
            metadata.targetType = 'bloodbank';
            metadata.targetUserId = targetUserId;
            metadata.targetProfileId = targetProfileId;
        } else {
            return res.status(400).json({ ok: false, error: 'Invalid payment purpose' });
        }

        await abandonStaleCreatedPayments(req.user._id, purpose, plan);

        const receipt = buildReceipt(receiptPrefix);

        const order = await razorpay.orders.create({
            amount: Math.round(amountInr * 100),
            currency: 'INR',
            receipt,
            payment_capture: 1,
            notes: {
                userId: req.user._id.toString(),
                purpose,
                plan,
                role: req.user.role,
                ...metadata,
            },
        });

        await Payment.create({
            userId: req.user._id,
            purpose,
            plan,
            amount: amountInr,
            currency: order.currency,
            status: 'created',
            orderId: order.id,
            receipt: order.receipt || receipt,
            metadata,
        });

        const keyId = getRazorpayKeyId();
        if (!keyId) {
            return res.status(500).json({ ok: false, error: 'Razorpay Key ID is missing. Set RAZORPAY_KEY_ID in .env and restart the server.' });
        }

        return res.json({
            ok: true,
            key: keyId,
            keyId,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            purpose,
            plan,
            planLabel: plan ? PLAN_CONFIG[plan]?.label : null,
            durationDays: plan ? PLAN_CONFIG[plan]?.durationDays : null,
            testMode: keyId.indexOf('rzp_test_') === 0,
            customer: buildCheckoutCustomer(req.user),
        });
    } catch (error) {
        console.error('create-order error:', error);
        return res.status(500).json({
            ok: false,
            error: getRazorpayErrorMessage(error, 'Failed to create payment order'),
        });
    }
}

async function verifyPayment(req, res) {
    try {
        const orderId = (req.body.razorpay_order_id || req.body.order_id || '').toString().trim();
        const paymentId = (req.body.razorpay_payment_id || req.body.payment_id || '').toString().trim();
        const signature = (req.body.razorpay_signature || req.body.signature || '').toString().trim();

        if (!orderId || !paymentId || !signature) {
            return res.status(400).json({ ok: false, error: 'Missing payment verification fields' });
        }

        const payment = await Payment.findOne({ orderId, userId: req.user._id });
        if (!payment) {
            return res.status(404).json({ ok: false, error: 'Payment order not found. Please try checkout again.' });
        }

        if (payment.status === 'paid') {
            return res.json({
                ok: true,
                message: 'Payment already recorded',
                payment: { id: payment._id, purpose: payment.purpose, status: payment.status },
                redirectUrl: getPaymentSuccessRedirect(req.user, payment.purpose),
            });
        }

        let verified = verifyOrderSignature(orderId, paymentId, signature);
        if (!verified) {
            const remote = await confirmPaymentWithRazorpay(orderId, paymentId);
            if (!remote.ok) {
                console.error('verify-payment signature failed:', { orderId, paymentId, remoteError: remote.error });
                if (!remote.retryable) {
                    await markPaymentAsFailed(payment);
                }
                return res.status(remote.retryable ? 409 : 400).json({
                    ok: false,
                    retryable: Boolean(remote.retryable),
                    error: remote.error || 'Payment signature verification failed. Check RAZORPAY_KEY_SECRET matches your Key ID in .env',
                });
            }
            verified = true;
        }

        let updated;
        try {
            updated = await markPaymentAsPaid(payment, { paymentId, signature }, req);
        } catch (saveErr) {
            console.error('markPaymentAsPaid error:', saveErr);
            return res.status(500).json({
                ok: false,
                error: saveErr.message || 'Payment verified but could not be saved. Contact support with payment id: ' + paymentId,
            });
        }
        const msg = updated.purpose === 'subscription'
            ? `${PLAN_CONFIG[updated.plan]?.label || 'Selected'} plan activated`
            : updated.purpose === 'request_boost'
                ? 'Request boost activated'
                : 'Donor verification fee recorded';

        return res.json({
            ok: true,
            message: msg,
            payment: {
                id: updated._id,
                purpose: updated.purpose,
                status: updated.status,
            },
            redirectUrl: getPaymentSuccessRedirect(req.user, updated.purpose),
        });
    } catch (error) {
        console.error('verify-payment error:', error);
        return res.status(500).json({ ok: false, error: error.message || 'Failed to verify payment' });
    }
}

async function handleWebhook(req, res) {
    try {
        const signature = req.header('x-razorpay-signature');
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!signature || !secret) {
            return res.status(200).json({ ok: true, skipped: true, reason: 'Webhook secret not configured' });
        }

        const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
        const expected = crypto.createHmac('sha256', secret).update(bodyBuffer).digest('hex');
        if (expected !== signature) return res.status(400).json({ ok: false, error: 'Invalid webhook signature' });

        const event = JSON.parse(bodyBuffer.toString('utf8'));
        const eventId = event?.id;
        if (!eventId) return res.status(400).json({ ok: false, error: 'Missing event id' });

        const existingEvent = await RazorpayWebhookEvent.findOne({ eventId });
        if (existingEvent) return res.json({ ok: true, duplicate: true });

        await RazorpayWebhookEvent.create({
            eventId,
            eventType: event.event,
            payload: event,
        });

        const entity = event?.payload?.payment?.entity;
        const orderId = entity?.order_id;
        const paymentId = entity?.id;
        if (orderId) {
            const payment = await Payment.findOne({ orderId });
            if (payment) {
                if (event.event === 'payment.captured') {
                    await markPaymentAsPaid(payment, { paymentId, signature: payment.signature || 'webhook' });
                } else if (event.event === 'payment.failed') {
                    await markPaymentAsFailed(payment);
                }
            }
        }

        const subEntity = event?.payload?.subscription?.entity;
        const subId = subEntity?.id;
        if (subId) {
            const user = await User.findOne({ 'subscription.razorpaySubscriptionId': subId });
            if (user) {
                if (event.event === 'subscription.activated') user.subscription.status = 'active';
                if (event.event === 'subscription.cancelled') user.subscription.status = 'cancelled';
                if (event.event === 'subscription.charged') user.subscription.status = 'active';
                if (event.event === 'subscription.completed' || event.event === 'subscription.halted') {
                    user.subscription.status = 'expired';
                }
                if (subEntity.current_end) {
                    user.subscription.currentPeriodEnd = new Date(Number(subEntity.current_end) * 1000);
                    user.subscription.expiresAt = user.subscription.currentPeriodEnd;
                }
                await user.save();
            }
        }

        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ ok: false, error: 'Webhook processing failed' });
    }
}

module.exports = {
    createOrder,
    verifyPayment,
    handleWebhook,
    isRazorpayConfigured,
    getRazorpayKeyId,
};
