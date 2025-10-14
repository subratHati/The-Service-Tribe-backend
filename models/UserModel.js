const mongoose = require("mongoose");


const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    phoneNumber: {
        type: String,
        trim: true,
        default: null,
    },
    password: {
        type: String,
        required: true,
    },
    // mark OAuth accounts so we know how they signed up
    oauthProvider: {
        type: String,
        enum: ["google", null],
        default: null
    },
    oauthId: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
    },
    isVerified: {
        type: Boolean,
        default: false,
    },

    //otp fields.
    otp: {
        type: String,
        default: null,
    },
    otpExpiry: {
        type: Date,
        default: null,
    },

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);