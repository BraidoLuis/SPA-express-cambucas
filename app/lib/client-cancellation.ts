import { cancelClientAppointment, type ClientAppointment } from "./services/appointment-service";

export function applyConfirmedClientCancellation(appointments: ClientAppointment[], appointmentId: string) {
  return appointments.map((item) =>
    item.id === appointmentId && (item.status === "pending" || item.status === "confirmed")
      ? { ...item, status: "cancelled" as const }
      : item,
  );
}

// A confirmação local precede a recarga e permanece válida se esta falhar.
export async function cancelAndRefreshClientAppointment(
  appointmentId: string,
  callbacks: {
    isCurrent: () => boolean;
    onConfirmed: () => void;
    reload: () => Promise<void>;
  },
) {
  await cancelClientAppointment(appointmentId);
  if (!callbacks.isCurrent()) return;
  callbacks.onConfirmed();
  await callbacks.reload();
}
