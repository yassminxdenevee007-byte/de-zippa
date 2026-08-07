const mongoose = require('mongoose');

const BlockedUserSchema = new mongoose.Schema({
  ip: String,
  date: String,
  reason: String,
});

module.exports = mongoose.model('BlockedUser', BlockedUserSchema);