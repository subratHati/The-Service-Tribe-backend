const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: true,
    },

    //Snapshot so price changes later don't affect old bookings
    serviceName: {
        type: String,
        required: true,
    },
    servicePriceAtBooking: {
        type: Number,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        default: 1,
    },
    totalAmount: {
        type: Number,
        required: true,
    },
    scheduledAt: {
        type: Date,
        required: true,
    },
    address: {
        type: String,
        required: true,
    },
    notes: {
        type: String,
    },
    status: {
        type: String,
        enum: ["pending", "confirmed", "in_progress", "completed", "cancelled"],
        default: "pending",
    },
    paymentStatus: {
        type: String,
        enum: ["unpaid", "paid", "refunded"],
    },

    assignTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Technician",
        default: null
    },

    assignAt: {
        type: Date,
    },

    // OTP fields for admin-complete flow
    otp: {
        type: String,
        default: null
    }, // hashed otp
    otpExpiry: {
        type: Date,
        default: null
    },

}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);