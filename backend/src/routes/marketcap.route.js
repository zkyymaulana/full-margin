// src/routes/marketcap.route.js
import express from "express";
import {
  getMarketcap,
  getMarketcapLiveController,
} from "../controllers/marketcap.controller.js";

const router = express.Router();

router.get("/", getMarketcap);
router.get("/live", getMarketcapLiveController);

export default router;
