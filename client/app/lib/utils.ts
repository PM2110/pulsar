const IST_LOCALE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: "Asia/Kolkata",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
};

export const formatTime = (iso: string | null): string => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", IST_LOCALE_OPTS);
};

/** Returns "YYYY-MM-DD HH:mm:ss" in IST */
export const formatTimeIST = (iso: string): string => {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
};

export const timeSince = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  return `${Math.floor(diff / 60000)}m ago`;
};
