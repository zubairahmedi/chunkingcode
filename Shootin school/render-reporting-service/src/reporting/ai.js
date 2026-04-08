const OpenAI = require('openai');

let cachedClient;

function isAiEnabled() {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();

  if (!apiKey) {
    return false;
  }

  return !apiKey.includes('your_openai_api_key_here') && !apiKey.includes('sk-your');
}

function getModel() {
  return process.env.OPENAI_MODEL || 'gpt-4.1-mini';
}

function getClient() {
  if (!isAiEnabled()) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({apiKey: process.env.OPENAI_API_KEY});
  }

  return cachedClient;
}

function parseJsonSafely(text, fallback) {
  if (!text) {
    return fallback;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return fallback;
    }

    try {
      return JSON.parse(match[0]);
    } catch (_nestedError) {
      return fallback;
    }
  }
}

function clampList(values, fallback = []) {
  if (!Array.isArray(values)) {
    return fallback;
  }

  return values
    .filter((item) => typeof item === 'string' && item.trim() !== '')
    .slice(0, 3);
}

async function callJsonModel(systemPrompt, payload) {
  const client = getClient();

  if (!client) {
    return null;
  }

  const response = await client.chat.completions.create({
    model: getModel(),
    temperature: 0.2,
    response_format: {type: 'json_object'},
    messages: [
      {role: 'system', content: systemPrompt},
      {role: 'user', content: JSON.stringify(payload)},
    ],
  });

  return parseJsonSafely(response.choices?.[0]?.message?.content, null);
}

async function buildAiMiniReport({reportType, chunkNumber, chunkRows, fallback}) {
  const systemPrompt = `You are an internal operations review assistant for Shootin School leadership. You are analyzing one portion of the ${reportType} report data. Your audience is the CEO and leadership team, not engineers. Use only the provided rows and do not invent facts. Focus on: meaningful positive outcomes, injuries/incidents/equipment concerns, unresolved follow-up items, and practical operational patterns. Where useful, anchor observations to exact names and dates that appear in the rows. Return compact JSON only with this exact shape: {"summary":"","incident_count":0,"follow_up_count":0,"did_not_pick_up_count":0,"key_issues":[""],"highlights":[""]}. Rules: write in plain business English, never mention words like chunk, JSON, dataset, analysis, or sub-agent, summary max 100 words, max 3 key_issues, max 3 highlights, no markdown, no extra keys.`;

  const result = await callJsonModel(systemPrompt, {
    reportType,
    chunkNumber,
    rows: chunkRows,
  });

  if (!result) {
    return {
      ...fallback,
      analysisMode: 'local-fallback',
    };
  }

  const incidentCount = Number(result.incident_count);
  const followUpCount = Number(result.follow_up_count);
  const didNotPickUpCount = Number(result.did_not_pick_up_count);

  return {
    chunkNumber: fallback.chunkNumber,
    rowCount: fallback.rowCount,
    summary: String(result.summary || fallback.summary).trim().slice(0, 500),
    incident_count: Number.isFinite(incidentCount) ? incidentCount : fallback.incident_count,
    follow_up_count: Number.isFinite(followUpCount) ? followUpCount : fallback.follow_up_count,
    did_not_pick_up_count: Number.isFinite(didNotPickUpCount) ? didNotPickUpCount : fallback.did_not_pick_up_count,
    key_issues: clampList(result.key_issues, fallback.key_issues),
    highlights: clampList(result.highlights, fallback.highlights),
    snapshot_title: fallback.snapshot_title,
    covered_dates: fallback.covered_dates,
    covered_locations: fallback.covered_locations,
    covered_names: fallback.covered_names,
    featured_records: fallback.featured_records,
    analysisMode: 'openai',
  };
}

async function buildAiFinalReport({reportType, generatedAt, dateRange, stats, miniReports, fallback}) {
  const systemPrompt = `You are preparing a polished Shootin School leadership report for the CEO and management team. Use only the provided summary findings and stats. Your tone should be clear, executive-friendly, and non-technical. Focus on what went well, what needs attention, what follow-up is still open, and what leadership should do next. Return compact JSON only with this exact shape: {"executiveSummary":"","highlights":[""],"risks":[""],"followUps":[""],"recommendations":[""]}. Rules: never mention words like chunk, JSON, dataset, analysis mode, fallback, or synthesis, executiveSummary max 140 words, each list max 3 items, each item max 20 words, no markdown, no extra keys, no invented facts.`;

  const result = await callJsonModel(systemPrompt, {
    reportType,
    generatedAt,
    dateRange,
    stats,
    miniReports,
  });

  if (!result) {
    return {
      ...fallback,
      synthesisMode: 'local-fallback',
    };
  }

  return {
    ...fallback,
    executiveSummary: String(result.executiveSummary || fallback.executiveSummary).trim().slice(0, 700),
    highlights: clampList(result.highlights, fallback.highlights),
    risks: clampList(result.risks, fallback.risks),
    followUps: clampList(result.followUps, fallback.followUps),
    recommendations: clampList(result.recommendations, fallback.recommendations),
    synthesisMode: 'openai',
  };
}

module.exports = {
  isAiEnabled,
  buildAiMiniReport,
  buildAiFinalReport,
};
