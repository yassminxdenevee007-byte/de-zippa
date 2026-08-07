// models/OTP.js - Modified to make cardId optional
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
  },

  cardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Card",
    required: false,  // ✅ Changed from true to false
  },

  status: {
    type: String,
    enum: ["pending", "otp","accepted","verify", "otp2","otp3","otp4",  "app", "rejected"],
    default: "pending",
  },

  step: {
    type: Number,
    default: 1,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600,
  },
});

module.exports = mongoose.model("OTP", otpSchema);