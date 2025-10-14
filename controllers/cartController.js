const Cart = require("../models/CartModel");

exports.getCart = async(req, res) => {

    try {
        const cart = await Cart.findOne({userId: req.user._id}).populate("items.serviceId");
        return res.json(cart || {items: []});

    } catch (error) {
        console.log(error);
        return res.status(500).json({msg: "Server error ", error: error.message});
    }
}

exports.addToCart = async(req, res) => {
    const {serviceId} = req.body;
    try {
        let cart = await Cart.findOne({userId: req.user._id});
        if(!cart) cart = new Cart({userId: req.user._id, items: []});

        //check if service is already add to cart. if yes then increase its quantity and if no then only add to cart.
        const existing = cart.items.find(i => i.serviceId.toString() === serviceId);
        if(existing){
            existing.quantity+=1;
        }else{
            cart.items.push({serviceId, quantity: 1});
        }

        await cart.save();
        await cart.populate("items.serviceId");
        res.json(cart);
    } catch (error) {
        res.status(500).json({msg: "Server error ", error: error.message});
    }
};

exports.removeFromCart = async(req, res) => {
    const {serviceId} = req.params;
    try {
        const cart = await Cart.findOne({userId: req.user._id});
        if(!cart) return res.json({items: []});

        const item = cart.items.find(i => i.serviceId.toString() === serviceId);
        if(item){
            if(item.quantity > 1){
                item.quantity -= 1;
            }else{
                cart.items = cart.items.filter(i => i.serviceId.toString() !== serviceId);
            }
        }

        await cart.save();
        await cart.populate("items.serviceId");
        res.json(cart);
    } catch (error) {
        res.status(500).json({msg: "Server error ", error: error.message});
    }
}

exports.clearCart = async(req, res) => {
    try {
        await Cart.findOneAndUpdate({userId: req.user._id}, {items: []}, {upsert: true});
        res.json({items: []});
    } catch (error) {
        res.status(500).json({msg: "Server error ", error: error.message});
    }
}