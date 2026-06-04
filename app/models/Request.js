const mongoose = require('mongoose');
const { normalizeCity } = require('../utils/city');

const requestSchema = new mongoose.Schema({
    patientName: { type: String, required: true },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], required: true },
    hospitalName: { type: String, required: true },
    contactName: { type: String, required: true },
    contactPhone: { type: String, required: true },
    urgencyLevel: { type: String, enum: ['Normal', 'High', 'Critical'] },
    requiredUnits: { type: Number, required: true },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true } // [longitude, latitude]
    },
    city: { type: String, required: true },
    status: {
        type: String,
        enum: ['active', 'contacted', 'received', 'cancelled', 'fulfilled'],
        default: 'active',
    },
    contacts: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['donor', 'bloodbank', 'admin'] },
        name: String,
        phone: String,
        note: String,
        createdAt: { type: Date, default: Date.now },
    }],
    receivedAt: { type: Date },
    patientDocuments: {
        bloodTestReportUrl: String,
        prescriptionUrl: String,
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    matchedDonors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Donor' }],
    fulfilledBy: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['donor', 'bloodbank'] },
        name: String,
        phone: String,
    },
    isPriorityBoost: { type: Boolean, default: false },
    boostedUntil: { type: Date, default: null },
}, { timestamps: true });

requestSchema.pre('save', function () {
    if (this.isModified('city') && this.city) {
        this.city = normalizeCity(this.city);
    }
});

requestSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Request', requestSchema);
