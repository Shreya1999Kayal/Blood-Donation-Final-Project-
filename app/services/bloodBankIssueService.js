const BloodIssueHistory = require('../models/BloodIssueHistory');
const Request = require('../models/Request');
const BloodBank = require('../models/BloodBank');
const mongoose = require('mongoose');

async function recordBloodIssue({ bloodbank, bloodRequest, patientUserId, verifiedByUserId }) {
    const existing = await BloodIssueHistory.findOne({ requestId: bloodRequest._id });
    if (existing) {
        return existing;
    }

    const units = Number(bloodRequest.requiredUnits || 1);
    const bloodGroup = bloodRequest.bloodGroup;
    const previousStock = Number(bloodbank.inventory?.[bloodGroup] || 0);
    const remainingStock = Math.max(0, previousStock - units);

    bloodbank.inventory[bloodGroup] = remainingStock;
    bloodbank.markModified('inventory');
    await bloodbank.save();

    return BloodIssueHistory.create({
        bloodBankId: bloodbank._id,
        requestId: bloodRequest._id,
        patientUserId,
        patientName: bloodRequest.patientName,
        hospitalName: bloodRequest.hospitalName,
        city: bloodRequest.city || '',
        bloodGroup,
        units,
        previousStock,
        remainingStock,
        verifiedBy: verifiedByUserId,
        issuedAt: bloodRequest.receivedAt || new Date(),
    });
}

async function syncIssueHistoryFromRequests(bloodBankId, bloodBankUserId) {
    const existing = await BloodIssueHistory.find({ bloodBankId }).select('requestId').lean();
    const existingIds = new Set(existing.map((row) => row.requestId?.toString()).filter(Boolean));

    const userId = mongoose.Types.ObjectId.isValid(String(bloodBankUserId))
        ? new mongoose.Types.ObjectId(String(bloodBankUserId))
        : bloodBankUserId;

    const requests = await Request.find({
        status: { $in: ['received', 'fulfilled'] },
        'fulfilledBy.userId': userId,
        'fulfilledBy.role': 'bloodbank',
    }).lean();

    const bloodbank = await BloodBank.findById(bloodBankId).select('inventory').lean();
    if (!bloodbank) return;

    for (const request of requests) {
        if (existingIds.has(request._id.toString())) continue;

        const bloodGroup = request.bloodGroup;
        const units = Number(request.requiredUnits || 1);
        const previousStock = Number(bloodbank.inventory?.[bloodGroup] || 0);

        await BloodIssueHistory.create({
            bloodBankId,
            requestId: request._id,
            patientUserId: request.requestedBy,
            patientName: request.patientName,
            hospitalName: request.hospitalName,
            city: request.city || '',
            bloodGroup,
            units,
            previousStock,
            remainingStock: previousStock,
            verifiedBy: request.requestedBy,
            issuedAt: request.receivedAt || request.updatedAt || new Date(),
        });
    }
}

async function getIssueHistoryForBloodBank(bloodBankId, bloodBankUserId) {
    if (bloodBankId && bloodBankUserId) {
        await syncIssueHistoryFromRequests(bloodBankId, bloodBankUserId);
    }

    return BloodIssueHistory.find({ bloodBankId })
        .populate('requestId', 'patientName city status')
        .populate('patientUserId', 'name phone city')
        .sort({ issuedAt: -1 })
        .lean();
}

module.exports = {
    recordBloodIssue,
    getIssueHistoryForBloodBank,
};
