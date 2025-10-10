import express from "express";
import { getChart } from "../controllers/chart.controller.js";

const router = express.Router();
router.get("/:symbol?", getChart);
export default router;
