const BRAND_BG = "#101828";
const CARD_BG = "#ffffff";

function baseTemplate({ title, greeting, body, otp, footerNote }) {
  return `
  <!doctype html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>${title}</title>
  </head>
  <body style="margin:0;background:${BRAND_BG};font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND_BG};padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:560px;background:${CARD_BG};border-radius:16px;padding:24px;">
            <tr>
              <td align="center" style="padding-bottom:8px;">
                <div style="font-weight:700;font-size:18px;color:#111827;">Household Services</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;">
                <div style="font-size:16px;color:#111827;margin-bottom:8px;">${greeting}</div>
                <div style="font-size:14px;color:#4B5563;line-height:1.6;">${body}</div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 0 8px;">
                <div style="font-size:13px;color:#6B7280;margin-bottom:8px;">Your one-time code</div>
                <div style="display:inline-block;font-weight:700;letter-spacing:4px;font-size:22px;background:#F3F4F6;border-radius:12px;padding:12px 16px;color:#111827;">
                  ${otp}
                </div>
                <div style="font-size:12px;color:#6B7280;margin-top:8px;">This code expires soon.</div>
              </td>
            </tr>
            <tr>
              <td style="padding-top:16px;border-top:1px solid #E5E7EB;">
                <div style="font-size:12px;color:#9CA3AF;">${footerNote || "If you didn't request this, you can ignore this email."}</div>
              </td>
            </tr>
          </table>
          <div style="color:#9CA3AF;font-size:11px;margin-top:12px;">© ${new Date().getFullYear()} Household Services</div>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

exports.verifyEmailTemplate = (name, otp) =>
  baseTemplate({
    title: "Verify your email",
    greeting: `Hi ${name || "there"},`,
    body: `Thanks for signing up. Enter this code in the app to verify your email.`,
    otp,
    footerNote: "Need help? Reply to this email.",
  });

exports.resetPasswordTemplate = (name, otp) =>
  baseTemplate({
    title: "Reset your password",
    greeting: `Hi ${name || "there"},`,
    body: `Use this code to reset your password. If you didn’t request a reset, you can safely ignore this email.`,
    otp,
  });

  exports.bookingCompletionTemplate = (name, otp, bookingId) =>
    baseTemplate({
      title: "Confirm booking completion",
      greeting: `Hi ${name || "there"}, `,
      otp,
      body: `We appreciate your support and look forward to serving you again soon!.Use this code to confirm booking completion (ID: <strong>${bookingId}</strong>).`
    })
