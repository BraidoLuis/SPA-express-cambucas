import { createClient } from "../../../lib/supabase/client";

export type AdminTodayAppointment = {
  id: string;
  clientName: string;
  serviceName: string;
  professionalName: string;
  startAt: string;
  endAt: string;
  status: string;
  price: number;
  paymentStatus: string;
};

export type AdminServiceRanking = {
  serviceName: string;
  total: number;
};

export type AdminProfessionalSummary = {
  professionalName: string;
  specialty: string;
  appointmentsToday: number;
};

export type AdminOverview = {
  appointmentsToday: number;
  appointmentsThisMonth: number;
  completedThisMonth: number;
  clientsTotal: number;
  receivedThisMonth: number;
  pendingThisMonth: number;
  todayAppointments: AdminTodayAppointment[];
  serviceRanking: AdminServiceRanking[];
  professionals: AdminProfessionalSummary[];
};

type AppointmentDatabaseRow = {
  id: string;
  client_name: string | null;
  start_at: string;
  end_at: string;
  status: string;
  professional_id: string;
  service_id: string;
  professionals:
    | {
        display_name: string;
        specialty: string | null;
      }
    | {
        display_name: string;
        specialty: string | null;
      }[]
    | null;
  services:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
  payments:
    | {
        amount: number | string | null;
        status: string;
      }
    | {
        amount: number | string | null;
        status: string;
      }[]
    | null;
};

function firstRelation<T>(relation: T | T[] | null): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function localDateBoundary(date: Date, endOfDay = false) {
  const boundary = new Date(date);

  if (endOfDay) {
    boundary.setHours(23, 59, 59, 999);
  } else {
    boundary.setHours(0, 0, 0, 0);
  }

  return boundary.toISOString();
}

type ProfessionalDatabaseRow = {
  id: string;
  display_name: string;
  specialty: string | null;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = createClient();
  const now = new Date();

  const todayStart = localDateBoundary(now);
  const todayEnd = localDateBoundary(now, true);

  const monthStartDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  );

  const monthEndDate = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  );

  const monthStart = localDateBoundary(monthStartDate);
  const monthEnd = localDateBoundary(monthEndDate, true);

  const [
    todayResponse,
    monthResponse,
    clientsResponse,
    professionalsResponse,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(`
        id,
        client_name,
        start_at,
        end_at,
        status,
        professional_id,
        service_id,
        professionals (
          display_name,
          specialty
        ),
        services (
          name
        ),
        payments (
          amount,
          status
        )
      `)
      .gte("start_at", todayStart)
      .lte("start_at", todayEnd)
      .neq("status", "cancelled")
      .order("start_at", { ascending: true }),

    supabase
      .from("appointments")
      .select(`
        id,
        client_name,
        start_at,
        end_at,
        status,
        professional_id,
        service_id,
        professionals (
          display_name,
          specialty
        ),
        services (
          name
        ),
        payments (
          amount,
          status
        )
      `)
      .gte("start_at", monthStart)
      .lte("start_at", monthEnd),

    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "client")
      .eq("active", true),

    supabase
      .from("professionals")
      .select("id, display_name, specialty")
      .eq("active", true)
      .order("display_name"),
  ]);

  if (todayResponse.error) throw todayResponse.error;
  if (monthResponse.error) throw monthResponse.error;
  if (clientsResponse.error) throw clientsResponse.error;
  if (professionalsResponse.error) throw professionalsResponse.error;

  const todayRows =
    (todayResponse.data ?? []) as unknown as AppointmentDatabaseRow[];

  const monthRows =
    (monthResponse.data ?? []) as unknown as AppointmentDatabaseRow[];

  const todayAppointments = todayRows.map((appointment) => {
    const professional = firstRelation(appointment.professionals);
    const service = firstRelation(appointment.services);
    const payment = firstRelation(appointment.payments);

    return {
      id: appointment.id,
      clientName: appointment.client_name || "Cliente não informado",
      serviceName: service?.name || "Serviço não informado",
      professionalName:
        professional?.display_name || "Profissional não informada",
      startAt: appointment.start_at,
      endAt: appointment.end_at,
      status: appointment.status,
      price: Number(payment?.amount ?? 0),
      paymentStatus: payment?.status || "pending",
    };
  });

  const completedThisMonth = monthRows.filter(
    (appointment) => appointment.status === "completed",
  ).length;

  const validMonthAppointments = monthRows.filter(
    (appointment) => appointment.status !== "cancelled",
  );

  let receivedThisMonth = 0;
  let pendingThisMonth = 0;

  for (const appointment of validMonthAppointments) {
    const payment = firstRelation(appointment.payments);
    const amount = Number(payment?.amount ?? 0);

    if (payment?.status === "paid") {
      receivedThisMonth += amount;
    } else if (payment?.status === "pending") {
      pendingThisMonth += amount;
    }
  }

  const rankingMap = new Map<string, number>();

  for (const appointment of validMonthAppointments) {
    const service = firstRelation(appointment.services);
    const serviceName = service?.name || "Serviço não informado";

    rankingMap.set(
      serviceName,
      (rankingMap.get(serviceName) ?? 0) + 1,
    );
  }

  const serviceRanking = Array.from(rankingMap.entries())
    .map(([serviceName, total]) => ({
      serviceName,
      total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

    const professionalRows =
    (professionalsResponse.data ?? []) as ProfessionalDatabaseRow[];

    const professionals = professionalRows.map(
    (professional) => ({
      professionalName: professional.display_name,
      specialty: professional.specialty || "Profissional",
      appointmentsToday: todayRows.filter(
        (appointment) =>
          appointment.professional_id === professional.id,
      ).length,
    }),
  );

  return {
    appointmentsToday: todayRows.length,
    appointmentsThisMonth: validMonthAppointments.length,
    completedThisMonth,
    clientsTotal: clientsResponse.count ?? 0,
    receivedThisMonth,
    pendingThisMonth,
    todayAppointments,
    serviceRanking,
    professionals,
  };
}

export type AdminAppointment = AdminTodayAppointment;

export async function getAdminAppointments(): Promise<
  AdminAppointment[]
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select(`
      id,
      client_name,
      start_at,
      end_at,
      status,
      professional_id,
      service_id,
      professionals (
        display_name,
        specialty
      ),
      services (
        name
      ),
      payments (
        amount,
        status
      )
    `)
    .order("start_at", { ascending: false })
    .limit(500);

  if (error) {
    throw error;
  }

  const rows =
    (data ?? []) as unknown as AppointmentDatabaseRow[];

  return rows.map((appointment) => {
    const professional = firstRelation(
      appointment.professionals,
    );

    const service = firstRelation(appointment.services);
    const payment = firstRelation(appointment.payments);

    return {
      id: appointment.id,
      clientName:
        appointment.client_name || "Cliente não informado",
      serviceName:
        service?.name || "Serviço não informado",
      professionalName:
        professional?.display_name ||
        "Profissional não informada",
      startAt: appointment.start_at,
      endAt: appointment.end_at,
      status: appointment.status,
      price: Number(payment?.amount ?? 0),
      paymentStatus: payment?.status || "pending",
    };
  });
}

export type AdminPaymentMethod =
  | "pix"
  | "dinheiro"
  | "cartao"
  | "outro";

export type ConfirmAdminPaymentInput = {
  appointmentId: string;
  method: AdminPaymentMethod;
  notes?: string;
};

export async function confirmAdminPayment(
  input: ConfirmAdminPaymentInput,
): Promise<void> {
  const supabase = createClient();

  if (!input.appointmentId.trim()) {
    throw new Error("Agendamento inválido.");
  }

  const allowedMethods: AdminPaymentMethod[] = [
    "pix",
    "dinheiro",
    "cartao",
    "outro",
  ];

  if (!allowedMethods.includes(input.method)) {
    throw new Error("Forma de pagamento inválida.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  const { data, error } = await supabase
    .from("payments")
    .update({
      status: "paid",
      method: input.method,
      notes: input.notes?.trim() || null,
      confirmed_by: user.id,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("appointment_id", input.appointmentId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "O pagamento não foi encontrado ou já foi confirmado.",
    );
  }
}

export type AdminCalendarItem = {
  id: string;
  type: "appointment" | "block";
  professionalName: string;
  clientName: string | null;
  serviceName: string | null;
  startAt: string;
  endAt: string;
  status: string;
  outsideSchedule: boolean;
  reason: string | null;
  paymentStatus: string | null;
  price: number;
};

type AdminCalendarAppointmentRow = {
  id: string;
  client_name: string | null;
  start_at: string;
  end_at: string;
  status: string;
  outside_schedule: boolean | null;
  professionals:
    | {
        display_name: string;
      }
    | {
        display_name: string;
      }[]
    | null;
  services:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
  payments:
    | {
        amount: number | string | null;
        status: string;
      }
    | {
        amount: number | string | null;
        status: string;
      }[]
    | null;
};

type AdminCalendarBlockRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  professionals:
    | {
        display_name: string;
      }
    | {
        display_name: string;
      }[]
    | null;
};

function getMonthBoundaries(monthKey: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error("Mês inválido.");
  }

  const [year, month] = monthKey
    .split("-")
    .map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("Mês inválido.");
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function getAdminCalendar(
  monthKey: string,
): Promise<AdminCalendarItem[]> {
  const supabase = createClient();
  const boundaries = getMonthBoundaries(monthKey);

  const [appointmentsResponse, blocksResponse] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(`
          id,
          client_name,
          start_at,
          end_at,
          status,
          outside_schedule,
          professionals (
            display_name
          ),
          services (
            name
          ),
          payments (
            amount,
            status
          )
        `)
        .gte("start_at", boundaries.start)
        .lt("start_at", boundaries.end)
        .order("start_at", { ascending: true }),

      supabase
        .from("schedule_blocks")
        .select(`
          id,
          starts_at,
          ends_at,
          reason,
          professionals (
            display_name
          )
        `)
        .lt("starts_at", boundaries.end)
        .gt("ends_at", boundaries.start)
        .order("starts_at", { ascending: true }),
    ]);

  if (appointmentsResponse.error) {
    throw appointmentsResponse.error;
  }

  if (blocksResponse.error) {
    throw blocksResponse.error;
  }

  const appointmentRows =
    (appointmentsResponse.data ??
      []) as unknown as AdminCalendarAppointmentRow[];

  const blockRows =
    (blocksResponse.data ??
      []) as unknown as AdminCalendarBlockRow[];

  const appointments: AdminCalendarItem[] =
    appointmentRows.map((appointment) => {
      const professional = firstRelation(
        appointment.professionals,
      );

      const service = firstRelation(
        appointment.services,
      );

      const payment = firstRelation(
        appointment.payments,
      );

      return {
        id: appointment.id,
        type: "appointment",
        professionalName:
          professional?.display_name ||
          "Profissional não informada",
        clientName:
          appointment.client_name ||
          "Cliente não informado",
        serviceName:
          service?.name || "Serviço não informado",
        startAt: appointment.start_at,
        endAt: appointment.end_at,
        status: appointment.status,
        outsideSchedule:
          appointment.outside_schedule ?? false,
        reason: null,
        paymentStatus: payment?.status || "pending",
        price: Number(payment?.amount ?? 0),
      };
    });

  const blocks: AdminCalendarItem[] = blockRows.map(
    (block) => {
      const professional = firstRelation(
        block.professionals,
      );

      return {
        id: block.id,
        type: "block",
        professionalName:
          professional?.display_name ||
          "Profissional não informada",
        clientName: null,
        serviceName: null,
        startAt: block.starts_at,
        endAt: block.ends_at,
        status: "blocked",
        outsideSchedule: false,
        reason: block.reason,
        paymentStatus: null,
        price: 0,
      };
    },
  );

  return [...appointments, ...blocks].sort(
    (first, second) =>
      new Date(first.startAt).getTime() -
      new Date(second.startAt).getTime(),
  );
}