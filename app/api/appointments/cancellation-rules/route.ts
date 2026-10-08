import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { parseCancellationRules } from "../../../lib/cancellation-rules";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Configuração indisponível." }, { status: 503 });
  }
  try {
    const admin = createAdminClient();
    const auth = await admin.auth.getUser(token);
    if (auth.error || !auth.data.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    const actor = await admin.from("profiles").select("role,active").eq("id", auth.data.user.id).single();
    if (actor.error) return NextResponse.json({ error: "Não foi possível validar o acesso." }, { status: 503 });
    if (actor.data?.role !== "client" || actor.data.active !== true) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    // A flag aplica a antecedência. Horas em texto preservam o contrato do trigger.
    const settings = await admin.from("spa_settings").select("cancellationEnabled:booking_rules->cancellationEnabled,cancellationNoticeHours:booking_rules->>cancellationNoticeHours").eq("id", true).maybeSingle();
    const rules = settings.error ? null : parseCancellationRules(settings.data);
    if (!rules) return NextResponse.json({ error: "Configuração indisponível." }, { status: 503 });
    return NextResponse.json(rules, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar a configuração." }, { status: 503 });
  }
}
