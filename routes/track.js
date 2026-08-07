const express = require("express");
const router = express.Router();
const Visitor = require("../models/Visitor");
const BlockedIP = require("../models/BlockedIP");
const geoip = require("geoip-lite");
const { getSettings } = require("../settingsHelper");

// ✅ Rate limiting for logging
let lastErrorLog = 0;
function logErrorLimited(message) {
  const now = Date.now();
  if (now - lastErrorLog > 5000) {
    console.error(message);
    lastErrorLog = now;
  }
}

const bannedISPs = [
  // Cloudflare
  "CLOUDFLARENET",
  "Cloudflare, Inc.",
  "Cloudflare Inc",
  // Microsoft
  "MICROSOFT-CORP-MSN-AS-BLOCK",
  "Microsoft Corporation",
  "Microsoft Azure",
  "AS8075",
  // Amazon
  "AMAZON-02",
  "Amazon.com, Inc.",
  "Amazon Technologies Inc.",
  // Google
  "GOOGLE-IT",
  "Google Cloud",
  "GoogleCloud",
  "Google One VPN",
  "Google One",
  // DigitalOcean
  "DIGITALOCEAN-ASN",
  "DigitalOcean, LLC",
  // OVH
  "OVH SAS",
  "OVHcloud",
  // Hetzner
  "Hetzner Online GmbH",
  // Alibaba
  "Alibaba Cloud LLC",
  "Alibaba Cloud (Singapore) Private Limited",
  "AlibabaCloud",
  // Tencent
  "Tencent Cloud Computing (Beijing) Co., Ltd",
  // Oracle
  "Oracle Cloud",
  "Oracle Public Cloud",
  // IBM
  "IBM Cloud",
  "SoftLayer Technologies Inc",
  // Akamai / Linode
  "Akamai Technologies, Inc.",
  "Linode",
  // Vultr
  "Vultr Holdings LLC",
  // Huawei
  "Huawei Public Cloud Service",
  // Salesforce
  "Salesforce",
  // Kamatera
  "Kamatera",
  // Facebook / Meta
  "Facebook, Inc.",
  "FACEBOOK",
  "Meta Platforms, Inc.",
  "META",
  // Others (various hosting and proxy services)
  "Choopa, LLC",
  "LeaseWeb Netherlands B.V.",
  "M247 Europe SRL",
  "G-Core Labs S.A.",
  "Contabo GmbH",
  "Scaleway",
  "NETNOD",
  "Shodan",
  "Censys",
  "UAB Cherry Servers",
  "HostHatch",
  "FranTech Solutions",
  "OVH Hosting",
  "NetActuate",
  "Packet",
  "Turnkey Internet",
  "PONYNET",
  "Zenedge LLC",
  // CDN/Protection Services
  "Incapsula Inc",
  "Fastly",
  "StackPath, LLC",
  "Sucuri",
  "Reblaze Technologies Ltd",
  // Mobile Proxy / VPN Detection
  "Mullvad",
  "Windscribe Limited",
  "Private Internet Access",
  "NordVPN",
  "ExpressVPN",
  "Proton VPN AG",
  "CyberGhost",
  "Surfshark Ltd.",
  "HideMyAss",
  "TunnelBear, LLC",
  "MAGIC-WAN",
  "Cogent Communications",
  "xTom GmbH",
  "Mythic Beasts Ltd",
  "IVPN",
  "Oeck LTD",
  "Hide.me VPN",
  "AdGuard VPN",
];

const bannedKeywords = [
  "cloud",
  "hosting",
  "host",
  "vpn",
  "proxy",
  "server",
  "colo",
  "datacenter",
  "infrastructure",
  "solutions",
  "vps",
];

// ⏱️ Simple in-memory cache with TTL cleanup
const ipCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Periodically clean up expired cache entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of ipCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      ipCache.delete(key);
    }
  }
}, CACHE_TTL_MS);

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

router.post("/", async (req, res) => {
  try {
    const ip = getClientIp(req);

    // ⏱️ Check cache
    const cached = ipCache.get(ip);
    if (cached && cached.timestamp > Date.now() - CACHE_TTL_MS) {
      if (cached.blocked) {
        return res
          .status(403)
          .json({ error: cached.reason || "Blocked (cached)" });
      }
    }

    // 🔒 Check if IP is blocked
    const blocked = await BlockedIP.findOne({ ip });
    if (blocked) {
      ipCache.set(ip, {
        blocked: true,
        timestamp: Date.now(),
        reason: blocked.reason,
      });
      return res.status(403).json({ error: "You are blocked." });
    }

    const userAgent = req.get("User-Agent") || "Unknown";
    const isBot = /bot|crawl|spider|crawling|curl|python|fetch/i.test(
      userAgent
    );
    const isProxyUA = /proxy|vpn|anonym|tor|hidemy|tunnel/i.test(userAgent);

    const geo = geoip.lookup(ip);
    const country = geo?.country || "Unknown";

    // ⬇️ VPN detection with timeout (skip if no API key)
    let isVPN = false;
    if (process.env.VPN_API_KEY) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const vpnRes = await fetch(
          `https://vpnapi.io/api/${ip}?key=${process.env.VPN_API_KEY}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        const vpnData = await vpnRes.json();
        isVPN = vpnData.security?.vpn || false;
      } catch (vpnError) {
        logErrorLimited("VPN check failed: " + vpnError.message);
      }
    }

    // 🔍 Detect hosting/proxy provider (respect blockProxies setting)
    const settings = await getSettings();
    let isp = "";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const ispRes = await fetch(`http://ip-api.com/json/${ip}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const ispData = await ispRes.json();
      isp = (ispData.as || ispData.org || "").toLowerCase();

      const matchISP = bannedISPs.some((b) => isp.includes(b.toLowerCase()));
      const matchKeyword = bannedKeywords.some((k) => isp.includes(k));

      if ((matchISP || matchKeyword) && settings.blockProxies !== false) {
        const reason = `Blocked ISP/Keyword: ${isp}`;
        await BlockedIP.updateOne(
          { ip },
          { $set: { reason } },
          { upsert: true }
        );
        ipCache.set(ip, { blocked: true, timestamp: Date.now(), reason });
        return res
          .status(403)
          .json({ error: "Access denied (ISP/proxy detected)" });
      }
    } catch (ispError) {
      logErrorLimited("ISP check failed: " + ispError.message);
    }

    // ❌ If VPN or suspicious proxy
    if (isVPN || isProxyUA) {
      const reason = isVPN ? "VPN Detected" : "Suspicious User-Agent";
      await BlockedIP.updateOne({ ip }, { $set: { reason } }, { upsert: true });
      ipCache.set(ip, { blocked: true, timestamp: Date.now(), reason });
      return res.status(403).json({ error: `Access denied (${reason})` });
    }

    // 🔒 Auto-block bots when setting is enabled
    if (settings.autoBlock && isBot) {
      const reason = "Auto-blocked bot";
      await BlockedIP.updateOne({ ip }, { $set: { reason } }, { upsert: true });
      ipCache.set(ip, { blocked: true, timestamp: Date.now(), reason });
      return res.status(403).json({ error: `Access denied (${reason})` });
    }

    if (settings.logVisitors !== false) {
      const visitor = new Visitor({
        ip,
        userAgent,
        path: req.body.path || "/",
        isBot,
        country,
      });
      await visitor.save();
    }

    // 📢 Optional Telegram notification for visits (skip root page "/")
    const visitPath = req.body.path || "/";
    if (
      settings.notifyVisits &&
      process.env.NOTIFY_BOT_TOKEN &&
      visitPath !== "/"
    ) {
      try {
        const TelegramBot = require("node-telegram-bot-api");
        const notifyBot = new TelegramBot(process.env.NOTIFY_BOT_TOKEN, {
          polling: false,
        });
        await notifyBot.sendMessage(
          process.env.NOTIFY_GROUP_ID,
          `🌐 New visit\n📍 IP: ${ip}\n🌍 Country: ${country}\n🖥️ Path: ${visitPath}\n🤖 Bot: ${isBot ? "Yes" : "No"}`
        );
      } catch (notifyErr) {
        logErrorLimited("Notify bot error: " + notifyErr.message);
      }
    }

    ipCache.set(ip, { blocked: false, timestamp: Date.now() });
    res.status(200).json({ message: "Visitor logged", country });
  } catch (err) {
    logErrorLimited("Visitor log error: " + err.message);
    res.status(500).json({ error: "Failed to log visitor" });
  }
});

module.exports = router;