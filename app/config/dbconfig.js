require('dotenv').config();

const mongoose = require('mongoose');

const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI;

const dbConnection = async () => {
    try {
        await mongoose.connect(MONGO_URL);
        console.log('✅ MongoDB Connected Successfully');

        // Legacy payments stored paymentId: null — only one null allowed on unique index.
        try {
            const Payment = require('../models/Payment');
            const result = await Payment.updateMany({ paymentId: null }, { $unset: { paymentId: '' } });
            if (result.modifiedCount > 0) {
                console.log(`Payment index cleanup: unset paymentId on ${result.modifiedCount} record(s)`);
            }
        } catch (cleanupErr) {
            console.warn('Payment index cleanup skipped:', cleanupErr.message);
        }
    } catch (err) {
        console.log('❌ MongoDB Connection Failed');
        console.log(err.message);
        process.exit(1);
    }
};

module.exports = dbConnection;
