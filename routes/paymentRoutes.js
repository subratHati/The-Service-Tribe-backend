const express = require("express");
const router = express.Router();
const {mockPayment, createOrder, verifyPayment, webhook} = require("../controllers/paymentController");
const verifyToken = require("../middlewares/authMiddleware");

router.post("/mock",verifyToken, mockPayment);


router.post("/create-order", verifyToken, createOrder);
router.post("/verify", verifyToken, verifyPayment);

// Webhook should not be authenticated and must read raw body for signature verification.
// In server.js you need: app.post('/api/payment/webhook', express.raw({type:'application/json'}), webhook)
router.post("/webhook", webhook);

module.exports = router;