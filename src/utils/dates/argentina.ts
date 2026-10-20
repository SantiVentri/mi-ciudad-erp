const AR_TIMEZONE = "America/Argentina/Buenos_Aires";

// Fecha de hoy en Argentina como "YYYY-MM-DD".
// El servidor corre en UTC, así que no se puede usar new Date() directamente.
export function todayKeyAR(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: AR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Medianoche local de "hoy en Argentina" (mismo tipo de Date que devuelve startOfDay)
export function todayAR(): Date {
  const [year, month, day] = todayKeyAR().split("-").map(Number);
  return new Date(year, month - 1, day);
}
