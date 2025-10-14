const isAdmin = async(req, res, next) => {
    try {
        if(!req.user) return res.status(400).json({msg: "Not authenticated"});
        if(req.user.role !== "admin"){
            return res.status(403).json({msg: "Admin only route"});
        }
        next();
    } catch (error) {
        res.statu(500).json({msg: "Server error", error:error.message});
    }
}

module.exports = isAdmin;