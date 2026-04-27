import { Router } from "express";
import SellerProfile from "../models/sellerProfile.js";
import User from "../models/user.js";

const router = Router();

function requireUserId(req, res) {
  const userId = req.headers["x-user-id"] || req.body.userId || req.query.userId;
  if (!userId) {
    res.status(400).json({ message: "Missing userId" });
    return null;
  }
  return userId;
}

async function ensureAdmin(req, res) {
  const adminId = req.headers["x-user-id"] || req.body.reviewerId || req.query.reviewerId;
  if (!adminId) {
    res.status(401).json({ message: "Missing reviewer identity" });
    return null;
  }
  try {
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== "admin") {
      res.status(403).json({ message: "Admin only" });
      return null;
    }
    return admin;
  } catch (e) {
    res.status(400).json({ message: e.message || "Invalid reviewer" });
    return null;
  }
}

router.get("/seller/verification/status", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const profile = await SellerProfile.findOne({ userId });
    if (!profile) return res.json({ status: "none" });
    res.json({
      status: profile.verification?.status || "none",
      profilePhotoUrl: profile.profilePhotoUrl || null,
      idDocumentUrl: profile.idDocumentUrl || null,
      selfieUrl: profile.selfieUrl || null,
      submittedAt: profile.verification?.submittedAt || null,
      verifiedAt: profile.verification?.verifiedAt || null,
      rejectedAt: profile.verification?.rejectedAt || null,
      reviewNotes: profile.verification?.reviewNotes || null,
    });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to get status" });
  }
});

router.post("/seller/verification/profile-photo", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ message: "Missing url" });
  try {
    const profile = await SellerProfile.findOneAndUpdate(
      { userId },
      { $set: { profilePhotoUrl: url } },
      { upsert: true, new: true }
    );
    res.json({ message: "Profile photo updated", profilePhotoUrl: profile.profilePhotoUrl });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to update" });
  }
});

router.post("/seller/verification/id-document", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ message: "Missing url" });
  try {
    const profile = await SellerProfile.findOneAndUpdate(
      { userId },
      { $set: { idDocumentUrl: url } },
      { upsert: true, new: true }
    );
    res.json({ message: "ID document updated", idDocumentUrl: profile.idDocumentUrl });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to update" });
  }
});

router.post("/seller/verification/selfie", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ message: "Missing url" });
  try {
    const profile = await SellerProfile.findOneAndUpdate(
      { userId },
      { $set: { selfieUrl: url } },
      { upsert: true, new: true }
    );
    res.json({ message: "Selfie updated", selfieUrl: profile.selfieUrl });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to update" });
  }
});

router.post("/seller/verification/submit", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const profile = await SellerProfile.findOne({ userId });
    if (!profile) return res.status(400).json({ message: "Seller profile not found" });
    if (!profile.profilePhotoUrl || !profile.idDocumentUrl) {
      return res.status(400).json({ message: "Please upload profile photo and ID document first" });
    }
    profile.verification = profile.verification || {};
    profile.verification.status = "under_review";
    profile.verification.submittedAt = new Date();
    await profile.save();
    res.json({ message: "Submitted for review", status: profile.verification.status });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to submit" });
  }
});

// Admin: list sellers pending review
router.get("/admin/verification/pending", async (req, res) => {
  const admin = await ensureAdmin(req, res);
  if (!admin) return;
  try {
    const items = await SellerProfile.find({ "verification.status": "under_review" })
      .select("userId fullName businessName phone city country profilePhotoUrl idDocumentUrl createdAt verification.submittedAt")
      .sort({ "verification.submittedAt": 1 });
    res.json({ items });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to load pending" });
  }
});

// Admin: get seller details
router.get("/admin/verification/:userId", async (req, res) => {
  const admin = await ensureAdmin(req, res);
  if (!admin) return;
  const { userId } = req.params;
  try {
    const profile = await SellerProfile.findOne({ userId });
    if (!profile) return res.status(404).json({ message: "Seller profile not found" });
    res.json({ profile });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to fetch seller" });
  }
});

// Admin: store webcam snapshot captured during review
router.post("/admin/verification/:userId/snapshot", async (req, res) => {
  const admin = await ensureAdmin(req, res);
  if (!admin) return;
  const { userId } = req.params;
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ message: "Missing url" });
  try {
    const profile = await SellerProfile.findOneAndUpdate(
      { userId },
      { $set: { "verification.adminSnapshotUrl": url, "verification.reviewedBy": admin._id } },
      { new: true }
    );
    if (!profile) return res.status(404).json({ message: "Seller profile not found" });
    res.json({ message: "Snapshot saved", adminSnapshotUrl: profile.verification?.adminSnapshotUrl || null });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to save snapshot" });
  }
});

router.post("/admin/verification/:userId/approve", async (req, res) => {
  const admin = await ensureAdmin(req, res);
  if (!admin) return;
  const { userId } = req.params;
  try {
    const profile = await SellerProfile.findOne({ userId });
    if (!profile) return res.status(404).json({ message: "Seller profile not found" });
    profile.verification = profile.verification || {};
    profile.verification.status = "verified";
    profile.verification.verifiedAt = new Date();
    profile.verification.reviewedBy = admin._id;
    if (req.body?.reviewNotes) profile.verification.reviewNotes = req.body.reviewNotes;
    await profile.save();
    res.json({ message: "Seller verified", status: profile.verification.status });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to approve" });
  }
});

router.post("/admin/verification/:userId/reject", async (req, res) => {
  const admin = await ensureAdmin(req, res);
  if (!admin) return;
  const { userId } = req.params;
  try {
    const profile = await SellerProfile.findOne({ userId });
    if (!profile) return res.status(404).json({ message: "Seller profile not found" });
    profile.verification = profile.verification || {};
    profile.verification.status = "rejected";
    profile.verification.rejectedAt = new Date();
    profile.verification.reviewedBy = admin._id;
    profile.verification.reviewNotes = req.body?.reviewNotes || "";
    await profile.save();
    res.json({ message: "Seller verification rejected", status: profile.verification.status });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to reject" });
  }
});

export default router;

