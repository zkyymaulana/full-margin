import {
  compareStrategies,
  validateComparisonParams,
  handleComparisonError,
} from "../services/comparison/comparison.service.js";

export const compareIndicators = async (req, res) => {
  try {
    // Validate request parameters using service function
    const validation = validateComparisonParams(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        ...validation.error,
      });
    }

    const { symbol, startDate, endDate, threshold = 0 } = req.body;

    // Call service layer (pure business logic)
    const result = await compareStrategies(
      symbol,
      startDate,
      endDate,
      threshold
    ); // ✅ Pass threshold

    // Handle service response
    if (!result.success) {
      return res.status(404).json(result);
    }

    // Return successful response
    return res.status(200).json(result);
  } catch (error) {
    // Handle errors using centralized error handler
    const { statusCode, response } = handleComparisonError(error);
    return res.status(statusCode).json(response);
  }
};
