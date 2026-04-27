import Product from "../models/product.js";
import SellerProfile from "../models/sellerProfile.js";

export const createProduct = async (req, res) => {
  try {
    const sellerId = req.headers["x-seller-id"] || req.headers["x-user-id"] || req.body.sellerId || undefined;
    // Enforce seller verification
    if (!sellerId) {
      return res.status(401).json({ message: "Missing seller identity" });
    }
    const profile = await SellerProfile.findOne({ userId: sellerId });
    const status = profile?.verification?.status || "none";
    if (status !== "verified") {
      return res.status(403).json({
        message: "Seller account is not verified. Complete verification before adding products.",
        status,
      });
    }
    // Basic validation
    const { name, category, price } = req.body || {};
    if (!name || !category || price === undefined) {
      return res.status(400).json({ message: "name, category and price are required" });
    }

    // Map legacy single image field to images array
    let images = Array.isArray(req.body.images) ? req.body.images : [];
    if (!images?.length && req.body.image) {
      images = [{ url: req.body.image }];
    }

    const payload = {
      ...req.body,
      sellerId,
      price: Number(req.body.price),
      stock: req.body.stock !== undefined ? Number(req.body.stock) : 0,
      images,
    };
    const product = await Product.create(payload);
    res.status(201).json(product);
  } catch (e) {
    res.status(400).json({ message: e.message || "Failed to create product" });
  }
};

export const listProducts = async (req, res) => {
  try {
    const { q, category, brand, page = 1, limit = 20, own } = req.query;
    const filter = { status: "active" };
    const sellerId = req.headers["x-seller-id"] || req.headers["x-user-id"] || undefined;
    if (own === "true" && sellerId) filter.sellerId = sellerId;
    if (q) filter.name = { $regex: q, $options: "i" };
    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Product.countDocuments(filter),
    ]);
    res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to fetch products" });
  }
};

export const getProduct = async (req, res) => {
  try {
    const item = await Product.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Product not found" });
    res.json(item);
  } catch (e) {
    res.status(404).json({ message: e.message || "Product not found" });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const callerSellerId = req.headers["x-seller-id"] || req.headers["x-user-id"] || undefined;
    const existing = await Product.findById(id);
    if (!existing) return res.status(404).json({ message: "Product not found" });
    if (!callerSellerId || String(existing.sellerId) !== String(callerSellerId)) {
      return res.status(403).json({ message: "Not authorized to update this product" });
    }
    // Map legacy single image field to images array if provided
    const update = { ...req.body };
    if (update.price !== undefined) update.price = Number(update.price);
    if (update.stock !== undefined) update.stock = Number(update.stock);
    if (!update.images && update.image) {
      update.images = [{ url: update.image }];
      delete update.image;
    }
    const updated = await Product.findByIdAndUpdate(id, { $set: update }, { new: true });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: e.message || "Failed to update product" });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const callerSellerId = req.headers["x-seller-id"] || req.headers["x-user-id"] || undefined;
    const existing = await Product.findById(id);
    if (!existing) return res.status(404).json({ message: "Product not found" });
    if (!callerSellerId || String(existing.sellerId) !== String(callerSellerId)) {
      return res.status(403).json({ message: "Not authorized to delete this product" });
    }
    await Product.findByIdAndDelete(id);
    res.json({ message: "Product deleted" });
  } catch (e) {
    res.status(400).json({ message: e.message || "Failed to delete product" });
  }
};
