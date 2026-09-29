require("dotenv").config();

console.log("=== Checking your .env values ===");
console.log("TWILIO_ACCOUNT_SID present:", !!process.env.TWILIO_ACCOUNT_SID);
console.log("TWILIO_ACCOUNT_SID starts with 'AC':", process.env.TWILIO_ACCOUNT_SID?.startsWith("AC"));
console.log("TWILIO_AUTH_TOKEN present:", !!process.env.TWILIO_AUTH_TOKEN);
console.log("TWILIO_AUTH_TOKEN length:", process.env.TWILIO_AUTH_TOKEN?.length || 0);
console.log("TWILIO_PHONE_NUMBER:", process.env.TWILIO_PHONE_NUMBER || "(not set)");
console.log("");

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
  console.log("STOP: One or more Twilio variables is missing or empty in your .env file.");
  console.log("Go fix .env first, then run this script again.");
  process.exit(1);
}

// ---- EDIT THIS LINE: put YOUR verified mobile number here ----
const TEST_RECIPIENT = "+919054332852"; // <-- change this to your real, verified number

console.log("=== Attempting to send a real test SMS ===");
console.log("Sending to:", TEST_RECIPIENT);
console.log("");

const twilio = require("twilio");
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

client.messages
  .create({
    body: "ServiceHub test message - if you got this, Twilio is working correctly.",
    from: process.env.TWILIO_PHONE_NUMBER,
    to: TEST_RECIPIENT,
  })
  .then((message) => {
    console.log("SUCCESS! Message sent.");
    console.log("Message SID:", message.sid);
    console.log("Status:", message.status);
    console.log("");
    console.log("Check your phone now - it should arrive within a few seconds.");
  })
  .catch((err) => {
    console.log("FAILED. Twilio rejected the request.");
    console.log("Error code:", err.code);
    console.log("Error message:", err.message);
    console.log("");
    console.log("Common error codes:");
    console.log("  21608 = recipient number is not verified (trial account restriction)");
    console.log("  20003 = wrong Account SID or Auth Token");
    console.log("  21211 = invalid 'to' phone number format");
    console.log("  21606 = the 'from' number isn't a valid Twilio number on your account");
  });
