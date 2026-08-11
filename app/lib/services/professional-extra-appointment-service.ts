import { createClient } from "../../../lib/supabase/client";

export type CreateExtraAppointmentInput = {
  serviceId: string;
  clientName: string;
  date: string;
  time: string;
  duration: number;
  notes?: string;
};

export async function createProfessionalExtraAppointment(
  input: CreateExtraAppointmentInput,
): Promise<string> {
  const startDate = new Date(
    `${input.date}T${input.time}:00-03:00`,
  );

  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Data ou horário inválido.");
  }

  const { data, error } = await createClient().rpc(
    "create_professional_extra_appointment",
    {
      p_service_id: input.serviceId,
      p_client_name: input.clientName.trim(),
      p_start_at: startDate.toISOString(),
      p_duration_minutes: input.duration,
      p_notes: input.notes?.trim() || null,
    },
  );

  if (error) throw error;

  return data as string;
}