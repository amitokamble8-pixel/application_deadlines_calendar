// Shared helpers for the API routes. Files starting with "_" are not exposed as routes on Vercel.
const crypto = require("crypto");

const KEY = "student-deadlines:v1";
const TYPES = ["Application", "Early Decision", "Early Action", "Regular Decision", "Admissions test", "Scholarship", "Financial aid", "Interview", "Other"];

function dbConfig() {
  // Works with Vercel's Upstash for Redis integration (KV_* or UPSTASH_* variable names).
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(command) {
  const cfg = dbConfig();
  if (!cfg) { const e = new Error("Database not connected"); e.code = "NO_DB"; e.status = 503; throw e; }
  const r = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { const e = new Error("Database error: " + (j.error || r.status)); e.status = 502; throw e; }
  return j.result;
}

function passwordConfigured() { return !!process.env.ADMIN_PASSWORD; }

function isAdmin(req) {
  const real = process.env.ADMIN_PASSWORD || "";
  if (!real) return false;
  const given = String(req.headers["x-admin-password"] || "");
  // Compare hashes so the comparison takes the same time whatever was typed
  const a = crypto.createHash("sha256").update(real).digest();
  const b = crypto.createHash("sha256").update(given).digest();
  return crypto.timingSafeEqual(a, b);
}

function str(v, max) { return String(v == null ? "" : v).trim().slice(0, max); }

// Validate and clean a list sent by the admin page before storing it
function cleanList(list) {
  if (!Array.isArray(list)) { const e = new Error("Expected a list of deadlines"); e.status = 400; throw e; }
  if (list.length > 3000) { const e = new Error("Too many deadlines (max 3000)"); e.status = 400; throw e; }
  const out = [];
  for (const d of list) {
    if (!d || typeof d !== "object") continue;
    const date = str(d.date, 10);
    const title = str(d.title, 200);
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const link = str(d.link, 500);
    out.push({
      id: str(d.id, 64) || crypto.randomUUID(),
      title,
      institution: str(d.institution, 200),
      country: str(d.country, 80),
      type: TYPES.includes(d.type) ? d.type : "Other",
      date,
      time: /^\d{2}:\d{2}$/.test(str(d.time, 5)) ? str(d.time, 5) : "",
      timezone: str(d.timezone, 40),
      priority: ["high", "low", "normal"].includes(d.priority) ? d.priority : "normal",
      link: /^https?:\/\//i.test(link) ? link : "",
      notes: str(d.notes, 2000),
    });
  }
  return out;
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (_) { return null; } }
  return null;
}

module.exports = { KEY, dbConfig, redis, isAdmin, passwordConfigured, cleanList, readBody };
