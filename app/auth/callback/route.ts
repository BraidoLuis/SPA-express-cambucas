import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

function clientUrl(
  origin: string,
  oauthError?: string,
) {
  const url = new URL("/", origin);

  url.searchParams.set("access", "client");

  if (oauthError) {
    url.searchParams.set(
      "oauth_error",
      oauthError,
    );
  }

  return url;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const providerError =
    requestUrl.searchParams.get("error");

  if (providerError) {
    const errorCode =
      providerError === "access_denied"
        ? "cancelled"
        : "provider";

    return NextResponse.redirect(
      clientUrl(origin, errorCode),
    );
  }

  const code =
    requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      clientUrl(origin, "missing_code"),
    );
  }

  const supabase =
    await createServerSupabaseClient();

  const {
    data: authData,
    error: exchangeError,
  } =
    await supabase.auth.exchangeCodeForSession(
      code,
    );

  if (exchangeError || !authData.user) {
    await supabase.auth
      .signOut()
      .catch(() => undefined);

    return NextResponse.redirect(
      clientUrl(origin, "exchange"),
    );
  }

  const user = authData.user;
  const admin = createAdminClient();

  const {
    data: existingProfile,
    error: profileLookupError,
  } = await admin
    .from("profiles")
    .select("id, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileLookupError) {
    await supabase.auth
      .signOut()
      .catch(() => undefined);

    return NextResponse.redirect(
      clientUrl(origin, "profile"),
    );
  }

  /*
   * Não transforma uma conta da equipe
   * em cliente.
   */
  if (
    existingProfile &&
    existingProfile.role !== "client"
  ) {
    await supabase.auth
      .signOut()
      .catch(() => undefined);

    return NextResponse.redirect(
      clientUrl(origin, "team_account"),
    );
  }

  if (
    existingProfile &&
    existingProfile.active !== true
  ) {
    await supabase.auth
      .signOut()
      .catch(() => undefined);

    return NextResponse.redirect(
      clientUrl(origin, "inactive"),
    );
  }

  /*
   * Dependendo do gatilho existente no banco,
   * o perfil pode já ter sido criado junto com
   * auth.users. Se ainda não existir, criamos
   * aqui usando a Service Role no servidor.
   */
  if (!existingProfile) {
    const metadata = user.user_metadata ?? {};

    const metadataName =
      metadata.full_name ?? metadata.name;

    const fullName =
      typeof metadataName === "string" &&
      metadataName.trim()
        ? metadataName.trim()
        : user.email?.split("@")[0] ??
          "Cliente";

    if (!user.email) {
      await supabase.auth
        .signOut()
        .catch(() => undefined);

      return NextResponse.redirect(
        clientUrl(origin, "missing_email"),
      );
    }

    const { error: insertError } =
      await admin.from("profiles").insert({
        id: user.id,
        full_name: fullName,
        email: user.email.toLowerCase(),
        phone: null,
        role: "client",
        active: true,
      });

    /*
     * 23505 significa que o perfil foi criado
     * simultaneamente pelo gatilho do banco.
     */
    if (
      insertError &&
      insertError.code !== "23505"
    ) {
      await supabase.auth
        .signOut()
        .catch(() => undefined);

      return NextResponse.redirect(
        clientUrl(origin, "profile_creation"),
      );
    }

    if (insertError?.code === "23505") {
      const {
        data: createdProfile,
        error: createdProfileError,
      } = await admin
        .from("profiles")
        .select("role, active")
        .eq("id", user.id)
        .single();

      if (
        createdProfileError ||
        createdProfile?.role !== "client" ||
        createdProfile?.active !== true
      ) {
        await supabase.auth
          .signOut()
          .catch(() => undefined);

        return NextResponse.redirect(
          clientUrl(origin, "profile"),
        );
      }
    }
  }

  return NextResponse.redirect(
    clientUrl(origin),
  );
}