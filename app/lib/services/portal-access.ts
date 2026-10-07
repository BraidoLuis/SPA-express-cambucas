import type { AuthProfile } from "./auth-service";
import { getProfessionalAccess, type ProfessionalAccess } from "./professional-access-service";

export type Portal = "admin" | "client";
export type AccountView = "admin" | "staff" | "client" | "complete-client-profile";
export type PortalAccount = {
  profile: AuthProfile;
  professionalAccess: ProfessionalAccess | null;
  view: AccountView;
};

export async function resolvePortalAccount(
  profile: AuthProfile,
  portal: Portal,
): Promise<PortalAccount> {
  if (!profile.active) throw new Error("Perfil inativo.");
  if ((profile.role === "client") !== (portal === "client")) {
    throw new Error("Portal incompatível.");
  }
  if (profile.role === "client") {
    return {
      profile,
      professionalAccess: null,
      view: profile.phone?.trim() ? "client" : "complete-client-profile",
    };
  }
  if (profile.role === "admin") {
    return { profile, professionalAccess: null, view: "admin" };
  }
  if (profile.role !== "professional") throw new Error("Perfil inválido.");
  // A consulta lança erro sem vínculo ativo; nenhum estado parcial é publicado.
  const professionalAccess = await getProfessionalAccess(profile.id);
  if (!professionalAccess?.id || professionalAccess.profileId !== profile.id) {
    throw new Error("Conta profissional não vinculada.");
  }
  return { profile, professionalAccess, view: "staff" };
}
