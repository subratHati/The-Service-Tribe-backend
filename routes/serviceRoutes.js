// routes/serviceRoutes.js
const express = require("express");
const verifyToken = require("../middlewares/authMiddleware");
const isAdmin = require("../middlewares/isAdmin");
const router = express.Router();
const {
    addService,
    getAllServices,
    getServiceById,
    getServicesByCategory,
    updateService,
    deleteService} = require("../controllers/serviceController");

const popularController = require("../controllers/popularController");

// multer memory storage for service images
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) cb(new Error("Only images are allowed"));
    else cb(null, true);
  },
});

// admin routes - accept optional image
router.post("/create", verifyToken, isAdmin, upload.single("image"), addService);
router.put("/update/:serviceId", verifyToken, isAdmin, upload.single("image"), updateService);
router.delete("/:serviceId", verifyToken, isAdmin, deleteService);

// for popular services
router.post("/popular", verifyToken, isAdmin, popularController.addPopular);
router.delete("/popular/:serviceId", verifyToken, isAdmin, popularController.removePopular);
router.patch("/popular/reorder", verifyToken, isAdmin, popularController.reorderPopular);

// public routes
router.get("/get/:serviceId", getServiceById);
router.get("/all", getAllServices);
router.get("/category/:id", getServicesByCategory);

router.get("/popular", popularController.getPopular);

module.exports = router;
