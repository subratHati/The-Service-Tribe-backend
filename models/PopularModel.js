// models/PopularModel.js
const mongoose = require("mongoose");

const PopularSchema = new mongoose.Schema({
  // we keep single doc pattern: one doc holds ordered array of service refs
  services: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model("Popular", PopularSchema);
