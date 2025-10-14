const express = require("express");
const { 
    getCategoryById,
    createCategory,
    getAllCategories,
    editCategory,
    deleteCategory } = require("../controllers/categoryController");
const router = express.Router();
const multer = require("multer");
const streamifier = require("streamifier");
const verifyToken = require("../middlewares/authMiddleware");
const isAdmin = require("../middlewares/isAdmin");

//multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {fileSize: 5 * 1024 * 1024}, // 5MB.
    fileFilter: (req, file, cb) => {
        if(!file.mimetype.startsWith("image/")) cb(new Error("Only images are allowed"));
        else cb(null, true);
    },
});


//Public routes.
router.get("/all", getAllCategories);

//Admin routes.
router.post("/create",verifyToken, isAdmin, upload.single("image"), createCategory);
router.get("/:id",verifyToken, isAdmin, getCategoryById);
router.put("/:id", verifyToken, isAdmin, upload.single("image"), editCategory);
router.delete("/:id",verifyToken, isAdmin, deleteCategory);




module.exports = router;