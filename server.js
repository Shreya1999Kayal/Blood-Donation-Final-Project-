require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./app/config/dbconfig.js');
const { configureSockets } = require('./app/sockets');
const { normalizeDocumentUrl, profileImageUrl, userInitials } = require('./app/utils/upload');
const portalMedia = require('./app/utils/portalMedia');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

/*
|--------------------------------------------------------------------------
| DATABASE CONNECTION
|--------------------------------------------------------------------------
*/
connectDB();

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
}
app.use('/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.docUrl = normalizeDocumentUrl;
app.locals.profileImageUrl = profileImageUrl;
app.locals.userInitials = userInitials;
app.locals.razorpayKeyId = (process.env.RAZORPAY_KEY_ID || '').trim();
app.locals.portalMedia = portalMedia;
app.locals.getNotificationMetaMap = portalMedia.getNotificationMetaMap;

// Socket.io for Real-Time Features (auth + notifications + chat)
configureSockets(io);

// Attach io to req for routes to use
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Import Routes
const pageRoutes = require('./app/routes/pages');
const authRoutes = require('./app/routes/auth');
const donorRoutes = require('./app/routes/donor');
const bloodbankRoutes = require('./app/routes/bloodbank');
const requestRoutes = require('./app/routes/request');
const adminRoutes = require('./app/routes/admin');
const aiRoutes = require('./app/routes/ai');
const searchRoutes = require('./app/routes/search');
const chatRoutes = require('./app/routes/chat');
const paymentRoutes = require('./app/routes/payment');
const exportRoutes = require('./app/routes/export');
const campRoutes = require('./app/routes/camp');
const feedbackRoutes = require('./app/routes/feedback');

// Use Routes
app.use('/', pageRoutes);
app.use('/auth', authRoutes);
app.use('/donor', donorRoutes);
app.use('/bloodbank', bloodbankRoutes);
app.use('/request', requestRoutes);
app.use('/blood-request', requestRoutes);
app.use('/admin', adminRoutes);
app.use('/ai', aiRoutes);
app.use('/search', searchRoutes);
app.use('/', chatRoutes);
app.use('/payment', paymentRoutes);
app.use('/export', exportRoutes);
app.use('/camp', campRoutes);
app.use('/feedback', feedbackRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err?.code === 'LIMIT_FILE_SIZE') {
        if (req.originalUrl === '/auth/register') {
            return res.status(400).render('register', { error: 'Profile photo must be 5 MB or smaller.' });
        }
        if (req.originalUrl === '/admin/registration') {
            return res.status(400).render('admin-register', { error: 'Profile photo must be 5 MB or smaller.' });
        }
        return res.redirect('/dashboard?error=upload_file_too_large');
    }
    if (err?.code === 'INVALID_FILE_TYPE') {
        return res.redirect('/dashboard?error=upload_invalid_type');
    }
    if (err?.code === 'INVALID_PROFILE_IMAGE') {
        if (req.originalUrl === '/auth/register') {
            return res.status(400).render('register', { error: err.message });
        }
        if (req.originalUrl === '/admin/registration') {
            return res.status(400).render('admin-register', { error: err.message });
        }
        return res.redirect(`/dashboard?error=${encodeURIComponent(err.message)}`);
    }
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
const razorpayKeyId = (process.env.RAZORPAY_KEY_ID || '').trim();
const razorpaySecretSet = Boolean((process.env.RAZORPAY_KEY_SECRET || '').trim());
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (!razorpayKeyId || !razorpaySecretSet) {
        console.warn('⚠ Razorpay not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
    } else if (razorpayKeyId.indexOf('rzp_test_') === 0) {
        console.log('✓ Razorpay test mode — use UPI success@razorpay for checkout');
    } else {
        console.log('✓ Razorpay live mode configured');
    }
});
