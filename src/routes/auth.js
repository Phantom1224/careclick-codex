const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const router = express.Router();

const OTP_LENGTH = 6;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const DEFAULT_OTP_EXP_MINUTES = 10;
const pendingSignups = new Map();
let mailTransporter = null;

function buildToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function cleanEmail(emailAddress = "") {
  return emailAddress.trim().toLowerCase();
}

function otpExpiresMs() {
  const minutes = Number(process.env.OTP_EXPIRES_MINUTES) || DEFAULT_OTP_EXP_MINUTES;
  return Math.max(1, minutes) * 60 * 1000;
}

function hashOtp(code) {
  const pepper = process.env.JWT_SECRET || "careclick";
  return crypto.createHash("sha256").update(`${code}:${pepper}`).digest("hex");
}

function generateOtpCode() {
  return String(Math.floor(Math.random() * 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

function getTransporter() {
  if (mailTransporter) return mailTransporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error("GMAIL_USER or GMAIL_APP_PASSWORD is not configured");
  }

  mailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  return mailTransporter;
}

async function sendOtpEmail(toEmail, code) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: toEmail,
    subject: "Your CareClick Verification Code",
    text: `Your CareClick verification code is ${code}. It expires in ${Number(process.env.OTP_EXPIRES_MINUTES) || DEFAULT_OTP_EXP_MINUTES} minutes.`,
    html: `<p>Your CareClick verification code is <strong>${code}</strong>.</p><p>It expires in ${Number(process.env.OTP_EXPIRES_MINUTES) || DEFAULT_OTP_EXP_MINUTES} minutes.</p>`,
  });
}

function duplicateErrorResponse(error, res) {
  const duplicateField =
    Object.keys(error?.keyPattern || {})[0] ||
    Object.keys(error?.keyValue || {})[0];
  const duplicateValue = duplicateField ? error?.keyValue?.[duplicateField] : undefined;

  if (duplicateField === "emailAddress") {
    return res.status(409).json({ message: "Email already registered" });
  }

  if (duplicateField === "userName") {
    return res.status(409).json({ message: "Username already taken" });
  }

  if (duplicateField) {
    return res.status(409).json({
      message: `Duplicate value already exists for ${duplicateField}: ${String(duplicateValue)}`,
    });
  }

  return res.status(409).json({ message: "Duplicate value already exists" });
}

router.post("/signup/request-code", async (req, res) => {
  try {
    const { userName, emailAddress, password, confirmPassword } = req.body;

    if (!userName || !emailAddress || !password || !confirmPassword) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const normalizedEmail = cleanEmail(emailAddress);
    const trimmedUserName = userName.trim();

    const existingEmail = await User.findOne({ emailAddress: normalizedEmail });
    if (existingEmail) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const existingUserName = await User.findOne({ userName: trimmedUserName });
    if (existingUserName) {
      return res.status(409).json({ message: "Username already taken" });
    }

    const code = generateOtpCode();
    const passwordHash = await bcrypt.hash(password, 10);
    const now = Date.now();

    pendingSignups.set(normalizedEmail, {
      userName: trimmedUserName,
      emailAddress: normalizedEmail,
      passwordHash,
      codeHash: hashOtp(code),
      expiresAt: now + otpExpiresMs(),
      resendAvailableAt: now + OTP_RESEND_COOLDOWN_MS,
    });

    await sendOtpEmail(normalizedEmail, code);
    return res.json({ message: "Verification code sent to email" });
  } catch (error) {
    return res.status(500).json({ message: "Unable to send verification code" });
  }
});

router.post("/signup/resend-code", async (req, res) => {
  try {
    const normalizedEmail = cleanEmail(req.body.emailAddress);
    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const pending = pendingSignups.get(normalizedEmail);
    if (!pending) {
      return res.status(404).json({ message: "No pending signup found for this email" });
    }

    const now = Date.now();
    if (now < pending.resendAvailableAt) {
      const waitSeconds = Math.ceil((pending.resendAvailableAt - now) / 1000);
      return res.status(429).json({ message: `Please wait ${waitSeconds}s before resending` });
    }

    const code = generateOtpCode();
    pending.codeHash = hashOtp(code);
    pending.expiresAt = now + otpExpiresMs();
    pending.resendAvailableAt = now + OTP_RESEND_COOLDOWN_MS;
    pendingSignups.set(normalizedEmail, pending);

    await sendOtpEmail(normalizedEmail, code);
    return res.json({ message: "Verification code resent" });
  } catch (_error) {
    return res.status(500).json({ message: "Unable to resend verification code" });
  }
});

router.post("/signup/verify-code", async (req, res) => {
  try {
    const normalizedEmail = cleanEmail(req.body.emailAddress);
    const code = String(req.body.code || "").trim();

    if (!normalizedEmail || !code) {
      return res.status(400).json({ message: "Email and verification code are required" });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "Verification code must be a 6-digit number" });
    }

    const pending = pendingSignups.get(normalizedEmail);
    if (!pending) {
      return res.status(404).json({ message: "No pending signup found for this email" });
    }

    if (Date.now() > pending.expiresAt) {
      pendingSignups.delete(normalizedEmail);
      return res.status(400).json({ message: "Verification code has expired. Request a new code." });
    }

    if (hashOtp(code) !== pending.codeHash) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    const existingUser = await User.findOne({ emailAddress: normalizedEmail });
    if (existingUser) {
      pendingSignups.delete(normalizedEmail);
      return res.status(409).json({ message: "Email already registered" });
    }

    const existingUserName = await User.findOne({ userName: pending.userName });
    if (existingUserName) {
      pendingSignups.delete(normalizedEmail);
      return res.status(409).json({ message: "Username already taken" });
    }

    const user = await User.create({
      userName: pending.userName,
      emailAddress: pending.emailAddress,
      passwordHash: pending.passwordHash,
      role: "user",
    });

    pendingSignups.delete(normalizedEmail);
    const token = buildToken(user);
    return res.status(201).json({ token, user: user.toJSON() });
  } catch (error) {
    if (error?.code === 11000) {
      return duplicateErrorResponse(error, res);
    }

    return res.status(500).json({ message: "Unable to verify signup code" });
  }
});

// Backward-compatible direct signup endpoint.
router.post("/signup", async (req, res) => {
  try {
    const { userName, emailAddress, password, confirmPassword } = req.body;

    if (!userName || !emailAddress || !password || !confirmPassword) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const normalizedEmail = cleanEmail(emailAddress);
    const existingUser = await User.findOne({ emailAddress: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      userName: userName.trim(),
      emailAddress: normalizedEmail,
      passwordHash,
      role: "user",
    });

    const token = buildToken(user);
    return res.status(201).json({ token, user: user.toJSON() });
  } catch (error) {
    if (error?.code === 11000) {
      return duplicateErrorResponse(error, res);
    }

    return res.status(500).json({ message: "Unable to create account" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { emailAddress, password } = req.body;
    if (!emailAddress || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ emailAddress: cleanEmail(emailAddress) });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = buildToken(user);
    return res.json({ token, user: user.toJSON() });
  } catch (_error) {
    return res.status(500).json({ message: "Unable to log in" });
  }
});

module.exports = router;
