const crypto = require('crypto');

//generate 6 digit otp as string.
function generateOtp(len = 6) {
    const max = Math.pow(10, len) -1;
    const min = Math.pow(10, len-1);
    const num = Math.floor(Math.random() * (max - min + 1)) + min ;
    return String(num);
};


function hashOtp(otp){
    const salt = process.env.OTP_HASH_SALT;
    return crypto.createHash("sha256").update(String(otp) + salt).digest("hex");
    
}

module.exports = {generateOtp, hashOtp};