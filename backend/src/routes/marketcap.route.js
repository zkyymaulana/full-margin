// src/routes/marketcap.route.js
import express from "express";
import {
  getMarketcap,
  getMarketcapLiveController,
} from "../controllers/marketcap.controller.js";

const router = express.Router();

// Data dari DB (stabil)
router.get("/", getMarketcap);

// Data live langsung dari Coinbase
router.get("/live", getMarketcapLiveController);

export default router;
