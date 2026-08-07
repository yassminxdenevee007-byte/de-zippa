const express = require("express");
const router = express.Router();
const BlockedIP = require("../models/BlockedIP");

// ✅ عرض جميع IPs المحظورة
router.get("/", async (req, res) => {
  try {
    const blockedIPs = await BlockedIP.find().sort({ createdAt: -1 });
    res.json(blockedIPs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch blocked IPs" });
  }
});

// ✅ إضافة IP إلى قائمة البلوك
router.post("/", async (req, res) => {
  const { ip, reason } = req.body;

  if (!ip) {
    return res.status(400).json({ error: "IP address is required" });
  }

  try {
    const exists = await BlockedIP.findOne({ ip });
    if (exists) {
      return res.status(409).json({ error: "IP is already blocked" });
    }

    const tunisTime = new Date(Date.now() + 1 * 60 * 60 * 1000); // UTC+1

    const newBlocked = new BlockedIP({
      ip,
      reason: reason || "Manually added",
      createdAt: tunisTime,
    });

    await newBlocked.save();
    res.status(201).json({ message: `IP ${ip} blocked`, data: newBlocked });
  } catch (error) {
    console.error("Error blocking IP:", error);
    res.status(500).json({ error: "Failed to block IP" });
  }
});

// ✅ حذف IP معيّن من البلوك لست
router.delete("/:ip", async (req, res) => {
  const ip = req.params.ip;

  try {
    const result = await BlockedIP.deleteOne({ ip });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "IP not found in block list" });
    }

    res.json({ message: `IP ${ip} removed from block list` });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove IP" });
  }
});

// ✅ التحقق إن كان IP محظور
router.get("/check/:ip", async (req, res) => {
  const ip = req.params.ip;
  const blocked = await BlockedIP.findOne({ ip });
  if (blocked) {
    return res.status(403).json({ blocked: true });
  }
  res.json({ blocked: false });
});

module.exports = router;
