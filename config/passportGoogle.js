const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/UserModel");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change_this";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

module.exports = function setupPassportGoogle() {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo", // ensure modern endpoint
    },
    async function (accessToken, refreshToken, profile, done) {
      try {
        // DEBUG: uncomment if you need to inspect payload once
        // console.log("GOOGLE PROFILE:", JSON.stringify(profile, null, 2));

        // Safely extract email from a few possible places
        let email =
          (profile.emails && profile.emails[0] && profile.emails[0].value) ||
          (profile._json && profile._json.email) ||
          null;

        if (!email) {
          return done(new Error("No email from Google"));
        }

        const name =
          profile.displayName ||
          (profile.name && `${profile.name.givenName || ""} ${profile.name.familyName || ""}`.trim()) ||
          "Google User";

        let user = await User.findOne({ email });
        if (!user) {
          user = new User({
            name,
            email,
            phoneNumber: null,        // optional to collect later
            password: Math.random().toString(36).slice(2), // placeholder
            oauthProvider: "google",
            oauthId: profile.id,
            isVerified: true,
            role: "user",
          });
          await user.save();
        } else {
          let changed = false;
          if (!user.isVerified){ user.isVerified = true; changed = true}
          if (!user.oauthProvider) { user.oauthProvider = "google"; changed = true; }
          if (!user.oauthId) { user.oauthId = profile.id; changed = true; }
          if(changed) await user.save(); 
        }

        const payload = { id: user._id, phone: user.phoneNumber, role: user.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        return done(null, { user, token });
      } catch (err) {
        return done(err);
      }
    }
  ));
};
