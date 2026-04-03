// Helper functions for formatting data
// formatNumber: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export const formatNumber = (num) => {
  if (!num && num !== 0) return "N/A";
  return typeof num === "number" ? num.toFixed(2) : num;
};

// formatPercent: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export const formatPercent = (num) => {
  if (!num && num !== 0) return "N/A";
  return `${num.toFixed(2)}%`;
};

// formatRatio: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export const formatRatio = (num) => {
  if (!num && num !== 0) return "N/A";
  return num.toFixed(2);
};

// formatCurrency: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export const formatCurrency = (num) => {
  if (!num && num !== 0) return "N/A";
  return `$${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// getROIColor: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export const getROIColor = (roi, isDarkMode) => {
  if (!roi && roi !== 0) return isDarkMode ? "text-gray-400" : "text-gray-700";
  if (roi >= 50) return "text-green-600";
  if (roi >= 0) return "text-green-500";
  if (roi >= -50) return "text-red-500";
  return "text-red-600";
};
