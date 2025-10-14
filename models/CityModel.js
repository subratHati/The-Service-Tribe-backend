const mongoose = require("mongoose");

const CitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    isAvailable: {
        type: Boolean,
        default: false,
    }
});

module.exports = mongoose.model("City", CitySchema);