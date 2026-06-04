(function (global) {

    'use strict';



    function hasSwal() {

        return typeof global.Swal !== 'undefined';

    }



    function closeSwal() {

        if (hasSwal() && global.Swal.isVisible()) {

            global.Swal.close();

        }

    }



    function isTestKey() {

        const key = String(global.__RAZORPAY_KEY__ || '').trim();

        return key.indexOf('rzp_test_') === 0;

    }



    async function refreshSession() {

        try {

            await fetch('/auth/refresh', {

                method: 'POST',

                credentials: 'same-origin',

                headers: { Accept: 'application/json' },

            });

        } catch (e) {

            /* ignore */

        }

    }



    async function createOrder(payload) {

        await refreshSession();

        const response = await fetch('/payment/create-order', {

            method: 'POST',

            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },

            credentials: 'same-origin',

            body: JSON.stringify(payload),

        });

        let data = {};

        try {

            data = await response.json();

        } catch {

            if (response.status === 401 || response.redirected) {

                return { ok: false, error: 'Session expired. Please log in again and retry payment.' };

            }

            data = {};

        }

        if (!response.ok) {

            return { ok: false, error: data.error || 'Payment request failed (' + response.status + ')' };

        }

        return Object.assign({ ok: true }, data);

    }



    async function verifyPaymentOnce(payload) {

        const response = await fetch('/payment/verify', {

            method: 'POST',

            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },

            credentials: 'same-origin',

            body: JSON.stringify(payload),

        });

        let data = {};

        try {

            data = await response.json();

        } catch {

            if (response.status === 401) {

                return { ok: false, error: 'Session expired during payment. Log in and contact support with your payment id.' };

            }

            return { ok: false, error: 'Verification failed (' + response.status + '). Server returned an invalid response.' };

        }

        if (!response.ok) {

            return Object.assign({ ok: false, status: response.status }, data);

        }

        return Object.assign({ ok: true }, data);

    }



    async function verifyPayment(payload) {

        await refreshSession();

        const maxAttempts = 6;

        let lastError = 'Please try again.';



        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {

            const result = await verifyPaymentOnce(payload);

            if (result.ok) return result;



            lastError = result.error || lastError;

            const retryable = result.retryable || result.status === 409 || /not completed|waiting/i.test(lastError);



            if (!retryable || attempt === maxAttempts) {

                return { ok: false, error: lastError };

            }



            if (hasSwal()) {

                global.Swal.update({

                    title: 'Confirming payment…',

                    text: 'Waiting for Razorpay to confirm (' + attempt + '/' + maxAttempts + ')…',

                });

            }

            await new Promise(function (resolve) {

                global.setTimeout(resolve, 600 * attempt);

            });

            await refreshSession();

        }



        return { ok: false, error: lastError };

    }



    function cleanupRazorpayModal() {

        try {

            document.querySelectorAll('.razorpay-container, .razorpay-backdrop, iframe[name="razorpay-checkout-frame"]').forEach(function (el) {

                el.remove();

            });

        } catch (e) {

            /* ignore */

        }

        document.body.style.overflow = '';

        document.documentElement.style.overflow = '';

    }



    function showLoading(title, text) {

        closeSwal();

        if (!hasSwal()) return;

        global.Swal.fire({

            title: title || 'Confirming payment…',

            text: text || 'Please wait while we activate your plan.',

            allowOutsideClick: false,

            allowEscapeKey: false,

            showConfirmButton: false,

            didOpen: function () {

                global.Swal.showLoading();

            },

        });

    }



    function testPaymentHint() {
        if (!isTestKey()) return '';
        return ' Easiest: UPI → success@razorpay → Pay. Netbanking (PNB): on the Razorpay test page click Success, not Failure. Allow pop-ups if the bank page does not open.';
    }

    function formatFailureReason(reason) {
        const text = (reason || '').toString();

        if (/international card/i.test(text)) {
            return 'International cards are not supported in Razorpay India test mode. Use UPI with success@razorpay, or domestic test card 5267 3181 8797 5449.';
        }

        if (/netbanking|net banking|bank/i.test(text) && isTestKey()) {
            return 'Netbanking failed in test mode. After choosing PNB (or any bank), Razorpay opens a test page — click the green Success button (not Failure). Or use UPI with success@razorpay (no bank page needed). Allow browser pop-ups if nothing opens after selecting the bank.';
        }

        if (/popup|blocked|closed|dismiss/i.test(text) && isTestKey()) {
            return text + ' Allow pop-ups for this site, then try again. For netbanking, complete the Razorpay test page and click Success.';
        }

        if (/otp|authentication|cancel/i.test(text) && isTestKey()) {
            return text + ' In test mode, use UPI with success@razorpay instead of card OTP.';
        }

        if (isTestKey() && (!text || /another method|could not|failed/i.test(text))) {
            return 'Payment did not complete. Use UPI → success@razorpay → Pay. For PNB netbanking: select bank → on Razorpay test page click Success (not Failure).';
        }

        return text || 'The payment could not be completed.';
    }

    function buildCheckoutConfig() {
        if (!isTestKey()) return undefined;

        return {
            display: {
                blocks: {
                    upi: {
                        name: 'UPI — recommended (success@razorpay)',
                        instruments: [{ method: 'upi' }],
                    },
                    netbanking: {
                        name: 'Netbanking — then click Success on test page',
                        instruments: [{ method: 'netbanking' }],
                    },
                    card: {
                        name: 'Test card (5267 3181 8797 5449)',
                        instruments: [{ method: 'card' }],
                    },
                },
                sequence: ['block.upi', 'block.netbanking', 'block.card'],
                preferences: { show_default_blocks: false },
            },
        };
    }

    async function showTestModeNotice() {
        if (!isTestKey() || !hasSwal()) return true;

        const result = await global.Swal.fire({
            icon: 'info',
            title: 'Razorpay test checkout',
            html:
                '<p class="mb-2"><strong>Easiest:</strong> Choose <strong>UPI</strong> → enter <code>success@razorpay</code> → Pay.</p>' +
                '<p class="mb-2"><strong>PNB / Netbanking:</strong> Select your bank → a Razorpay <strong>test page</strong> opens → click <strong>Success</strong> (not Failure).</p>' +
                '<p class="mb-0 small text-muted">Allow pop-ups if the bank page does not appear. Real PNB login is not used in test mode.</p>',
            confirmButtonText: 'Continue to payment',
            confirmButtonColor: '#dc3545',
            showCancelButton: true,
            cancelButtonText: 'Cancel',
        });

        return result.isConfirmed;
    }



    function showError(title, text) {

        cleanupRazorpayModal();

        closeSwal();

        const fullText = (text || 'Please try again.') + testPaymentHint();

        if (hasSwal()) {

            global.Swal.fire({

                icon: 'error',

                title: title || 'Payment failed',

                text: fullText,

                confirmButtonColor: '#dc3545',

            });

        } else {

            alert((title || 'Payment failed') + '\n' + fullText);

        }

    }



    function showSuccess(message, redirectUrl) {

        cleanupRazorpayModal();

        closeSwal();

        const target = redirectUrl || '/dashboard?msg=subscription_activated';

        const go = function () {

            global.location.assign(target);

        };

        if (hasSwal()) {

            global.Swal.fire({

                icon: 'success',

                title: 'Payment successful',

                text: message || 'Your payment was recorded successfully.',

                confirmButtonColor: '#dc3545',

                allowOutsideClick: false,

            }).then(go);

        } else {

            go();

        }

    }



    function buildDescription(orderResp) {

        if (orderResp.purpose === 'subscription') {

            return orderResp.planLabel + ' subscription (' + orderResp.durationDays + ' days)';

        }

        if (orderResp.purpose === 'request_boost') {

            return 'Emergency request visibility boost';

        }

        if (orderResp.purpose === 'donor_verification') {

            return 'Donor verification fee';

        }

        if (orderResp.purpose === 'camp_unlock_donor') {

            return 'Unlock donor contact (₹5)';

        }

        if (orderResp.purpose === 'camp_unlock_bloodbank') {

            return 'Unlock blood bank contact (₹1000)';

        }

        return 'Payment';

    }



    function processPaymentResponse(paymentResponse) {

        if (!paymentResponse || !paymentResponse.razorpay_order_id) {

            showError('Payment incomplete', 'No payment details were returned. Please try again.');

            return;

        }



        cleanupRazorpayModal();



        global.setTimeout(function () {

            showLoading('Confirming payment…', 'Verifying with Razorpay. Do not close this page.');



            verifyPayment({

                razorpay_order_id: paymentResponse.razorpay_order_id,

                razorpay_payment_id: paymentResponse.razorpay_payment_id,

                razorpay_signature: paymentResponse.razorpay_signature,

            })

                .then(function (verifyResp) {

                    if (!verifyResp.ok) {

                        showError('Payment verification failed', verifyResp.error || 'Please contact support.');

                        return;

                    }

                    showSuccess(

                        verifyResp.message || 'Payment recorded successfully.',

                        verifyResp.redirectUrl

                    );

                })

                .catch(function (err) {

                    showError('Payment verification failed', err.message || 'Please try again.');

                });

        }, 350);

    }



    function resolveRazorpayKey(orderResp) {

        const fromOrder = orderResp && (orderResp.key || orderResp.keyId || orderResp.key_id);

        const fromPage = global.__RAZORPAY_KEY__;

        return String(fromOrder || fromPage || '').trim();

    }



    async function openCheckout(payload, themeColor) {

        if (typeof global.Razorpay === 'undefined') {

            showError('Payment unavailable', 'Razorpay checkout script did not load. Refresh the page and try again.');

            return;

        }



        const fallbackKey = resolveRazorpayKey(null);

        if (!fallbackKey) {

            showError(

                'Razorpay not configured',

                'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file, restart the server, then refresh this page.'

            );

            return;

        }



        try {

            const orderResp = await createOrder(payload);

            if (!orderResp.ok) {

                throw new Error(orderResp.error || 'Failed to initiate payment');

            }



            const razorpayKey = resolveRazorpayKey(orderResp);

            if (!razorpayKey) {

                throw new Error('Razorpay Key ID missing from server response. Restart the server and try again.');

            }



            const options = {

                key: razorpayKey,

                amount: orderResp.amount,

                currency: orderResp.currency,

                name: 'RaktaSetu',

                description: buildDescription(orderResp),

                order_id: orderResp.orderId,

                prefill: orderResp.customer || {},

                notes: {

                    purpose: orderResp.purpose || payload.purpose || '',

                    plan: orderResp.plan || payload.plan || '',

                },

                theme: { color: themeColor || '#dc3545' },

                redirect: false,

                retry: { enabled: true, max_count: 3 },

                handler: processPaymentResponse,

                config: buildCheckoutConfig(),

                modal: {

                    escape: true,

                    backdropclose: false,

                    ondismiss: function () {

                        cleanupRazorpayModal();

                        closeSwal();

                    },

                },

            };



            const rzp = new global.Razorpay(options);

            rzp.on('payment.failed', function (response) {
                const reason = formatFailureReason(
                    response?.error?.description
                    || response?.error?.reason
                    || response?.error?.code
                );
                showError('Payment failed', reason);
            });

            const proceed = await showTestModeNotice();
            if (!proceed) return;

            rzp.open();

        } catch (err) {

            showError('Unable to start payment', err.message || 'Please try again.');

        }

    }



    global.RaktaSetuPayments = {

        openCheckout: openCheckout,

    };

})(window);


