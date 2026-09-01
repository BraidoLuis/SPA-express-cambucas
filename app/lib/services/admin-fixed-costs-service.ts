import { createClient } from "../../../lib/supabase/client";

export type FixedCostRecurrence = "monthly" | "annual";

export type FixedCost = {
  id: string;
  name: string;
  category: string;
  amount: number;
  recurrence: FixedCostRecurrence;
  dueDay: number;
  annualDueMonth: number | null;
  startsOn: string;
  endsOn: string | null;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FixedCostInput = Omit<FixedCost, "id" | "createdAt" | "updatedAt">;

type Row = {
  id: string;
  name: string;
  category: string;
  amount: number | string;
  recurrence: FixedCostRecurrence;
  due_day: number;
  annual_due_month: number | null;
  starts_on: string;
  ends_on: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const map = (x: Row): FixedCost => ({
  id: x.id,
  name: x.name,
  category: x.category,
  amount: Number(x.amount),
  recurrence: x.recurrence,
  dueDay: x.due_day,
  annualDueMonth: x.annual_due_month,
  startsOn: x.starts_on,
  endsOn: x.ends_on,
  active: x.active,
  notes: x.notes,
  createdAt: x.created_at,
  updatedAt: x.updated_at,
});

const payload = (x: FixedCostInput) => ({
  name: x.name.trim().replace(/\s+/g, " "),
  category: x.category.trim().replace(/\s+/g, " "),
  amount: x.amount,
  recurrence: x.recurrence,
  due_day: x.dueDay,
  annual_due_month: x.recurrence === "annual" ? x.annualDueMonth : null,
  starts_on: x.startsOn,
  ends_on: x.endsOn || null,
  active: x.active,
  notes: x.notes?.trim() || null,
});

export async function listFixedCosts(): Promise<FixedCost[]> {
  const { data, error } = await createClient()
    .from("fixed_costs")
    .select("*")
    .order("active", { ascending: false })
    .order("name");

  if (error) {
    throw new Error(
      error.code === "42P01"
        ? "Custos indisponíveis. Execute a migration 016."
        : "Não foi possível carregar os custos fixos."
    );
  }

  return ((data || []) as Row[]).map(map);
}

export async function createFixedCost(input: FixedCostInput) {
  const s = createClient();
  const { data: u } = await s.auth.getUser();

  if (!u.user) {
    throw new Error("Sessão expirada.");
  }

  const { data, error } = await s
    .from("fixed_costs")
    .insert({
      ...payload(input),
      created_by: u.user.id,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Já existe um custo ativo com estes dados."
        : error.message
    );
  }

  return map(data as Row);
}

export async function updateFixedCost(id: string, input: FixedCostInput) {
  const { data, error } = await createClient()
    .from("fixed_costs")
    .update(payload(input))
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return map(data as Row);
}

export async function setFixedCostActive(id: string, active: boolean) {
  const { error } = await createClient()
    .from("fixed_costs")
    .update({ active })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export type CostOccurrence = {
  costId: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  recurrence: FixedCostRecurrence;
};

function localDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function isoLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function calculateCostOccurrences(
  costs: FixedCost[],
  start: string,
  endExclusive: string
): CostOccurrence[] {
  const startDate = localDate(start.slice(0, 10));
  const endDate = localDate(endExclusive.slice(0, 10));
  const out: CostOccurrence[] = [];

  for (const cost of costs) {
    if (!cost.active) continue;

    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1, 12);

    while (cursor < endDate) {
      if (
        cost.recurrence === "monthly" ||
        cursor.getMonth() + 1 === cost.annualDueMonth
      ) {
        const day = Math.min(
          cost.dueDay,
          new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
        );

        const date = new Date(cursor.getFullYear(), cursor.getMonth(), day, 12);
        const key = isoLocal(date);

        if (
          date >= startDate &&
          date < endDate &&
          key >= cost.startsOn &&
          (!cost.endsOn || key <= cost.endsOn)
        ) {
          out.push({
            costId: cost.id,
            name: cost.name,
            category: cost.category,
            amount: cost.amount,
            date: key,
            recurrence: cost.recurrence,
          });
        }
      }

      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}