const express = require("express");
const { createTechnician } = require("../controllers/technicianController");
const verifyToken = require("../middlewares/authMiddleware");
const isAdmin = require("../middlewares/isAdmin");
const router = express.Router();


router.post("/create", verifyToken, isAdmin, createTechnician);

module.exports = router;