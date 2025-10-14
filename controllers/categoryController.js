const Category = require("../models/CategoryModel");
const Service = require("../models/ServiceModel");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");
const { default: mongoose } = require("mongoose");

/**
 * Helper: uploadBufferToCloudinary
 * returns the upload result object (including secure_url and public_id)
 */
function uploadBufferToCloudinary(buffer, folder = "categories") {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder, resource_type: "image", transformation: [{ quality: "auto" }] },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(uploadStream);
    });

};

/**
 * Create category
 * Expects multipart/form-data (fields: name, description, file field "image")
 */

exports.createCategory = async (req, res) => {
    const { name } = req.body;

    try {
        if (!name) return res.status(400).json({ msg: "name is required" });
        const isExist = await Category.findOne({ name: name });
        if (isExist) return res.status(400).json({ msg: "Category is already exist" });
        let imageUrl = null;
        let publicId = null;

        if (req.file && req.file.buffer) {
            const result = await uploadBufferToCloudinary(req.file.buffer, "categories");
            imageUrl = result.url;
            publicId = result.public_id;
        }

        const category = new Category({
            name: name,
            image: imageUrl,
            imagePublicId: publicId,
        });
        await category.save();
        res.status(200).json({ msg: "New category saved!", category });
    } catch (error) {
        res.status(500).json({ msg: "Server error ", error: error.message });

    }
};

exports.getCategoryById = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ msg: "Invalid id", CurrentId: id });
    }
    try {
        const category = await Category.findById(id);
        if (!category) return res.status(404).json({ msg: "Category not found!" });

        res.json({ category });
    } catch (error) {
        res.status(500).json({ msg: "Server error ", error: error.message });
    }
}

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find();
        res.json({ categories });
    } catch (error) {
        res.status(500).json({ msg: "Server error ", error: error.message });

    }
}

exports.editCategory = async (req, res) => {
    const { id } = req.params;
    console.log("req is : ", req.body);
    const { name } = req.body;
    try {
        const category = await Category.findById(id);
        if (!category) return res.status(404).json({ msg: "Category not found!" });

        //Handle if new image provided
        console.log("req.file:", req.file);

        if (req.file && req.file.buffer) {
            const result = await uploadBufferToCloudinary(req.file.buffer, "categories");
            const newUrl = result.url;
            const newPublicId = result.public_id;

            //Delete old image from cloudinary if exist.
            if (category.imagePublicId) {
                try {
                    await cloudinary.uploader.destroy(category.imagePublicId, { resource_type: "image" });
                } catch (delErr) {
                    console.warn("Failed to delete old cloudinary image : ", delErr.message);
                }
            }
            category.image = newUrl;
            category.imagePublicId = newPublicId;
        }

        if (name) category.name = name;
        await category.save();

        return res.json({ category });
    } catch (error) {
        res.status(500).json({ msg: "Server error" });

    }
}

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findById(id);
        if (!category) return res.status(404).json({ msg: "Category not found!" });

        //Delete all the services related to this category.
        const services = await Service.find({ category: id });
        if(!services) return res.status(404).json({msg: "Services not found"});

        //Delete service images in cloudinary(if any).
        for (const svc of services) {
            if (svc.imagePublicId) {
                try {
                    await cloudinary.uploader.destroy(svc.imagePublicId, { resource_type: "image" });
                } catch (error) {
                    console.warn(`Failed to delete service image (public_id=${svc.imagePublicId}): `, error.message);
                }
            }
        }

        // 3) Remove services from DB
       const deletedServices = await Service.deleteMany({ category: id });
       console.log("Deleted services are : ", deletedServices);

        //Delete image from cloudinary if we have public id
        if (category.imagePublicId) {
            try {
                await cloudinary.uploader.destroy(category.imagePublicId, { resource_type: "image" });
            } catch (error) {
                console.warn("Failed to delete Cloudinary image:", err.message);
            }

        }

        await category.deleteOne();
        return res.json({ msg: "Category deleted" });
    } catch (error) {
        console.error("DeleteCategory error : ", err);
        return res.status(500).json({ msg: "Server error" });
    }
};
