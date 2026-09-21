import { createClient } from "../../../lib/supabase/client";
import {
  normalizeBrazilianPhone,
  type ClientSignupData,
} from "../validations/client-signup";

export type ProfileRole =
  | "client"
  | "professional"
  | "admin";

export type AuthProfile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: ProfileRole;
  active: boolean;
};

export async function getProfile(
  userId: string,
): Promise<AuthProfile> {
  const { data, error } = await createClient()
    .from("profiles")
    .select(
      "id, full_name, email, phone, role, active",
    )
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data as AuthProfile;
}

export async function loginWithPassword(
  email: string,
  password: string,
) {
  const supabase = createClient();

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error(
      "Não foi possível identificar a conta.",
    );
  }

  return {
    user: data.user,
    profile: await getProfile(data.user.id),
  };
}

export async function loginWithGoogle() {
  if (typeof window === "undefined") {
    throw new Error(
      "O login com Google só pode ser iniciado no navegador.",
    );
  }

  const supabase = createClient();

  const { error } =
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

  if (error) {
    throw error;
  }
}

export async function logoutUser() {
  const { error } =
    await createClient().auth.signOut();

  if (error) {
    throw error;
  }
}

export async function requestPasswordReset(
  email: string,
) {
  const redirectTo =
    `${window.location.origin}/?access=client&reset=1`;

  const { error } =
    await createClient().auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo },
    );

  if (error) {
    throw error;
  }
}

export async function updatePassword(
  password: string,
) {
  const { error } =
    await createClient().auth.updateUser({
      password,
    });

  if (error) {
    throw error;
  }
}

export async function saveClientPhone(
  phone: string,
): Promise<string> {
  const response = await fetch(
    "/api/profile/phone",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone }),
    },
  );

  const result = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.error ??
        "Não foi possível salvar o celular.",
    );
  }

  if (
    !result ||
    typeof result.phone !== "string"
  ) {
    throw new Error(
      "O servidor não retornou o celular salvo.",
    );
  }

  return result.phone;
}

export async function registerClient(
  data: ClientSignupData,
) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { demo: true };
  }

  const supabase = createClient();

  const { data: auth, error } =
    await supabase.auth.signUp({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      options: {
        data: {
          full_name: data.fullName.trim(),
          phone: `55${normalizeBrazilianPhone(
            data.phone,
          )}`,
          role: "client",
          email_notifications:
            data.emailNotifications,
        },
      },
    });

  if (error) {
    throw error;
  }

  return {
    demo: false,
    user: auth.user,
  };
}