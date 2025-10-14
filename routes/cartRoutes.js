const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const {getCart, addToCart, removeFromCart, clearCart} = require("../controllers/cartController");

router.get("/get", verifyToken, getCart);
router.post("/add", verifyToken, addToCart);
router.delete("/remove/:serviceId", verifyToken, removeFromCart);
router.post("/clear", verifyToken, clearCart);

module.exports = router;