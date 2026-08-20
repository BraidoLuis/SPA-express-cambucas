import { describe, expect, it } from "vitest";
import { appointmentDurationMinutes } from "./appointment-duration";

describe("appointmentDurationMinutes", () => {
  it.each([
    [
      "2026-08-20T12:00:00.000Z",
      "2026-08-20T12:30:00.000Z",
      30,
    ],
    [
      "2026-08-20T12:00:00.000Z",
      "2026-08-20T12:50:00.000Z",
      50,
    ],
    [
      "2026-08-20T12:15:00.000Z",
      "2026-08-20T13:25:00.000Z",
      70,
    ],
    [
      "2026-08-20T12:00:00.000Z",
      "2026-08-20T14:00:00.000Z",
      120,
    ],
  ])(
    "calcula corretamente o intervalo entre %s e %s",
    (start, end, expectedDuration) => {
      expect(
        appointmentDurationMinutes(start, end),
      ).toBe(expectedDuration);
    },
  );

  it("arredonda diferenças que contenham segundos", () => {
    expect(
      appointmentDurationMinutes(
        "2026-08-20T12:00:00.000Z",
        "2026-08-20T12:50:29.000Z",
      ),
    ).toBe(50);

    expect(
      appointmentDurationMinutes(
        "2026-08-20T12:00:00.000Z",
        "2026-08-20T12:50:31.000Z",
      ),
    ).toBe(51);
  });

  it.each([
    ["data inválida", "2026-08-20T13:00:00.000Z"],
    ["2026-08-20T12:00:00.000Z", "data inválida"],
    [
      "2026-08-20T13:00:00.000Z",
      "2026-08-20T12:00:00.000Z",
    ],
    [
      "2026-08-20T12:00:00.000Z",
      "2026-08-20T12:00:00.000Z",
    ],
  ])(
    "usa zero como fallback para intervalo inválido",
    (start, end) => {
      expect(
        appointmentDurationMinutes(start, end),
      ).toBe(0);
    },
  );

  it("aceita um fallback personalizado", () => {
    expect(
      appointmentDurationMinutes(
        "data inválida",
        "outra data inválida",
        60,
      ),
    ).toBe(60);
  });
});