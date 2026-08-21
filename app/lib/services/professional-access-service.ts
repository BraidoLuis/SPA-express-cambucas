import { createClient } from "../../../lib/supabase/client";

export type ProfessionalAccess = {
  id: string;
  profileId: string;
  displayName: string;
  specialty: string;
  bio: string | null;
};

type ProfessionalRow = {
  id: string;
  profile_id: string;
  display_name: string;
  specialty: string;
  bio: string | null;
};

export async function getProfessionalAccess(
  profileId: string,
): Promise<ProfessionalAccess> {
  const { data, error } = await createClient()
    .from("professionals")
    .select(
      "id,profile_id,display_name,specialty,bio",
    )
    .eq("profile_id", profileId)
    .eq("active", true)
    .single();

  if (error || !data) {
    throw error || new Error("Conta profissional não vinculada.");
  }

  const row = data as ProfessionalRow;

  return {
    id: row.id,
    profileId: row.profile_id,
    displayName: row.display_name,
    specialty: row.specialty,
    bio: row.bio,
  };
}