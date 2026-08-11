import { createClient } from "../../../lib/supabase/client";

export type CreateAppointmentInput = {
  professionalId: string;
  serviceId: string;
  slotStart: string;
  notes?: string;
};

export type ClientAppointment = {
  id: string;
  start: string;
  end: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  serviceName: string;
  category: string;
  duration: number;
  professionalName: string;
  price: number;
  paymentStatus:
  | "pending"
  | "paid"
  | "refunded"
  | "cancelled";
};

type AppointmentRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: ClientAppointment["status"];
  notes: string | null;
  services: { name: string; category: string; duration_minutes: number };
  professionals: { display_name: string };
  payments:
  | {
      amount: number;
      status: ClientAppointment["paymentStatus"];
    }
  | Array<{
      amount: number;
      status: ClientAppointment["paymentStatus"];
    }>
  | null;
};

export async function createClientAppointment(input: CreateAppointmentInput): Promise<string> {
  const { data, error } = await createClient().rpc("create_client_appointment", {
    p_professional_id: input.professionalId,
    p_service_id: input.serviceId,
    p_slot_start: input.slotStart,
    p_notes: input.notes?.trim() || null,
  });

  if (error) throw error;
  if (!data) throw new Error("O agendamento não retornou um identificador.");
  return data as string;
}

export async function getClientAppointments(): Promise<ClientAppointment[]> {
  const { data, error } = await createClient()
    .from("appointments")
    .select(`
      id,
      start_at,
      end_at,
      status,
      notes,
      services!inner(name,category,duration_minutes),
      professionals!inner(display_name),
      payments(amount,status)
    `)
    .order("start_at", { ascending: false });

  if (error) throw error;

    return ((data || []) as unknown as AppointmentRow[]).map((row) => {
    const payment = Array.isArray(row.payments)
        ? row.payments[0]
        : row.payments;

    return {
        id: row.id,
        start: row.start_at,
        end: row.end_at,
        status: row.status,
        notes: row.notes,
        serviceName: row.services.name,
        category: row.services.category,
        duration: row.services.duration_minutes,
        professionalName: row.professionals.display_name,
        price: Number(payment?.amount || 0),
        paymentStatus: payment?.status || "pending",
    };
    });
}

export async function cancelClientAppointment(appointmentId: string) {
  const { error } = await createClient()
    .from("appointments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "Cancelado pela cliente",
    })
    .eq("id", appointmentId);

  if (error) throw error;
}
