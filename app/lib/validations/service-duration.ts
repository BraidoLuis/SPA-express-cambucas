export const MIN_SERVICE_DURATION_MINUTES = 30;

export function isValidServiceDuration(
  duration: number,
): boolean {
  return (
    Number.isInteger(duration) &&
    duration >= MIN_SERVICE_DURATION_MINUTES
  );
}

export function validateServiceDuration(
  duration: number,
  fieldName = "A duração do serviço",
): void {
  if (!isValidServiceDuration(duration)) {
    throw new Error(
      `${fieldName} deve ser um número inteiro de pelo menos ${MIN_SERVICE_DURATION_MINUTES} minutos.`,
    );
  }
}