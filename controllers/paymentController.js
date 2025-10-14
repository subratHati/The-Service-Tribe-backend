// backend/controllers/paymentController.js
require("dotenv").config();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Booking = require("../models/BookingModel");
const Payment = require("../models/PaymentModel");
const BookingModel = Booking; // same alias
const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Mock payment (for testing without gateway)
exports.mockPayment = async (req, res) => {
  const { amount } = req.body;
  try {
    if (!amount) return res.status(400).json({ msg: "Amount is required" });
    const mockPaymentId = "mockpay_" + Date.now();
    return res.json({ success: true, paymentId: mockPaymentId, amount });
  } catch (error) {
    console.error("mockPayment error :", error);
    return res.status(500).json({ msg: "Payment error", error: error.message });
  }
};

/**
 * createOrder
 * Accepts:
 *  - bookingId (optional) OR
 *  - bookingPayload (preferred for your flow) OR
 *  - amountInPaise (adhoc)
 *
 * Returns orderId, amount (paise), currency and key id.
 */
exports.createOrder = async (req, res) => {
  try {
    const { bookingId, bookingPayload, amountInPaise, notes } = req.body;
    let amountPaise;
    let receipt = `rcpt_${Date.now()}`;
    let currency = "INR";

    // Case A: bookingId provided (not used in your current flow but supported)
    if (bookingId) {
      const booking = await Booking.findById(bookingId).lean();
      if (!booking) return res.status(404).json({ msg: "Booking not found!" });

      // derive amount defensively
      const price = Number(booking.totalAmount ?? booking.servicePriceAtBooking ?? 0);
      if (!price || price <= 0) return res.status(400).json({ msg: "Invalid booking amount" });
      amountPaise = Math.max(1, Math.round(price * 100));
      receipt = `bk_${booking._id}_${Date.now()}`;

      const order = await rzp.orders.create({
        amount: amountPaise,
        currency,
        receipt,
        notes: notes || { bookingId },
      });

      // store Payment
      await Payment.create({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        status: "created",
        bookingId: bookingId,
        userId: req.user?._id || null,
      });

      return res.json({ orderId: order.id, amount: order.amount, currency: order.currency, key: process.env.RAZORPAY_KEY_ID });
    }

    // Case B: bookingPayload provided (your front-end flow)
    if (bookingPayload) {
      // Expect bookingPayload: { items: [{serviceId, quantity}], address: {...}, scheduleAt, total }
      const payload = bookingPayload;
      const payloadTotal = Number(payload.total ?? payload.amount ?? 0);

      let total = 0;
      if (!isNaN(payloadTotal) && payloadTotal > 0) {
        total = payloadTotal;
      } else {
        // fallback: compute from items
        const items = Array.isArray(payload.items) ? payload.items : [];
        for (const it of items) {
          const price = Number(it.serviceId?.price ?? it.price ?? 0);
          const qty = Number(it.quantity ?? 1);
          total += (isNaN(price) ? 0 : price) * (isNaN(qty) ? 1 : qty);
        }
      }

      if (!total || total <= 0) return res.status(400).json({ msg: "Invalid booking payload total" });

      amountPaise = Math.round(total * 100);
      receipt = `bk_payload_${Date.now()}`;

      // gather item refs (service ids) defensively
      const itemsArr = Array.isArray(payload.items) ? payload.items : [];
      const itemRefs = itemsArr.map(it => {
        if (!it) return null;
        if (it.serviceId) {
          if (typeof it.serviceId === "object") return it.serviceId._id ?? it.serviceId.id ?? JSON.stringify(it.serviceId);
          return String(it.serviceId);
        }
        return null;
      }).filter(Boolean);

      const order = await rzp.orders.create({
        amount: amountPaise,
        currency,
        receipt,
        notes: notes || { note: "multi-item booking" },
      });

      // store Payment record with bookingPayload snapshot
      await Payment.create({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        status: "created",
        bookingPayload: payload,
        itemRefs,
        userId: req.user?._id || null,
      });

      return res.json({ orderId: order.id, amount: order.amount, currency: order.currency, key: process.env.RAZORPAY_KEY_ID });
    }

    // Case C: adhoc amountInPaise
    if (amountInPaise) {
      const amt = Number(amountInPaise);
      if (!amt || amt <= 0) return res.status(400).json({ msg: "Invalid amountInPaise" });
      const order = await rzp.orders.create({ amount: amt, currency, receipt, notes: notes || {} });
      await Payment.create({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        status: "created",
        userId: req.user?._id || null,
      });
      return res.json({ orderId: order.id, amount: order.amount, currency: order.currency, key: process.env.RAZORPAY_KEY_ID });
    }

    return res.status(400).json({ msg: "bookingId or bookingPayload or amountInPaise required" });
  } catch (err) {
    console.error("createOrder error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
};

/**
 * verifyPayment
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * - verifies signature
 * - updates Payment record
 * - if Payment has bookingPayload (no bookingIds), create Booking docs now and assign bookingIds
 * - if Payment had bookingId or bookingIds already, mark them paid
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return res.status(400).json({ msg: "Missing fields" });

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(body).digest("hex");
    const valid = expected === razorpay_signature;

    const payment = await Payment.findOne({ orderId: razorpay_order_id });
    if (!payment) return res.status(404).json({ msg: "Payment record not found" });

    payment.paymentId = razorpay_payment_id;
    payment.signature = razorpay_signature;
    payment.status = valid ? "paid" : "failed";
    await payment.save();

    if (!valid) return res.status(400).json({ msg: "Signature mismatch" });

    // If payment has bookingPayload and no bookingIds => create Booking docs now
    if ((!payment.bookingIds || payment.bookingIds.length === 0) && payment.bookingPayload) {
      const payload = payment.bookingPayload;
      const items = Array.isArray(payload.items) ? payload.items : [];
      const createdBookingIds = [];

      for (const item of items) {
        // serviceId may be an object or a string id
        let serviceId = null;
        let serviceName = "Service";
        let priceAtBooking = 0;
        let qty = Number(item.quantity ?? 1);

        if (item.serviceId) {
          if (typeof item.serviceId === "object") {
            serviceId = item.serviceId._id ?? item.serviceId.id ?? null;
            serviceName = item.serviceId.name ?? serviceName;
            priceAtBooking = Number(item.serviceId.price ?? item.serviceId.priceAtBooking ?? 0);
          } else {
            serviceId = item.serviceId;
            priceAtBooking = Number(item.price ?? 0); // fallback
          }
        } else {
          priceAtBooking = Number(item.price ?? 0);
        }

        // fallback: if price still 0 and payload.total present, distribute proportionally
        // For simplicity: compute totalPerItem = priceAtBooking * qty
        const totalAmount = Math.max(0, priceAtBooking) * Math.max(1, qty);

        // Build address string (BookingModel.address expects string)
        let addressStr = "";
        if (payload.address) {
          if (typeof payload.address === "string") addressStr = payload.address;
          else {
            const a = payload.address;
            const parts = [];
            if (a.line1) parts.push(a.line1);
            if (a.city) parts.push(a.city);
            if (a.pincode) parts.push(a.pincode);
            addressStr = parts.join(", ");
          }
        }

        // scheduling
        let sched = payload.scheduleAt ? new Date(payload.scheduleAt) : new Date();

        const bookingDoc = new BookingModel({
          user: req.user?._id || null,
          service: serviceId,
          serviceName: serviceName,
          servicePriceAtBooking: priceAtBooking,
          quantity: qty,
          totalAmount: totalAmount,
          scheduledAt: sched,
          address: addressStr || "—",
          notes: payload.notes || "",
          status: "confirmed",
          paymentStatus: "paid",
        });

        const saved = await bookingDoc.save();
        createdBookingIds.push(saved._id);
      }

      // attach created booking ids to payment record
      payment.bookingIds = createdBookingIds;
      await payment.save();
    } else if (payment.bookingId) {
      // single booking exists: mark paid
      await Booking.findByIdAndUpdate(payment.bookingId, { paymentStatus: "paid", status: "confirmed" });
    } else if (Array.isArray(payment.bookingIds) && payment.bookingIds.length > 0) {
      await Booking.updateMany({ _id: { $in: payment.bookingIds } }, { $set: { paymentStatus: "paid", status: "confirmed" } });
    }

    return res.json({ msg: "Payment verified", paymentId: razorpay_payment_id });
  } catch (err) {
    console.error("verifyPayment error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
};

/**
 * webhook - raw body already parsed in server.js for route /api/payment/webhook
 */
exports.webhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (secret) {
      const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
      if (expected !== signature) return res.status(401).json({ msg: "Invalid webhook signature" });
    }

    const event = req.body?.event;
    const payload = req.body?.payload;

    if (event === "payment.captured") {
      const orderId = payload?.payment?.entity?.order_id;
      const paymentId = payload?.payment?.entity?.id;
      const payment = await Payment.findOneAndUpdate({ orderId }, { status: "paid", paymentId }, { new: true });

      // update booking(s) if present
      if (payment?.bookingId) {
        await Booking.findByIdAndUpdate(payment.bookingId, { paymentStatus: "paid", status: "confirmed" });
      } else if (Array.isArray(payment?.bookingIds) && payment.bookingIds.length > 0) {
        await Booking.updateMany({ _id: { $in: payment.bookingIds } }, { $set: { paymentStatus: "paid", status: "confirmed" } });
      } else {
        // nothing to do — payload kept for manual reconciliation
        console.warn("Webhook: payment captured but no associated booking ids");
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("webhook error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
};
