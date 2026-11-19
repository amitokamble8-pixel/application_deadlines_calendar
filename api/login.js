// POST /api/login -> checks the admin password (sent in the x-admin-password header)
const { isAdmin, passwordConfigured, dbConfig } = require("./_lib");

// Slow down password guessing a little
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  if (!passwordConfigured()) {
    return res.status(503).json({ error: "Admin password is not set up yet. Add ADMIN_PASSWORD in Vercel (see README)." });
  }
  if (!isAdmin(req)) { await wait(800); return res.status(401).json({ error: "Wrong password" }); }
  return res.status(200).json({ ok: true, dbConnected: !!dbConfig() });
};
