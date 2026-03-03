const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

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
