const mongoose = require('mongoose');

const campEventSchema = new mongoose.Schema({
    campId: { type: mongoose.Schema.Types.ObjectId, ref: 'Camp', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    campName: { type: String, required: true },
    campAddress: { type: String, required: true },
    state: { type: String, required: true },
    district: { type: String, required: true },
    city: { type: String, required: true },
    linkedBloodBankId: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodBank', default: null },
    proposedDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] },
    },
    estimatedParticipants: { type: Number, required: true, min: 1 },
    referenceSupporter: { type: String, default: '' },
    remarks: { type: String, default: '' },
    status: {
        type: String,
        enum: ['scheduled', 'completed', 'cancelled'],
        default: 'scheduled',
    },
}, { timestamps: true });

campEventSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('CampEvent', campEventSchema);
