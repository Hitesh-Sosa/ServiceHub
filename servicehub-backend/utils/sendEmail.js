const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    // Dev mode: log codes to the console until real SMTP is configured.
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

async function sendOtpEmail(toEmail, otp) {
  const t = getTransporter();

  if (!t) {
    console.log(`\n[DEV MODE - no SMTP configured] OTP for ${toEmail}: ${otp}\n`);
    return { devMode: true };
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || `"ServiceHub" <no-reply@servicehub.local>`,
    to: toEmail,
    subject: "Your ServiceHub verification code",
    text: `Your verification code is ${otp}. It expires in 1 minute. Do not share this code with anyone.`,
    html: `<p>Your verification code is <b style="font-size:20px">${otp}</b>.</p>
           <p>It expires in <b>1 minute</b>. Do not share this code with anyone.</p>`,
  });

  return { devMode: false };
}

// NEW: password reset OTP email
async function sendPasswordResetEmail(toEmail, otp) {
  const t = getTransporter();

  if (!t) {
    console.log(`\n[DEV MODE - no SMTP configured] Password reset OTP for ${toEmail}: ${otp}\n`);
    return { devMode: true };
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || `"ServiceHub" <no-reply@servicehub.local>`,
    to: toEmail,
    subject: "Reset your ServiceHub password",
    text: `Your password reset code is ${otp}. It expires in 1 minute. If you did not request this, ignore this email.`,
    html: `<p>You requested a password reset.</p>
           <p>Your reset code is <b style="font-size:20px">${otp}</b>.</p>
           <p>It expires in <b>1 minute</b>. If you did not request this, you can safely ignore this email.</p>`,
  });

  return { devMode: false };
}

module.exports = { sendOtpEmail, sendPasswordResetEmail };