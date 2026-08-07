const express = require('express');
const router = express.Router();
const BlockedUser = require('../models/BlockedUser');

router.get('/', async (req, res) => {
  const blocked = await BlockedUser.find();
  res.json(blocked);
});

router.post('/', async (req, res) => {
  const blocked = new BlockedUser(req.body);
  await blocked.save();
  res.json(blocked);
});

router.delete('/:ip', async (req, res) => {
  await BlockedUser.deleteOne({ ip: req.params.ip });
  res.json({ message: 'User unblocked' });
});

module.exports = router;