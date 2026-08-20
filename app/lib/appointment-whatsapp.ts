export type AppointmentWhatsAppInput = {
  whatsappNumber?: string;
  clientName: string;
  professionalName: string;
  serviceName: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  appointmentId: string;
};

function normalizeWhatsAppNumber(number: string): string {
  return number.replace(/\D/g, "");
}

function formatAppointmentDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(
    "pt-BR",
  );
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
    .format(price)
    .replace(/[\u00A0\u202F]/g, " ");
}

export function buildAppointmentWhatsAppUrl(
  input: AppointmentWhatsAppInput,
): string | null {
  if (!input.whatsappNumber) return null;

  const number = normalizeWhatsAppNumber(
    input.whatsappNumber,
  );

  if (number.length < 10 || number.length > 15) {
    return null;
  }

  const message = [
    `Olá, ${input.professionalName}! Acabei de realizar um agendamento pelo site do SPA Express Cambucás.`,
    "",
    `Cliente: ${input.clientName}`,
    `Serviço: ${input.serviceName}`,
    `Data: ${formatAppointmentDate(input.date)}`,
    `Horário: ${input.time}`,
    `Duração: ${input.duration} minutos`,
    `Valor: ${formatPrice(input.price)}`,
    `Código: ${input.appointmentId.slice(0, 8).toUpperCase()}`,
    "",
    "Estou enviando os dados para facilitar nossa comunicação.",
  ].join("\n");

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}