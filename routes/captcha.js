const express = require("express");
const router = express.Router();
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const BlockedIP = require("../models/BlockedIP");

// In-memory failure tracking per IP so we can auto-block repeat offenders.
// (In production, swap this for a DB-backed store so it survives restarts.)
const failureTracker = new Map();

// --- Rate limiting for the captcha verification endpoint ---
// Strict limit: max 10 attempts per 15 minutes per IP.
const captchaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many attempts. Please try again later." },
  handler: (req, res) => {
    // Auto-block the IP when the rate limit is exhausted
    const ip = getIp(req);
    recordFailure(ip, "Rate limit exceeded");
    return res.status(429).json({
      success: false,
      error: "Too many attempts. Your IP has been flagged.",
    });
  },
});

// Extract the real client IP (respecting proxies)
function getIp(req) {
  let ip =
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    "0.0.0.0";
  if (ip && ip.includes(",")) ip = ip.split(",")[0];
  ip = String(ip).replace("::ffff:", "").trim();
  if (ip === "::1") ip = "127.0.0.1";
  return ip;
}

// Record a failed verification attempt and auto-block after 3 failures
async function recordFailure(ip, reason) {
  const count = (failureTracker.get(ip) || 0) + 1;
  failureTracker.set(ip, count);

  if (count >= 3) {
    try {
      const existing = await BlockedIP.findOne({ ip });
      if (!existing) {
        await BlockedIP.create({
          ip,
          reason: `Auto-blocked: ${reason}`,
        });
        console.log(`🚫 Auto-blocked IP after repeated failures: ${ip}`);
      }
    } catch (err) {
      console.error("Error auto-blocking IP:", err.message);
    }
  }
}

router.post("/verify-captcha", captchaLimiter, async (req, res) => {
  const { token, fingerprint, behavior, challenge, honeypot } = req.body;
  const ip = getIp(req);

  // --- 1. Require a valid reCAPTCHA token ---
  if (!token) {
    await recordFailure(ip, "Missing token");
    return res.status(400).json({ success: false, error: "Missing token" });
  }

  // --- 2. Require a device fingerprint ---
  // The frontend always sends one; bots that skip it are rejected.
  if (!fingerprint || typeof fingerprint !== "string" || fingerprint.length < 20) {
    await recordFailure(ip, "Missing/invalid fingerprint");
    return res.status(400).json({ success: false, error: "Invalid fingerprint" });
  }

  // --- 3. Reject requests that tripped the honeypot ---
  // A real user never fills the hidden field; bots do.
  if (honeypot === true) {
    await recordFailure(ip, "Honeypot triggered");
    return res.status(403).json({ success: false, error: "Bot detected" });
  }

  // --- 4. Reject high-risk behavioral fingerprints ---
  // The frontend already blocks these, but we enforce it server-side too.
  if (behavior && behavior.risk === "high") {
    await recordFailure(ip, "High-risk behavior");
    return res.status(403).json({ success: false, error: "Bot detected" });
  }

  // --- 5. Rate limit check (handled by captchaLimiter above) ---

  try {
    // --- 6. Verify the reCAPTCHA token with Google ---
    const googleRes = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret: process.env.SECRET_KEY,
          response: token,
        },
      }
    );

    const { success } = googleRes.data;

    if (success) {
      // Success — clear this IP's failure count
      failureTracker.delete(ip);
      return res
        .status(200)
        .json({ success: true, message: "Verified" });
    } else {
      await recordFailure(ip, "Captcha failed");
      return res.status(403).json({ success: false, error: "Captcha failed" });
    }
  } catch (error) {
    console.error("Captcha verification error:", error.message);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
});

module.exports = router;