import { createClient } from "../../../lib/supabase/client";
import { normalizeBrazilianPhone } from "../validations/client-signup";

type Relation<T> = T | T[] | null;
const one = <T,>(value: Relation<T>) =>
  Array.isArray(value) ? value[0] ?? null : value;

export type AdminClient = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  active: boolean;
  lastService: string | null;
  lastVisit: string | null;
  totalAppointments: number;
  completedAppointments: number;
  noShows: number;
  nextAppointment: string | null;
  futureActiveAppointments: number;
  paidTotal: number;
  professionalIds: string[];
};

export type AdminClientAppointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  notes: string | null;
  cancellationReason: string | null;
  serviceName: string;
  professionalName: string;
  paidAmount: number;
  paymentStatus: string;
  paymentMethod: string | null;
};

export type AdminClientDetails = AdminClient & {
  birthDate: string | null;
  clientNotes: string | null;
  appointments: AdminClientAppointment[];
  preferences: { email: boolean; whatsapp: boolean; inApp: boolean } | null;
};

type SummaryAppointment = {
  start_at: string;
  end_at: string;
  status: string;
  professional_id: string;
  services: Relation<{ name: string }>;
  payments: Relation<{ amount: number | string; status: string }>;
};

export async function getAdminClients(): Promise<AdminClient[]> {
  const { data, error } = await createClient()
    .from("profiles")
    .select(
      `id,full_name,email,phone,avatar_url,active,created_at,appointments!appointments_client_id_fkey(start_at,end_at,status,professional_id,services(name),payments(amount,status))`
    )
    .eq("role", "client")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Não foi possível carregar os clientes.");
  }

  const now = new Date().toISOString();

  return (data || []).map((profile) => {
    const appointments = (profile.appointments || []) as unknown as SummaryAppointment[];

    const validPast = appointments
      .filter((item) => item.start_at < now && item.status !== "cancelled")
      .sort((a, b) => b.start_at.localeCompare(a.start_at));

    const future = appointments
      .filter((item) => item.start_at >= now && ["pending", "confirmed"].includes(item.status))
      .sort((a, b) => a.start_at.localeCompare(b.start_at));

    const paidTotal = appointments.reduce((total, item) => {
      const payment = one(item.payments);
      return (
        total +
        (payment?.status === "paid" && item.status !== "cancelled"
          ? Number(payment.amount || 0)
          : 0)
      );
    }, 0);

    return {
      id: profile.id,
      name: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      avatarUrl: profile.avatar_url,
      createdAt: profile.created_at,
      active: profile.active,
      lastService: validPast[0] ? one(validPast[0].services)?.name || null : null,
      lastVisit: validPast[0]?.start_at || null,
      totalAppointments: appointments.filter((item) => item.status !== "cancelled").length,
      completedAppointments: appointments.filter((item) => item.status === "completed").length,
      noShows: appointments.filter((item) => item.status === "no_show").length,
      nextAppointment: future[0]?.start_at || null,
      futureActiveAppointments: future.length,
      paidTotal,
      professionalIds: [...new Set(appointments.map((item) => item.professional_id))],
    };
  });
}

export async function getAdminClientProfessionals() {
  const { data, error } = await createClient()
    .from("professionals")
    .select("id,display_name")
    .order("display_name");

  if (error) {
    throw new Error("Não foi possível carregar as profissionais.");
  }

  return (data || []).map((item) => ({ id: item.id, name: item.display_name }));
}

export async function getAdminClientDetails(
  client: AdminClient
): Promise<AdminClientDetails> {
  const supabase = createClient();

  const [profile, appointments, preferences] = await Promise.all([
    supabase.from("profiles").select("birth_date,client_notes").eq("id", client.id).single(),
    supabase
      .from("appointments")
      .select(
        "id,start_at,end_at,status,notes,cancellation_reason,services(name),professionals(display_name),payments(amount,status,method)"
      )
      .eq("client_id", client.id)
      .order("start_at", { ascending: false }),
    supabase
      .from("notification_preferences")
      .select("email_enabled,whatsapp_enabled,in_app_enabled")
      .eq("profile_id", client.id)
      .maybeSingle(),
  ]);

  if (profile.error || appointments.error || preferences.error) {
    throw new Error("Não foi possível carregar os detalhes da cliente.");
  }

  return {
    ...client,
    birthDate: profile.data.birth_date,
    clientNotes: profile.data.client_notes,
    appointments: (appointments.data || []).map((item) => {
      const payment = one(
        item.payments as Relation<{
          amount: number | string;
          status: string;
          method: string | null;
        }>
      );

      return {
        id: item.id,
        startAt: item.start_at,
        endAt: item.end_at,
        status: item.status,
        notes: item.notes,
        cancellationReason: item.cancellation_reason,
        serviceName:
          one(item.services as Relation<{ name: string }>)?.name || "Serviço não informado",
        professionalName:
          one(item.professionals as Relation<{ display_name: string }>)?.display_name ||
          "Profissional não informada",
        paidAmount:
          payment?.status === "paid" && item.status !== "cancelled"
            ? Number(payment.amount || 0)
            : 0,
        paymentStatus: payment?.status || "pending",
        paymentMethod: payment?.method || null,
      };
    }),
    preferences: preferences.data
      ? {
          email: preferences.data.email_enabled,
          whatsapp: preferences.data.whatsapp_enabled,
          inApp: preferences.data.in_app_enabled,
        }
      : null,
  };
}

export async function updateAdminClient(
  clientId: string,
  input: { name: string; phone?: string; active: boolean }
) {
  const values: { full_name: string; active: boolean; phone?: string | null } = {
    full_name: input.name.trim().replace(/\s+/g, " "),
    active: input.active,
  };

  if (input.phone !== undefined) {
    const digits = normalizeBrazilianPhone(input.phone);
    values.phone = digits ? `55${digits}` : null;
  }

  const { error } = await createClient()
    .from("profiles")
    .update(values)
    .eq("id", clientId)
    .eq("role", "client");

  if (error) {
    throw new Error("Não foi possível atualizar a cliente.");
  }
}

export async function inviteAdminClient(input: {
  name: string;
  email: string;
  phone: string;
  active: boolean;
}) {
  const supabase = createClient();
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) {
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  const response = await fetch("/api/admin/clients", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const body = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(body.error || "Não foi possível convidar a cliente.");
  }
}