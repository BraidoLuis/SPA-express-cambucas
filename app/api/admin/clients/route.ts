import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { normalizeBrazilianPhone } from "../../../lib/validations/client-signup";

type Input = {
  name?: string;
  email?: string;
  phone?: string;
  active?: boolean;
};

export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Convites não estão configurados no servidor." },
      { status: 503 }
    );
  }

  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) {
    return NextResponse.json(
      { error: "Sessão administrativa ausente." },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  const auth = await admin.auth.getUser(token);

  if (auth.error || !auth.data.user) {
    return NextResponse.json(
      { error: "Sessão administrativa inválida." },
      { status: 401 }
    );
  }

  const actor = await admin
    .from("profiles")
    .select("role,active")
    .eq("id", auth.data.user.id)
    .single();

  if (actor.error || actor.data.role !== "admin" || !actor.data.active) {
    return NextResponse.json(
      { error: "Apenas administradores ativos podem convidar clientes." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as Input;
  const name = body.name?.trim().replace(/\s+/g, " ") || "";
  const email = body.email?.trim().toLowerCase() || "";
  const phone = normalizeBrazilianPhone(body.phone || "");

  if (
    name.split(" ").length < 2 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email) ||
    (body.phone && phone.length !== 11)
  ) {
    return NextResponse.json(
      { error: "Revise nome, e-mail e telefone." },
      { status: 400 }
    );
  }

  const duplicate = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .ilike("email", email);

  if ((duplicate.count || 0) > 0) {
    return NextResponse.json(
      { error: "Já existe uma conta com este e-mail." },
      { status: 409 }
    );
  }

  const invited = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: name,
      phone: phone ? `55${phone}` : "",
      role: "client",
    },
    redirectTo: new URL("/", request.url).toString(),
  });

  if (invited.error || !invited.data.user) {
    return NextResponse.json(
      {
        error: invited.error?.message?.toLowerCase().includes("already")
          ? "Já existe uma conta com este e-mail."
          : "Não foi possível enviar o convite. Verifique o e-mail do Supabase Auth.",
      },
      { status: 400 }
    );
  }

  const updated = await admin
    .from("profiles")
    .update({
      full_name: name,
      email,
      phone: phone ? `55${phone}` : null,
      role: "client",
      active: body.active !== false,
    })
    .eq("id", invited.data.user.id);

  if (updated.error) {
    await admin.auth.admin.deleteUser(invited.data.user.id);
    return NextResponse.json(
      { error: "O convite não pôde ser concluído e foi revertido." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}