import { createAdminClient } from "../../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
}

export async function GET(request: Request) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return Response.json(
        { error: "Sessão não informada." },
        { status: 401 },
      );
    }

    const supabase = createAdminClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return Response.json(
        { error: "Sessão inválida ou expirada." },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role,active")
        .eq("id", user.id)
        .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin" ||
      !profile.active
    ) {
      return Response.json(
        { error: "Acesso administrativo necessário." },
        { status: 403 },
      );
    }

    return Response.json(
      {
        email: Boolean(
          process.env.RESEND_API_KEY?.trim() &&
            process.env.RESEND_FROM_EMAIL?.trim(),
        ),
        whatsapp: Boolean(
          process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
            process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
        ),
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Não foi possível verificar as integrações." },
      { status: 500 },
    );
  }
}