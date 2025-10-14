// backend/models/PaymentModel.js
const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    index: true,
    unique: true,
  },
  paymentId: {
    type: String,
    default: null,
  },
  signature: {
    type: String,
    default: null,
  },
  amount: {
    type: Number,
    required: true, // paise
  },
  currency: {
    type: String,
    default: "INR",
  },
  status: {
    type: String,
    enum: ["created", "paid", "failed"],
    default: "created",
  },
  bookingId: { // for single-booking flows (optional)
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    default: null,
  },
  bookingIds: [{ // for multi-booking created after verify
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
  }],
  itemRefs: [{ type: String }], // service ids / refs for audit
  bookingPayload: { type: Object, default: null }, // store original payload
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model("Payment", PaymentSchema);
