// settingsHelper.js
// Centralized settings access with caching so routes can react to them in real-time.
const Settings = require("./models/Settings");

let cache = null;
let cacheTime = 0;
const TTL_MS = 5000; // re-check DB every 5s max

const DEFAULT_SETTINGS = {
  logVisitors: true,
  autoBlock: false,
  dailyReports: true,
  advancedSecurity: false,
  blockProxies: true,
  notifyVisits: false,
};

async function getSettings(force = false) {
  if (!force && cache && Date.now() - cacheTime < TTL_MS) {
    return cache;
  }

  let settings = await Settings.findOne();
  if (!settings) {
    settings = new Settings(DEFAULT_SETTINGS);
    await settings.save();
  }

  cache = { ...DEFAULT_SETTINGS, ...settings.toObject() };
  delete cache._id;
  delete cache.__v;
  delete cache.createdAt;
  delete cache.updatedAt;
  cacheTime = Date.now();
  return cache;
}

function invalidateCache() {
  cache = null;
  cacheTime = 0;
}

module.exports = { getSettings, invalidateCache, DEFAULT_SETTINGS };