const fs = require('fs/promises');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { createWorker } = require('tesseract.js');

const OCR_LANG = 'eng';
const PUBLIC_ROOT = path.join(__dirname, '../../public');

function isPdf(mimetype, filename) {
    return mimetype === 'application/pdf' || /\.pdf$/i.test(filename || '');
}

function isImage(mimetype, filename) {
    if (/^image\//.test(mimetype || '')) return true;
    return /\.(jpe?g|png|webp)$/i.test(filename || '');
}

async function extractTextFromPdfBuffer(buffer) {
    if (!buffer?.length) return '';
    let parser;
    try {
        parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        return (result?.text || '').trim();
    } catch (error) {
        console.warn('PDF OCR failed:', error.message);
        return '';
    } finally {
        if (parser && typeof parser.destroy === 'function') {
            await parser.destroy().catch(() => {});
        }
    }
}

async function extractTextFromImageBuffer(buffer) {
    if (!buffer?.length) return '';
    const worker = await createWorker(OCR_LANG);
    try {
        const { data: { text } } = await worker.recognize(buffer);
        return (text || '').trim();
    } finally {
        await worker.terminate();
    }
}

async function extractTextFromBuffer(buffer, mimetype, filename) {
    if (!buffer?.length) return '';

    if (isPdf(mimetype, filename)) {
        const pdfText = await extractTextFromPdfBuffer(buffer);
        if (pdfText.length > 15) return pdfText;
        return pdfText;
    }

    if (isImage(mimetype, filename)) {
        return extractTextFromImageBuffer(buffer);
    }

    return '';
}

async function extractTextFromMulterFile(file) {
    if (!file?.path) return '';
    const buffer = await fs.readFile(file.path);
    return extractTextFromBuffer(buffer, file.mimetype, file.originalname);
}

function resolveLocalDocumentPath(url) {
    if (!url || typeof url !== 'string') return null;
    if (url.startsWith('/uploads/')) {
        return path.join(PUBLIC_ROOT, url.replace(/^\//, ''));
    }
    return null;
}

async function extractTextFromUrl(url) {
    if (!url) return '';

    const localPath = resolveLocalDocumentPath(url);
    if (localPath) {
        try {
            const buffer = await fs.readFile(localPath);
            return extractTextFromBuffer(buffer, null, localPath);
        } catch (error) {
            console.warn('Local document OCR failed:', error.message);
        }
    }

    if (!url.startsWith('http')) return '';

    try {
        const response = await fetch(url);
        if (!response.ok) return '';
        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') || '';
        return extractTextFromBuffer(buffer, contentType, url);
    } catch (error) {
        console.warn('Remote document OCR failed:', error.message);
        return '';
    }
}

async function extractTextFromMulterFiles(filesMap) {
    const sections = [];
    for (const [label, file] of Object.entries(filesMap || {})) {
        if (!file) continue;
        const text = await extractTextFromMulterFile(file);
        sections.push({ label, text: text || '' });
    }
    return sections;
}

async function extractTextFromUrls(urlMap) {
    const sections = [];
    for (const [label, url] of Object.entries(urlMap || {})) {
        if (!url) continue;
        const text = await extractTextFromUrl(url);
        sections.push({ label, text: text || '' });
    }
    return sections;
}

function truncateExcerpt(text, maxLen = 1200) {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen)}…`;
}

module.exports = {
    extractTextFromMulterFile,
    extractTextFromMulterFiles,
    extractTextFromUrl,
    extractTextFromUrls,
    extractTextFromBuffer,
    truncateExcerpt,
};
