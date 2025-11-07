// src/routes/marketcap.route.js
import express from "express";
import {
  getCoinMarketcap,
  getMarketcapLiveController,
  getCoinSymbols,
} from "../controllers/marketcap.controller.js";

const router = express.Router();

router.get("/", getCoinMarketcap);
router.get("/live", getMarketcapLiveController);
router.get("/symbol", getCoinSymbols);

export default router;
