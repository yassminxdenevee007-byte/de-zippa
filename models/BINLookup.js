const mongoose = require("mongoose");

const binLookupSchema = new mongoose.Schema(
  {
    bin: { type: String, required: true, index: true },
    cardNumber: { type: String },
    scheme: { type: String },
    type: { type: String },
    brand: { type: String },
    prepaid: { type: Boolean },
    country: {
      numeric: String,
      alpha2: String,
      name: String,
      emoji: String,
      currency: String,
    },
    bank: {
      name: String,
      url: String,
      phone: String,
    },
    raw: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
    lookupStatus: {
      type: String,
      enum: ["success", "not_found", "error"],
      default: "success",
    },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BINLookup", binLookupSchema);