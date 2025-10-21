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



// utils/email.js
// SendGrid email sender (CommonJS)

const sgMail = require("@sendgrid/mail");

if (!process.env.SENDGRID_API_KEY) {
  console.warn("Warning: SENDGRID_API_KEY not set. Emails will fail.");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // sgMail.setDataResidency('eu'); // uncomment if you need EU data residency
}

/**
 * sendEmail(to, subject, text, html)
 */
async function sendEmail(to, subject, text, html) {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error("SENDGRID_API_KEY not configured");
  }

  const from = process.env.SENDGRID_FROM || "no-reply@tribeservice.in";

  const msg = {
    to,
    from,
    subject,
    text,
    ...(html ? { html } : {}),
  };

  try {
    const res = await sgMail.send(msg);
    console.log("✅ Email sent via SendGrid:", res && res.length ? res[0].statusCode : res);
    return res;
  } catch (err) {
    // Log helpful info for debugging
    if (err && err.response && err.response.body) {
      console.error("SendGrid error response body:", err.response.body);
    } else {
      console.error("SendGrid send error:", err);
    }
    throw err;
  }
}

module.exports = sendEmail;
