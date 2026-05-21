require("dotenv").config();

const crypto = require("crypto");
const path = require("path");
const express = require("express");
const OpenAI = require("openai");
const { pricing, calculateQuote } = require("./config/pricing");
const { logRequest, logEvent, shouldLogRequest, readRecentLogs, cleanupOldLogs } = require("./utils/logStore");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    if (!shouldLogRequest(req.path)) {
      return;
    }

    logRequest(req, res, Date.now() - startedAt);
  });

  next();
});

const model = process.env.OPENAI_MODEL || "gpt-4o";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
const hasGemini = Boolean(process.env.GEMINI_API_KEY);
const openai = hasOpenAI ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "admin@detailing.local").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "ChangeMe123!");
const SESSION_TTL_HOURS = Number(process.env.ADMIN_SESSION_TTL_HOURS || 12);
const sessionStore = new Map();

function parseCookies(req) {
  const cookieHeader = String(req.headers.cookie || "");
  const cookies = {};

  for (const item of cookieHeader.split(";")) {
    const [key, ...rest] = item.split("=");
    const k = String(key || "").trim();
    if (!k) {
      continue;
    }

    cookies[k] = decodeURIComponent(rest.join("=").trim());
  }

  return cookies;
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req);
  const token = cookies.admin_session;

  if (!token || !sessionStore.has(token)) {
    return null;
  }

  const session = sessionStore.get(token);
  if (!session || Date.now() > session.expiresAt) {
    sessionStore.delete(token);
    return null;
  }

  return { token, session };
}

function issueSessionCookie(res, email) {
  const token = crypto.randomBytes(24).toString("hex");
  const maxAgeSeconds = SESSION_TTL_HOURS * 60 * 60;

  sessionStore.set(token, {
    email,
    createdAt: Date.now(),
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  });

  const securePart = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const cookie = `admin_session=${token}; HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${securePart}`;
  res.setHeader("Set-Cookie", cookie);
}

function clearSessionCookie(req, res) {
  const sessionData = getSessionFromRequest(req);
  if (sessionData?.token) {
    sessionStore.delete(sessionData.token);
  }

  res.setHeader("Set-Cookie", "admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
}

function requireAdmin(req, res, next) {
  const sessionData = getSessionFromRequest(req);
  if (!sessionData) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.adminSession = sessionData.session;
  return next();
}

async function recommendTierWithGemini({ prompt, fallbackTier }) {
  if (!hasGemini) {
    return { tier: fallbackTier, explanation: "Gemini key missing. Fallback used.", source: "fallback" };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    geminiModel
  )}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || "";

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { tier: fallbackTier, explanation: "Gemini response was not valid JSON; fallback used." };
  }

  return {
    tier: parsed.tier,
    explanation: parsed.explanation || "Recommended based on your inputs.",
    source: "gemini",
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model, geminiModel, hasOpenAI, hasGemini });
});

app.post("/api/admin/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    logEvent("admin_login_failed", { email }, req);
    return res.status(401).json({ error: "Invalid email or password." });
  }

  issueSessionCookie(res, email);
  logEvent("admin_login_success", { email }, req);
  return res.json({ ok: true, email });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  clearSessionCookie(req, res);
  logEvent("admin_logout", { email: req.adminSession?.email || "" }, req);
  return res.json({ ok: true });
});

app.get("/api/admin/me", (req, res) => {
  const sessionData = getSessionFromRequest(req);
  if (!sessionData) {
    return res.status(401).json({ loggedIn: false });
  }

  return res.json({ loggedIn: true, email: sessionData.session.email });
});

app.get("/api/logs", requireAdmin, (req, res) => {
  cleanupOldLogs();

  const logs = readRecentLogs({
    limit: req.query.limit,
    sinceHours: req.query.sinceHours,
    type: req.query.type,
    contains: req.query.contains,
  });

  return res.json({
    count: logs.length,
    retentionDays: Number(process.env.LOG_RETENTION_DAYS || 7),
    logs,
  });
});

app.get("/api/admin/logs", requireAdmin, (req, res) => {
  cleanupOldLogs();

  const logs = readRecentLogs({
    limit: req.query.limit,
    sinceHours: req.query.sinceHours,
    type: req.query.type,
    contains: req.query.contains,
  });

  return res.json({
    count: logs.length,
    retentionDays: Number(process.env.LOG_RETENTION_DAYS || 7),
    logs,
  });
});

app.get("/api/admin/analytics", requireAdmin, (req, res) => {
  cleanupOldLogs();

  const sinceHours = Number(req.query.sinceHours) || 168; // Default 7 days
  const logs = readRecentLogs({
    sinceHours,
    type: "ai_quote_success",
    limit: 10000,
  });

  const serviceCount = {};
  const combinationCount = {};
  const vehicleCount = {};
  const goalCount = {};
  const dirtLevelCount = {};
  const revenueByService = {};

  logs.forEach((log) => {
    if (log.type === "ai_quote_success" && log.payload) {
      const { vehicle, dirtLevel, goal, total } = log.payload;
      
      // Service = vehicle + goal combo
      const service = `${vehicle} / ${goal}`;
      serviceCount[service] = (serviceCount[service] || 0) + 1;
      revenueByService[service] = (revenueByService[service] || 0) + (total || 0);
      
      // Individual counts
      vehicleCount[vehicle] = (vehicleCount[vehicle] || 0) + 1;
      goalCount[goal] = (goalCount[goal] || 0) + 1;
      dirtLevelCount[dirtLevel] = (dirtLevelCount[dirtLevel] || 0) + 1;
      
      // Full combination (vehicle + dirtLevel + goal)
      const combination = `${vehicle} | ${dirtLevel} | ${goal}`;
      combinationCount[combination] = (combinationCount[combination] || 0) + 1;
    }
  });

  // Sort by frequency
  const topServices = Object.entries(serviceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count, revenue: revenueByService[name] || 0 }));

  const topCombinations = Object.entries(combinationCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const topVehicles = Object.entries(vehicleCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const topGoals = Object.entries(goalCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const topDirtLevels = Object.entries(dirtLevelCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const totalRevenue = Object.values(revenueByService).reduce((sum, val) => sum + val, 0);

  return res.json({
    sinceHours,
    totalQuotes: logs.length,
    totalRevenue,
    topServices,
    topCombinations,
    topVehicles,
    topGoals,
    topDirtLevels,
  });
});

app.get("/api/pricing", (_req, res) => {
  res.json(pricing);
});

app.post("/api/calculate", (req, res) => {
  try {
    const quote = calculateQuote(req.body || {});
    return res.json(quote);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/ai-quote", async (req, res) => {
  const { vehicle, dirtLevel, goal, addons = [] } = req.body || {};

  if (!vehicle || !dirtLevel || !goal) {
    return res.status(400).json({ error: "vehicle, dirtLevel, and goal are required." });
  }

  const rulebook = {
    tiers: pricing.tiers,
    addons: pricing.addons,
    surcharges: pricing.surcharges,
    vehicles: pricing.vehicles,
    serviceLimits: [
      "No buffing",
      "No paint correction",
      "No steam cleaning",
      "No ozone odor treatment",
      "No leather conditioning",
    ],
  };

  const fallbackTierByGoal = {
    quick: "quick",
    reset: "full",
    protection: "premium",
  };

  const fallbackTier = fallbackTierByGoal[goal] || "full";
  const fallback = calculateQuote({
    tier: fallbackTier,
    vehicle,
    dirtLevel,
    addons,
  });

  try {
    const prompt = [
      "You are a car detailing pricing assistant.",
      "Pick exactly one tier key from: quick, full, premium.",
      "Goal mapping preference: quick->quick, reset->full, protection->premium.",
      "Return strict JSON only with keys: tier, explanation.",
      `Customer input: ${JSON.stringify({ vehicle, dirtLevel, goal, addons })}`,
      `Pricing rulebook: ${JSON.stringify(rulebook)}`,
    ].join("\n");

    let recommendation;

    if (openai) {
      const completion = await openai.responses.create({
        model,
        input: prompt,
        temperature: 0.2,
      });

      const text = (completion.output_text || "").trim();
      let parsed;

      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { tier: fallbackTier, explanation: "OpenAI response was not valid JSON; fallback used." };
      }

      recommendation = {
        tier: parsed.tier,
        explanation: parsed.explanation || "Recommended based on your inputs.",
        source: "openai",
      };
    } else if (hasGemini) {
      recommendation = await recommendTierWithGemini({ prompt, fallbackTier });
    } else {
      recommendation = {
        tier: fallbackTier,
        explanation: "No AI key configured. Returned deterministic rules quote.",
        source: "fallback",
      };
    }

    const tier = pricing.tiers[recommendation.tier] ? recommendation.tier : fallbackTier;
    const quote = calculateQuote({
      tier,
      vehicle,
      dirtLevel,
      addons,
    });

    logEvent(
      "ai_quote_success",
      {
        source: recommendation.source,
        vehicle,
        dirtLevel,
        goal,
        total: quote.total,
      },
      req
    );

    return res.json({
      source: recommendation.source,
      explanation: recommendation.explanation,
      quote,
    });
  } catch (error) {
    logEvent(
      "ai_quote_error",
      {
        vehicle,
        dirtLevel,
        goal,
        error: String(error.message || "").slice(0, 300),
      },
      req
    );

    return res.json({
      source: "fallback",
      reasoning: `AI call failed: ${error.message}`,
      quote: fallback,
    });
  }
});

app.post("/api/book", (req, res) => {
  const { name, phone, address, vehicle, packageTier, date, time, notes = "" } = req.body || {};

  if (!name || !phone || !address || !vehicle || !packageTier || !date || !time) {
    logEvent("booking_invalid", { name: Boolean(name), phone: Boolean(phone), address: Boolean(address) }, req);
    return res.status(400).json({ error: "Missing required booking fields." });
  }

  const bookingId = `bk_${Date.now()}`;

  logEvent(
    "booking_created",
    {
      bookingId,
      vehicle,
      packageTier,
      date,
      time,
      hasNotes: Boolean(notes),
    },
    req
  );

  return res.status(201).json({
    message: "Booking request captured. Connect this endpoint to your CRM/calendar later.",
    booking: {
      id: bookingId,
      name,
      phone,
      address,
      vehicle,
      packageTier,
      date,
      time,
      notes,
    },
  });
});

app.listen(port, () => {
  console.log(`Car detailing site running at http://localhost:${port}`);
});
