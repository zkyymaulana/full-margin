import express from "express";
import { runHourlySyncInternal } from "../controllers/scheduler.controller.js";

const router = express.Router();

router.post("/run-hourly", runHourlySyncInternal);

export default router;
