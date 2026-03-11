import express from "express";
import {
  getWatchlistHandler,
  addToWatchlistHandler,
  removeFromWatchlistHandler,
} from "../controllers/wachlist.controller.js";

const router = express.Router();

router.get("/", getWatchlistHandler);
router.post("/", addToWatchlistHandler);
router.delete("/:coinId", removeFromWatchlistHandler);

export default router;
