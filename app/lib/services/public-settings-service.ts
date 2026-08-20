import { createClient } from "../../../lib/supabase/client";

export type PublicBusinessSettings = {
  name: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  whatsappUrl: string | null;
  instagramUrl: string | null;
};

export type PublicBusinessDay = {
  open: boolean | null;
  start: string | null;
  end: string | null;
};

export type PublicSpaSettings = {
  business: PublicBusinessSettings;
  businessHours: Record<string, PublicBusinessDay>;
};

export async function getPublicSpaSettings(): Promise<PublicSpaSettings | null> {
  const { data, error } = await createClient().rpc(
    "get_public_spa_settings",
  );

  if (error) {
    console.error("Não foi possível carregar as configurações públicas.", error);
    return null;
  }

  return data as PublicSpaSettings | null;
}