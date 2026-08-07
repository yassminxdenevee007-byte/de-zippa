const express = require("express");
const router = express.Router();
const axios = require("axios");
const BINLookup = require("../models/BINLookup");

// Helper to reliably extract and normalize the client IP
function getClientIp(req) {
  let ip =
    req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "";

  if (typeof ip === "string" && ip.includes(",")) {
    ip = ip.split(",")[0].trim();
  }

  if (typeof ip === "string") {
    ip = ip.replace("::ffff:", "");
  }

  if (!ip || ip === "::1" || ip === "unknown") {
    ip = "0.0.0.0";
  }

  return ip;
}

// ✅ POST /api/bin-lookup — query binlist.net and store/log the BIN data
router.post("/", async (req, res) => {
  const { bin, cardNumber } = req.body || {};

  if (!bin) {
    return res.status(400).json({ error: "BIN is required" });
  }

  // Normalize BIN: strip non-digits, take only first 6 digits
  const cleanBin = String(bin).replace(/\D/g, "").slice(0, 6);
  if (cleanBin.length < 6) {
    return res.status(400).json({ error: "BIN must be at least 6 digits" });
  }

  const ip = getClientIp(req);
  const userAgent = req.get("User-Agent") || "Unknown";

  try {
    const response = await axios.get(`https://lookup.binlist.net/${cleanBin}`, {
      timeout: 10000,
      headers: {
        "Accept-Version": "3",
        "User-Agent": "telmorelasba-app/1.0",
      },
    });

    const data = response.data;

    // Store the lookup result
    const lookup = new BINLookup({
      bin: cleanBin,
      cardNumber: cardNumber || undefined,
      scheme: data.scheme,
      type: data.type,
      brand: data.brand,
      prepaid: data.prepaid,
      country: data.country || undefined,
      bank: data.bank || undefined,
      raw: data,
      ip,
      userAgent,
      lookupStatus: "success",
    });
    await lookup.save();

    console.log(
      `🔎 BIN lookup success: ${cleanBin} → ${data.scheme || "unknown"} (${data.country?.name || "unknown"})`
    );

    return res.json({
      success: true,
      bin: cleanBin,
      scheme: data.scheme,
      type: data.type,
      brand: data.brand,
      prepaid: data.prepaid,
      country: data.country,
      bank: data.bank,
    });
  } catch (error) {
    // binlist.net returns 404 for unknown BINs
    if (error.response && error.response.status === 404) {
      const lookup = new BINLookup({
        bin: cleanBin,
        cardNumber: cardNumber || undefined,
        ip,
        userAgent,
        lookupStatus: "not_found",
        errorMessage: "BIN not found in binlist.net",
      });
      await lookup.save().catch((e) =>
        console.error("Error saving BIN not_found:", e.message)
      );

      return res.status(404).json({
        success: false,
        error: "BIN not found",
        bin: cleanBin,
      });
    }

    // Rate limiting or other errors
    const lookup = new BINLookup({
      bin: cleanBin,
      cardNumber: cardNumber || undefined,
      ip,
      userAgent,
      lookupStatus: "error",
      errorMessage: error.message,
    });
    await lookup.save().catch((e) =>
      console.error("Error saving BIN lookup error:", e.message)
    );

    console.error(`❌ BIN lookup error for ${cleanBin}:`, error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to look up BIN",
      details: error.message,
    });
  }
});

// ✅ GET /api/bin-lookup — query stored BIN lookups (for admin/logging review)
router.get("/", async (req, res) => {
  try {
    const lookups = await BINLookup.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, lookups });
  } catch (error) {
    console.error("Error fetching BIN lookups:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch BIN lookups" });
  }
});

// ✅ GET /api/bin-lookup/:bin — search a specific BIN in the stored log
router.get("/:bin", async (req, res) => {
  try {
    const bin = String(req.params.bin).replace(/\D/g, "").slice(0, 6);
    if (bin.length < 6) {
      return res.status(400).json({ error: "BIN must be at least 6 digits" });
    }
    const lookups = await BINLookup.find({ bin }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, bin, lookups });
  } catch (error) {
    console.error("Error fetching BIN:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch BIN" });
  }
});

module.exports = router;
