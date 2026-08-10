import { Resend } from "resend";
import { createAdminClient } from "../../../../lib/supabase/admin";

type Profile = { id: string; full_name: string; email: string; phone: string | null };
type Preferences = { email_enabled: boolean; whatsapp_enabled: boolean; in_app_enabled: boolean; new_appointment: boolean };
const defaults: Preferences = { email_enabled: true, whatsapp_enabled: true, in_app_enabled: true, new_appointment: true };

export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.NOTIFICATION_SECRET}`) return new Response("Não autorizado", { status: 401 });
  const { appointmentId } = await request.json();
  const supabase = createAdminClient();
  const { data: appointment, error } = await supabase.from("appointments").select("id,start_at,client_id,professional_id,service_id").eq("id", appointmentId).single();
  if (error || !appointment) return Response.json({ error: "Agendamento não encontrado" }, { status: 404 });

  const [{ data: client }, { data: professional }, { data: service }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,phone").eq("id", appointment.client_id).single(),
    supabase.from("professionals").select("display_name,profile_id").eq("id", appointment.professional_id).single(),
    supabase.from("services").select("name,price,duration_minutes").eq("id", appointment.service_id).single(),
  ]);
  if (!client || !professional || !service) return Response.json({ error: "Dados incompletos" }, { status: 422 });
  const { data: professionalProfile } = await supabase.from("profiles").select("id,full_name,email,phone").eq("id", professional.profile_id).single();
  const recipients = [{ profile: client as Profile, audience: "client" }, ...(professionalProfile ? [{ profile: professionalProfile as Profile, audience: "professional" }] : [])];
  const resend = new Resend(process.env.RESEND_API_KEY);
  const when = new Date(appointment.start_at).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
  const results: unknown[] = [];

  for (const recipient of recipients) {
    const { data: storedPreferences } = await supabase.from("notification_preferences").select("email_enabled,whatsapp_enabled,in_app_enabled,new_appointment").eq("profile_id", recipient.profile.id).maybeSingle();
    const preferences = { ...defaults, ...(storedPreferences ?? {}) };
    if (!preferences.new_appointment) continue;
    const title = recipient.audience === "client" ? "Seu agendamento está confirmado" : "Novo agendamento na sua agenda";
    const body = recipient.audience === "client"
      ? `${service.name} com ${professional.display_name}, em ${when}. Pagamento de R$ ${service.price} no local.`
      : `${client.full_name} agendou ${service.name} para ${when}. Duração prevista: ${service.duration_minutes} minutos.`;

    if (preferences.in_app_enabled) {
      await supabase.from("notifications").insert({ appointment_id: appointment.id, recipient_id: recipient.profile.id, channel: "in_app", notification_type: "appointment_confirmed", title, body, status: "sent", sent_at: new Date().toISOString() });
    }
    if (preferences.email_enabled && recipient.profile.email) {
      const email = await resend.emails.send({ from: process.env.RESEND_FROM_EMAIL!, to: recipient.profile.email, subject: title, html: `<h1>${title}</h1><p>Olá, ${recipient.profile.full_name}.</p><p>${body}</p><p>SPA Express Cambucás</p>` });
      await supabase.from("notifications").insert({ appointment_id: appointment.id, recipient_id: recipient.profile.id, channel: "email", notification_type: "appointment_confirmed", title, body, status: email.error ? "failed" : "sent", provider_id: email.data?.id, error_message: email.error ? JSON.stringify(email.error) : null, sent_at: email.error ? null : new Date().toISOString() });
      results.push(email);
    }
    if (preferences.whatsapp_enabled && recipient.profile.phone) {
      const response = await fetch(new URL("/api/notifications/whatsapp", request.url), { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.NOTIFICATION_SECRET}` }, body: JSON.stringify({ to: recipient.profile.phone, template: recipient.audience === "client" ? "appointment_confirmation" : "professional_new_appointment", parameters: recipient.audience === "client" ? [recipient.profile.full_name, service.name, professional.display_name, when] : [recipient.profile.full_name, client.full_name, service.name, when] }) });
      const whatsapp = await response.json();
      await supabase.from("notifications").insert({ appointment_id: appointment.id, recipient_id: recipient.profile.id, channel: "whatsapp", notification_type: "appointment_confirmed", title, body, status: response.ok ? "sent" : "failed", provider_id: whatsapp?.messages?.[0]?.id, error_message: response.ok ? null : JSON.stringify(whatsapp), sent_at: response.ok ? new Date().toISOString() : null });
      results.push(whatsapp);
    }
  }
  return Response.json({ ok: true, recipients: recipients.length, results });
}
