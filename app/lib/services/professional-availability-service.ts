import { createClient } from "../../../lib/supabase/client";
import {
  BOOKING_START_INTERVAL_MINUTES,
} from "../booking-grid";
export type ProfessionalAvailabilityRule = {
  id: string | null;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  active: boolean;
};

type AvailabilityRuleRow = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  active: boolean;
};

export async function getProfessionalAvailability(
  professionalId: string,
): Promise<ProfessionalAvailabilityRule[]> {
  const { data, error } = await createClient()
    .from("availability_rules")
    .select(`
      id,
      weekday,
      start_time,
      end_time,
      slot_minutes,
      active
    `)
    .eq("professional_id", professionalId)
    .is("valid_from", null)
    .is("valid_until", null)
    .order("weekday", { ascending: true });

  if (error) throw error;

  return ((data || []) as AvailabilityRuleRow[]).map((rule) => ({
    id: rule.id,
    weekday: rule.weekday,
    startTime: rule.start_time.slice(0, 5),
    endTime: rule.end_time.slice(0, 5),
    slotMinutes: BOOKING_START_INTERVAL_MINUTES,
    active: rule.active,
  }));
}

export async function saveProfessionalAvailability(
  professionalId: string,
  rules: ProfessionalAvailabilityRule[],
): Promise<void> {
  const supabase = createClient();

  for (const rule of rules) {
    const values = {
      professional_id: professionalId,
      weekday: rule.weekday,
      start_time: rule.startTime,
      end_time: rule.endTime,
      slot_minutes: BOOKING_START_INTERVAL_MINUTES,
      active: rule.active,
      valid_from: null,
      valid_until: null,
    };

    if (rule.id) {
      const { error } = await supabase
        .from("availability_rules")
        .update(values)
        .eq("id", rule.id)
        .eq("professional_id", professionalId);

      if (error) {
        throw new Error(
          [
            error.message,
            error.details,
            error.hint,
            error.code
              ? `Código: ${error.code}`
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
        );
      }
    } else {
      const { error } = await supabase
        .from("availability_rules")
        .insert(values);

      if (error) {
        throw new Error(
          [
            error.message,
            error.details,
            error.hint,
            error.code
              ? `Código: ${error.code}`
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
        );
      }
    }
  }
}