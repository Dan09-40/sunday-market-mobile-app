import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  userId: { type: Number, unique: true, sparse: true, index: true },
  role: {
    type: String,
    enum: ["customer", "seller", "delivery", "admin"],
    default: "customer",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Assign auto-increment userId for new users
userSchema.pre("save", async function (next) {
  if (!this.isNew || this.userId != null) return next();
  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: "userId" },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    this.userId = counter.seq;
    next();
  } catch (err) {
    next(err);
  }
});

// Hash password before saving if modified
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Hash password on findOneAndUpdate when password is being updated
userSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  if (!update) return next();

  try {
    const password = update.password || (update.$set && update.$set.password);
    if (!password) return next();

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    if (update.password) update.password = hashed;
    if (update.$set && update.$set.password) update.$set.password = hashed;
    next();
  } catch (err) {
    next(err);
  }
});

const User = mongoose.model("User", userSchema);

export default User;