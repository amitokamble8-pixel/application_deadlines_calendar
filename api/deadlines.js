// GET  /api/deadlines -> public, anyone can read
// PUT  /api/deadlines -> admin only (x-admin-password header), replaces the whole list
const { KEY, dbConfig, redis, isAdmin, cleanList, readBody } = require("./_lib");
const seed = require("./_seed.json");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      let stored = null;
      if (dbConfig()) {
        const raw = await redis(["GET", KEY]);
        stored = raw ? JSON.parse(raw) : null;
      }
      return res.status(200).json({
        deadlines: stored || seed,
        source: stored ? "database" : "starter-list",
        dbConnected: !!dbConfig(),
      });
    }

    if (req.method === "PUT") {
      if (!isAdmin(req)) return res.status(401).json({ error: "Not authorised. Please sign in again." });
      const body = readBody(req);
      const list = cleanList(body && body.deadlines);
      await redis(["SET", KEY, JSON.stringify(list)]);
      return res.status(200).json({ ok: true, count: list.length });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
};
