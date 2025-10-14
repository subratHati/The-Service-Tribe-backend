// controllers/popularController.js
const Popular = require("../models/PopularModel");
const Service = require("../models/ServiceModel"); // adjust path if your Service model filename differs
const mongoose = require("mongoose");

// Helper to ensure single doc exists
async function getOrCreateDoc() {
  let doc = await Popular.findOne();
  if (!doc) {
    doc = await Popular.create({ services: [] });
  }
  return doc;
}

// GET /api/service/popular
exports.getPopular = async (req, res) => {
  try {
    const doc = await getOrCreateDoc();
    // populate in order
    await doc.populate({
      path: "services",
      model: "Service",
    });
    return res.json({ services: doc.services });
  } catch (err) {
    console.error("getPopular error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
};

// POST /api/service/popular
// body: { serviceId, position? } (position optional: integer index)
exports.addPopular = async (req, res) => {
  try {
    const { serviceId, position } = req.body;
    if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ msg: "Invalid serviceId" });
    }

    const svc = await Service.findById(serviceId);
    if (!svc) return res.status(404).json({ msg: "Service not found" });

    const doc = await getOrCreateDoc();

    // Prevent duplicates
    const exists = doc.services.some(id => id.equals(serviceId));
    if (exists) return res.status(400).json({ msg: "Service already in popular list" });

    if (typeof position === "number" && position >= 0 && position <= doc.services.length) {
      doc.services.splice(position, 0, serviceId);
    } else {
      doc.services.push(serviceId);
    }

    await doc.save();
    await doc.populate("services");
    return res.json({ msg: "Added to popular", services: doc.services });
  } catch (err) {
    console.error("addPopular error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
};

// DELETE /api/service/popular/:serviceId
exports.removePopular = async (req, res) => {
  try {
    const { serviceId } = req.params;
    if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ msg: "Invalid serviceId" });
    }

    const doc = await getOrCreateDoc();
    const after = doc.services.filter(id => !id.equals(serviceId));
    doc.services = after;
    await doc.save();
    await doc.populate("services");
    return res.json({ msg: "Removed from popular", services: doc.services });
  } catch (err) {
    console.error("removePopular error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
};

// PATCH /api/service/popular/reorder
// body: { orderedIds: [id1, id2, ...] } - replaces ordering (admin)
exports.reorderPopular = async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ msg: "orderedIds required" });

    // validate ids
    const valid = orderedIds.every(id => mongoose.Types.ObjectId.isValid(id));
    if (!valid) return res.status(400).json({ msg: "Invalid id in orderedIds" });

    const doc = await getOrCreateDoc();
    // ensure only valid services (intersect)
    const existingSet = new Set((await Service.find({ _id: { $in: orderedIds } })).map(s => s._id.toString()));
    const filtered = orderedIds.filter(id => existingSet.has(id.toString()));
    doc.services = filtered;
    await doc.save();
    await doc.populate("services");
    return res.json({ msg: "Reordered popular list", services: doc.services });
  } catch (err) {
    console.error("reorderPopular error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
};
