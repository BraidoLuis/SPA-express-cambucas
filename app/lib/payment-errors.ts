export class PaymentOperationError extends Error {}

export function paymentErrorMessage(error: unknown, operation: "payment" | "completion") {
  if (error instanceof PaymentOperationError) return error.message;
  const details = error && typeof error === "object"
    ? error as { code?: unknown; message?: unknown } : {};
  if (details.code === "42501" || details.code === "PGRST301" || details.code === "PGRST303") {
    return "Sua sessão não permite essa operação. Entre novamente e atualize os dados.";
  }
  if (operation === "completion" && typeof details.message === "string") {
    if (details.message.includes("atendimento futuro")) return "Esse atendimento ainda não pode ser concluído.";
    if (details.message.includes("Somente atendimentos confirmados")) {
      return "O atendimento não está mais confirmado. Atualize a agenda antes de continuar.";
    }
  }
  return operation === "payment"
    ? "Não foi possível confirmar o resultado do pagamento. Atualize os dados antes de tentar novamente."
    : "Não foi possível confirmar o resultado da conclusão. Atualize a agenda antes de tentar novamente.";
}

export const paymentConfirmationUncertain =
  "O pagamento não teve confirmação completa. Pode já ter sido confirmado ou alterado. Atualize os dados antes de tentar novamente.";

export const completionConfirmationUncertain =
  "Não foi possível verificar a conclusão do atendimento. Ela pode ter sido salva. Atualize a agenda antes de tentar novamente.";
