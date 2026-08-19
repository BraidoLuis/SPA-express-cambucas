import { createClient } from "../../../lib/supabase/client";
import { getAvailableSlots, type AvailableSlot } from "./availability-service";

type Relation<T> = T | T[] | null;
const one = <T,>(value: Relation<T>) => Array.isArray(value) ? value[0] ?? null : value;
export type AdminAppointmentClient = { id: string; name: string; email: string; phone: string | null };
export type AdminAppointmentProfessional = { id: string; name: string; duration: number; price: number };
export type AdminAppointmentService = { id: string; name: string; category: string; professionals: AdminAppointmentProfessional[] };
export type AdminAppointmentOptions = { clients: AdminAppointmentClient[]; services: AdminAppointmentService[] };

export async function getAdminAppointmentOptions(): Promise<AdminAppointmentOptions> {
  const supabase = createClient();
  const [clients, links] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,phone").eq("role", "client").eq("active", true).order("full_name").limit(200),
    supabase.from("professional_services").select("service_id,custom_duration_minutes,custom_price,services!inner(id,name,category,duration_minutes,price,active),professionals!inner(id,display_name,active)").eq("active", true).eq("services.active", true).eq("professionals.active", true),
  ]);
  if (clients.error || links.error) throw new Error("Não foi possível carregar as opções de agendamento.");
  const serviceMap = new Map<string, AdminAppointmentService>();
  for (const link of links.data || []) { const service = one(link.services as Relation<{ id: string; name: string; category: string; duration_minutes: number; price: number | string }>), professional = one(link.professionals as Relation<{ id: string; display_name: string }>); if (!service || !professional) continue; const item = serviceMap.get(service.id) || { id: service.id, name: service.name, category: service.category, professionals: [] }; if (!item.professionals.some((x) => x.id === professional.id)) item.professionals.push({ id: professional.id, name: professional.display_name, duration: link.custom_duration_minutes ?? service.duration_minutes, price: Number(link.custom_price ?? service.price) }); serviceMap.set(service.id, item); }
  return { clients: (clients.data || []).map((x) => ({ id: x.id, name: x.full_name, email: x.email, phone: x.phone })), services: [...serviceMap.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) };
}
export async function getAdminActiveProfessionals() { const { data, error } = await createClient().from("professionals").select("id,display_name").eq("active", true).order("display_name"); if (error) throw new Error("Não foi possível carregar as profissionais."); return (data || []).map((x) => ({ id: x.id, name: x.display_name })); }
export { getAvailableSlots };
export type { AvailableSlot };

export async function createAdminAppointment(input: { clientId: string; serviceId: string; professionalId: string; slotStart: string; notes?: string }) {
  const supabase = createClient(), session = await supabase.auth.getSession(), token = session.data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
  const response = await fetch("/api/admin/appointments", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(input) });
  const body = await response.json() as { id?: string; error?: string };
  if (!response.ok || !body.id) throw new Error(body.error || "Não foi possível criar o agendamento.");
  return body.id;
}

export async function createAdminScheduleBlock(input: { professionalId: string; date: string; startTime: string; endTime: string; reason?: string }) {
  const start = new Date(`${input.date}T${input.startTime}:00-03:00`), end = new Date(`${input.date}T${input.endTime}:00-03:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start <= new Date() || end <= start) throw new Error("Informe um período futuro com início anterior ao fim.");
  const supabase = createClient();
  const [overlap, appointments] = await Promise.all([
    supabase.from("schedule_blocks").select("id", { count: "exact", head: true }).eq("professional_id", input.professionalId).lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString()),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("professional_id", input.professionalId).in("status", ["pending", "confirmed"]).lt("start_at", end.toISOString()).gt("end_at", start.toISOString()),
  ]);
  if (overlap.error || appointments.error) throw new Error("Não foi possível validar os conflitos deste período.");
  if ((overlap.count || 0) > 0) throw new Error("Já existe um bloqueio sobreposto neste período.");
  if ((appointments.count || 0) > 0) throw new Error("Existe um agendamento ativo neste período. Escolha outro horário.");
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("Sua sessão expirou. Entre novamente.");
  const result = await supabase.from("schedule_blocks").insert({ professional_id: input.professionalId, starts_at: start.toISOString(), ends_at: end.toISOString(), reason: input.reason?.trim().replace(/\s+/g, " ") || null, created_by: user.data.user.id }).select("id").single();
  if (result.error) throw new Error("Não foi possível criar o bloqueio. Verifique conflitos e tente novamente.");
  return result.data.id;
}
