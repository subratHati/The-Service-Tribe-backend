require("dotenv").config();
require('./config/passportGoogle')();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const connectDB = require("./config/db"); 

const {apiLimiter} = require("./middlewares/security");


const authRoutes = require("./routes/authRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const technicianRoutes = require("./routes/technicianRoutes");
const cartRouters = require("./routes/cartRoutes");
const paymentRouter = require("./routes/paymentRoutes");
const locationRouter = require("./routes/locationRoutes");
const categoryRouter = require("./routes/categoryRoutes");



const app = express();
const PORT = process.env.PORT || 5000;

// If you deploy behind a proxy (Render, Railway, Nginx), keep this:
app.set("trust proxy", 1); // ✅ helps rate-limit see real IP, sets secure cookies correctly in prod

// Flexible CORS that reads ALLOWED_ORIGINS from env (comma separated).
// It will accept requests from any origin listed there and allow credentials.
const allowedOriginsRaw = process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || "http://localhost:5173";
const allowedOrigins = allowedOriginsRaw
  .split(",")
  .map(o => o.trim().replace(/\/$/, "")) // normalize & remove trailing slash
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, "");
    if (allowedOrigins.includes(normalized)) {
      return callback(null, true);
    }
    // otherwise block
    return callback(new Error(`CORS policy: origin ${origin} not allowed`), false);
  },
  credentials: true,
}));


app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// ✅ Apply global API limiter BEFORE routes
app.use("/api", apiLimiter);

// raw body for webhook endpoint only
app.post("/api/payment/webhook", express.raw({ type: "application/json" }), require("./controllers/paymentController").webhook);

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/service", serviceRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/technician", technicianRoutes);
app.use("/api/cart", cartRouters);
app.use("/api/payment", paymentRouter);
app.use("/api/location", locationRouter);
app.use("/api/category", categoryRouter);



app.get("/", (req, res) => {
    res.send("Household service API is running!");
});

connectDB();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})

