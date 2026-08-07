const mongoose = require("mongoose");

const blockedIPSchema = new mongoose.Schema({
  ip: { type: String, required: true, unique: true },
  reason: { type: String, default: "VPN Detected" },
  createdAt: { type: Date, default: () => new Date(Date.now() + 1 * 60 * 60 * 1000) }, // UTC+1
});

module.exports = mongoose.model("BlockedIP", blockedIPSchema);
