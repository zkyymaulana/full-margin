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

// formatDateLabel: samakan tampilan tanggal di comparison (selector, loading, hasil, error).
export const formatDateLabel = (value) => {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

// replaceIsoDatesInText: ubah tanggal ISO di pesan backend ke format UI yang konsisten.
export const replaceIsoDatesInText = (text) => {
  if (!text || typeof text !== "string") return text;

  return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (isoDate) => {
    return formatDateLabel(isoDate);
  });
};
