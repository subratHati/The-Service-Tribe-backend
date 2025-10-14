const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

/**
 * Global API limiter — protects the whole API from abuse.
 * Adjust numbers to your traffic.
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, //15 min.
    max: 3000,
    standardHeaders: true,
    legacyheaders: false,
});

/**
 * Helper: key = IP + identifier (email or phone), so one user can't spray attempts
 */
const authKey = (req) => {
  const ip = ipKeyGenerator(req);
  const id =
    (req.body && (req.body.email || req.body.phoneNumber)) ||
    (req.query && (req.query.email || req.query.phoneNumber)) ||
    ""; // fallback empty
  return `${ip}::${String(id).toLowerCase()}`;
};

/**
 * Brute-force limiter for login — counts ONLY failed responses.
 * When your login returns 200, the counter is not incremented.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,                  // 10 failed tries / 15min per IP+email
  keyGenerator: authKey,
  skipSuccessfulRequests: true,
  message: { msg: "Too many failed login attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});


/**
 * OTP/email verification + password reset limiter — tighter than global
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 failed tries / 15min per IP+email
  keyGenerator: authKey,
  skipSuccessfulRequests: true,
  message: { msg: "Too many attempts. Please wait a few minutes and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  loginLimiter,
  otpLimiter,
};
