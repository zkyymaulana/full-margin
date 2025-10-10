const ONE_HOUR_MS = 60 * 60 * 1000;

/** Konversi UTC timestamp ke WIB string */
export function toJakartaTime(timestamp) {
  const jakartaOffset = 7 * 60 * 60 * 1000;
  const jakartaTime = new Date(timestamp + jakartaOffset);

  const d = jakartaTime;
  const pad = (n) => n.toString().padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} WIB`;
}

/** Ambil waktu candle terakhir yang sudah close (WIB) */
export function getLastClosedHourlyCandleEndTime() {
  const nowUTC = new Date();
  const WIB_OFFSET = 7 * 60 * 60 * 1000;
  const nowWIB = new Date(nowUTC.getTime() + WIB_OFFSET);

  const currentHourWIB = new Date(
    Date.UTC(
      nowWIB.getUTCFullYear(),
      nowWIB.getUTCMonth(),
      nowWIB.getUTCDate(),
      nowWIB.getUTCHours()
    )
  );

  const currentHourUTC = currentHourWIB.getTime() - WIB_OFFSET;
  return currentHourUTC - ONE_HOUR_MS; // 1 jam terakhir yang sudah close
}

export function validateEndTime(endTime) {
  const lastClosed = getLastClosedHourlyCandleEndTime();
  return Math.min(endTime, lastClosed);
}
