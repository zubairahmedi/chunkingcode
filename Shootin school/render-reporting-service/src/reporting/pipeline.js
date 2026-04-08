const {renderReportHtml} = require('./template');
const {buildAiMiniReport, buildAiFinalReport, isAiEnabled} = require('./ai');

function toText(value) {
  return String(value ?? '').trim();
}

function toLower(value) {
  return toText(value).toLowerCase();
}

function isYes(value) {
  return ['yes', 'y', 'true', '1'].includes(toLower(value));
}

function isMeaningful(value) {
  const lowered = toLower(value);
  return !['', 'no', 'none', 'nothing', 'no injury', 'not applicable', 'n/a'].includes(lowered);
}

function parseAttemptNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePayload(payload, forcedReportType) {
  let root = payload;

  if (Array.isArray(payload)) {
    if (payload.length === 1 && payload[0] && Array.isArray(payload[0].rows)) {
      root = payload[0];
    } else {
      root = {rows: payload};
    }
  }

  const rows = Array.isArray(root.rows) ? root.rows : [];
  const reportType = forcedReportType || root.reportType || 'weekly';
  const generatedAt = root.generatedAt || new Date().toISOString();

  return {
    reportType,
    generatedAt,
    source: root.source || 'google-sheets',
    totalRows: rows.length,
    rows,
    dateRange: root.dateRange || {
      start: rows[0]?.Date || '',
      end: rows[rows.length - 1]?.Date || '',
    },
  };
}

function normalizeRow(row) {
  const firstName = toText(row['First Name']);
  const lastName = toText(row['Last Name']);
  const fullName = `${firstName} ${lastName}`.trim() || 'Unknown trainer';
  const feedbackSentiment = toLower(row['Feedback Sentiment']);
  const callStatus = toLower(row['Call Status']);
  const aiCallStatus = toText(row.aicall_status || row.Ai_status);
  const flagReason = toText(row['Flag Reason']);

  const hasInjury = isYes(row['Injuries Reported?']) || (isMeaningful(row['Injury Description']) && toLower(row['Injury Description']) !== 'no injury');
  const hasIncident = isYes(row['Incidents Reported?']) || isMeaningful(row['Incident Description']);
  const hasEquipmentIssue = isYes(row['Equipment Issues?']) || isMeaningful(row['Equipment Issue Description']);
  const hasNegativeFeedback = feedbackSentiment === 'negative' || flagReason !== '';
  const needsFollowUp = isYes(row['Needs Follow-up?']);

  return {
    raw: row,
    rowNumber: Number(row.row_number || 0),
    date: toText(row.Date),
    fullName,
    phoneNumber: toText(row['Phone Number']),
    programType: Number(row['Program Type'] || 0) || 0,
    location: toText(row.Location),
    callStatus,
    callAttemptTime: toText(row['Call Attempt Time']),
    dateCalled: toText(row['Date Called']),
    needsFollowUp,
    hasInjury,
    hasIncident,
    hasEquipmentIssue,
    hasNegativeFeedback,
    feedbackSentiment,
    feedbackText: toText(row['Client Feedback']),
    aiCallStatus,
    attemptNo: parseAttemptNumber(row.Attemp_no ?? row.Attempt_no),
    flagReason,
    participationLevel: toText(row['Participation Level']),
    groupEnergyLevel: toText(row['Group Energy Level']),
    attendance: toText(row.Attendance),
    activities: toText(row['Activities/Games Played']),
  };
}

function createBalancedChunks(items, desiredChunkCount) {
  if (items.length === 0) {
    return [[]];
  }

  const chunkCount = Math.min(Math.max(1, desiredChunkCount), items.length);
  const baseSize = Math.floor(items.length / chunkCount);
  const remainder = items.length % chunkCount;
  const chunks = [];

  let cursor = 0;
  for (let index = 0; index < chunkCount; index += 1) {
    const extra = index < remainder ? 1 : 0;
    const size = baseSize + extra;
    chunks.push(items.slice(cursor, cursor + size));
    cursor += size;
  }

  return chunks;
}

function uniqueLimited(values, maxItems = 3) {
  return [...new Set(values.filter(Boolean))].slice(0, maxItems);
}

function buildFeaturedRecords(rows, maxItems = 4) {
  return rows
    .slice(0, maxItems)
    .map((row) => {
      const parts = [
        row.date || 'Unknown date',
        row.fullName || 'Unknown name',
        row.location || 'Location not listed',
        row.programType ? `Program ${row.programType}` : '',
        row.callStatus ? `Call: ${row.callStatus}` : '',
      ].filter(Boolean);

      return parts.join(' • ');
    })
    .filter(Boolean);
}

function prepareChunkRowsForAi(rows) {
  return rows.map((row) => ({
    date: row.date,
    trainerName: row.fullName,
    programType: row.programType,
    location: row.location,
    callStatus: row.callStatus,
    callAttemptTime: row.callAttemptTime,
    dateCalled: row.dateCalled,
    needsFollowUp: row.needsFollowUp,
    aicall_status: row.aiCallStatus,
    Attemp_no: row.attemptNo,
    hasInjury: row.hasInjury,
    hasIncident: row.hasIncident,
    hasEquipmentIssue: row.hasEquipmentIssue,
    feedbackSentiment: row.feedbackSentiment,
    feedbackText: row.feedbackText,
    flagReason: row.flagReason,
    attendance: row.attendance,
    participationLevel: row.participationLevel,
    groupEnergyLevel: row.groupEnergyLevel,
    activities: row.activities,
  }));
}

function buildMiniReport(chunk, index) {
  const rows = chunk.filter(Boolean);
  const incidentRows = rows.filter((row) => row.hasInjury || row.hasIncident || row.hasEquipmentIssue || row.hasNegativeFeedback);
  const followUpRows = rows.filter((row) => row.needsFollowUp);
  const didNotPickUpRows = rows.filter((row) => toLower(row.aiCallStatus) === 'did not pick up');
  const highlightRows = rows.filter(
    (row) =>
      row.participationLevel.toLowerCase().includes('good') ||
      row.participationLevel.toLowerCase().includes('energetic') ||
      row.groupEnergyLevel.toLowerCase().includes('great') ||
      row.attendance.toLowerCase().includes('perfect'),
  );

  const coveredDates = uniqueLimited(rows.map((row) => row.date), 4);
  const coveredLocations = uniqueLimited(rows.map((row) => row.location), 3);
  const coveredNames = uniqueLimited(rows.map((row) => row.fullName), 4);
  const featuredRecords = buildFeaturedRecords(rows, 4);
  const firstDate = coveredDates[0] || 'Unknown start';
  const lastDate = coveredDates[coveredDates.length - 1] || firstDate;
  const snapshotTitle = firstDate === lastDate ? firstDate : `${firstDate} → ${lastDate}`;

  const keyIssues = uniqueLimited(
    incidentRows.map((row) => {
      const label = row.flagReason || row.feedbackText || row.callStatus || 'Operational issue noted';
      return `${row.date || 'Unknown date'} — ${row.fullName}: ${label}`;
    }),
  );

  const highlights = uniqueLimited(
    highlightRows.map((row) => `${row.date || 'Unknown date'} — ${row.fullName}: positive participation / energy noted`),
  );

  const summary = `This snapshot covers ${rows.length} sessions across ${snapshotTitle}, with ${incidentRows.length} issue(s) needing attention, ${followUpRows.length} open follow-up item(s), and ${didNotPickUpRows.length} unreached call outcome(s).`;

  return {
    chunkNumber: index + 1,
    rowCount: rows.length,
    summary,
    incident_count: incidentRows.length,
    follow_up_count: followUpRows.length,
    did_not_pick_up_count: didNotPickUpRows.length,
    key_issues: keyIssues,
    highlights,
    snapshot_title: snapshotTitle,
    covered_dates: coveredDates,
    covered_locations: coveredLocations,
    covered_names: coveredNames,
    featured_records: featuredRecords,
  };
}

function synthesizeReport({reportType, generatedAt, dateRange, rows, miniReports}) {
  const injuryCount = rows.filter((row) => row.hasInjury).length;
  const incidentCount = rows.filter((row) => row.hasIncident).length;
  const equipmentIssueCount = rows.filter((row) => row.hasEquipmentIssue).length;
  const followUpCount = rows.filter((row) => row.needsFollowUp).length;
  const didNotPickUpCount = rows.filter((row) => toLower(row.aiCallStatus) === 'did not pick up').length;
  const pendingAiStatusCount = rows.filter((row) => toLower(row.aiCallStatus) === 'pending').length;
  const wrongNumberCount = rows.filter((row) => row.callStatus.includes('wrong number')).length;
  const positiveSentimentCount = rows.filter((row) => row.feedbackSentiment === 'positive').length;
  const mixedSentimentCount = rows.filter((row) => row.feedbackSentiment === 'mixed').length;
  const negativeSentimentCount = rows.filter((row) => row.feedbackSentiment === 'negative').length;
  const completedCallCount = rows.filter((row) => row.callStatus.includes('completed')).length;
  const programType1Count = rows.filter((row) => row.programType === 1).length;
  const programType2Count = rows.filter((row) => row.programType === 2).length;

  const highlights = uniqueLimited(miniReports.flatMap((report) => report.highlights), 3);
  const risks = uniqueLimited(miniReports.flatMap((report) => report.key_issues), 3);
  const followUps = uniqueLimited(
    rows
      .filter((row) => row.needsFollowUp || toLower(row.aiCallStatus) === 'pending')
      .map((row) => `${row.fullName} — ${row.flagReason || 'follow-up still open'}`),
    3,
  );

  const recommendations = uniqueLimited(
    [
      injuryCount > 0 ? 'Review all injury-related rows with leadership immediately.' : '',
      wrongNumberCount > 0 ? 'Clean up phone number accuracy to reduce wasted call attempts.' : '',
      pendingAiStatusCount > 0 ? 'Prioritize pending AI rows before the next scheduled call window.' : '',
      equipmentIssueCount > 0 ? 'Track and resolve equipment issues before the next session block.' : '',
    ],
    3,
  );

  const executiveSummary = `${reportType[0].toUpperCase()}${reportType.slice(1)} leadership report generated on ${generatedAt}. ${rows.length} sessions were reviewed for the selected period. ${followUpCount} item(s) still require follow-up, ${didNotPickUpCount} call outcome(s) remain unresolved, and ${injuryCount + incidentCount} incident or injury flag(s) were identified.`;

  return {
    title: `Shootin School ${reportType[0].toUpperCase()}${reportType.slice(1)} PDF Report`,
    stats: {
      injuryCount,
      incidentCount,
      equipmentIssueCount,
      followUpCount,
      didNotPickUpCount,
      pendingAiStatusCount,
      wrongNumberCount,
      positiveSentimentCount,
      mixedSentimentCount,
      negativeSentimentCount,
      completedCallCount,
      programType1Count,
      programType2Count,
    },
    executiveSummary,
    highlights,
    risks,
    followUps,
    recommendations,
    meta: {
      reportType,
      generatedAt,
      dateRange,
    },
  };
}

async function buildReportPipeline(payload, forcedReportType) {
  const normalizedPayload = normalizePayload(payload, forcedReportType);
  const normalizedRows = normalizedPayload.rows.map(normalizeRow);
  const targetChunkCount = normalizedPayload.reportType === 'monthly' ? 6 : 3;
  const chunks = createBalancedChunks(normalizedRows, targetChunkCount);

  const miniReports = await Promise.all(
    chunks.map(async (chunk, index) => {
      const fallbackMiniReport = buildMiniReport(chunk, index);

      if (!isAiEnabled()) {
        return {
          ...fallbackMiniReport,
          analysisMode: 'local-fallback',
        };
      }

      try {
        return await buildAiMiniReport({
          reportType: normalizedPayload.reportType,
          chunkNumber: index + 1,
          chunkRows: prepareChunkRowsForAi(chunk),
          fallback: fallbackMiniReport,
        });
      } catch (error) {
        return {
          ...fallbackMiniReport,
          analysisMode: `local-fallback (${error.message})`,
        };
      }
    }),
  );

  const fallbackFinalReport = synthesizeReport({
    reportType: normalizedPayload.reportType,
    generatedAt: normalizedPayload.generatedAt,
    dateRange: normalizedPayload.dateRange,
    rows: normalizedRows,
    miniReports,
  });

  let finalReport;
  if (!isAiEnabled()) {
    finalReport = {
      ...fallbackFinalReport,
      synthesisMode: 'local-fallback',
    };
  } else {
    try {
      finalReport = await buildAiFinalReport({
        reportType: normalizedPayload.reportType,
        generatedAt: normalizedPayload.generatedAt,
        dateRange: normalizedPayload.dateRange,
        stats: fallbackFinalReport.stats,
        miniReports,
        fallback: fallbackFinalReport,
      });
    } catch (error) {
      finalReport = {
        ...fallbackFinalReport,
        synthesisMode: `local-fallback (${error.message})`,
      };
    }
  }

  const meta = {
    reportType: normalizedPayload.reportType,
    generatedAt: normalizedPayload.generatedAt,
    source: normalizedPayload.source,
    totalRows: normalizedPayload.totalRows,
    requestedChunkTarget: targetChunkCount,
    actualChunkCount: chunks.length,
    dateRange: normalizedPayload.dateRange,
    analysisMode: isAiEnabled() ? 'openai-enabled' : 'local-fallback',
  };

  const html = renderReportHtml({meta, finalReport, miniReports});

  return {
    meta,
    finalReport,
    miniReports,
    html,
  };
}

module.exports = {
  buildReportPipeline,
  normalizePayload,
  normalizeRow,
  createBalancedChunks,
};
