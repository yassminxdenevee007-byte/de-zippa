const express = require("express");
const router = express.Router();
const axios = require("axios");

router.post("/verify-captcha", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, error: "Missing token" });
  }

  try {
    const googleRes = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret: process.env.SECRET_KEY,
          response: token,
        },
      }
    );

    const { success } = googleRes.data;

    if (success) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(403).json({ success: false, error: "Captcha failed" });
    }
  } catch (error) {
    console.error("Captcha verification error:", error.message);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
});

module.exports = router;