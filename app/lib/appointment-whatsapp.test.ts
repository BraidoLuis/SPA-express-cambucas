import { describe, expect, it } from "vitest";
import {
  buildAppointmentWhatsAppUrl,
  buildBookingGapWhatsAppUrl,
} from "./appointment-whatsapp";

const appointment = {
  whatsappNumber: "55 (21) 99999-9999",
  clientName: "Luis Braido",
  professionalName: "Dayanne Braido",
  serviceName: "Manicure em Gel",
  date: "2026-08-25",
  time: "14:30",
  duration: 60,
  price: 75,
  appointmentId: "a1b2c3d4-e5f6",
};

describe("buildAppointmentWhatsAppUrl", () => {
  it("gera o link com o número normalizado", () => {
    const url =
      buildAppointmentWhatsAppUrl(appointment);

    expect(url).toMatch(
      /^https:\/\/wa\.me\/5521999999999\?text=/,
    );
  });

  it("inclui os dados do agendamento", () => {
    const url =
      buildAppointmentWhatsAppUrl(appointment);

    expect(url).not.toBeNull();

    const message = decodeURIComponent(
      url!.split("?text=")[1],
    );

    expect(message).toContain("Luis Braido");
    expect(message).toContain("Dayanne Braido");
    expect(message).toContain("Manicure em Gel");
    expect(message).toContain("25/08/2026");
    expect(message).toContain("14:30");
    expect(message).toContain("60 minutos");
    expect(message).toContain("R$ 75,00");
    expect(message).toContain("A1B2C3D4");
  });

  it("retorna null sem número cadastrado", () => {
    expect(
      buildAppointmentWhatsAppUrl({
        ...appointment,
        whatsappNumber: undefined,
      }),
    ).toBeNull();
  });

  it("rejeita número inválido", () => {
    expect(
      buildAppointmentWhatsAppUrl({
        ...appointment,
        whatsappNumber: "123",
      }),
    ).toBeNull();
  });
});

describe("buildBookingGapWhatsAppUrl", () => {
  const gap = {
    whatsappNumber: "55 (21) 99999-9999",
    clientName: "Luis Braido",
    professionalName: "Eliane Cristina",
    serviceName: "Micropigmentação",
    date: "2026-08-25",
    gapStart: "09:40",
    gapEnd: "10:10",
    availableMinutes: 30,
    serviceDuration: 90,
  };

  it("gera o link de consulta de encaixe", () => {
    const url = buildBookingGapWhatsAppUrl(gap);

    expect(url).toMatch(
      /^https:\/\/wa\.me\/5521999999999\?text=/,
    );
  });

  it("inclui os dados do intervalo disponível", () => {
    const url = buildBookingGapWhatsAppUrl(gap);

    expect(url).not.toBeNull();

    const message = decodeURIComponent(
      url!.split("?text=")[1],
    );

    expect(message).toContain("Luis Braido");
    expect(message).toContain("Eliane Cristina");
    expect(message).toContain("Micropigmentação");
    expect(message).toContain("25/08/2026");
    expect(message).toContain("09:40 às 10:10");
    expect(message).toContain("30 minutos");
    expect(message).toContain(
      "Duração normal do serviço: 90 minutos",
    );
    expect(message).toContain("possibilidade de um encaixe");
  });

  it("retorna null sem WhatsApp cadastrado", () => {
    expect(
      buildBookingGapWhatsAppUrl({
        ...gap,
        whatsappNumber: undefined,
      }),
    ).toBeNull();
  });

  it("rejeita número inválido", () => {
    expect(
      buildBookingGapWhatsAppUrl({
        ...gap,
        whatsappNumber: "123",
      }),
    ).toBeNull();
  });
});