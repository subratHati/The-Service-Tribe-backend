const City = require("../models/CityModel");

exports.addCity = async(req, res) => {
    const {city} = req.body;
    try {
        if(!city) return res.status(400).json({msg: "City name is required"});
        const isExist = await City.findOne({name: city});
        if(isExist) return res.json({msg: "City is already exist"});

        const newCity = new City({name: city, isAvailable: false});
        await newCity.save();

        res.status(200).json({msg: "City added", City: city});
    } catch (error) {
        res.status(500).json({msg: "Server error ", error: error.message});
        
    }
};

exports.listCities = async(req, res) => {
    try {
        const list = await City.find({}, {name: 1, isAvailable: 1}).sort({name: 1});
        res.json(list);
    } catch (error) {
        res.status(500).json({msg: "Server error ", error: error.message});
    }
}

exports.setAvailability = async(req, res) => {
    const {city, isAvailable} = req.body;
    try {
        const result = await City.findOneAndUpdate({name: city}, {isAvailable}, {new: true});
        console.log(result);

        if(!result) return res.status(404).json({msg: "City not found!"});
        res.json({msg: "Availability updated"});
    } catch (error) {
        res.status(500).json({msg:"Server error", error: error.message});
        
    }
}