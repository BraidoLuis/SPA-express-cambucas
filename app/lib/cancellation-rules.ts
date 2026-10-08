import { BookingError } from "./booking-errors";

// A flag controla a antecedência, e não a autorização geral de cancelamento.
export type CancellationRules = {
  cancellationEnabled: boolean;
  cancellationNoticeHours: number;
};

export function parseCancellationRules(value: unknown): CancellationRules | null {
  if (!value || typeof value !== "object") return null;
  const rules = value as { cancellationEnabled?: unknown; cancellationNoticeHours?: unknown };
  // Sem uma configuração identificável, a interface mantém a ação bloqueada.
  if (typeof rules.cancellationEnabled !== "boolean") return null;

  // Contrato do trigger validate_configured_client_cancellation_notice_017:
  // o texto deve ter 1 a 5 dígitos; qualquer outro valor usa zero.
  // O endpoint lê ->> para preservar, por exemplo, "2.0" sem convertê-lo em 2.
  const hoursText = typeof rules.cancellationNoticeHours === "string"
    ? rules.cancellationNoticeHours
    : typeof rules.cancellationNoticeHours === "number" ? String(rules.cancellationNoticeHours) : "";
  const validHours = /^[0-9]{1,5}$/.exec(hoursText)?.[0] === hoursText;
  return {
    cancellationEnabled: rules.cancellationEnabled,
    cancellationNoticeHours: validHours ? Number(hoursText) : 0,
  };
}

export function cancellationMessage(rules: CancellationRules | null) {
  if (!rules) return "Não foi possível consultar as regras de cancelamento. Tente atualizar os agendamentos.";
  if (!rules.cancellationEnabled) return "Não há antecedência mínima de cancelamento. O atendimento deve ser futuro e estar pendente ou confirmado.";
  return `Cancelamentos online exigem mais de ${rules.cancellationNoticeHours} hora(s) de antecedência, em atendimentos pendentes ou confirmados.`;
}

export function canClientCancelAppointment(start: string, rules: CancellationRules | null, now = Date.now()) {
  const appointmentTime = Date.parse(start);
  if (!rules || !Number.isFinite(appointmentTime) || appointmentTime <= now) return false;
  if (!rules.cancellationEnabled) return true;
  return appointmentTime > now + rules.cancellationNoticeHours * 60 * 60 * 1000;
}

// Usado tanto na abertura quanto na confirmação. O relógio é consultado após a leitura.
export async function revalidateCancellation(start: string, load: () => Promise<CancellationRules>, now = Date.now) {
  const rules = await load();
  if (!canClientCancelAppointment(start, rules, now())) {
    throw new BookingError(cancellationUnavailableMessage(rules));
  }
  return rules;
}

export function cancellationUnavailableMessage(rules: CancellationRules | null) {
  if (!rules) return cancellationMessage(null);
  return rules.cancellationEnabled
    ? "O prazo para cancelamento online terminou. " + cancellationMessage(rules)
    : "O atendimento já iniciou ou não é futuro. Não é possível cancelar.";
}
