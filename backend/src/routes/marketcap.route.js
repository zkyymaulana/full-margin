import express from "express";
import { getMarketcap } from "../controllers/marketcap.controller.js";

const router = express.Router();

// /api/marketcap
router.get("/", getMarketcap);

export default router;
