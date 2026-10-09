import { describe, expect, it } from "vitest";
import { bookingToday, formatBookingDate, isBookingDate, shiftBookingDate } from "./booking-calendar";

describe("datas de agendamento no calendário do SPA", () => {
  it.each([
    ["2026-10-09T02:59:59Z", "2026-10-08"],
    ["2026-10-09T03:00:00Z", "2026-10-09"],
    ["2027-01-01T01:00:00Z", "2026-12-31"],
    ["2027-01-01T03:00:00Z", "2027-01-01"],
  ])("hoje usa America/Sao_Paulo para %s", (instant, day) => {
    expect(bookingToday(new Date(instant))).toBe(day);
  });

  it.each([
    ["2026-10-31", 1, "2026-11-01"],
    ["2026-11-01", -1, "2026-10-31"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2027-01-01", -1, "2026-12-31"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2028-02-29", 1, "2028-03-01"],
    ["2027-02-28", 1, "2027-03-01"],
  ])("navega um dia: %s + %s", (day, offset, expected) => {
    expect(shiftBookingDate(day, offset)).toBe(expected);
  });

  it.each(["", "inválida", "2026-02-30", "2026-13-01", "2026-1-01"])("rejeita datas incompletas ou inválidas: %s", (value) => {
    expect(isBookingDate(value)).toBe(false);
    expect(() => shiftBookingDate(value, 1)).toThrow("inválida");
  });

  it("calendário, resumo e atalhos exibem o mesmo dia, sem conversão pelo fuso do navegador", () => {
    expect(formatBookingDate("2026-12-31")).toBe("31/12/2026");
    expect(formatBookingDate("2027-01-01", { weekday: "long" })).toBe("sexta-feira");
    expect(isBookingDate("2028-02-29")).toBe(true);
  });
});
