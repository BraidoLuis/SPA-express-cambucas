import { createClient } from "../../../lib/supabase/client";

export type ProfessionalTimeOff = {
  id: string;
  date: string;
  reason: string | null;
};

type TimeOffRow = {
  id: string;
  exception_date: string;
  reason: string | null;
};

export async function getProfessionalTimeOffs(
  professionalId: string,
): Promise<ProfessionalTimeOff[]> {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await createClient()
    .from("availability_exceptions")
    .select("id,exception_date,reason")
    .eq("professional_id", professionalId)
    .eq("available", false)
    .gte("exception_date", today)
    .order("exception_date", { ascending: true });

  if (error) throw error;

  return ((data || []) as TimeOffRow[]).map((item) => ({
    id: item.id,
    date: item.exception_date,
    reason: item.reason,
  }));
}

export async function createProfessionalTimeOff(
  professionalId: string,
  date: string,
  reason: string,
): Promise<void> {
  const supabase = createClient();

  const { data: existing, error: findError } = await supabase
    .from("availability_exceptions")
    .select("id")
    .eq("professional_id", professionalId)
    .eq("exception_date", date)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { error } = await supabase
      .from("availability_exceptions")
      .update({
        available: false,
        start_time: null,
        end_time: null,
        reason: reason.trim() || "Folga",
      })
      .eq("id", existing.id)
      .eq("professional_id", professionalId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("availability_exceptions")
    .insert({
      professional_id: professionalId,
      exception_date: date,
      available: false,
      start_time: null,
      end_time: null,
      reason: reason.trim() || "Folga",
    });

  if (error) throw error;
}

export async function deleteProfessionalTimeOff(
  professionalId: string,
  timeOffId: string,
): Promise<void> {
  const { error } = await createClient()
    .from("availability_exceptions")
    .delete()
    .eq("id", timeOffId)
    .eq("professional_id", professionalId);

  if (error) throw error;
}