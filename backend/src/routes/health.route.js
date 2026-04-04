import express from "express";

const router = express.Router();

router.get("/", async (_req, res, next) => {
  try {
    return res.status(200).json({
      status: "ok",
      message: "Server is running",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
