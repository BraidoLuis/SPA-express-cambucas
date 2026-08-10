"use client";

import { useEffect, useState } from "react";
import { AdminDashboard } from "./components/admin/admin-dashboard";
import { LoginScreen, type TeamAccount } from "./components/auth/login-screen";
import { ClientDashboard } from "./components/client/client-dashboard";
import { ProfessionalDashboard } from "./components/professional/professional-dashboard";
import { PublicSite } from "./components/public/public-site";
import { initialServiceMedia, type ServiceMedia } from "./lib/spa-data";

export default function Home() {
  const [view, setView] = useState<"public" | "login-admin" | "login-client" | "admin" | "staff" | "client">("public");
  useEffect(() => {
    const access = new URLSearchParams(window.location.search).get("access");
    queueMicrotask(() => setView(access === "admin" ? "login-admin" : access === "client" ? "login-client" : "public"));
  }, []);
  const [teamUser, setTeamUser] = useState<"Eliane" | "Dayanne">("Eliane");
  const [mediaItems, setMediaItems] = useState<ServiceMedia[]>(initialServiceMedia);
  function navigate(next: typeof view) { setView(next); const query = next === "login-admin" || next === "staff" || next === "admin" ? "?access=admin" : next === "login-client" || next === "client" ? "?access=client" : "/"; window.history.pushState({}, "", query); }
  function enterTeam(account: TeamAccount) { if (account === "admin") navigate("admin"); else { setTeamUser(account); navigate("staff"); } }
  return <>{view === "admin" ? <AdminDashboard goPublic={() => navigate("public")} logout={() => navigate("login-admin")} mediaItems={mediaItems} setMediaItems={setMediaItems} /> : view === "staff" ? <ProfessionalDashboard professional={teamUser} goPublic={() => navigate("public")} logout={() => navigate("login-admin")} /> : view === "client" ? <ClientDashboard logout={() => navigate("login-client")} mediaItems={mediaItems} /> : view === "login-admin" ? <LoginScreen role="admin" close={() => navigate("public")} onTeamLogin={enterTeam} /> : view === "login-client" ? <LoginScreen role="client" close={() => navigate("public")} onLogin={() => navigate("client")} /> : <PublicSite goAdmin={() => navigate("login-client")} openBooking={() => navigate("login-client")} />}</>;
}
