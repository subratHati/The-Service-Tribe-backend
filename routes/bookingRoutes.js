const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const isAdmin = require("../middlewares/isAdmin");
const {
    createBooking,
    getMyBookings,
    getBookingById,
    updateStatus,
    cancelMyBooking,
    assignBooking,
    getAllBookings,
    sendCompletionOtp,
    verifyCompletionOtp } = require("../controllers/bookingController");

//admin routes
router.get("/all", verifyToken, isAdmin, getAllBookings);
router.put("/updateStatus/:bookingId", verifyToken, isAdmin, updateStatus);
router.put("/assign/:bookingId", verifyToken, isAdmin, assignBooking);


//public routes
router.post("/create", verifyToken, createBooking);
router.get("/myBookings", verifyToken, getMyBookings);
router.get("/getBooking/:bookingId", verifyToken, getBookingById);
router.put("/cancelBooking/:bookingId", verifyToken, cancelMyBooking);

//admin routes
router.post("/:id/send-completion-otp", verifyToken, isAdmin, sendCompletionOtp);
router.post("/:id/verify-completion-otp", verifyToken, isAdmin, verifyCompletionOtp);

module.exports = router;