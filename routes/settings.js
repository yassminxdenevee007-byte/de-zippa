const express = require('express');
const router = express.Router();
const { getSettings, invalidateCache } = require('../settingsHelper');

router.get('/', async (req, res) => {
  try {
    const settings = await getSettings(true); // force fresh read
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/', async (req, res) => {
  try {
    const Settings = require('../models/Settings');
    const settings = await Settings.findOneAndUpdate({}, req.body, {
      new: true,
      upsert: true,
      runValidators: true,
    });
    invalidateCache();
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;