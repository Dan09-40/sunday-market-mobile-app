import { Router } from "express";
import { createProduct, listProducts, getProduct, updateProduct, deleteProduct } from "../controllers/products.js";

const router = Router();

router.post("/", createProduct);
router.get("/", listProducts);
router.get("/:id", getProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;
