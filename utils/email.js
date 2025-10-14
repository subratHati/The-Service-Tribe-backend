const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user:process.env.EMAIL_USER,
        pass:process.env.EMAIL_PASS,
    },
});

async function sendEmail(to, subject, text, html){
    try {
        const mail = {
            from: `"The Service Tribe" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            ...(html ? {html} : {}),
        };

        console.log("Email send successfully");
        return await transporter.sendMail(mail);
    } catch (error) {
        console.log("Error sending email ", error);
        
    }
}

module.exports = sendEmail;