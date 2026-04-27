import mongoose from "mongoose";

const SellerProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    fullName: { type: String, required: true },
    businessName: { type: String },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    idNumber: { type: String },
    bankAccount: { type: String },
    profilePhotoUrl: { type: String },
    idDocumentUrl: { type: String },
    selfieUrl: { type: String },
    verification: {
      status: {
        type: String,
        enum: ["none", "under_review", "verified", "rejected"],
        default: "none",
      },
      submittedAt: { type: Date },
      verifiedAt: { type: Date },
      rejectedAt: { type: Date },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reviewNotes: { type: String },
      adminSnapshotUrl: { type: String },
    },
  },
  { timestamps: true }
);

export default mongoose.model("SellerProfile", SellerProfileSchema);


