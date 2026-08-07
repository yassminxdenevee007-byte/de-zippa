const mongoose = require("mongoose");

const codeSchema = new mongoose.Schema({
  code: String,
  ip: String,
  status: { type: String, default: "pending" },
});

module.exports = mongoose.model("Code", codeSchema);
