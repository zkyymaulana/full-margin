import express from "express";
import { compareIndicators } from "../controllers/comparison.controller.js";

const router = express.Router();

router.post("/compare", compareIndicators);

export default router;
