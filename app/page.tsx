"use client";

import { useEffect, useState } from "react";
import { AdminDashboard } from "./components/admin/admin-dashboard";
import { LoginScreen } from "./components/auth/login-screen";
import { ClientDashboard } from "./components/client/client-dashboard";
import { ProfessionalDashboard } from "./components/professional/professional-dashboard";
import { PublicSite } from "./components/public/public-site";
import { getProfile, loginWithPassword, logoutUser, type AuthProfile } from "./lib/services/auth-service";
import {
  getProfessionalAccess,
  type ProfessionalAccess,
} from "./lib/services/professional-access-service";
import { initialServiceMedia, type ServiceMedia } from "./lib/spa-data";
import { createClient } from "../lib/supabase/client";

type View = "public" | "login-admin" | "login-client" | "admin" | "staff" | "client";

export default function Home() {
  const [view, setView] = useState<View>("public");
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [professionalAccess, setProfessionalAccess] =
  useState<ProfessionalAccess | null>(null);
  const [mediaItems, setMediaItems] = useState<ServiceMedia[]>(initialServiceMedia);
  const [checkingSession, setCheckingSession] = useState(true);

  function navigate(next: View) {
    setView(next);
    const query = next === "login-admin" || next === "staff" || next === "admin" ? "?access=admin" : next === "login-client" || next === "client" ? "?access=client" : "/";
    window.history.pushState({}, "", query);
  }

  async function routeProfile(
    found: AuthProfile,
    access: string | null,
  ) {
    setProfile(found);

    if (!found.active) {
      return false;
    }

    if (found.role === "client") {
      if (access === "admin") {
        return false;
      }

      navigate("client");
      return true;
    }

    if (access === "client") {
      return false;
    }

    if (found.role === "admin") {
      navigate("admin");
      return true;
    }

    const linkedProfessional =
      await getProfessionalAccess(found.id);

    setProfessionalAccess(linkedProfessional);
    navigate("staff");

    return true;
  }

  useEffect(() => {
    const access = new URLSearchParams(window.location.search).get("access");
    const fallback: View = access === "admin" ? "login-admin" : access === "client" ? "login-client" : "public";
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session && access) {
        try { const found = await getProfile(data.session.user.id); if (!(await routeProfile(found, access))) setView(fallback); }
        catch { setView(fallback); }
      } else setView(fallback);
      setCheckingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  // Executa apenas na inicialização; a navegação interna é controlada por estado.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(email: string, password: string) {
    try {
      const { profile: found } = await loginWithPassword(email, password);
      const portal = view === "login-admin" ? "admin" : "client";
      const allowed = await routeProfile(found, portal);
      if (!allowed) {
        await logoutUser();
        return { error: portal === "admin" ? "Esta conta é de cliente. Use o acesso público para entrar." : "Esta conta pertence à equipe. Use o acesso reservado da equipe." };
      }
      return {};
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("invalid login")) return { error: "E-mail ou senha incorretos." };
      if (message.toLowerCase().includes("email not confirmed")) return { error: "Confirme seu e-mail antes de entrar." };
      return { error: "Não foi possível entrar. Verifique os dados e tente novamente." };
    }
  }

  async function logout(destination: "login-admin" | "login-client") {
    await logoutUser().catch(() => undefined);

    setProfile(null);
    setProfessionalAccess(null);
    navigate(destination);
  }

  if (checkingSession) return <div className="auth-loading"><span>✦</span><p>Preparando seu espaço...</p></div>;
  return <>{view === "admin" ? <AdminDashboard profile={profile} goPublic={() => navigate("public")} logout={() => logout("login-admin")} mediaItems={mediaItems} setMediaItems={setMediaItems} /> : view === "staff" && professionalAccess ? <ProfessionalDashboard access={professionalAccess} goPublic={() => navigate("public")} logout={() => logout("login-admin")} /> : view === "client" ? <ClientDashboard profile={profile} logout={() => logout("login-client")} mediaItems={mediaItems} /> : view === "login-admin" ? <LoginScreen role="admin" close={() => navigate("public")} onLogin={handleLogin} /> : view === "login-client" ? <LoginScreen role="client" close={() => navigate("public")} onLogin={handleLogin} /> : <PublicSite goAdmin={() => navigate("login-client")} openBooking={() => navigate("login-client")} />}</>;
}
