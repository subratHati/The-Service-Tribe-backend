const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    // image URL or relative path. Example: "/uploads/categories/ac-cleaning.jpg"
    image: {
        type: String,
        default: null,
    },
    imagePublicId: {
        type: String,
        default: null,
    },
    count: {
        type: Number,
        default: 0,
        min: 0,
    },

}, {timestamps: true});

module.exports = mongoose.model("Category", CategorySchema);