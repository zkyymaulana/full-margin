import express from "express";
import { compareIndicators } from "../controllers/index.js";

const router = express.Router();

router.post("/compare", compareIndicators);

export default router;
