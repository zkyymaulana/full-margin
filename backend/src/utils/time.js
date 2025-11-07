import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export const HOUR_MS = 3600000;

export const formatTime = (
  t,
  f = "DD/MM/YYYY HH:mm:ss",
  z = "Asia/Jakarta"
) => {
  try {
    return t ? dayjs(t).tz(z).format(f) : "-";
  } catch {
    return "-";
  }
};

export const formatWibTime = (t) => `${formatTime(t)} WIB`;

export const toISO = (v) => {
  try {
    if (!v) return dayjs().utc().toISOString();
    let ms = v instanceof Date ? v.getTime() : Number(v);
    if (typeof v === "bigint" || /^\d+$/.test(v)) ms = Number(v);
    if (ms < 1e12) ms *= 1000;
    return dayjs(ms).utc().toISOString();
  } catch {
    return dayjs().utc().toISOString();
  }
};

export const getLastClosedHourlyCandleEndTime = () =>
  dayjs().utc().startOf("hour").subtract(1, "hour").valueOf();

export const validateEndTime = (end) =>
  Math.min(end, getLastClosedHourlyCandleEndTime());

export const fmt = (t) =>
  t ? dayjs(t).utc().format("YYYY-MM-DD HH:mm:ss[Z]") : "-";
