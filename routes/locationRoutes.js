const express = require("express");
const router = express.Router();
const {listCities, addCity, setAvailability} = require("../controllers/cityController");
const verifyToken = require("../middlewares/authMiddleware");
const isAdmin = require("../middlewares/isAdmin");


//Public routes.
router.get("/list", listCities);

router.post("/add",verifyToken, isAdmin, addCity);
router.put("/setAvailability",verifyToken, isAdmin, setAvailability);

module.exports = router;