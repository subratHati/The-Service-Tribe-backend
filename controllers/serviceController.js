// controllers/serviceController.js
const Service = require("../models/ServiceModel");
const Category = require("../models/CategoryModel");
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary"); // adjust path if you use a wrapper


/**
 * Helper: uploadBufferToCloudinary
 * returns the upload result object (including secure_url and public_id)
 */
async function uploadBufferToCloudinary(buffer, folder = "services") {
  return new Promise((resolve, reject) => {
    const streamifier = require("streamifier");
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

exports.addService = async (req, res) => {
  try {
    const { name, category, description, price } = req.body;

    if (!name || !category || !description || price == null) {
      return res.status(400).json({ msg: "Please provide name, category, description and price" });
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ msg: "please provide a valid category id" });
    }

    const existingService = await Service.findOne({ name: name.trim() });
    if (existingService) return res.status(400).json({ msg: "Service already exist" });

    const serviceData = {
      name: name.trim(),
      category,
      description,
      price: Number(price),
    };

    // handle image upload if provided (multer memory buffer available at req.file.buffer)
    if (req.file && req.file.buffer) {
      const result = await uploadBufferToCloudinary(req.file.buffer, "services");
      serviceData.image = result.url;
      serviceData.imagePublicId = result.public_id;
    }

    const service = new Service(serviceData);
    await service.save();

    // Update category count (safe)
    await Category.findByIdAndUpdate(category, { $inc: { count: 1 } });

    res.status(200).json({ msg: "Service added successfully", service });
  } catch (error) {
    console.error("addService error:", error);
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

exports.getAllServices = async (req, res) => {
  try {
    const services = await Service.find().populate("category");
    if (!services) return res.status(404).json({ msg: "No service found!" });
    res.json(services);
  } catch (error) {
    console.error("getAllServices error:", error);
    res.status(500).json({ msg: "Server error ", error: error.message });
  }
};

exports.getServiceById = async (req, res) => {
  const { serviceId } = req.params;

  try {
    const service = await Service.findById(serviceId).populate("category");
    if (!service) return res.status(404).json({ msg: "Service not found!" });
    res.json(service);
  } catch (error) {
    console.error("getServiceById error:", error);
    res.status(500).json({ msg: "Server error ", error: error.message });
  }
};

exports.getServicesByCategory = async (req, res) => {
  const { id } = req.params;
  try {
    if (!id) return res.status(400).json({ msg: "Category is required" });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ msg: "Invalid category" });

    const services = await Service.find({ category: id }).populate("category");
    if (!services || services.length === 0) return res.json([]);
    return res.json(services);
  } catch (error) {
    console.error("getServicesByCategory error:", error);
    return res.status(500).json({ msg: "Server error ", error: error.message });
  }
};

exports.updateService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { name, category, description, price } = req.body;

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ msg: "Invalid service id" });
    }

    const update = {};
    if (name) update.name = name.trim();
    if (description) update.description = description;
    if (price != null) update.price = Number(price);

    // handle image upload: if new file provided, upload and delete old image
    if (req.file && req.file.buffer) {
      // fetch current service to remove old image if present
      const existing = await Service.findById(serviceId);
      if (!existing) return res.status(404).json({ msg: "Service not found!" });

      // upload new image
      const result = await uploadBufferToCloudinary(req.file.buffer, "services");
      update.image = result.url;
      update.imagePublicId = result.public_id;

      // delete old cloudinary asset if exists
      if (existing.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(existing.imagePublicId, { resource_type: "image" });
        } catch (delErr) {
          console.warn("Failed to delete old service image:", delErr.message);
        }
      }
    }

    // optionally allow changing category reference (if provided and valid)
    if (category) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ msg: "Invalid category id" });
      }
      update.category = category;
    }

    const service = await Service.findByIdAndUpdate(serviceId, update, { new: true }).populate("category");
    if (!service) return res.status(404).json({ msg: "Service not found!" });

    res.status(200).json({ msg: "Service updated", service });
  } catch (error) {
    console.error("updateService error:", error);
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ msg: "Invalid service id" });
    }

    const service = await Service.findByIdAndDelete(serviceId);
    if (!service) return res.status(404).json({ msg: "Service not found!" });

    // decrement category count
    try {
      await Category.findByIdAndUpdate(service.category, { $inc: { count: -1 } });
    } catch (err) {
      console.warn("Failed to decrement category count", err.message);
    }

    // delete cloudinary image if exists
    if (service.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(service.imagePublicId, { resource_type: "image" });
      } catch (delErr) {
        console.warn("Failed to delete service image:", delErr.message);
      }
    }

    res.json({ msg: "Service deleted" });
  } catch (error) {
    console.error("deleteService error:", error);
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};
