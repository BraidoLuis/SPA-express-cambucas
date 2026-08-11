import { createClient } from "../../../lib/supabase/client";

export type ProfessionalScheduleBlock = {
  id: string;
  start: string;
  end: string;
  reason: string | null;
};

type ScheduleBlockRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

export type CreateScheduleBlockInput = {
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
};

export async function getProfessionalScheduleBlocks(
  professionalId: string,
  month: string,
): Promise<ProfessionalScheduleBlock[]> {
  const monthStart = new Date(
    `${month}-01T00:00:00-03:00`,
  );

  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  const { data, error } = await createClient()
    .from("schedule_blocks")
    .select("id,starts_at,ends_at,reason")
    .eq("professional_id", professionalId)
    .lt("starts_at", nextMonth.toISOString())
    .gt("ends_at", monthStart.toISOString())
    .order("starts_at", { ascending: true });

  if (error) throw error;

  return ((data || []) as ScheduleBlockRow[]).map((block) => ({
    id: block.id,
    start: block.starts_at,
    end: block.ends_at,
    reason: block.reason,
  }));
}

export async function createProfessionalScheduleBlock(
  input: CreateScheduleBlockInput,
): Promise<string> {
  const startsAt = new Date(
    `${input.date}T${input.startTime}:00-03:00`,
  );

  const endsAt = new Date(
    `${input.date}T${input.endTime}:00-03:00`,
  );

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime())
  ) {
    throw new Error("Data ou horário inválido.");
  }

  if (endsAt <= startsAt) {
    throw new Error(
      "O horário final deve ser posterior ao inicial.",
    );
  }

  const { data, error } = await createClient().rpc(
    "create_professional_schedule_block",
    {
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
      p_reason: input.reason?.trim() || null,
    },
  );

  if (error) throw error;

  return data as string;
}

export async function deleteProfessionalScheduleBlock(
  professionalId: string,
  blockId: string,
): Promise<void> {
  const { error } = await createClient()
    .from("schedule_blocks")
    .delete()
    .eq("id", blockId)
    .eq("professional_id", professionalId);

  if (error) throw error;
}