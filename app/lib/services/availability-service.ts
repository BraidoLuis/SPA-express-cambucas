import { createClient } from "../../../lib/supabase/client";

export type AvailableSlot = {
  start: string;
  end: string;
  label: string;
};

export type BookingGapSuggestion = {
  start: string;
  end: string;
  availableMinutes: number;
  startLabel: string;
  endLabel: string;
};

export async function getAvailableSlots(
  professionalId: string,
  serviceId: string,
  date: string,
): Promise<AvailableSlot[]> {
  const { data, error } = await createClient().rpc(
    "get_available_slots",
    {
      p_professional_id: professionalId,
      p_service_id: serviceId,
      p_date: date,
    },
  );

  if (error) throw error;

  return (data || []).map(
    (slot: {
      slot_start: string;
      slot_end: string;
      slot_label: string;
    }) => ({
      start: slot.slot_start,
      end: slot.slot_end,
      label: slot.slot_label,
    }),
  );
}

export async function getBookingGapSuggestions(
  professionalId: string,
  serviceId: string,
  date: string,
): Promise<BookingGapSuggestion[]> {
  const { data, error } = await createClient().rpc(
    "get_booking_gap_suggestions",
    {
      p_professional_id: professionalId,
      p_service_id: serviceId,
      p_date: date,
    },
  );

  if (error) throw error;

  return (data || []).map(
    (gap: {
      gap_start: string;
      gap_end: string;
      available_minutes: number;
      gap_start_label: string;
      gap_end_label: string;
    }) => ({
      start: gap.gap_start,
      end: gap.gap_end,
      availableMinutes: Number(gap.available_minutes),
      startLabel: gap.gap_start_label,
      endLabel: gap.gap_end_label,
    }),
  );
}