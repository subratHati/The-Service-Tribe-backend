const mongoose = require("mongoose");

const connectDB = async() => {
    try {
        const connect = await mongoose.connect(process.env.MONGO_CLOUD_URI, {
            
        });
        console.log("Mongo connected!");
    } catch (error) {
        console.log("Mongo error : ", error);
    }
}

module.exports = connectDB;