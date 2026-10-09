const establishmentTimeZone = "America/Sao_Paulo";

// Datas de calendário: a data do estabelecimento não depende do fuso do navegador.
export function bookingToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: establishmentTimeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)!.value).join("-");
}

function calendarValue(date: Date): string {
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function isBookingDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && calendarValue(date) === value;
}

export function shiftBookingDate(value: string, days: number): string {
  if (!isBookingDate(value)) throw new RangeError("Data de calendário inválida.");
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return calendarValue(date);
}

export function formatBookingDate(value: string, options: Intl.DateTimeFormatOptions = {}): string {
  // UTC representa somente os componentes da data, sem convertê-la em um horário local.
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" })
    .format(new Date(value + "T12:00:00Z"));
}
