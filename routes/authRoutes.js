const express = require("express");
const passport = require("passport");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const {register,
    verifyEmail,
    requestPasswordReset,
    resetPassword,
    login,
    getProfile,
    currentUser,
    logout,
    googleCallback,
    updatePhoneNumber,
    resendOtp} = require("../controllers/authController");

const {otpLimiter, loginLimiter} = require("../middlewares/security");

//Registration Routes.
router.post("/register", otpLimiter, register);
router.post("/verify-email", otpLimiter, verifyEmail);

//Forget passowrd Routes.
router.post("/forget-password", otpLimiter, requestPasswordReset);
router.post("/reset-password", otpLimiter, resetPassword);
router.post("/resend-otp", otpLimiter, resendOtp);

//Login, logout, fetch profile Routes.
router.post("/login", loginLimiter, login);
router.get("/profile", verifyToken, getProfile);
router.get("/currentUser", verifyToken, currentUser);
router.get("/logout", verifyToken, logout);
router.post("/update-phoneNumber", verifyToken, updatePhoneNumber);

//Start google auth flow.
router.get("/google", passport.authenticate('google', { scope : ['profile', 'email']}));

router.get("/google/callback", googleCallback);




module.exports = router;