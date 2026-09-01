import { createClient } from "../../../lib/supabase/client";
import { normalizeBrazilianPhone } from "../validations/client-signup";

export type ClientProfileSettings = {
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  notes: string;
  emailNotifications: boolean;
};

export async function getClientProfileSettings():
  Promise<ClientProfileSettings> {
  const supabase = createClient();

  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw (
      authError ||
      new Error("Sessão não encontrada.")
    );
  }

  const [profileResult, preferencesResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "full_name,email,phone,birth_date,client_notes",
        )
        .eq("id", authData.user.id)
        .single(),

      supabase
        .from("notification_preferences")
        .select("email_enabled")
        .eq("profile_id", authData.user.id)
        .maybeSingle(),
    ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (preferencesResult.error) {
    throw preferencesResult.error;
  }

  return {
    fullName: profileResult.data.full_name,
    email: profileResult.data.email,
    phone: profileResult.data.phone || "",
    birthDate:
      profileResult.data.birth_date || "",
    notes:
      profileResult.data.client_notes || "",
    emailNotifications:
      preferencesResult.data?.email_enabled ?? true,
  };
}

export async function updateClientProfileSettings(
  settings: ClientProfileSettings,
) {
  const supabase = createClient();

  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw (
      authError ||
      new Error("Sessão não encontrada.")
    );
  }

  const phoneDigits =
    normalizeBrazilianPhone(settings.phone);

  const profileUpdate = await supabase
    .from("profiles")
    .update({
      full_name: settings.fullName.trim(),
      phone: `55${phoneDigits}`,
      birth_date: settings.birthDate || null,
      client_notes:
        settings.notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", authData.user.id);

  if (profileUpdate.error) {
    throw profileUpdate.error;
  }

  const preferencesUpdate = await supabase
    .from("notification_preferences")
    .upsert({
      profile_id: authData.user.id,
      email_enabled:
        settings.emailNotifications,
      in_app_enabled: false,

      updated_at: new Date().toISOString(),
    });

  if (preferencesUpdate.error) {
    throw preferencesUpdate.error;
  }
}