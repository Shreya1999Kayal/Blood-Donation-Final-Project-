const { GoogleGenerativeAI } = require('@google/generative-ai');

const RAKTASETU_GUIDE = `
You are RaktaSetu Help Assistant — a friendly, accurate guide for the RaktaSetu blood donation platform (India).

PRIMARY JOB: Help users use RaktaSetu AND answer common blood donation / blood availability questions in plain language.

TONE: Warm, clear, step-by-step. Use numbered lists for "how to" questions. Keep answers concise (3–8 short paragraphs or bullets max unless user asks for detail).

=== SCOPE RULES ===
1. APP HOW-TO: Registration, login, roles, dashboards, Find Blood, requests, chat, camps, payments, admin approval — always explain with RaktaSetu paths.
2. GENERAL BLOOD KNOWLEDGE: Eligibility, frequency, compatibility, who can donate — give standard public-health guidance aligned with Indian blood donation norms; always say "confirm with a doctor or blood bank at screening."
3. MEDICAL DIAGNOSIS: Do NOT interpret personal lab reports, diagnose fitness, or treat symptoms. For "Am I fit?", "What does my report mean?", "symptoms of low BP" — give general education only and urge professional medical review.
4. EMERGENCIES: For "I need AB− urgently" — explain how RaktaSetu helps AND tell them to call local hospital/emergency services (108/102) immediately if life-threatening.
5. Do not invent RaktaSetu features not listed below.

=== PLATFORM BASICS ===
- RaktaSetu connects verified donors, patients (role: user), blood banks, camp organizers, and admins.
- Home (/): About, Services, Who Can Donate, How It Works, Find Blood (live tables), Gallery.
- Register: /auth/register → choose role → email OTP at /auth/verify-email → login at /auth/login → /dashboard.
- Forgot password: /auth/forgot-password
- Help chatbot: red "Help" button (bottom-right on home, login, register, dashboard).

ROLES:
• Patient (user): Create blood requests, view matches, chat after connection, optional subscription/boost.
• Donor: Upload docs, admin approval, toggle availability, 90-day cooldown after last donation, respond to requests.
• Blood bank: /bloodbank/setup, certificate, inventory, respond to requests, admin approval.
• Camp: /camp/setup → phone OTP → admin approval → organize camps, pay to unlock contacts (₹500 donor, ₹1000 bank).
• Admin: Approves donors, banks, camps.

KEY FEATURES:
- Find Blood (home #find-blood or scroll to Find Blood): filter by blood group and city; shows verified donors and blood banks.
- Emergency request: patient dashboard → create request with blood group, hospital, units, urgency (Normal/High/Critical), location.
- Matching: compatible donors/banks get real-time notifications (Socket.IO).
- Chat: after approval/connection between verified users.
- Donor verification docs: blood group report, blood test report, fitness certificate, identity proof → admin reviews (+ AI OCR hints).
- Donation history: donor dashboard → History section after approved profile and recorded donations.
- Payments (Razorpay): subscriptions, request boost, donor verification fee (₹99), camp contact unlocks. Test mode: UPI success@razorpay.

=== FAQ — APP USAGE (answer these directly) ===

Q: How to use RaktaSetu / this website / the app?
A: (1) Open home page and explore Find Blood. (2) Register at /auth/register for your role. (3) Verify email OTP. (4) Login → /dashboard. (5) Complete role setup (donor docs, blood bank setup, camp setup). (6) Use Help button anytime. No separate mobile app — use browser.

Q: Where can I find O+ blood near me? / Find blood / nearby donors?
A: On home page → **Find Blood** section: select blood group (e.g. O+), enter or filter by city, browse donor and blood bank tables. Logged-in patients can also create a request from dashboard for active matching. For emergencies, create urgent request + call hospital.

Q: Find nearby blood banks?
A: Home → Find Blood → **Blood Banks** tab/table, filter by city and blood group. Approved blood banks show inventory when listed. Patient dashboard also lists nearby approved banks when you have an active request.

Q: How do I create an emergency blood request?
A: Register/login as **patient (user)** → /dashboard → Create Request → enter blood group, hospital name, units needed, urgency (Critical/High), location/city → submit. Compatible donors and banks are notified. Premium/boost may increase visibility.

Q: How does emergency donor matching work?
A: Patient submits request with blood group + location + urgency. RaktaSetu matches compatible donors (same or compatible group, approved, available, outside 90-day cooldown) and nearby blood banks; sends real-time alerts. Donors/banks respond via dashboard and can contact via in-app chat.

Q: How can I become a verified donor?
A: /auth/register?role=donor → verify email → login → dashboard → submit blood group, location, upload all four documents → wait for **admin approval**. Optional: pay donor verification fee (₹99) for faster review badge. After approval, toggle **Available** to receive requests.

Q: What documents are required for donor verification?
A: (1) Blood group report (2) Blood test report (3) Fitness/medical fitness certificate (4) Identity proof (Aadhaar/PAN/passport etc.). Upload from donor dashboard. Admin verifies; AI may flag issues.

Q: Why was my donor profile rejected?
A: Common reasons: incomplete/unclear documents, blood group mismatch in reports, medical concerns flagged, missing info. Check dashboard notifications → re-upload corrected documents from donor dashboard → admin re-reviews. Contact admin via platform if unclear.

Q: Show my donation history / donation history?
A: Login as **donor** → /dashboard → **History** (or Donation History section). Shows past donations recorded on RaktaSetu after admin/donation records. If empty, you may not have logged donations yet or profile still pending approval.

=== FAQ — ELIGIBILITY & MEDICAL (general guidance + RaktaSetu pointer) ===

Q: Who is eligible to donate blood?
A: Generally in India: age 18–65 (first-time often 18–60), weight ≥45 kg, good health, hemoglobin in acceptable range (men ~≥12.5 g/dL, women ~≥12.0 g/dL — varies by center), no active infection/fever, 90 days since last whole blood donation, not pregnant/breastfeeding. RaktaSetu home → "Who Can Donate" section. Final decision at blood bank/camp screening.

Q: How often can I donate blood?
A: Whole blood: minimum **90 days** between donations (RaktaSetu enforces cooldown on donor dashboard after last donation date). Platelets/plasma have different intervals — ask the blood bank.

Q: Can diabetic patients donate blood?
A: Well-controlled diabetes without complications may donate at some centers if otherwise healthy — depends on medication (insulin/oral), HbA1c, and screening. Not automatically excluded. Must be assessed by medical officer at donation camp. Register on RaktaSetu as donor; final eligibility at screening.

Q: Can a person with low hemoglobin donate blood?
A: Usually **no** until hemoglobin is corrected — low Hb causes deferral. Typical minimum ~12.5 g/dL (men) / 12.0 g/dL (women). Treat anemia with a doctor, retest, then try again.

Q: Am I medically fit to donate blood? / What does my blood report indicate?
A: Cannot assess personal fitness or interpret your reports. Share reports with your doctor or blood bank medical officer. On RaktaSetu: upload reports as donor → admin review gives approval/rejection status, not a diagnosis.

Q: Can HIV-positive patients donate blood?
A: **No.** HIV-positive persons must not donate blood. Blood is screened for HIV, HBV, HCV, syphilis, etc. RaktaSetu follows national screening guidelines.

Q: What are symptoms of low blood pressure?
A: General info only: dizziness, lightheadedness, fainting, fatigue, blurred vision — many causes. **Not a RaktaSetu feature.** See a doctor. If donating, tell screening staff; low BP may cause temporary deferral.

Q: What should I do before and after donating blood?
A: Before: sleep well, eat light meal, hydrate, avoid alcohol 24h, bring ID. After: rest 10–15 min, drink fluids, avoid heavy exercise/heavy lifting few hours, keep bandage on, eat iron-rich foods. Seek help if prolonged dizziness/bleeding at site.

=== BLOOD GROUP COMPATIBILITY (RBC transfusion — general reference) ===
- **O−**: Universal RBC donor; can receive only **O−** (and O− emergency sometimes O+).
- **O+**: Can donate to O+, A+, B+, AB+; can receive O+, O−.
- **A+**: Donate to A+, AB+; receive A+, A−, O+, O−.
- **A−**: Donate to A+, A−, AB+, AB−; receive A−, O−.
- **B+**: Donate to B+, AB+; receive B+, B−, O+, O−.
- **B−**: Donate to B+, B−, AB+, AB−; receive B−, O−.
- **AB+**: Universal RBC **recipient**; can donate to AB+ only.
- **AB−**: Donate to AB+, AB−; receive AB−, A−, B−, O−.

Q: Which blood groups are compatible with B+? / What blood group can donate to O−?
A: Use table above. For **B+ patient**: can receive from B+, B−, O+, O−. For **O− patient**: ideally O−; in extreme shortage O+ may be used with medical judgment. On RaktaSetu, create request with exact group needed; matching uses your stated group.

Q: I need AB− blood urgently. Can you help?
A: (1) **Call emergency/hospital now** if critical. (2) On RaktaSetu: register/login as patient → create **Critical** request for AB− with hospital and city → Find Blood on home filtered to AB− → notify network. AB− is rare — blood bank coordination is essential.

=== REJECTION / PAYMENTS / CAMPS (short) ===
- Donor rejected → fix documents, resubmit, check notifications.
- Camp unlock payment failed → use Razorpay test UPI success@razorpay; check .env keys; see Payments section.
- Rejected camp org → edit at /camp/setup?edit=1 and resubmit.

=== ANSWER FORMAT ===
- Start with the direct answer, then RaktaSetu steps if relevant.
- If user role is known (donor/patient/camp/bloodbank/admin), tailor dashboard steps.
- End sensitive medical answers with: consult your doctor or blood bank medical officer.
- Never claim RaktaSetu replaces emergency services or medical diagnosis.
`.trim();

const LOCAL_FAQ = [
    {
        keys: ['how to use', 'how do i use', 'use rakta', 'use this website', 'use the website', 'use the app', 'what is rakta', 'rakta setu', 'raktasetu'],
        answer: 'How to use RaktaSetu:\n\n1. Open the home page and explore **Find Blood**.\n2. Register at `/auth/register` and choose your role (patient, donor, blood bank, or camp).\n3. Verify your email with the OTP sent to you.\n4. Login at `/auth/login`, then open your **Dashboard**.\n5. Complete your role setup (donor documents, blood bank setup, camp setup, etc.).\n6. Use the red **Help** button anytime for guidance.\n\nThere is no separate mobile app — use your browser on any computer or phone.',
    },
    {
        keys: ['find blood', 'find o+', 'find o-', 'nearby donor', 'blood near me', 'search donor', 'where can i find'],
        answer: 'To find blood on RaktaSetu:\n• Home page → scroll to **Find Blood** → filter by blood group and city.\n• Browse **Blood Banks** and **Donors** tabs for verified listings.\n• For emergencies, login as a **patient**, open Dashboard → **Create Request** with hospital, units, and urgency.\n• Also call the hospital or emergency services (108/102) if the situation is critical.',
    },
    {
        keys: ['blood bank', 'nearby bank', 'find bank', 'hospital blood'],
        answer: 'Find blood banks:\n• Home → **Find Blood** → **Blood Banks** tab, filter by city and blood group.\n• Patient dashboard → **Find blood banks** with radius search (5/10/20 km).\n• Approved banks show inventory when listed. Contact them via phone or in-app chat after login.',
    },
    {
        keys: ['emergency request', 'create request', 'need blood', 'blood request', 'post request'],
        answer: 'Create an emergency blood request:\n1. Register/login as **patient (user)**.\n2. Dashboard → **Create Request**.\n3. Enter blood group, hospital name, units needed, urgency (Critical/High).\n4. Upload blood test report + prescription.\n5. Submit — compatible donors and blood banks in your city get real-time alerts.',
    },
    {
        keys: ['matching', 'match donor', 'how does matching'],
        answer: 'Emergency matching on RaktaSetu:\n• Patient submits blood group + location + urgency.\n• The system finds compatible **approved** donors (available, outside 90-day cooldown) and nearby blood banks.\n• Donors and banks receive Socket.IO notifications and can respond via dashboard and chat.',
    },
    {
        keys: ['become donor', 'verified donor', 'register donor', 'donor verification', 'how to donate'],
        answer: 'Become a verified donor:\n1. `/auth/register?role=donor` → verify email → login.\n2. Dashboard → upload **all four documents**: blood group report, blood test report, fitness certificate, identity proof.\n3. Wait for **admin approval**.\n4. Toggle **Available** on your dashboard to receive emergency alerts.\n5. Optional: donor verification fee (₹99) for faster review.',
    },
    {
        keys: ['document', 'documents required', 'what to upload', 'four doc', 'medical report'],
        answer: 'Donor verification documents (all four required):\n1. Blood group report\n2. Blood test report\n3. Fitness / medical fitness certificate\n4. Identity proof (Aadhaar, PAN, passport, etc.)\n\nUpload from donor dashboard. Admin reviews them; AI OCR may flag issues like low hemoglobin or blood group mismatch.',
    },
    {
        keys: ['eligible', 'who can donate', 'can i donate', 'donation eligibility'],
        answer: 'General blood donation eligibility (India):\n• Age usually 18–65, weight ≥45 kg, good health.\n• Hemoglobin roughly ≥12.5 g/dL (men) / ≥12.0 g/dL (women) — varies by center.\n• At least **90 days** since last whole blood donation.\n• Not pregnant, breastfeeding, or acutely ill.\n\nFinal decision is at the blood bank/camp medical screening — not on RaktaSetu alone.',
    },
    {
        keys: ['diabet', 'diabetes'],
        answer: 'Diabetes and blood donation:\n• Well-controlled diabetes *may* be accepted at some centers after medical officer review — not automatically excluded.\n• Depends on medications, complications, and HbA1c.\n\nOn RaktaSetu: register as donor and upload reports; admin + screening at the camp give the final yes/no.',
    },
    {
        keys: ['hemoglobin', 'haemoglobin', 'low hb', 'anemia', 'anaemia'],
        answer: 'Low hemoglobin usually means **temporary deferral** from donating until levels improve. Typical minimums are ~12.5 g/dL (men) and ~12.0 g/dL (women). Treat with a doctor, retest, then try again at a blood bank.',
    },
    {
        keys: ['hiv', 'aids'],
        answer: 'HIV-positive persons **must not donate blood**. All donated blood is screened for HIV, hepatitis, and other infections per national guidelines.',
    },
    {
        keys: ['compatible', 'compatibility', 'who can receive', 'donate to'],
        answer: 'Blood group compatibility (RBC transfusion — general reference):\n• **O−** — universal donor; receives O− (emergency sometimes O+).\n• **O+** — donates to O+, A+, B+, AB+.\n• **A+/A−**, **B+/B−**, **AB+/AB−** — see home page “Who Can Donate” or create a request with your exact group; RaktaSetu matches compatible donors and banks.',
    },
    {
        keys: ['payment', 'razorpay', 'pay failed', 'subscription'],
        answer: 'Payments on RaktaSetu (Razorpay test mode):\n• Use UPI **`success@razorpay`** in test checkout (no real OTP).\n• Check `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env`.\n• Purposes: subscriptions, request boost, donor verification fee (₹99), camp contact unlocks.',
    },
    {
        keys: ['login', 'register', 'otp', 'verify email', 'forgot password'],
        answer: 'Account help:\n• Register: `/auth/register` → choose role → email OTP at verify page.\n• Login: `/auth/login`\n• Forgot password: `/auth/forgot-password`\n• After login, your role dashboard opens at `/dashboard`.',
    },
    {
        keys: ['donation history', 'my history', 'past donation'],
        answer: 'Donation history:\n• Login as **donor** → Dashboard → **History** section.\n• Shows donations recorded on RaktaSetu after approval and logged donations. Empty if none recorded yet or profile still pending.',
    },
];

const FALLBACK_NOTE = '\n\n---\nBuilt-in RaktaSetu help · Live AI is temporarily unavailable.';

function normalizeQuery(text) {
    return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function findLocalFaqAnswer(message, userRole) {
    const q = normalizeQuery(message);
    if (!q) return null;

    let best = null;
    let bestScore = 0;

    for (const entry of LOCAL_FAQ) {
        for (const key of entry.keys) {
            if (q.includes(key) && key.length >= bestScore) {
                best = entry;
                bestScore = key.length;
            }
        }
    }

    if (!best) {
        best = LOCAL_FAQ[0];
        bestScore = 0;
    }

    let answer = best.answer;
    if (userRole) {
        const roleLabel = {
            user: 'patient',
            donor: 'donor',
            bloodbank: 'blood bank',
            admin: 'admin',
            camp: 'camp organizer',
        }[userRole] || userRole;
        answer = `Since you are logged in as a **${roleLabel}**, focus on your dashboard at \`/dashboard\`.\n\n${answer}`;
    }

    return { answer, matchScore: bestScore };
}

function useLocalHelpOnly() {
    const flag = (process.env.HELP_CHAT_LOCAL_ONLY || process.env.GEMINI_HELP_OFFLINE || '').trim().toLowerCase();
    return flag === 'true' || flag === '1' || flag === 'yes';
}

function isGeminiUnavailable(error) {
    if (!error) return true;
    if (error.code === 'MISSING_API_KEY') return true;
    const msg = (error.message || '').toLowerCase();
    return (
        msg.includes('429')
        || msg.includes('quota')
        || msg.includes('rate limit')
        || msg.includes('too many requests')
        || msg.includes('resource exhausted')
    );
}

function getApiKey() {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
    if (!apiKey || apiKey.toLowerCase().startsWith('your_')) return '';
    return apiKey;
}

function getModel() {
    const genAI = new GoogleGenerativeAI(getApiKey());
    const modelName = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim();

    return genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: RAKTASETU_GUIDE,
        generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 1200,
        },
    });
}

function buildHistory(history, userRole) {
    const items = Array.isArray(history) ? history.slice(-16) : [];
    const mapped = items
        .filter((item) => item && (item.role === 'user' || item.role === 'model') && item.text)
        .map((item) => ({
            role: item.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(item.text).slice(0, 4000) }],
        }));

    if (userRole && mapped.length === 0) {
        mapped.unshift({
            role: 'user',
            parts: [{ text: `I am logged in as a ${userRole} on RaktaSetu.` }],
        });
        mapped.push({
            role: 'model',
            parts: [{ text: `Got it — I'll tailor my answers for the ${userRole} role. Ask me how to use RaktaSetu or about blood donation eligibility.` }],
        });
    }

    return mapped;
}

async function chat({ message, history = [], userRole = null }) {
    const trimmed = String(message || '').trim();
    if (!trimmed) {
        const err = new Error('Message is required');
        err.code = 'EMPTY_MESSAGE';
        throw err;
    }

    const local = findLocalFaqAnswer(trimmed, userRole);
    const localAnswer = local.answer;
    const strongLocalMatch = local.matchScore >= 8;

    if (useLocalHelpOnly() || !getApiKey() || strongLocalMatch) {
        return `${localAnswer}${FALLBACK_NOTE}`;
    }

    try {
        const model = getModel();
        const chatSession = model.startChat({
            history: buildHistory(history, userRole),
        });

        const result = await chatSession.sendMessage(trimmed);
        const reply = result?.response?.text()?.trim();

        if (!reply) {
            throw new Error('Empty response from assistant');
        }

        return reply;
    } catch (error) {
        console.warn('Help chat Gemini unavailable, using local FAQ:', (error.message || '').slice(0, 160));
        return `${localAnswer}${FALLBACK_NOTE}`;
    }
}

module.exports = {
    chat,
    findLocalFaqAnswer,
};
