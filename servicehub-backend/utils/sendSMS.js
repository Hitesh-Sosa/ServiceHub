const twilio = require("twilio");

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // Ensure both SID and Auth Token exist and SID starts with 'AC'
  if (!accountSid || !authToken || !accountSid.startsWith("AC")) {
    return null;
  }

  return twilio(accountSid, authToken);
}

async function sendOtpSms(toMobile, otp) {
  const client = getTwilioClient();

  if (!client || !process.env.TWILIO_PHONE_NUMBER) {
    console.log(`\n[DEV MODE] Simulated OTP for ${toMobile}: ${otp}\n`);
    return { devMode: true };
  }

  // Ensure international standard formatting (+ country code)
  let formattedNumber = String(toMobile).trim();
  if (!formattedNumber.startsWith("+")) {
    formattedNumber = `+${formattedNumber}`;
  }

  try {
    const message = await client.messages.create({
      body: `Your ServiceHub verification code is ${otp}. It expires in 1 minute.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedNumber,
    });

    console.log(`[SMS SUCCESS] Sent to ${formattedNumber}. SID: ${message.sid}`);
    return { devMode: false, sid: message.sid };
  } catch (error) {
    console.error("Twilio API Rejected Request:", error.message);
    throw new Error(`Twilio SMS Failure: ${error.message}`);
  }
}

module.exports = { sendOtpSms };
