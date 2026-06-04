const PDFDocument = require('pdfkit');
const Request = require('../models/Request');
const DonationHistory = require('../models/DonationHistory');
const Donor = require('../models/Donor');
const BloodBank = require('../models/BloodBank');
const { userHasFeature } = require('../utils/subscription');

function sendPdf(res, filename, buildFn) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);
    buildFn(doc);
    doc.end();
}

function writeHeader(doc, title, user) {
    doc.fontSize(18).fillColor('#b00020').text('RaktaSetu', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(14).fillColor('#000').text(title);
    doc.fontSize(10).fillColor('#555')
        .text(`Generated for: ${user.name} (${user.role})`)
        .text(`Date: ${new Date().toLocaleString()}`);
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown();
}

function writeSectionTitle(doc, text) {
    doc.fontSize(12).fillColor('#b00020').text(text);
    doc.moveDown(0.4);
}

function ensureSpace(doc, height = 80) {
    if (doc.y + height > 750) doc.addPage();
}

async function exportMyData(req, res) {
    if (!userHasFeature(req.user, 'canUseApiExport')) {
        return res.status(403).send('Advanced plan required to download reports.');
    }

    const filename = `blood-donation-report-${req.user.role}-${Date.now()}.pdf`;

    if (req.user.role === 'user') {
        const requests = await Request.find({ requestedBy: req.user._id })
            .sort({ createdAt: -1 })
            .lean();

        return sendPdf(res, filename, (doc) => {
            writeHeader(doc, 'Patient Request Report', req.user);
            writeSectionTitle(doc, `Total requests: ${requests.length}`);

            if (!requests.length) {
                doc.fontSize(10).fillColor('#000').text('No emergency requests found.');
                return;
            }

            requests.forEach((r, index) => {
                ensureSpace(doc, 120);
                doc.fontSize(11).fillColor('#000').text(`${index + 1}. ${r.bloodGroup} at ${r.hospitalName}`, { underline: true });
                doc.fontSize(10).fillColor('#333')
                    .text(`Status: ${r.status}   |   Urgency: ${r.urgencyLevel || '—'}`)
                    .text(`Created: ${r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}`);

                const contacts = r.contacts || [];
                if (contacts.length) {
                    doc.moveDown(0.3);
                    doc.fontSize(10).fillColor('#b00020').text('Responders:');
                    contacts.forEach((c) => {
                        doc.fontSize(10).fillColor('#333')
                            .text(`• ${c.name || 'Unknown'} (${c.role || '—'}) — ${c.phone || 'No phone'}${c.note ? ` — Note: ${c.note}` : ''}`);
                    });
                } else {
                    doc.fontSize(10).fillColor('#777').text('No responders yet.');
                }
                doc.moveDown();
            });
        });
    }

    if (req.user.role === 'donor') {
        const donor = await Donor.findOne({ userId: req.user._id });
        if (!donor) return res.status(404).send('Donor profile not found');

        const donations = await DonationHistory.find({ donorId: donor._id })
            .populate('requestId', 'patientName hospitalName')
            .sort({ donatedAt: -1 })
            .lean();

        return sendPdf(res, filename, (doc) => {
            writeHeader(doc, 'Donor Donation History Report', req.user);
            writeSectionTitle(doc, `Blood group: ${donor.bloodGroup}   |   Total donations: ${donations.length}`);

            if (!donations.length) {
                doc.fontSize(10).text('No donation records yet.');
                return;
            }

            donations.forEach((d, index) => {
                ensureSpace(doc, 60);
                doc.fontSize(10).fillColor('#333')
                    .text(`${index + 1}. ${d.bloodGroup} — ${d.hospitalName || 'Hospital not recorded'}`)
                    .text(`   Units: ${d.units || 1}   |   Patient: ${d.requestId?.patientName || '—'}`)
                    .text(`   Donated: ${d.donatedAt ? new Date(d.donatedAt).toLocaleString() : '—'}`);
                doc.moveDown(0.5);
            });
        });
    }

    if (req.user.role === 'bloodbank') {
        const bank = await BloodBank.findOne({ userId: req.user._id });
        if (!bank) return res.status(404).send('Blood bank profile not found');

        const respondedRequests = await Request.find({ 'contacts.userId': req.user._id })
            .sort({ createdAt: -1 })
            .lean();

        return sendPdf(res, filename, (doc) => {
            writeHeader(doc, 'Blood Bank Activity Report', req.user);
            writeSectionTitle(doc, bank.hospitalName);
            doc.fontSize(10).fillColor('#333').text(`Status: ${bank.status}`);
            doc.moveDown();

            writeSectionTitle(doc, 'Inventory snapshot');
            Object.entries(bank.inventory || {}).forEach(([group, units]) => {
                doc.fontSize(10).fillColor('#333').text(`${group}: ${units} units`);
            });
            const total = Object.values(bank.inventory || {}).reduce((s, n) => s + Number(n || 0), 0);
            doc.moveDown(0.3);
            doc.fontSize(11).fillColor('#b00020').text(`Total units in stock: ${total}`);
            doc.moveDown();

            writeSectionTitle(doc, `Emergency requests contacted (${respondedRequests.length})`);
            if (!respondedRequests.length) {
                doc.fontSize(10).fillColor('#777').text('No patient requests contacted yet.');
                return;
            }

            respondedRequests.forEach((r, index) => {
                ensureSpace(doc, 70);
                const myContact = (r.contacts || []).find(
                    (c) => c.userId && c.userId.toString() === req.user._id.toString()
                );
                doc.fontSize(10).fillColor('#333')
                    .text(`${index + 1}. ${r.bloodGroup} — ${r.patientName || 'Patient'} @ ${r.hospitalName}`)
                    .text(`   Status: ${r.status}   |   Urgency: ${r.urgencyLevel || '—'}`)
                    .text(`   Patient phone: ${r.contactPhone || '—'}`)
                    .text(`   Your note: ${myContact?.note || '—'}`);
                doc.moveDown(0.4);
            });
        });
    }

    return res.status(403).send('Export not available for this role.');
}

module.exports = { exportMyData };
