// const nodemailer = require("nodemailer");

// const transporter = nodemailer.createTransport({
//     host:"smtp.gmail.com",
//     port: 587,
//     secure:false,
//     auth: {
//         user:process.env.EMAIL_USER,
//         pass:process.env.EMAIL_PASS,
//     },
//     requireTLS:true,
// });

// async function sendEmail(to, subject, text, html){
//     try {
//         const mail = {
//             from: `"The Service Tribe" <${process.env.EMAIL_USER}>`,
//             to,
//             subject,
//             text,
//             ...(html ? {html} : {}),
//         };

//         console.log("Email send successfully");
//         return await transporter.sendMail(mail);
//     } catch (error) {
//         console.log("Error sending email ", error);
        
//     }
// }

// module.exports = sendEmail;




// email.js
// Reusable SMTP-only mailer with connection pooling + reconnect + retries
// Environment vars:
// - EMAIL_USER (required)
// - EMAIL_PASS (required)  -> Gmail App Password if using Gmail
// - SMTP_HOST (optional, default smtp.gmail.com)
// - SMTP_PORT (optional, default 587)
// - EMAIL_FROM (optional, default uses EMAIL_USER)
// - SMTP_POOL (optional, default true)
// - SMTP_MAX_CONNECTIONS (optional, default 5)
// - SMTP_MAX_MESSAGES (optional, default 100)
// - EMAIL_SEND_RETRIES (optional, default 3)

const nodemailer = require("nodemailer");

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const EMAIL_FROM =
  process.env.EMAIL_FROM || (EMAIL_USER ? `"The Service Tribe" <${EMAIL_USER}>` : "no-reply@tribeservice.in");

const SMTP_POOL = process.env.SMTP_POOL !== "false"; // default true
const SMTP_MAX_CONNECTIONS = Number(process.env.SMTP_MAX_CONNECTIONS || 5);
const SMTP_MAX_MESSAGES = Number(process.env.SMTP_MAX_MESSAGES || 100);

const EMAIL_SEND_RETRIES = Number(process.env.EMAIL_SEND_RETRIES || 3);

if (!EMAIL_USER || !EMAIL_PASS) {
  console.warn("Warning: EMAIL_USER or EMAIL_PASS not set. Email sending will fail without credentials.");
}

/**
 * Singleton transporter object and health flag
 */
let transporter = null;
let transporterHealthy = false;
let verifying = false;

/**
 * Create transporter instance (pooling enabled)
 */
function createTransporter() {
  const secure = SMTP_PORT === 465; // true for 465, false for 587 (STARTTLS)
  const t = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    requireTLS: !secure,
    pool: SMTP_POOL,
    maxConnections: SMTP_MAX_CONNECTIONS,
    maxMessages: SMTP_MAX_MESSAGES,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    // no logger/debug in production
  });

  return t;
}

/**
 * Verify transporter (tries to authenticate & connect)
 * Sets transporterHealthy flag.
 * Avoid concurrent verification calls.
 */
async function verifyTransporter() {
  if (verifying) return transporterHealthy;
  verifying = true;

  try {
    if (!transporter) transporter = createTransporter();

    await new Promise((resolve, reject) => {
      transporter.verify((err, success) => {
        if (err) return reject(err);
        return resolve(success);
      });
    });

    transporterHealthy = true;
    console.log("SMTP transporter is healthy:", `${SMTP_HOST}:${SMTP_PORT}`);
  } catch (err) {
    transporterHealthy = false;
    console.warn("SMTP transporter verify failed:", err && err.code ? `${err.code} - ${err.message}` : err);
    // close and null transporter so next attempt creates a fresh one
    try {
      transporter && transporter.close && transporter.close();
    } catch (e) {}
    transporter = null;
  } finally {
    verifying = false;
  }

  return transporterHealthy;
}

/**
 * Ensure transporter exists and is healthy; if not attempt to recreate & verify
 */
async function ensureTransporterReady() {
  if (transporterHealthy && transporter) return transporter;
  // try to create and verify up to 2 times
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (!transporter) transporter = createTransporter();
      const ok = await verifyTransporter();
      if (ok) return transporter;
    } catch (err) {
      console.warn("ensureTransporterReady attempt failed:", err && err.code ? err.code : err);
      try {
        transporter && transporter.close && transporter.close();
      } catch (e) {}
      transporter = null;
      await new Promise((r) => setTimeout(r, 1000 * attempt)); // backoff
    }
  }
  // Last try: return current transporter (may be null / unhealthy)
  return transporter;
}

/**
 * Helper sleep
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * sendEmail(to, subject, text, html)
 * Retries on common transient errors.
 * Throws on permanent failure.
 */
async function sendEmail(to, subject, text, html) {
  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error("EMAIL_USER or EMAIL_PASS not configured in environment.");
  }

  const mailOptions = {
    from: EMAIL_FROM,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  };

  let lastErr = null;

  for (let attempt = 1; attempt <= EMAIL_SEND_RETRIES; attempt++) {
    try {
      const t = await ensureTransporterReady();
      if (!t) throw new Error("No SMTP transporter available after verification attempts.");

      // Try sending
      const info = await t.sendMail(mailOptions);

      // Mark healthy on success
      transporterHealthy = true;
      // Optional: log the message id or server response (concise)
      console.log("Email sent successfully:", info && info.response ? info.response : info.messageId || info);

      return info;
    } catch (err) {
      lastErr = err;
      transporterHealthy = false;
      console.warn(
        `sendEmail attempt ${attempt} failed:`,
        err && err.code ? `${err.code} - ${err.message}` : err
      );

      // Close transporter so next attempt will recreate
      try {
        transporter && transporter.close && transporter.close();
      } catch (e) {}

      transporter = null;

      // Decide if should retry: retry on network issues/timeouts, not on auth errors (EAUTH)
      const retryable = err && err.code && ["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH"].includes(err.code);

      if (!retryable) {
        // For auth errors or other non-retryable errors, stop retrying
        console.error("Non-retryable email error. Aborting attempts.");
        throw err;
      }

      // exponential backoff before next attempt
      const backoffMs = Math.min(30000, 1000 * Math.pow(2, attempt));
      console.log(`Retrying sendEmail in ${backoffMs}ms...`);
      await sleep(backoffMs);
      // continue attempts
    }
  }

  // if we exit loop, all attempts failed
  console.error("All sendEmail attempts failed. Last error:", lastErr);
  throw lastErr || new Error("Failed to send email after retries");
}

/**
 * Optional: Run verify once on module load in background (non-blocking).
 * This helps surface auth/connectivity problems early in logs.
 */
(async () => {
  try {
    await verifyTransporter();
  } catch (e) {
    // already handled in verifyTransporter
  }
})();

module.exports = sendEmail;
