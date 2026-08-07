const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema(
  {
    logVisitors: { type: Boolean, default: true },
    autoBlock: { type: Boolean, default: false },
    dailyReports: { type: Boolean, default: true },
    advancedSecurity: { type: Boolean, default: false },
    blockProxies: { type: Boolean, default: true },
    notifyVisits: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', SettingsSchema);