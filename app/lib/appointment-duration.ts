export function appointmentDurationMinutes(
  start: string,
  end: string,
  fallback = 0,
): number {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const difference = endTime - startTime;

  if (
    !Number.isFinite(difference) ||
    difference <= 0
  ) {
    return fallback;
  }

  return Math.round(difference / 60_000);
}