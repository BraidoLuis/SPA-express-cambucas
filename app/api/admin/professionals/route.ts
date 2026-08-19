import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type Input = { name?: string; email?: string; specialty?: string; phone?: string; active?: boolean; serviceIds?: string[] };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Convites não estão configurados no servidor." }, { status: 503 });
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) return NextResponse.json({ error: "Sessão administrativa ausente." }, { status: 401 });
  const admin = createAdminClient(), auth = await admin.auth.getUser(bearer);
  if (auth.error || !auth.data.user) return NextResponse.json({ error: "Sessão administrativa inválida." }, { status: 401 });
  const profile = await admin.from("profiles").select("role,active").eq("id", auth.data.user.id).single();
  if (profile.error || profile.data.role !== "admin" || !profile.data.active) return NextResponse.json({ error: "Apenas administradores ativos podem convidar profissionais." }, { status: 403 });
  const body = await request.json() as Input, name = body.name?.trim().replace(/\s+/g, " ") || "", email = body.email?.trim().toLowerCase() || "", specialty = body.specialty?.trim().replace(/\s+/g, " ") || "";
  if (name.length < 3 || !emailPattern.test(email) || specialty.length < 2) return NextResponse.json({ error: "Revise nome, e-mail e especialidade." }, { status: 400 });
  const duplicate = await admin.from("profiles").select("id", { count: "exact", head: true }).ilike("email", email);
  if ((duplicate.count || 0) > 0) return NextResponse.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
  const invited = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: name, phone: body.phone?.trim() || "" }, redirectTo: new URL("/", request.url).toString() });
  if (invited.error || !invited.data.user) return NextResponse.json({ error: invited.error?.message?.toLowerCase().includes("already") ? "Já existe uma conta com este e-mail." : "Não foi possível enviar o convite. Verifique a configuração de e-mail do Supabase." }, { status: 400 });
  const userId = invited.data.user.id;
  try {
    const profileUpdate = await admin.from("profiles").update({ full_name: name, email, phone: body.phone?.trim() || null, role: "professional", active: body.active !== false }).eq("id", userId);
    if (profileUpdate.error) throw profileUpdate.error;
    const professional = await admin.from("professionals").insert({ profile_id: userId, display_name: name, specialty, active: body.active !== false }).select("id").single();
    if (professional.error) throw professional.error;
    const serviceIds = [...new Set((body.serviceIds || []).filter((id): id is string => typeof id === "string" && id.length > 0))];
    if (serviceIds.length) {
      const links = await admin.from("professional_services").upsert(serviceIds.map((serviceId) => ({ professional_id: professional.data.id, service_id: serviceId, active: true })), { onConflict: "professional_id,service_id" });
      if (links.error) throw links.error;
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "O convite não pôde ser concluído e foi revertido." }, { status: 500 });
  }
}
