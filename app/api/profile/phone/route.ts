import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");

  if (
    digits.startsWith("55") &&
    digits.length === 13
  ) {
    digits = digits.slice(2);
  }

  return digits;
}

export async function POST(request: Request) {
  const supabase =
    await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      {
        error:
          "Sua sessão expirou. Entre novamente.",
      },
      { status: 401 },
    );
  }

  const body = await request
    .json()
    .catch(() => null);

  const receivedPhone =
    body &&
    typeof body.phone === "string"
      ? body.phone
      : "";

  const nationalPhone =
    normalizePhone(receivedPhone);

  if (
    !/^[1-9]{2}9\d{8}$/.test(
      nationalPhone,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Informe um celular válido com DDD.",
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const {
    data: profile,
    error: profileError,
  } = await admin
    .from("profiles")
    .select("id, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "client"
  ) {
    return NextResponse.json(
      {
        error:
          "Não foi possível identificar o perfil da cliente.",
      },
      { status: 403 },
    );
  }

  if (profile.active !== true) {
    return NextResponse.json(
      {
        error:
          "Esta conta está inativa.",
      },
      { status: 403 },
    );
  }

  const storedPhone = `55${nationalPhone}`;

  const {
    data: updatedProfile,
    error: updateError,
  } = await admin
    .from("profiles")
    .update({
      phone: storedPhone,
    })
    .eq("id", user.id)
    .eq("role", "client")
    .select("phone")
    .single();

  if (updateError || !updatedProfile) {
    return NextResponse.json(
      {
        error:
          "Não foi possível salvar o celular. Tente novamente.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    phone: updatedProfile.phone,
  });
}