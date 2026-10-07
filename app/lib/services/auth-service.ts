import { createClient } from "../../../lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { resolvePortalAccount, type Portal } from "./portal-access";
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

  if (error || !data) {
    throw error || new Error("Perfil não encontrado.");
  }

  return data as AuthProfile;
}

export async function loginWithPassword(
  email: string,
  password: string,
  portal: Portal,
  isCurrent: () => boolean = () => true,
  onPasswordSession: (session: Session | null) => void = () => undefined,
) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(), password,
  });
  onPasswordSession(data.session);
  if (error) throw error;
  try {
    if (!data.user || !data.session) throw new Error("Não foi possível identificar a conta.");
    if (!isCurrent()) throw new Error("A tentativa de login foi interrompida.");
    const profile = await getProfile(data.user.id);
    if (!isCurrent()) throw new Error("A tentativa de login foi interrompida.");
    const account = await resolvePortalAccount(profile, portal);
    if (!isCurrent()) throw new Error("A tentativa de login foi interrompida.");
    return { ...account, user: data.user, session: data.session };
  } catch (profileError) {
    await discardPasswordSession(data.session).catch(() => undefined);
    throw profileError;
  }
}

export async function discardPasswordSession(session: Session | null) {
  if (!session) return;
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  // Só encerra a sessão criada por esta tentativa, nunca uma conta mais recente.
  if (data.session?.access_token === session.access_token) {
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) throw signOutError;
  }
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
  const supabase = createClient();
  const { data, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !data.user) {
    throw sessionError || new Error("O link expirou ou é inválido.");
  }
  const { error } =
    await supabase.auth.updateUser({
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