const mongoose = require("mongoose");

const technicianSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },

    phoneNumber : {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },

    skills : [{
        type: mongoose.Types.ObjectId,
        ref: "Service"
    }],

    active: {
        type: Boolean,
        default: true,
    }

}, {timestamps: true});

module.exports = mongoose.model("Technician", technicianSchema);