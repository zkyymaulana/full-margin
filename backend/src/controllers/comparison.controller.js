import { compareStrategies } from "../services/comparison/comparison.service.js";

export const compareIndicators = async (req, res) => {
  try {
    // Validate request parameters
    const { symbol, startDate, endDate } = req.body;

    if (!symbol || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required parameters: symbol, startDate, and endDate are required",
        example: {
          symbol: "BTC-USD",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        },
      });
    }

    // Validate date formats
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use ISO 8601 format (YYYY-MM-DD)",
      });
    }

    if (startDateObj >= endDateObj) {
      return res.status(400).json({
        success: false,
        message: "startDate must be before endDate",
      });
    }

    console.log(
      `📊 Comparison request received: ${symbol} (${startDate} → ${endDate})`
    );

    // Call service layer (pure business logic)
    const result = await compareStrategies(symbol, startDate, endDate);

    // Handle service response
    if (!result.success) {
      return res.status(404).json(result);
    }

    // Return successful response
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Comparison Controller Error:", error);

    // Handle specific error types
    if (error.message.includes("No data found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    // Generic internal server error
    return res.status(500).json({
      success: false,
      message: "Internal server error during comparison",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
