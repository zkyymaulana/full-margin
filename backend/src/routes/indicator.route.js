import express from "express";
import { getIndicators } from "../controllers/indicator.controller.js";

const router = express.Router();

router.get("/:symbol?", getIndicators);

export default router;
