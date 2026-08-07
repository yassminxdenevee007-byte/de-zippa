const express = require("express");
const router = express.Router();
const Visitor = require("../models/Visitor");

// ✅ Analytics endpoint - real data from Visitor collection
// Returns per-day stats: visitors (unique IPs), page views, bounce rate, avg session duration
router.get("/", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    // Fetch all visitors within the range
    const visitors = await Visitor.find({
      timestamp: { $gte: startDate },
    }).sort({ timestamp: 1 });

    // Group by day
    const dayMap = new Map();

    for (const v of visitors) {
      const date = new Date(v.timestamp);
      const dayKey = date.toISOString().split("T")[0]; // YYYY-MM-DD (UTC)

      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, {
          date: dayKey,
          visitorsByIp: new Map(), // ip -> array of timestamps
          pageViews: 0,
        });
      }

      const day = dayMap.get(dayKey);
      day.pageViews++;

      if (!day.visitorsByIp.has(v.ip)) {
        day.visitorsByIp.set(v.ip, []);
      }
      day.visitorsByIp.get(v.ip).push(v.timestamp);
    }

    // Build result array for each day in range, including empty days
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dayKey = d.toISOString().split("T")[0];

      const day = dayMap.get(dayKey);

      if (!day) {
        result.push({
          date: dayKey,
          visitors: 0,
          pageViews: 0,
          bounceRate: "0%",
          avgSession: "0:00",
        });
        continue;
      }

      // Visitors = unique IPs
      const visitorsCount = day.visitorsByIp.size;

      // Bounce rate = IPs with only 1 page view / total unique IPs
      let bounced = 0;
      let totalSessionMs = 0;
      let sessionsWithData = 0;

      for (const [, timestamps] of day.visitorsByIp.entries()) {
        if (timestamps.length === 1) {
          bounced++;
        }
        if (timestamps.length > 1) {
          const first = Math.min(...timestamps.map((t) => new Date(t).getTime()));
          const last = Math.max(...timestamps.map((t) => new Date(t).getTime()));
          totalSessionMs += last - first;
          sessionsWithData++;
        }
      }

      const bounceRate =
        visitorsCount > 0
          ? Math.round((bounced / visitorsCount) * 100) + "%"
          : "0%";

      // Average session duration (only for sessions with multiple views)
      const avgSessionMs =
        sessionsWithData > 0 ? totalSessionMs / sessionsWithData : 0;
      const avgMinutes = Math.floor(avgSessionMs / 60000);
      const avgSeconds = Math.floor((avgSessionMs % 60000) / 1000);
      const avgSession = `${avgMinutes}:${String(avgSeconds).padStart(2, "0")}`;

      result.push({
        date: dayKey,
        visitors: visitorsCount,
        pageViews: day.pageViews,
        bounceRate,
        avgSession,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

module.exports = router;