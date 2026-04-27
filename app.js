import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";
import validateRoutes from "./routes/validate.js";
//import sellerRoutes from "./routes/sellerRoutes.js";
import SellerProfile from "./models/sellerProfile.js";
import productRoutes from "./routes/productRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import path from "path";
import sellerVerifyRoutes from "./routes/sellerVerifyRoutes.js";

dotenv.config(); // ✅ Load environment variables first

const app = express(); // ✅ Declare app before using it

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/users", validateRoutes);
//app.use("/api/seller", sellerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api", sellerVerifyRoutes);

// Static file serving for uploads
const uploadsPath = path.resolve(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsPath));

// Fallback inline routes (helps avoid 404s if router isn't picked up)
app.get("/api/seller", (req, res) => {
  res.json({ ok: true, scope: "seller-inline" });
});

app.get("/api/seller/account", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || req.query.userId || req.body?.userId;
    if (!userId) return res.status(400).json({ message: "Missing userId" });
    const profile = await SellerProfile.findOne({ userId });
    if (!profile) return res.json({ registered: false, verified: false });
    const verified = (profile.verification?.status || "none") === "verified";
    res.json({ registered: true, verified, profile });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to fetch account" });
  }
});

app.post("/api/seller/account", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || req.body.userId || req.query.userId;
    if (!userId) return res.status(400).json({ message: "Missing userId" });
    const { fullName, businessName, phone, address, city, country, idNumber, bankAccount } = req.body;
    if (!fullName || !phone || !address || !city || !country) {
      return res.status(400).json({ message: "Please fill all required fields" });
    }
    const update = { userId, fullName, businessName, phone, address, city, country, idNumber, bankAccount };
    const profile = await SellerProfile.findOneAndUpdate(
      { userId },
      { $set: update },
      { upsert: true, new: true }
    );
    res.json({ message: "Seller information saved", profile });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to save account" });
  }
});

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully with mati"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));