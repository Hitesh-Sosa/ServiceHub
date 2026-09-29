// npm install google-auth-library jsonwebtoken

// ---------- routes/googleAuth.js ----------
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ message: 'Missing Google credential' });
  }

  try {
    // Verifies signature, expiry, and audience (your Client ID)
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    // payload contains: sub (Google user id), email, name, picture, email_verified

    if (!payload.email_verified) {
      return res.status(401).json({ message: 'Google email not verified' });
    }

    // ---- Find or create the user in your DB ----
    // let user = await User.findOne({ email: payload.email });
    // if (!user) {
    //   user = await User.create({
    //     email: payload.email,
    //     name: payload.name,
    //     avatar: payload.picture,
    //     googleId: payload.sub,
    //     authProvider: 'google',
    //   });
    // }
    // Swap payload.sub for user._id below once your DB lookup is wired in.

    const tokenPayload = { userId: payload.sub, email: payload.email };

    // ---- Issue access token (short-lived) ----
    const accessToken = jwt.sign(
      tokenPayload,
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN }
    );

    // ---- Issue refresh token (long-lived) ----
    const refreshToken = jwt.sign(
      tokenPayload,
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
    );

    // Recommended: store refreshToken in an httpOnly cookie instead of the JSON body
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, keep in sync with JWT_REFRESH_EXPIRES_IN
    });

    return res.json({
      accessToken,
      user: {
        email: payload.email,
        name: payload.name,
        avatar: payload.picture,
      },
    });
  } catch (err) {
    console.error('Google token verification failed:', err.message);
    return res.status(401).json({ message: 'Invalid Google token' });
  }
});

module.exports = router;

// ---------- app.js / server.js ----------
// const cookieParser = require('cookie-parser'); // npm install cookie-parser
// app.use(cookieParser());
// const googleAuthRoutes = require('./routes/googleAuth');
// app.use(googleAuthRoutes);
