const User = require("../models/UserModel");
const jwt = require("jsonwebtoken");


const verifyToken = async(req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
       return res.status(401).json({ msg: "No token, authorization denied" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // console.log("Decoded JWT:", decoded); 
        const user = await User.findById(decoded.id).select('-password');
        if(!user) return res.status(404).json({msg: "User not found"});
        req.user = user;
        next();
    } catch (error) {
         console.error("JWT Error:", error.message);
        res.status(401).json({msg: "Token is not valid"});
    }
};

module.exports = verifyToken;