export class BookingError extends Error {}

export function bookingErrorMessage(error: unknown, operation: "create" | "cancel" | "update") {
  if (error instanceof BookingError) return error.message;
  const detail = error && typeof error === "object" ? error as { code?: string; message?: string } : {};
  const message = typeof detail.message === "string" ? detail.message.toLocaleLowerCase("pt-BR") : "";
  if (detail.code === "42501" || detail.code === "PGRST301" || message.includes("acesso negado") || message.includes("sessão") || message.includes("não autorizado")) {
    return "Sua sessão não permite esta operação. Entre novamente e confira seus agendamentos.";
  }
  if (operation === "cancel" && (message.includes("antecedência") || message.includes("prazo") || message.includes("cancelamento deve ser solicitado"))) {
    return "O prazo para cancelamento online terminou. Entre em contato com o SPA.";
  }
  if (detail.code === "23P01" || message.includes("appointments_no_professional_overlap") || message.includes("conflict") || message.includes("ocupado") || message.includes("não está mais disponível") || message.includes("acabou de ser reservado")) {
    return "Este horário não está mais disponível. Escolha outro horário.";
  }
  if (message.includes("já possui um horário ativo")) return "Você já possui um horário ativo com esta profissional na data selecionada.";
  if (message.includes("limite de 3 agendamentos futuros")) return "Você atingiu o limite de 3 agendamentos futuros.";
  if (message.includes("serviço não encontrado")) return "Esse serviço não está mais disponível para a profissional.";
  if (message.includes("futuro") && operation === "update") return "Esse atendimento futuro ainda não pode ser concluído ou marcado como ausência.";
  return operation === "create"
    ? "Não foi possível confirmar a reserva. Confira seus agendamentos antes de tentar criar outra."
    : "Não foi possível confirmar a alteração. Atualize seus agendamentos para conferir o resultado.";
}

export function confirmedAppointmentId(data: unknown): string {
  if (typeof data !== "string" || !data.trim()) {
    throw new BookingError("Não foi possível confirmar a reserva. Confira seus agendamentos antes de tentar criar outra.");
  }
  return data;
}
