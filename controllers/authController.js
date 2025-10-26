require("dotenv").config();
const User = require("../models/UserModel");
const passport = require("passport");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { generateOtp, hashOtp, verifyOtpHash } = require("../utils/otp");
const sendEmail = require("../utils/email");
const { verifyEmailTemplate, resetPasswordTemplate } = require("../utils/emailTemplates");


const JWT_SECRET = process.env.JWT_SECRET || "change_this";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";
const OTP_EXPIRE_MIN = Number(process.env.OTP_EXPIRE_MIN || 10);
const OTP_SALT = process.env.OTP_HASH_SALT || "change_this_salt";
const BCRYPT_SALT_ROUND = Number(process.env.BCRYPT_SALT_ROUND || 10);

function createSendToken(user, res) {
    const payload = { id: user._id, phone: user.phoneNumber, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return token;
}

exports.register = async (req, res) => {
    try {
        const { name, email, phoneNumber, password, role } = req.body;
        if (!name || !email || !phoneNumber || !password) {
            return res.status(400).json({ msg: "Please provide the necessary details" });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser.isVerified) return res.status(400).json({ msg: "Email already registered", email: email });

        //Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const now = new Date();
        await User.deleteMany({ email: email, isVerified: false });

        //create now account
        const user = new User({
            name,
            email,
            phoneNumber,
            password: hashedPassword,
            role: role || "user",
        });

        //Generate OTP.
        const otpPlain = generateOtp(6);
        user.otp = hashOtp(otpPlain);
        user.otpExpiry = new Date(Date.now() + OTP_EXPIRE_MIN * 60 * 1000);

        await user.save();

        //Send OTP by email.
        const subject = "Your verification code";
        const text = `Hello ${name}, Your OTP is ${otpPlain}`;

        await sendEmail(email, subject, text, verifyEmailTemplate(name, otpPlain));


        res.status(200).json({ msg: "User registered successfully! OTP send to your email", email: email });

    } catch (error) {
        console.log("Server error : ", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!otp) return res.status(400).json({ msg: "OTP is required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ msg: "User not found!" });
        if (user.isVerified) return res.status(400).json({ msg: "Email already verified" });

        if (new Date() > user.otpExpiry) {
            user.otp = null;
            user.otpExpiry = null,

                await user.save();
            return res.status(400).json({ msg: "OTP expired" });
        }
        if (hashOtp(otp) !== user.otp) {
            return res.status(400).json({ msg: "Invalid OTP" });
        }

        // Verified: clear otp and mark verified
        user.isVerified = true;
        user.otp = null;
        user.otpExpiry = null;
        user.otpPurpose = null;
        await user.save();

        // optional: auto-login
       const token = createSendToken(user, res);
        return res.json({ msg: "Email verified", token, user: { id: user._id, email: user.email, name: user.name } });
    } catch (error) {
        console.error("verifyEmail error:", err);
        return res.status(500).json({ msg: "Server error" });
    }
}

//Request password reset.
exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        console.log("Now the req.email is : ", email);
        if (!email) return res.status(400).json({ msg: "email required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ msg: "No account with this email" });

        const otpPlain = generateOtp(6);
        user.otp = hashOtp(otpPlain);
        user.otpExpiry = new Date(Date.now() + OTP_EXPIRE_MIN * 60 * 1000);
        await user.save();

        const subject = "Password reset code";
        const text = `Hi ${user.name},
      Your password reset code is ${otpPlain}. It expires in ${OTP_EXPIRE_MIN} minutes.`;

        await sendEmail(email, subject, text, resetPasswordTemplate(user.name, otpPlain));

        return res.json({ msg: "Password reset OTP sent" });
    } catch (error) {
        console.error("requestPasswordReset error:", error);
        return res.status(500).json({ msg: "Server error" });
    }
};

//Reset password.
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        console.log("Email is ", email);
        console.log("otp is ", otp);
        console.log("pwd is ", newPassword);
        if (!otp || !newPassword) return res.status(400).json({ msg: "otp and newPassword required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ msg: "No account with this email" });


        if (new Date() > user.otpExpiry) {
            user.otp = null;
            user.otpExpiry = null;
            await user.save();
            console.log("OTP expires");
            return res.status(400).json({ msg: "OTP expired" });
        }

        if (hashOtp(otp) !== user.otp) {
            console.log("Invalid OTP");
            return res.status(400).json({ msg: "Invalid OTP" });
        }

        const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUND);
        user.password = await bcrypt.hash(newPassword, salt);

        // clear otp fields
        user.otp = null;
        user.otpExpiry = null;
        user.otpPurpose = null;
        await user.save();

        return res.json({ msg: "Password updated" });
    } catch (err) {
        console.error("resetPassword error:", err);
        return res.status(500).json({ msg: "Server error" });
    }
};

exports.updatePhoneNumber = async (req, res) => {
    try {
        console.log("User is : ", req.user);
        const { phone } = req.body;
        if (!phone || typeof phone !== "string" || phone.trim().length < 6) {
            return res.status(400).json({ msg: "Please enter a valid phone number" });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: "User not found" });

        // optional: normalize/trim
        user.phoneNumber = phone.trim();

        await user.save();
        return res.json({ msg: "Phone number updated", phoneNumber: user.phoneNumber });
    } catch (error) {
        console.error("phone number update error:", error);
        return res.status(500).json({ msg: "Server error" });
    }
};

//resend otp.
exports.resendOtp = async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ msg: "Email is required" });

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ msg: "User not found" });
        if (user.isVerified) return res.status(400).json({ msg: "User is already verified" });

        // Generate new OTP
        const otpPlain = generateOtp(6);
        user.otp = hashOtp(otpPlain);
        user.otpExpiry = new Date(Date.now() + OTP_EXPIRE_MIN * 60 * 1000);
        await user.save();

        // Send OTP via email
        const subject = "Resend verification code";
        const text = `Hello ${user.name},
      Your OTP is ${otpPlain}. It expires in ${OTP_EXPIRE_MIN} minutes.`;

        await sendEmail(email, subject, text, verifyEmailTemplate(user.name, otpPlain));

        return res.json({ msg: "Resend verification code" });

    } catch (error) {
        console.error("Resend OTP error:", error);
        res.status(500).json({ msg: "Server error. Please try again later." });
    }
}


//Login function
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ msg: "Fill the required fields" });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ msg: "User not found!" });

        //compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: "Invalid email or passowrd" });
        }

        //generate token
        const token = createSendToken(user, res);

        res.status(200).json({
            msg: "Login successful",
            token,
            user: {
                id: user._id,
                email: email,
                role: user.role,
            }
        });

    } catch (error) {
        res.status(500).json({ msg: "Server error", error: error.message });
    }
}

//Google login.
exports.googleCallback = async (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, data) => {
        if (err) {
            console.error("Google auth error ", err);
            //redirect to frontend with error.
            return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'} /oauth-error?msg=${encodeURIComponent(err.message)}`);

        }
        if (!data || !data.token) {
            return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/oauth-error?msg=NoToken`);
        }
        // set cookie same as createSendToken
        res.cookie("token", data.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 1000 * 60 * 60 * 24 * 7,
        });
        // redirect back to frontend success page
        return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/oauth-success`);
    })(req, res, next);
};


exports.logout = async (req, res) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Lax",
            path: "/"
        });

        res.json({ msg: "Logout successful" });
    } catch (error) {
        res.status(500).json({ msg: "Server error" });

    }
}

// exports.getProfile = async (req, res) => {
//     console.log("Current user is calling...");
//     try {
//         res.json({ msg: "Profile fetched successfully!", user: req.user });
//     } catch (error) {
//         res.status(500).json({ msg: "Server error" });
//     }
// }

exports.currentUser = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ msg: "Unauthorized" });

        const decode = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decode.id).select("-password");
        if (!user) return res.status(404).json({ msg: "User not found" });

        return res.json(user);

    } catch (error) {
        res.status(401).json({ msg: "Unauthorized" });

    }
}