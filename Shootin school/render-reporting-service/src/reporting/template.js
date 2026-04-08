function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPeriodLabel(reportType) {
  return reportType === 'monthly' ? 'Monthly Leadership Brief' : 'Weekly Leadership Brief';
}

function renderBrandMark() {
  return `
    <div class="brand-lockup">
      <div class="brand-logo">SS</div>
      <div>
        <div class="brand-name">Shootin School</div>
        <div class="brand-tag">Basketball · Multi-sport · Leadership Reporting</div>
      </div>
    </div>
  `;
}

function renderSectionHeader(title, subtitle) {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">${escapeHtml(title)}</h2>
        <p class="section-subtitle">${escapeHtml(subtitle)}</p>
      </div>
      <div class="section-divider"></div>
    </div>
  `;
}

function renderList(title, items, variant = 'default') {
  const safeItems = Array.isArray(items) && items.length > 0 ? items : ['None noted'];

  return `
    <section class="card card--${variant}">
      <div class="card-kicker">${escapeHtml(title)}</div>
      <ul>
        ${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </section>
  `;
}

function renderHealthBar(label, value, total, toneClass = 'blue') {
  const safeTotal = Math.max(Number(total) || 1, 1);
  const safeValue = Number(value) || 0;
  const width = Math.max(6, Math.min(100, Math.round((safeValue / safeTotal) * 100)));

  return `
    <div class="health-row">
      <div class="health-label-row">
        <span>${escapeHtml(label)}</span>
        <strong>${safeValue}</strong>
      </div>
      <div class="health-track">
        <div class="health-fill health-fill--${toneClass}" style="width:${width}%"></div>
      </div>
    </div>
  `;
}

function renderChips(items, extraClass = '') {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  if (safeItems.length === 0) {
    return '';
  }

  return `
    <div class="mini-meta-row">
      ${safeItems.map((item) => `<span class="mini-chip ${extraClass}">${escapeHtml(item)}</span>`).join('')}
    </div>
  `;
}

function renderMiniReports(miniReports) {
  return miniReports
    .map(
      (report, index) => `
        <div class="mini-card">
          <div class="mini-card-top">
            <div>
              <h4>Program Snapshot ${index + 1}</h4>
              <div class="mini-range">${escapeHtml(report.snapshot_title || 'Selected reporting dates')}</div>
            </div>
            <span class="mini-badge">${report.rowCount || 0} sessions · ${report.follow_up_count} open</span>
          </div>
          ${renderChips(report.covered_locations)}
          ${renderChips(report.covered_names, 'mini-chip--alt')}
          <p class="mini-overview">${escapeHtml(report.summary)}</p>
          <div class="mini-section">
            <h5>Reviewed Records</h5>
            <ul>
              ${(Array.isArray(report.featured_records) && report.featured_records.length > 0 ? report.featured_records : ['Detailed record examples were not available for this snapshot.'])
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join('')}
            </ul>
          </div>
          <div class="mini-section">
            <h5>Positive Signals</h5>
            <ul>
              ${(Array.isArray(report.highlights) && report.highlights.length > 0 ? report.highlights : ['Steady operational performance noted.'])
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join('')}
            </ul>
          </div>
          <div class="mini-section">
            <h5>Watchouts</h5>
            <ul>
              ${(Array.isArray(report.key_issues) && report.key_issues.length > 0 ? report.key_issues : ['No major concerns were highlighted in this section.'])
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join('')}
            </ul>
          </div>
        </div>
      `,
    )
    .join('');
}

function renderReportHtml(report) {
  const {meta, finalReport, miniReports} = report;
  const stats = finalReport.stats || {};
  const reportLabel = formatPeriodLabel(meta.reportType);
  const reviewedTotal = Math.max(meta.totalRows || 1, 1);
  const programMixTotal = Math.max((stats.programType1Count || 0) + (stats.programType2Count || 0), 1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(finalReport.title)}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      margin: 0;
      background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
      padding: 16px;
      line-height: 1.5;
    }
    .page {
      width: 100%;
      max-width: 940px;
      margin: 0 auto;
    }
    .cover-page {
      min-height: 95vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 34px 36px;
      border-radius: 28px;
      background: radial-gradient(circle at top left, #f59e0b 0%, #f97316 14%, #1d4ed8 44%, #0f172a 100%);
      color: white;
      margin-bottom: 20px;
      page-break-after: always;
      break-after: page;
      break-inside: avoid-page;
      page-break-inside: avoid;
      box-shadow: 0 20px 55px rgba(15, 23, 42, 0.22);
    }
    .cover-eyebrow {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: rgba(255,255,255,0.78);
      margin-bottom: 18px;
      font-weight: 700;
    }
    .cover-title {
      margin: 0 0 12px;
      font-size: 46px;
      line-height: 1.03;
      max-width: 620px;
    }
    .cover-subtitle {
      margin: 0;
      max-width: 620px;
      color: #e0f2fe;
      font-size: 18px;
    }
    .cover-footer {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 28px;
    }
    .cover-stat {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 18px;
      padding: 12px 14px;
      backdrop-filter: blur(4px);
    }
    .cover-stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #dbeafe;
      margin-bottom: 6px;
      font-weight: 700;
    }
    .cover-stat-value {
      font-size: 24px;
      font-weight: 800;
    }
    .brand-lockup {
      display: inline-flex;
      align-items: center;
      gap: 14px;
    }
    .brand-logo {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      background: linear-gradient(135deg, #facc15 0%, #fb923c 100%);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.35);
    }
    .brand-name {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 0.01em;
    }
    .brand-tag {
      font-size: 12px;
      color: rgba(255,255,255,0.78);
      margin-top: 2px;
    }
    .hero {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%);
      color: white;
      padding: 24px 28px;
      border-radius: 24px;
      margin-bottom: 16px;
      break-inside: avoid-page;
      page-break-inside: avoid;
      box-shadow: 0 12px 30px rgba(30, 58, 138, 0.18);
    }
    .eyebrow {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: #c7d2fe;
      margin-bottom: 10px;
      font-weight: 700;
    }
    .hero h1 {
      margin: 0;
      font-size: 32px;
      line-height: 1.15;
    }
    .hero-subtitle {
      margin: 10px 0 14px;
      max-width: 760px;
      color: #e2e8f0;
      font-size: 15px;
    }
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.12);
      color: #f8fafc;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid rgba(255,255,255,0.15);
    }
    .section-header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 12px;
    }
    .section-title {
      margin: 0 0 6px;
      font-size: 22px;
      color: #0f172a;
    }
    .section-subtitle {
      margin: 0;
      color: #475569;
      font-size: 14px;
    }
    .section-divider {
      flex: 1;
      min-width: 80px;
      height: 4px;
      border-radius: 999px;
      background: linear-gradient(90deg, #f59e0b 0%, #f97316 24%, #3b82f6 100%);
      opacity: 0.85;
      margin-bottom: 8px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .kpi-card {
      background: white;
      border-radius: 18px;
      padding: 16px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
      border: 1px solid #e2e8f0;
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .kpi-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
    }
    .kpi-value {
      font-size: 30px;
      font-weight: 800;
      margin-top: 6px;
      color: #111827;
    }
    .kpi-note {
      font-size: 12px;
      color: #475569;
      margin-top: 6px;
    }
    .summary-card,
    .health-card,
    .card,
    .mini-card {
      background: white;
      border-radius: 18px;
      padding: 16px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
      border: 1px solid #e2e8f0;
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .summary-card {
      margin-bottom: 16px;
    }
    .summary-card p {
      margin: 0;
      color: #1f2937;
      font-size: 15px;
    }
    .health-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .health-card h3 {
      margin: 0 0 10px;
      font-size: 16px;
      color: #111827;
    }
    .health-row + .health-row {
      margin-top: 10px;
    }
    .health-label-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 6px;
      color: #334155;
      font-size: 13px;
    }
    .health-track {
      width: 100%;
      height: 9px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
    }
    .health-fill {
      height: 100%;
      border-radius: 999px;
    }
    .health-fill--blue { background: linear-gradient(90deg, #3b82f6, #6366f1); }
    .health-fill--green { background: linear-gradient(90deg, #10b981, #22c55e); }
    .health-fill--amber { background: linear-gradient(90deg, #f59e0b, #f97316); }
    .health-fill--red { background: linear-gradient(90deg, #ef4444, #f43f5e); }
    .card-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .card-kicker {
      margin-bottom: 8px;
      color: #0f172a;
      font-size: 15px;
      font-weight: 800;
    }
    .card--good { border-top: 4px solid #10b981; }
    .card--warn { border-top: 4px solid #f59e0b; }
    .card--alert { border-top: 4px solid #ef4444; }
    .card--info { border-top: 4px solid #3b82f6; }
    ul {
      padding-left: 18px;
      margin: 0;
    }
    li {
      margin-bottom: 8px;
      color: #1f2937;
    }
    .mini-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .mini-card-top {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
    }
    .mini-card h4 {
      margin: 0;
      font-size: 16px;
    }
    .mini-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }
    .mini-range {
      margin-top: 4px;
      font-size: 12px;
      color: #475569;
      font-weight: 700;
    }
    .mini-meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 10px;
    }
    .mini-chip {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 999px;
      background: #fff7ed;
      color: #c2410c;
      border: 1px solid #fed7aa;
      font-size: 11px;
      font-weight: 700;
    }
    .mini-chip--alt {
      background: #eff6ff;
      color: #1d4ed8;
      border-color: #bfdbfe;
    }
    .mini-overview {
      margin: 0 0 12px;
      color: #1f2937;
      font-size: 14px;
    }
    .mini-section + .mini-section {
      margin-top: 12px;
    }
    .mini-section h5 {
      margin: 0 0 6px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #475569;
    }
    p, li {
      overflow-wrap: anywhere;
    }
    @media (max-width: 760px) {
      .kpi-grid,
      .health-grid,
      .card-grid,
      .mini-grid {
        grid-template-columns: 1fr;
      }
    }
    @page {
      size: A4;
      margin: 12mm;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .page {
        max-width: 100%;
      }
      .kpi-grid,
      .health-grid,
      .card-grid,
      .mini-grid {
        grid-template-columns: 1fr;
      }
      .hero,
      .kpi-card,
      .summary-card,
      .health-card,
      .card,
      .mini-card {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="cover-page">
      <div>
        ${renderBrandMark()}
        <div class="cover-eyebrow">${escapeHtml(reportLabel)}</div>
        <h1 class="cover-title">${escapeHtml(finalReport.title)}</h1>
        <p class="cover-subtitle">A premium leadership summary of engagement, safety, follow-up priorities, and program momentum across Shootin School operations.</p>
      </div>
      <div>
        <div class="meta-row">
          <span class="pill">${escapeHtml(meta.reportType)}</span>
          <span class="pill">Generated ${escapeHtml(meta.generatedAt)}</span>
          <span class="pill">Period ${escapeHtml(meta.dateRange.start)} → ${escapeHtml(meta.dateRange.end)}</span>
        </div>
        <div class="cover-footer">
          <div class="cover-stat">
            <div class="cover-stat-label">Sessions reviewed</div>
            <div class="cover-stat-value">${meta.totalRows}</div>
          </div>
          <div class="cover-stat">
            <div class="cover-stat-label">Open follow-ups</div>
            <div class="cover-stat-value">${stats.followUpCount || 0}</div>
          </div>
          <div class="cover-stat">
            <div class="cover-stat-label">Incidents / injuries</div>
            <div class="cover-stat-value">${(stats.incidentCount || 0) + (stats.injuryCount || 0)}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="hero">
      ${renderBrandMark()}
      <div class="eyebrow">${escapeHtml(reportLabel)}</div>
      <h1>${escapeHtml(finalReport.title)}</h1>
      <p class="hero-subtitle">A polished leadership view of program quality, safety signals, follow-up priorities, and operational momentum across the reporting period.</p>
      <div class="meta-row">
        <span class="pill">${escapeHtml(meta.reportType)}</span>
        <span class="pill">Generated ${escapeHtml(meta.generatedAt)}</span>
        <span class="pill">Period ${escapeHtml(meta.dateRange.start)} → ${escapeHtml(meta.dateRange.end)}</span>
      </div>
    </section>

    <section class="summary-card">
      ${renderSectionHeader('Leadership Snapshot', 'A quick read on overall performance, follow-up pressure, and areas leadership should monitor closely.')}
      <p>${escapeHtml(finalReport.executiveSummary)}</p>
    </section>

    <section class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Sessions reviewed</div>
        <div class="kpi-value">${meta.totalRows}</div>
        <div class="kpi-note">Coverage across the selected reporting period</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Completed call updates</div>
        <div class="kpi-value">${stats.completedCallCount || 0}</div>
        <div class="kpi-note">Closed call records captured successfully</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Open follow-ups</div>
        <div class="kpi-value">${stats.followUpCount || 0}</div>
        <div class="kpi-note">Items still needing team attention</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Incidents / injuries</div>
        <div class="kpi-value">${(stats.incidentCount || 0) + (stats.injuryCount || 0)}</div>
        <div class="kpi-note">Safety and operational issues flagged</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Pending call items</div>
        <div class="kpi-value">${stats.pendingAiStatusCount || 0}</div>
        <div class="kpi-note">Reporting still waiting to be completed</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Wrong numbers</div>
        <div class="kpi-value">${stats.wrongNumberCount || 0}</div>
        <div class="kpi-note">Contact cleanup needed to improve follow-up rates</div>
      </div>
    </section>

    <section class="health-grid">
      <div class="health-card">
        ${renderSectionHeader('Client Sentiment Mix', 'A dashboard view of how families, coaches, and partners experienced the reporting period.')}
        ${renderHealthBar('Positive', stats.positiveSentimentCount || 0, reviewedTotal, 'green')}
        ${renderHealthBar('Mixed', stats.mixedSentimentCount || 0, reviewedTotal, 'amber')}
        ${renderHealthBar('Negative', stats.negativeSentimentCount || 0, reviewedTotal, 'red')}
      </div>
      <div class="health-card">
        ${renderSectionHeader('Program Mix & Follow-Up Status', 'This shows how many sessions came from Program Type 1 vs Program Type 2, plus how many calls still did not connect.')}
        ${renderHealthBar('Sessions from Program Type 1', stats.programType1Count || 0, programMixTotal, 'blue')}
        ${renderHealthBar('Sessions from Program Type 2', stats.programType2Count || 0, programMixTotal, 'blue')}
        ${renderHealthBar('Calls that did not connect', stats.didNotPickUpCount || 0, reviewedTotal, 'red')}
      </div>
    </section>

    <div class="card-grid">
      ${renderList('What Went Well', finalReport.highlights, 'good')}
      ${renderList('Issues Needing Attention', finalReport.risks, 'alert')}
      ${renderList('Open Follow-Up Items', finalReport.followUps, 'warn')}
      ${renderList('Suggested Next Steps', finalReport.recommendations, 'info')}
    </div>

    <section class="summary-card">
      ${renderSectionHeader('Program & Location Spotlights', 'A more detailed look at how performance, engagement, and operational issues showed up across the report.')}
      <div class="mini-grid">
        ${renderMiniReports(miniReports)}
      </div>
    </section>
  </div>
</body>
</html>`;
}

module.exports = {
  renderReportHtml,
};
