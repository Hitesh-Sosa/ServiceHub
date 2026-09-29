# ServiceHub — Backend API

Backend for the **Local Service Booking Platform (ServiceHub / LocalConnect)** — a MERN-stack
project connecting customers with verified local service providers.

Built to match the project's SRS, Class Diagram, and REST API documentation.

## Tech Stack
- Node.js + Express
- MongoDB + Mongoose
- JWT authentication (access + refresh tokens), bcrypt password hashing
- AES-256-GCM encryption for mobile numbers (reversible — see note below)
- Email + Mobile OTP verification (user chooses the channel)
- Google Sign-In (`google-auth-library`)
- Socket.io (real-time chat)
- `helmet`, `express-rate-limit`, `express-validator`, `express-mongo-sanitize` (hardening)

## Project Structure
```
servicehub-backend/
├── config/db.js          MongoDB connection
├── models/                User, RefreshToken, Service, Booking, Payment, Review, ChatMessage
├── controllers/           Business logic for each entity
├── routes/                Express route definitions
├── middleware/             JWT auth, role checks, validation, rate limiting, errors
├── utils/                   Encryption, OTP, email/SMS senders, token generation
└── server.js               App entry point + Socket.io setup
```

## Authentication & Security Architecture

**Passwords vs. mobile numbers — different treatment, on purpose:**
- Passwords are **hashed** with bcrypt (one-way — there is no way to recover
  the original password, ever, even for you as the developer). See `models/User.js`.
- Mobile numbers are **encrypted** with AES-256-GCM (`utils/encryption.js`) —
  reversible, because the app genuinely needs the real number back later (to
  send an SMS OTP). A separate SHA-256 lookup hash is stored alongside it so
  the database can check "is this number already registered?" without
  decrypting every record to compare.
- **Never copy the mobile-number pattern for passwords.** If a password can
  be decrypted, it can be stolen and reused directly — that's exactly what
  bcrypt hashing prevents.

**Verification rule:** a new account cannot log in until it has verified
**either** its email **or** its mobile number — whichever the user picked
during registration (`verifyVia: "email" | "mobile"`). The OTP is 6 digits,
generated with `crypto.randomInt` (not `Math.random`, which is predictable
and unsafe for security purposes), hashed with bcrypt before storage, and
**expires after exactly 60 seconds**.

**Login sessions use two tokens:**
- **Access token** (15 min) — sent in the `Authorization: Bearer <token>`
  header on every request.
- **Refresh token** (7 days) — returned in the JSON response body (not a
  cookie, in this version — see "Design trade-off" below), stored **hashed**
  in the `RefreshToken` collection so a database leak alone can't be replayed,
  and can be individually revoked on logout.

**Other hardening in place:**
- `helmet` — sets standard security HTTP headers.
- `express-rate-limit` — blocks brute-force attempts on login/register, and
  caps OTP requests to 1 per minute per IP (matches the 60-second OTP window).
- `express-validator` — rejects weak passwords, invalid mobile formats, and
  blocks anyone from registering directly as `"Admin"`.
- `express-mongo-sanitize` — strips `$`/`.` from user input to block NoSQL
  injection attacks.
- **Account lockout**: 5 wrong password attempts locks the account for 15
  minutes (`models/User.js` — `registerFailedLogin`).
- Login errors are deliberately generic ("Invalid email or password") so the
  endpoint can't be used to discover which emails are registered.
- **Socket.io is authenticated too**: clients connect with
  `io(URL, { auth: { token: accessToken } })`; joining a booking room
  verifies the user is the customer or provider of that booking.

### Design trade-off: refresh token in JSON body, not an httpOnly cookie
Cookie-based refresh tokens are slightly more resistant to XSS token theft,
but require the frontend and backend to be wired together with matching
`credentials: true` / cookie settings, which is easier to get right once
you've actually built the frontend. This version keeps things simple and
testable with Postman/Thunder Client now; upgrading to httpOnly cookies later
is a small, isolated change (mainly in `issueTokens()` in `authController.js`
and the CORS config in `server.js`) — ask when you're ready for it.

## Auth API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register with email + password + mobile |
| POST | `/api/auth/verify-otp` | Verify the OTP (register or login step) |
| POST | `/api/auth/resend-otp` | Request a new OTP (rate-limited to 1/min) |
| POST | `/api/auth/login` | Log in with email + password |
| POST | `/api/auth/google` | Log in / register with Google (send `idToken`) |
| POST | `/api/auth/complete-profile` | Google sign-ups only: add mobile + role |
| POST | `/api/auth/refresh-token` | Exchange refresh token for a new access token |
| POST | `/api/auth/logout` | Revoke the current refresh token |

`complete-profile` always sends the OTP to the **mobile** number, because a
Google account's email is already verified — the only thing left to verify is
the mobile number.

## Setup (in VS Code)

1. Open this folder in VS Code (`File > Open Folder`).
2. Open a terminal (`` Ctrl+` ``) and install dependencies:
   ```
   npm install
   ```
3. Copy the environment template:
   ```
   copy .env.example .env
   ```
4. Generate your secrets and paste them into `.env`:
   ```
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   Run this **twice** — once for `JWT_ACCESS_SECRET`, once for `JWT_REFRESH_SECRET`
   (they must be different values).
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   This gives you `ENCRYPTION_KEY` (must be exactly 64 hex characters — the
   command above always produces the right length).
5. Leave `SMTP_*`, `TWILIO_*`, and `GOOGLE_CLIENT_ID` blank for now — the app
   runs in "dev mode" without them (see below).
6. Make sure the MongoDB Windows service is running, then start the server:
   ```
   npm run dev
   ```
7. You should see:
   ```
   MongoDB connected: 127.0.0.1
   ServiceHub API listening on http://localhost:5000
   ```

## Testing without real Email/SMS/Google credentials

You can test the **entire register → verify → login** flow immediately:

1. `POST /api/auth/register` with:
   ```json
   { "name": "Hitesh Sosa", "email": "hitesh@test.com", "password": "StrongP@ss1",
     "mobile": "+919876543210", "role": "Customer", "verifyVia": "email" }
   ```
   Since `SMTP_HOST` isn't set, the OTP prints to your **terminal** instead of
   sending a real email — copy it from there. Response includes `userId`.
2. `POST /api/auth/verify-otp` with `{ "userId": "<from step 1>", "otp": "<from terminal>" }`
   — you're now verified and logged in (response includes `accessToken` + `refreshToken`).
3. `POST /api/auth/login` with `{ "email": "hitesh@test.com", "password": "StrongP@ss1" }`
   — works from now on.

Try `"verifyVia": "mobile"` too — same pattern, OTP prints to the terminal
since `TWILIO_ACCOUNT_SID` isn't set.

**Google Sign-In** needs a real `GOOGLE_CLIENT_ID` before it can work (Google's
servers must verify the token) — create one free at
[console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
(OAuth 2.0 Client ID → Web application) once you're ready to wire up the frontend.

## Creating your first Admin account

There's no public "become an admin" endpoint (that would be a security hole
— notice the registration validator only accepts `"Customer"` or `"Provider"`).
To create one for testing: register normally, verify it, then manually change
that user's `role` field to `"Admin"` directly in MongoDB Compass.

## Notes on other design decisions

- **Booking lifecycle**: `Pending → Confirmed / Rejected / Cancelled`,
  then `Confirmed → Completed / Cancelled`. Customers may only **cancel**;
  providers may **confirm / reject / complete**; Admins may do anything.
- **Provider verification (F6)**: separate from email/mobile OTP verification.
  A Provider's `isProviderVerified` flag only gets set by an Admin, via
  `PUT /api/admin/providers/:id/verify` — matches your Activity Diagram.
- **Payment (F3 merged)**: `POST /api/payments` is a **test-mode simulation**
  (always succeeds) per the SRS constraint limiting the project to test/sandbox
  payment gateways. Only `Pending` bookings are payable, the amount must match
  the service price, and double payment is blocked (one payment per booking).
- **Chat (F4)**: messages can be sent via REST (`POST /api/chat/:bookingId`)
  or directly over Socket.io (`sendMessage` event) — both broadcast to the
  same `booking_<id>` room for instant delivery. Socket connections require a
  valid access token and room joins are participant-checked.

## Next steps

- Build the React frontend, including the Register/Login pages and Google
  Sign-In button (uses Google Identity Services to get the `idToken` this
  backend expects).
- Swap the test-mode payment logic for real Razorpay/Stripe test-mode
  integration when ready.
- Consider moving the refresh token to an httpOnly cookie once the frontend
  exists (see "Design trade-off" above).
