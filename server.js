require("dotenv").config();
require('./config/passportGoogle')();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const connectDB = require("./config/db"); 

const {apiLimiter} = require("./middlewares/security");

const net = require("net");

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

// Parse allowed origins from environment
const allowedOriginsRaw =
  process.env.ALLOWED_ORIGINS ||
  process.env.CLIENT_URL ||
  "http://localhost:5173";

const allowedOrigins = allowedOriginsRaw
  .split(",")
  .map(o =>
    o
      .trim()
      .replace(/\/$/, "") // remove trailing slash
      .replace(/^https?:\/\/www\./, "https://") // normalize www domains
  )
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like Postman, curl, server-to-server)
      if (!origin) return callback(null, true);

      const normalized = origin
        .trim()
        .replace(/\/$/, "")
        .replace(/^https?:\/\/www\./, "https://");

      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }

      console.warn(`🚫 CORS blocked: ${origin}`);
      return callback(new Error(`CORS policy: Origin ${origin} not allowed.`), false);
    },
    credentials: true,
  })
);



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

// add this one-time debug route (e.g. in app.js or server.js)


app.get("/_debug/smtp-tcp-check", async (req, res) => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const ports = [587, 465];
  const results = [];

  for (const port of ports) {
    results.push(
      await new Promise((resolve) => {
        const socket = new net.Socket();
        const timeout = 7000;
        let done = false;

        socket.setTimeout(timeout);

        socket.on("connect", () => {
          done = true;
          socket.destroy();
          resolve({ port, ok: true, msg: "connected" });
        });

        socket.on("timeout", () => {
          if (done) return;
          done = true;
          socket.destroy();
          resolve({ port, ok: false, msg: "timeout" });
        });

        socket.on("error", (err) => {
          if (done) return;
          done = true;
          socket.destroy();
          resolve({ port, ok: false, msg: err.message });
        });

        socket.connect(port, host);
      })
    );
  }

  res.json({ host: process.env.SMTP_HOST || "smtp.gmail.com", results });
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})

