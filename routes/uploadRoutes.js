import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, "_");
    const name = `${base}_${Date.now()}${ext}`;
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only image files are allowed"));
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB each

// Single image
router.post("/single", upload.single("image"), (req, res) => {
  const file = req.file;
  const url = `/uploads/${file.filename}`;
  res.json({ url });
});

// Multiple images
router.post("/multiple", upload.array("images", 8), (req, res) => {
  const files = req.files || [];
  const urls = files.map((f) => ({ url: `/uploads/${f.filename}` }));
  res.json({ urls });
});

export default router;
