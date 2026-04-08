const express = require('express');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config({path: path.join(__dirname, '..', '.env'), override: true});
const {buildReportPipeline} = require('./reporting/pipeline');

const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

const app = express();
app.use(express.json({limit: '25mb'}));

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, {recursive: true});
}

function buildBaseName(reportType) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${reportType}-report-${timestamp}`;
}

async function saveHtmlPreview(baseName, html) {
  await ensureOutputDir();
  const htmlPath = path.join(OUTPUT_DIR, `${baseName}.html`);
  await fs.writeFile(htmlPath, html, 'utf8');
  return htmlPath;
}

async function renderPdf(html) {
  try {
    const {chromium} = require('playwright');
    const browser = await chromium.launch({headless: true});
    const page = await browser.newPage();
    await page.setContent(html, {waitUntil: 'networkidle'});
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {top: '20px', right: '20px', bottom: '20px', left: '20px'},
    });
    await browser.close();
    return pdfBuffer;
  } catch (error) {
    error.message = `PDF rendering requires Playwright to be installed. Original error: ${error.message}`;
    throw error;
  }
}

async function handleReport(req, res, forcedReportType) {
  try {
    const requestedFormat = String(req.query.format || req.body?.format || 'json').toLowerCase();
    const report = await buildReportPipeline(req.body, forcedReportType);
    const baseName = buildBaseName(report.meta.reportType);
    const htmlPath = await saveHtmlPreview(baseName, report.html);

    if (requestedFormat === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(report.html);
    }

    if (requestedFormat === 'pdf') {
      const pdfBuffer = await renderPdf(report.html);
      const pdfPath = path.join(OUTPUT_DIR, `${baseName}.pdf`);
      await fs.writeFile(pdfPath, pdfBuffer);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
      return res.send(pdfBuffer);
    }

    return res.json({
      ok: true,
      message: 'Report pipeline executed locally. HTML preview saved for inspection.',
      previewHtmlPath: htmlPath,
      meta: report.meta,
      finalReport: report.finalReport,
      miniReports: report.miniReports,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}

app.get('/health', (_req, res) => {
  res.json({ok: true, service: 'shootin-school-reporting-service'});
});

app.post('/generate-report', (req, res) => handleReport(req, res));
app.post('/generate-weekly-report', (req, res) => handleReport(req, res, 'weekly'));
app.post('/generate-monthly-report', (req, res) => handleReport(req, res, 'monthly'));

app.listen(PORT, () => {
  console.log(`Reporting service running on http://localhost:${PORT}`);
});
