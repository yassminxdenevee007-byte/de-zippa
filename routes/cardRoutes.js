const express = require("express");
const router = express.Router();
const Card = require("../models/Card");

// مثال: Get card status by ID
router.get("/status/:id", async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ message: "Card not found" });
    res.json({ status: card.status || "pending" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
