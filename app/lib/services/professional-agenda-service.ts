import { createClient } from "../../../lib/supabase/client";
import {
  appointmentDurationMinutes,
} from "../appointment-duration";
export type ProfessionalAppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type ProfessionalAppointment = {
  id: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  serviceName: string;
  duration: number;
  start: string;
  end: string;
  status: ProfessionalAppointmentStatus;
  outsideSchedule: boolean;
  paymentAmount: number;
  paymentStatus:
    | "pending"
    | "paid"
    | "refunded"
    | "cancelled";
};

type AgendaRow = {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  start_at: string;
  end_at: string;
  status: ProfessionalAppointmentStatus;
  outside_schedule: boolean;
  services: {
    name: string;
    duration_minutes: number;
  } | null;
  payments:
    | {
        amount: number;
        status: ProfessionalAppointment["paymentStatus"];
      }
    | Array<{
        amount: number;
        status: ProfessionalAppointment["paymentStatus"];
      }>
    | null;
};

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function getProfessionalAgenda(
  professionalId: string,
  month: string,
): Promise<ProfessionalAppointment[]> {
  const range = monthRange(month);

  const { data, error } = await createClient()
    .from("appointments")
    .select(`
      id,
      client_name,
      client_email,
      client_phone,
      start_at,
      end_at,
      status,
      outside_schedule,
      services(name,duration_minutes),
      payments(amount,status)
    `)
    .eq("professional_id", professionalId)
    .gte("start_at", range.start)
    .lt("start_at", range.end)
    .order("start_at", { ascending: true });

  if (error) throw error;

  return ((data || []) as unknown as AgendaRow[]).map(
    (row) => {
      const payment = Array.isArray(row.payments)
        ? row.payments[0]
        : row.payments;

      const actualDuration =
        appointmentDurationMinutes(
          row.start_at,
          row.end_at,
          row.services?.duration_minutes ?? 0,
        );

      return {
        id: row.id,
        clientName: row.client_name,
        clientEmail: row.client_email,
        clientPhone: row.client_phone,
        serviceName:
          row.services?.name ||
          "Serviço não informado",
        duration: actualDuration,
        start: row.start_at,
        end: row.end_at,
        status: row.status,
        outsideSchedule: row.outside_schedule,
        paymentAmount: Number(payment?.amount || 0),
        paymentStatus:
          payment?.status || "pending",
      };
    },
  );
}

export async function updateProfessionalAppointmentStatus(
  appointmentId: string,
  status: ProfessionalAppointmentStatus,
  reason?: string,
) {
  const { error } = await createClient().rpc(
    "update_professional_appointment_status",
    {
      p_appointment_id: appointmentId,
      p_status: status,
      p_reason: reason || null,
    },
  );

  if (error) throw error;
}

export async function completeProfessionalAppointment(
  input: {
    appointmentId: string;
    paymentReceived: boolean;
    paymentMethod?:
      | "pix"
      | "dinheiro"
      | "cartao"
      | "outro";
    paymentNotes?: string;
  },
) {
  const { error } = await createClient().rpc(
    "complete_professional_appointment",
    {
      p_appointment_id: input.appointmentId,
      p_payment_received: input.paymentReceived,
      p_payment_method: input.paymentReceived
        ? input.paymentMethod
        : null,
      p_payment_notes:
        input.paymentNotes?.trim() || null,
    },
  );

  if (error) throw error;
}