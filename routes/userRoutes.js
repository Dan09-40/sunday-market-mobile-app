import express from "express";
import User from "../models/user.js";
import mongoose from "mongoose";


const router = express.Router();

// ✅ Register a new user (public registration)
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, phone, password, role } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const user = new User({
      fullName,
      email: normalizedEmail,
      phone,
      password,
      role,
    });

    await user.save();

    res.status(201).json({ message: "User registered successfully!", user });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Server error during registration" });
  }

  
});

// ✅ Admin utility: Backfill userId for existing users missing it
router.post("/backfill-userIds", async (req, res) => {
  try {
    const users = await User.find({ userId: { $exists: false } }).select("_id userId");
    let updated = 0;

    for (const u of users) {
      const result = await mongoose.connection
        .collection("counters")
        .findOneAndUpdate(
          { _id: "userId" },
          { $inc: { seq: 1 } },
          { upsert: true, returnDocument: "after" }
        );
      const nextSeq = result.value.seq;
      await User.updateOne({ _id: u._id }, { $set: { userId: nextSeq } });
      updated += 1;
    }

    res.json({ message: "Backfill complete", updated });
  } catch (error) {
    console.error("Backfill userIds error:", error);
    res.status(500).json({ message: "Failed to backfill userId" });
  }
});

// ===== Basic CRUD for Manage Users =====
// List users with optional search and pagination
router.get("/", async (req, res) => {
  try {
    const { q = "", page = 1, limit = 10 } = req.query;
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const filter = q
      ? {
          $or: [
            { fullName: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
            { phone: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .select("fullName email phone role createdAt userId"),
      User.countDocuments(filter),
    ]);

    res.json({ items, total, page: p, pages: Math.ceil(total / l) });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ message: "Failed to list users" });
  }
});

// Get single user by Mongo _id
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: "Invalid user id" });
  }
});

// Create user (admin add)
router.post("/", async (req, res) => {
  try {
    const { fullName, email, phone, password, role } = req.body;
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ message: "Email already registered" });

    const user = new User({ fullName, email: normalizedEmail, phone, password, role });
    await user.save();
    res.status(201).json({ message: "User created", user: { id: user._id, userId: user.userId } });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
});

// Update user
router.put("/:id", async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.email) update.email = String(update.email).toLowerCase().trim();

    const user = await User.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User updated", user });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
});

// Delete user
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

export default router;
