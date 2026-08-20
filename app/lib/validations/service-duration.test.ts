import { describe, expect, it } from "vitest";
import {
  MAX_SERVICE_DURATION_MINUTES,
  MIN_SERVICE_DURATION_MINUTES,
  isValidServiceDuration,
  validateServiceDuration,
} from "./service-duration";

describe("service-duration", () => {
  it("define os limites permitidos", () => {
    expect(MIN_SERVICE_DURATION_MINUTES).toBe(30);
    expect(MAX_SERVICE_DURATION_MINUTES).toBe(720);
  });

  it.each([30, 50, 60, 70, 90, 120, 720])(
    "aceita a duração válida de %i minutos",
    (duration) => {
      expect(isValidServiceDuration(duration)).toBe(true);

      expect(() =>
        validateServiceDuration(duration),
      ).not.toThrow();
    },
  );

  it.each([
    0,
    10,
    15,
    29,
    -30,
    30.5,
    721,
    1000,
    Number.NaN,
    Infinity,
    -Infinity,
  ])("rejeita a duração inválida %s", (duration) => {
    expect(isValidServiceDuration(duration)).toBe(false);

    expect(() =>
      validateServiceDuration(duration),
    ).toThrow(/entre 30 e 720 minutos/i);
  });

  it("utiliza o nome personalizado do campo no erro", () => {
    expect(() =>
      validateServiceDuration(15, "A duração personalizada"),
    ).toThrow(
      "A duração personalizada deve ser um número inteiro entre 30 e 720 minutos.",
    );
  });
});