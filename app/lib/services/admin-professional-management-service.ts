import { createClient } from "../../../lib/supabase/client";

export type AdminProfessionalService = { id: string; name: string; active: boolean };
export type AdminProfessional = {
  id: string; profileId: string | null; name: string; specialty: string; bio: string | null;
  email: string | null; phone: string | null; avatarUrl: string | null; active: boolean;
  appointmentsToday: number; appointmentsThisMonth: number; activeServices: number;
  upcomingCount: number;
  services: AdminProfessionalService[]; availableToday: boolean;
};
export type AdminAvailability = { id: string; weekday: number; startTime: string; endTime: string; active: boolean };
export type AdminProfessionalDetails = AdminProfessional & {
  availability: AdminAvailability[];
  upcomingAppointments: Array<{ id: string; clientName: string; serviceName: string; startAt: string; status: string }>;
  futureBlocks: Array<{ id: string; startAt: string; endAt: string; reason: string | null }>;
  notificationPreferences: { email: boolean; whatsapp: boolean; inApp: boolean } | null;
};

type Relation<T> = T | T[] | null;
const one = <T,>(value: Relation<T>) => Array.isArray(value) ? value[0] ?? null : value;
function boundaries() {
  const now = new Date(), today = new Date(now), tomorrow = new Date(now), month = new Date(now), nextMonth = new Date(now);
  today.setHours(0, 0, 0, 0); tomorrow.setHours(24, 0, 0, 0); month.setDate(1); month.setHours(0, 0, 0, 0); nextMonth.setMonth(nextMonth.getMonth() + 1, 1); nextMonth.setHours(0, 0, 0, 0);
  return { now, today: today.toISOString(), tomorrow: tomorrow.toISOString(), month: month.toISOString(), nextMonth: nextMonth.toISOString() };
}
function readable(error: { message?: string } | null, fallback: string) {
  if (!error) return fallback;
  if (/duplicate|unique/i.test(error.message || "")) return "Já existe um cadastro com esses dados.";
  return fallback;
}

export async function getAdminProfessionals(): Promise<AdminProfessional[]> {
  const supabase = createClient(), range = boundaries(), weekday = range.now.getDay();
  const [people, appointments, rules, exceptions, blocks] = await Promise.all([
    supabase.from("professionals").select(`id,profile_id,display_name,specialty,bio,active,profiles(full_name,email,phone,avatar_url),professional_services(service_id,active,services(name))`).order("display_name"),
    supabase.from("appointments").select("professional_id,start_at,status").gte("start_at", range.month).neq("status", "cancelled"),
    supabase.from("availability_rules").select("professional_id,start_time,end_time,valid_from,valid_until,active").eq("weekday", weekday).eq("active", true),
    supabase.from("availability_exceptions").select("professional_id,available,start_time,end_time").eq("exception_date", range.today.slice(0, 10)),
    supabase.from("schedule_blocks").select("professional_id,starts_at,ends_at").lt("starts_at", range.tomorrow).gt("ends_at", range.today),
  ]);
  for (const result of [people, appointments, rules, exceptions, blocks]) if (result.error) throw new Error(readable(result.error, "Não foi possível carregar as profissionais."));
  const appointmentRows = appointments.data || [], ruleRows = rules.data || [], exceptionRows = exceptions.data || [], blockRows = blocks.data || [];
  return (people.data || []).map((row) => {
    const profile = one(row.profiles as Relation<{ full_name: string; email: string; phone: string | null; avatar_url: string | null }>);
    const links = (row.professional_services || []) as Array<{ service_id: string; active: boolean; services: Relation<{ name: string }> }>;
    const personRules = ruleRows.filter((item) => item.professional_id === row.id && (!item.valid_from || item.valid_from <= range.today.slice(0, 10)) && (!item.valid_until || item.valid_until >= range.today.slice(0, 10)));
    const exception = exceptionRows.find((item) => item.professional_id === row.id);
    const intervals = exception ? (exception.available && exception.start_time && exception.end_time ? [{ start_time: exception.start_time, end_time: exception.end_time }] : []) : personRules;
    const availableToday = row.active && intervals.some((interval) => {
      const day = range.today.slice(0, 10), start = new Date(`${day}T${interval.start_time}-03:00`), end = new Date(`${day}T${interval.end_time}-03:00`);
      if (end <= range.now) return false;
      return !blockRows.some((block) => block.professional_id === row.id && new Date(block.starts_at) <= start && new Date(block.ends_at) >= end);
    });
    const personAppointments = appointmentRows.filter((item) => item.professional_id === row.id);
    const services = links.map((link) => ({ id: link.service_id, name: one(link.services)?.name || "Serviço", active: link.active }));
    return { id: row.id, profileId: row.profile_id, name: row.display_name || profile?.full_name || "Profissional", specialty: row.specialty,
      bio: row.bio, email: profile?.email || null, phone: profile?.phone || null, avatarUrl: profile?.avatar_url || null, active: row.active,
      appointmentsToday: personAppointments.filter((item) => item.start_at >= range.today && item.start_at < range.tomorrow).length,
      appointmentsThisMonth: personAppointments.filter((item) => item.start_at < range.nextMonth).length,
      upcomingCount: personAppointments.filter((item) => item.start_at >= range.now.toISOString()).length,
      activeServices: services.filter((item) => item.active).length, services, availableToday };
  });
}

export async function getAdminProfessionalDetails(person: AdminProfessional): Promise<AdminProfessionalDetails> {
  const supabase = createClient(), now = new Date().toISOString();
  const [availability, appointments, blocks, preferences] = await Promise.all([
    supabase.from("availability_rules").select("id,weekday,start_time,end_time,active").eq("professional_id", person.id).order("weekday"),
    supabase.from("appointments").select("id,client_name,start_at,status,services(name)").eq("professional_id", person.id).gte("start_at", now).neq("status", "cancelled").order("start_at").limit(10),
    supabase.from("schedule_blocks").select("id,starts_at,ends_at,reason").eq("professional_id", person.id).gte("ends_at", now).order("starts_at").limit(10),
    person.profileId ? supabase.from("notification_preferences").select("email_enabled,whatsapp_enabled,in_app_enabled").eq("profile_id", person.profileId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  for (const result of [availability, appointments, blocks, preferences]) if (result.error) throw new Error("Não foi possível carregar os detalhes da profissional.");
  return { ...person,
    availability: (availability.data || []).map((x) => ({ id: x.id, weekday: x.weekday, startTime: x.start_time.slice(0, 5), endTime: x.end_time.slice(0, 5), active: x.active })),
    upcomingAppointments: (appointments.data || []).map((x) => ({ id: x.id, clientName: x.client_name, serviceName: one(x.services as Relation<{ name: string }>)?.name || "Serviço", startAt: x.start_at, status: x.status })),
    futureBlocks: (blocks.data || []).map((x) => ({ id: x.id, startAt: x.starts_at, endAt: x.ends_at, reason: x.reason })),
    notificationPreferences: preferences.data ? { email: preferences.data.email_enabled, whatsapp: preferences.data.whatsapp_enabled, inApp: preferences.data.in_app_enabled } : null };
}

export async function updateAdminProfessional(id: string, profileId: string | null, changes: { name: string; specialty: string; phone?: string; bio?: string; active: boolean }) {
  const supabase = createClient();
  const professionalValues: Record<string, string | boolean | null> = { display_name: changes.name.trim(), specialty: changes.specialty.trim(), active: changes.active };
  if (changes.bio !== undefined) professionalValues.bio = changes.bio.trim() || null;
  const { error } = await supabase.from("professionals").update(professionalValues).eq("id", id);
  if (error) throw new Error(readable(error, "Não foi possível atualizar a profissional."));
  if (profileId) {
    const profileValues: Record<string, string | boolean | null> = { full_name: changes.name.trim(), active: changes.active };
    if (changes.phone !== undefined) profileValues.phone = changes.phone.trim() || null;
    const result = await supabase.from("profiles").update(profileValues).eq("id", profileId);
    if (result.error) throw new Error("Os dados profissionais foram salvos, mas o perfil associado não pôde ser atualizado.");
  }
}

export async function inviteAdminProfessional(input: { name: string; email: string; specialty: string; phone?: string; active: boolean; serviceIds: string[] }) {
  const supabase = createClient(), session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
  const response = await fetch("/api/admin/professionals", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(input) });
  const payload = await response.json() as { error?: string };
  if (!response.ok) throw new Error(payload.error || "Não foi possível convidar a profissional.");
}

export async function getAdminProfessionalServiceOptions() {
  const { data, error } = await createClient().from("services").select("id,name").eq("active", true).order("name");
  if (error) throw new Error("Não foi possível carregar os serviços disponíveis.");
  return data || [];
}
