const express = require('express');
const router = express.Router();
const Visitor = require('../models/Visitor');

router.get('/', async (req, res) => {
  const visitors = await Visitor.find().sort({ createdAt: -1 }).limit(10);
  res.json(visitors);
});

router.post('/', async (req, res) => {
  const newVisitor = new Visitor(req.body);
  await newVisitor.save();
  res.json(newVisitor);
});
router.get("/botuser", async (req, res) => {
  try {
    const visitors = await Visitor.find().sort({ timestamp: -1 }).limit(100); // آخر 100 زيارة
    res.json(visitors);
  } catch (err) {
    console.error("Error fetching visitors:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// DELETE all visitors
router.delete("/delete-all", async (req, res) => {
  try {
    await Visitor.deleteMany({});
    res.status(200).json({ message: "All visitors deleted." });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete visitors." });
  }
});
module.exports = router;