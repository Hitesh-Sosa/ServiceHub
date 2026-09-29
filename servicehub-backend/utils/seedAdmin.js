// Run once:  npm run seed:admin
// (or: node utils/seedAdmin.js)
require("dotenv").config({ override: true });

const mongoose = require("mongoose");
const User = require("../models/User");
const connectDB = require("../config/db");
 

async function seedAdmin() {
  await connectDB();

  const email = process.env.ADMIN_EMAIL || "admin@servicehub.local";
  const password = process.env.ADMIN_PASSWORD || "Admin@12345";

  const existing = await User.findOne({ email });
  if (existing) {
    console.log("Admin already exists:", email);
    process.exit(0);
  }

  const admin = new User({
    name: "Admin",
    email,
    password,
    role: "Admin",
    isEmailVerified: true,
    isMobileVerified: true,
  });
  admin.setMobile("9999999999"); // placeholder, satisfies required encrypted mobile
  await admin.save();

  console.log(`Admin created -> email: ${email}  password: ${password}`);
  console.log("Change this password immediately in production.");
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});