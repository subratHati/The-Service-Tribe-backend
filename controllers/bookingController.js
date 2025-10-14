const Booking = require("../models/BookingModel");
const Service = require("../models/ServiceModel");
const mongoose = require("mongoose");
const Technician = require("../models/TechnicianModel");
const CartModel = require("../models/CartModel");
const { generateOtp, hashOtp, verifyOtpHash } = require("../utils/otp");
const sendEmail = require("../utils/email");
const { bookingCompletionTemplate } = require("../utils/emailTemplates");

exports.createBooking = async (req, res) => {
    console.log("Create booking calling");
    try {
        const {items, scheduleAt, address, notes } = req.body;

       if(!scheduleAt || !address){
        return res.status(400).json({msg: "schedule date and address are required"});
       }

       //collect service ids and fetch them to get current prices.
       const serviceIds = items.map(it => it.serviceId);
       const services = await Service.find({_id: {$in: serviceIds}});

       //Build price map.
       const priceMap = {};
       services.forEach(s => {
        priceMap[s._id.toString()] = s.price
       });

       const createBookings = [];

       //for each booking create a separate booking document.
       for(const it of items){
        const svcId = it.serviceId._id;
        if(!mongoose.Types.ObjectId.isValid(svcId)){
            return res.status(400).json({msg: `Invalid service id: ${svcId}`});
        }

        const price = priceMap[svcId.toString()];
        const qty = it.quantity;
        const totalPrice = price * qty;

         const bookingDocs = new Booking({
            user: req.user._id,
            service: svcId,
            serviceName: services.find(s=> s._id.toString() === svcId.toString()).name,
            servicePriceAtBooking: price,
            quantity: qty,
            totalAmount: totalPrice,
            scheduledAt: new Date(scheduleAt),
            address: address.line1,
            notes,
            status: "pending",
            paymentStatus: "paid"
        });

        await bookingDocs.save();

        //populate service details for response.
        await bookingDocs.populate("service");

        createBookings.push(bookingDocs);
    }


        //clear user's cart once after create all the bookings.
        await CartModel.findOneAndUpdate({userId: req.user._id}, {items:  []}, {upsert: true});

        //compute combined amount.
        const combinedAmount = createBookings.reduce((s, b) => s+ (b.totalAmount), 0);

        return res.json({
            bookings: createBookings,
            amount: combinedAmount,
            status: "paid",

        });
       

    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error", error: error.message });

    }

};

exports.getAllBookings = async(req, res) => {
    try {
        const bookings = await Booking.find()
        .populate("user")
        .populate("service")
        .sort({createdAt: -1});
        return res.status(200).json({bookings});
    } catch (error) {
        res.status(500).json({msg: "Server error ", error: error.message});
    }

} 

exports.getMyBookings = async (req, res) => {
    const userId = req.user._id;
    try {
        const bookings = await Booking
            .find({ user: userId })
            .sort({ createdAt: -1 });

        return res.json(bookings);
    } catch (error) {
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};

    exports.getBookingById = async (req, res) => {
        const { bookingId } = req.params;
        try {
            if (!mongoose.Types.ObjectId.isValid(bookingId)) {
                return res.status(400).json({ msg: "Invalid booking id" });
            }

            const booking = await Booking.findById(bookingId);
            if (!booking) return res.status(404).json({ msg: "Booking not found!" });

            return res.json(booking);
        } catch (error) {
            res.status(500).json({ msg: "Server error", error: error.message });

        }
    };

    exports.updateStatus = async (req, res) => {
        const { status } = req.body;
        const { bookingId } = req.params;

        try {
            if (!mongoose.Types.ObjectId.isValid(bookingId)) {
                return res.status(400).json({ msg: "Invalid booking id" });
            }

            const allowed = ["pending", "confirmed", "in_progress", "completed", "cancelled"];
            if (!allowed.includes(status)) {
                return res.status(400).json({ msg: "Invalid status value" });
            }

            const booking = await Booking.findByIdAndUpdate(
                bookingId,
                { status },
                { new: true });

                if(!booking) return res.status(404).json({msg: "Booking not found!"});
                res.status(200).json({msg: "Status updated", booking});
        } catch (error) {
            res.status(500).json({msg: "Server error", error: error.message});
        }
    };

    exports.cancelMyBooking = async(req, res) => {
        const {bookingId} = req.params;
        const {reason} = req.body;
        console.log("Reason is : ", reason);

        try {
            if(!mongoose.Types.ObjectId.isValid(bookingId)){
                return res.status(400).json({msg: "Invalid booking id"});
            }

            const booking = await Booking.findById(bookingId);
            if(!booking){
                return res.status(404).json({msg: "Booking not found!"});
            }

            if(["in_progress", "completed"].includes(booking.status)){
                return res.status(400).json({msg: "Cannot cancel after job has started/completed"});
            }

            booking.status = "cancelled";
            booking.notes = reason;
            await booking.save();
            res.status(200).json({msg: "Booking cancelled", booking});
        } catch (error) {
            res.status(500).json({msg: "Server error", error:error.message});
            
        }
    };


    exports.assignBooking = async(req, res) => {
        const {bookingId} = req.params;
        const {technicianId} = req.body;
        try {
            if(!mongoose.Types.ObjectId.isValid(bookingId)){
                return res.status(400).json({msg: "Invalid booking Id"});
            }
            if(!mongoose.Types.ObjectId.isValid(technicianId)){
                return res.status(400).json({msg: "Invalid technician Id"});
            }

            const technician = await Technician.findById(technicianId);
            if(!technician || !technician.active){
                return res.status(404).json({msg: "Technician not available"});
            }

            const booking = await Booking.findByIdAndUpdate(bookingId, 
               { assignTo:technicianId,
                assignAt: Date.now(),
                status: "confirmed",
                },
                {new: true}
            )
            .populate("assignTo")
            .populate("service");

            res.json({msg: "Technician assign successfully", booking});

        } catch (error) {
            res.status(500).json({msg: "Server error", error: error.message});
        }
    };

    // POST /booking/:id/send-completion-otp  (admin only)
exports.sendCompletionOtp = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id).populate("user", "email name");
    if (!booking) return res.status(404).json({ msg: "Booking not found" });

    // Only allow for bookings that are in-progress or confirmed depending on your flow
    if (["completed", "cancelled"].includes(booking.status)) {
      return res.status(400).json({ msg: "Cannot send OTP for this booking status" });
    }

    // Generate 6-digit numeric OTP
    const otp = generateOtp(6);

    // Hash and store with expiry (10 minutes) and reset attempts
    booking.otp = hashOtp(otp);
    booking.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await booking.save();

    // send email
    const to = booking.user?.email;
    if (!to) {
      // If user email isn't present, treat as error
      return res.status(400).json({ msg: "User email unavailable" });
    }

    const subject = "OTP to confirm booking completion";
    const text = `Your OTP to confirm booking (ID: ${booking._id}) is ${otp}. It will expire in 10 minutes.`;
    const name = booking.user.name;
    const bookingId = booking._id;

    await sendEmail(to, subject, text, bookingCompletionTemplate(name, otp, bookingId) );

    return res.json({ msg: "OTP sent to user's email" });
  } catch (error) {
    console.error("sendCompletionOtp error:", error);
    return res.status(500).json({ msg: "Server error" });
  }
};

// POST /booking/:id/verify-completion-otp
exports.verifyCompletionOtp = async (req, res) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ msg: "OTP is required" });

    const booking = await Booking.findById(id).populate("user", "email name");
    if (!booking) return res.status(404).json({ msg: "Booking not found" });

    // check stored hash and expiry
    if (!booking.otp || !booking.otpExpiry) {
      return res.status(400).json({ msg: "No OTP was requested for this booking" });
    }

    if (new Date() > booking.completionOtpExpires) {
      // clear otp fields
      booking.otp = null;
      booking.otpExpiry = null;
      await booking.save();
      return res.status(400).json({ msg: "OTP expired" });
    }

    const providedHash = hashOtp(otp);
    if (providedHash !== booking.otp) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    // OTP valid: mark booking completed, clear OTP fields
    booking.status = "completed";
    booking.otp = null;
    booking.otpExpiry = null;
    await booking.save();

    return res.json({ msg: "Booking marked as completed", booking });
  } catch (error) {
    console.error("verifyCompletionOtp error:", error);
    return res.status(500).json({ msg: "Server error" });
  }
};




