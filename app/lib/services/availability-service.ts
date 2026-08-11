import { createClient } from "../../../lib/supabase/client";

export type AvailableSlot = {
  start: string;
  end: string;
  label: string;
};

export async function getAvailableSlots(professionalId: string, serviceId: string, date: string): Promise<AvailableSlot[]> {
  const { data, error } = await createClient().rpc("get_available_slots", {
    p_professional_id: professionalId,
    p_service_id: serviceId,
    p_date: date,
  });

  if (error) throw error;
  return (data || []).map((slot: { slot_start: string; slot_end: string; slot_label: string }) => ({
    start: slot.slot_start,
    end: slot.slot_end,
    label: slot.slot_label,
  }));
}