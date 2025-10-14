const express = require("express");
const router = express.Router();
const sendEmail = require("../utils/email");


exports.sendMsg("/send", async(req, res) => {
    try {
         const { message } = req.body;
    if (!message) return res.status(400).json({ msg: "Message not found" });

    const subject = "Message from user";
    const text = `Hello ${name}, Your OTP is ${otpPlain}`;

    await sendEmail(email, subject, text, verifyEmailTemplate(name, otpPlain));

    } catch (error) {
        
    }
   

})
