const Technician = require("../models/TechnicianModel"); 

exports.createTechnician = async(req, res) => {
    const {name, phoneNumber, skills} = req.body;
    try {
       const isExist = await Technician.findOne({phoneNumber});
       if(isExist){
        return res.status(400).json({msg: "This phone number is already registered"});
       }
       const tech = await Technician.create({
        name,
        phoneNumber,
        skills
       });

       res.status(200).json({msg: "Technician created successfully", technician: tech});
    } catch (error) {
        res.status(500).json({msg: "Server error", error: error.message});
    }
}