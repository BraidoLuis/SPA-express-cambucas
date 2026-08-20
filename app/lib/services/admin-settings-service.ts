import { createClient } from "../../../lib/supabase/client";
import { BOOKING_START_INTERVAL_MINUTES } from "../booking-grid";

export type BusinessSettings = {
  name: string | null;
  phone: string | null;
  email: string | null;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  description: string | null;
  mapAddress: string | null;
  whatsappUrl: string | null;
  instagramUrl: string | null;
  timezone: string | null;
};

export type BusinessDay = {
  open: boolean | null;
  start: string | null;
  end: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
};

export type BookingRules = {
  minimumNoticeHours: number | null;
  maximumAdvanceDays: number | null;
  cancellationEnabled: boolean | null;
  cancellationNoticeHours: number | null;
  defaultGridMinutes: number | null;
  allowSameDay: boolean | null;
  paymentText: string | null;
};

export type NotificationSettings = {
  inApp: boolean | null;
  clientEmail: boolean | null;
  professionalEmail: boolean | null;
  clientWhatsapp: boolean | null;
  professionalWhatsapp: boolean | null;
  reminder: boolean | null;
  reminderHours: number | null;
  cancellation: boolean | null;
  newAppointment: boolean | null;
  paymentConfirmed: boolean | null;
};

export type SpaSettings = {
  business: BusinessSettings;
  businessHours: Record<string, BusinessDay>;
  bookingRules: BookingRules;
  notifications: NotificationSettings;
};

export type AccessUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
  lastAccess: string | null;
};

const hours = Object.fromEntries(
  Array.from({ length: 7 }, (_, day) => [
    String(day),
    { open: day > 0, start: "09:00", end: "18:00" },
  ]),
) as Record<string, BusinessDay>;

export const defaultSpaSettings: SpaSettings = {
  business: {
    name: "SPA Express Cambucás",
    phone: "",
    email: "",
    postalCode: "25940-000",
    street: "Avenida Dedo de Deus",
    number: "1200",
    complement: "em frente à Prefeitura",
    district: "Centro",
    city: "Guapimirim",
    state: "RJ",
    description: "Beleza, cuidado e bem-estar em cada atendimento.",
    mapAddress: "Avenida Dedo de Deus, 1200, Centro, Guapimirim - RJ",
    whatsappUrl: "",
    instagramUrl: "",
    timezone: "America/Sao_Paulo",
  },
  businessHours: hours,
  bookingRules: {
    minimumNoticeHours: 0,
    maximumAdvanceDays: null,
    cancellationEnabled: false,
    cancellationNoticeHours: 0,
    defaultGridMinutes: BOOKING_START_INTERVAL_MINUTES,
    allowSameDay: true,
    paymentText: "Pagamento realizado no local.",
  },
  notifications: {
    inApp: true,
    clientEmail: false,
    professionalEmail: false,
    clientWhatsapp: false,
    professionalWhatsapp: false,
    reminder: false,
    reminderHours: 24,
    cancellation: true,
    newAppointment: true,
    paymentConfirmed: true,
  },
};

export async function getAdminSettings(): Promise<SpaSettings> {
  const { data, error } = await createClient()
    .from("spa_settings")
    .select("business, business_hours, booking_rules, notifications")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      throw new Error("Configurações indisponíveis. Execute a migration 016.");
    }
    throw new Error("Não foi possível carregar as configurações.");
  }

  if (!data) {
    return structuredClone(defaultSpaSettings);
  }

  return {
    business: {
      ...defaultSpaSettings.business,
      ...data.business,
    },
    businessHours: {
      ...defaultSpaSettings.businessHours,
      ...data.business_hours,
    },
    bookingRules: {
      ...defaultSpaSettings.bookingRules,
      ...data.booking_rules,
      defaultGridMinutes: BOOKING_START_INTERVAL_MINUTES,
    },
    notifications: {
      ...defaultSpaSettings.notifications,
      ...data.notifications,
    },
  } as SpaSettings;
}

export async function saveAdminSettings(settings: SpaSettings) {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) {
    throw new Error("Sessão expirada.");
  }

  const normalizedSettings: SpaSettings = {
    ...settings,
    bookingRules: {
      ...settings.bookingRules,
      defaultGridMinutes:
        BOOKING_START_INTERVAL_MINUTES,
    },
  };

  const { error } = await supabase.from("spa_settings").upsert(
    {
      id: true,
      business: normalizedSettings.business,
      business_hours:
        normalizedSettings.businessHours,
      booking_rules:
        normalizedSettings.bookingRules,
      notifications:
        normalizedSettings.notifications,
      updated_by: user.user.id,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(
      error.code === "42P01"
        ? "Execute a migration 016 antes de salvar configurações."
        : "Não foi possível salvar as configurações.",
    );
  }
}

export async function getAccessUsers(): Promise<AccessUser[]> {
  const { data, error } = await createClient()
    .from("profiles")
    .select("id, full_name, email, role, active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Não foi possível carregar os acessos.");
  }

  return (data || []).map((x) => ({
    id: x.id,
    fullName: x.full_name,
    email: x.email,
    role: x.role,
    active: x.active,
    createdAt: x.created_at,
    lastAccess: null,
  }));
}

export type ProviderStatus = {
  email: boolean;
  whatsapp: boolean;
};

export async function getProviderStatus(): Promise<ProviderStatus> {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sessão expirada ao verificar os provedores.");
  }

  const response = await fetch("/api/admin/integrations/status", {
    method: "GET",
    headers: {
      authorization: `Bearer ${session.access_token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Não foi possível verificar os provedores.");
  }

  const data = (await response.json()) as Partial<ProviderStatus>;

  return {
    email: data.email === true,
    whatsapp: data.whatsapp === true,
  };
}