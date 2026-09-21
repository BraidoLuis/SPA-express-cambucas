"use client";

import {
  useEffect,
  useState,
} from "react";
import { AdminDashboard } from "./components/admin/admin-dashboard";
import { CompleteClientProfile } from "./components/auth/complete-client-profile";
import { LoginScreen } from "./components/auth/login-screen";
import { ClientDashboard } from "./components/client/client-dashboard";
import { ProfessionalDashboard } from "./components/professional/professional-dashboard";
import { PublicSite } from "./components/public/public-site";
import {
  getProfile,
  loginWithPassword,
  logoutUser,
  type AuthProfile,
} from "./lib/services/auth-service";
import {
  getProfessionalAccess,
  type ProfessionalAccess,
} from "./lib/services/professional-access-service";
import { createClient } from "../lib/supabase/client";

type View =
  | "public"
  | "login-admin"
  | "login-client"
  | "complete-client-profile"
  | "admin"
  | "staff"
  | "client";

type InitializationStatus =
  | "initializing"
  | "unauthenticated"
  | "authenticated";

export default function Home() {
  const [view, setView] =
    useState<View>("public");

  const [profile, setProfile] =
    useState<AuthProfile | null>(null);

  const [
    professionalAccess,
    setProfessionalAccess,
  ] =
    useState<ProfessionalAccess | null>(
      null,
    );

  const [
    initializationStatus,
    setInitializationStatus,
  ] =
    useState<InitializationStatus>(
      "initializing",
    );

  function navigate(next: View) {
    setView(next);

    const adminView =
      next === "login-admin" ||
      next === "staff" ||
      next === "admin";

    const clientView =
      next === "login-client" ||
      next ===
        "complete-client-profile" ||
      next === "client";

    const query = adminView
      ? "?access=admin"
      : clientView
      ? "?access=client"
      : "/";

    window.history.pushState(
      {},
      "",
      query,
    );
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

      navigate(
        found.phone?.trim()
          ? "client"
          : "complete-client-profile",
      );

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

    setProfessionalAccess(
      linkedProfessional,
    );

    navigate("staff");

    return true;
  }

  useEffect(() => {
    const access =
      new URLSearchParams(
        window.location.search,
      ).get("access");

    const fallback: View =
      access === "admin"
        ? "login-admin"
        : access === "client"
        ? "login-client"
        : "public";

    const supabase = createClient();
    let cancelled = false;

    async function initialize() {
      try {
        const { data, error } =
          await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!data.session || !access) {
          if (!cancelled) {
            setView(fallback);
            setInitializationStatus(
              "unauthenticated",
            );
          }

          return;
        }

        const found = await getProfile(
          data.session.user.id,
        );

        if (!found.active) {
          throw new Error(
            "Perfil inativo.",
          );
        }

        let nextView: View;
        let linkedProfessional:
          | ProfessionalAccess
          | null = null;

        if (found.role === "client") {
          if (access !== "client") {
            throw new Error(
              "Portal incompatível.",
            );
          }

          nextView = found.phone?.trim()
            ? "client"
            : "complete-client-profile";
        } else if (
          found.role === "admin"
        ) {
          if (access !== "admin") {
            throw new Error(
              "Portal incompatível.",
            );
          }

          nextView = "admin";
        } else {
          if (access !== "admin") {
            throw new Error(
              "Portal incompatível.",
            );
          }

          linkedProfessional =
            await getProfessionalAccess(
              found.id,
            );

          if (!linkedProfessional) {
            throw new Error(
              "Perfil profissional sem vínculo ativo.",
            );
          }

          nextView = "staff";
        }

        if (!cancelled) {
          setProfile(found);

          setProfessionalAccess(
            linkedProfessional,
          );

          setView(nextView);

          setInitializationStatus(
            "authenticated",
          );
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setProfessionalAccess(null);
          setView(fallback);

          setInitializationStatus(
            "unauthenticated",
          );
        }
      }
    }

    void initialize();

    const { data: listener } =
      supabase.auth.onAuthStateChange(
        (event) => {
          if (
            event === "SIGNED_OUT" &&
            !cancelled
          ) {
            setProfile(null);
            setProfessionalAccess(null);

            setInitializationStatus(
              "unauthenticated",
            );
          }
        },
      );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(
    email: string,
    password: string,
  ) {
    try {
      const { profile: found } =
        await loginWithPassword(
          email,
          password,
        );

      const portal =
        view === "login-admin"
          ? "admin"
          : "client";

      const allowed =
        await routeProfile(
          found,
          portal,
        );

      if (!allowed) {
        await logoutUser();

        return {
          error:
            "E-mail ou senha incorretos.",
        };
      }

      return {};
    } catch (loginError) {
      const message =
        loginError instanceof Error
          ? loginError.message
          : "";

      if (
        message
          .toLowerCase()
          .includes("invalid login")
      ) {
        return {
          error:
            "E-mail ou senha incorretos.",
        };
      }

      if (
        message
          .toLowerCase()
          .includes(
            "email not confirmed",
          )
      ) {
        return {
          error:
            "Confirme seu e-mail antes de entrar.",
        };
      }

      return {
        error:
          "Não foi possível entrar. Verifique os dados e tente novamente.",
      };
    }
  }

  async function logout(
    destination:
      | "login-admin"
      | "login-client",
  ) {
    await logoutUser().catch(
      () => undefined,
    );

    setProfile(null);
    setProfessionalAccess(null);

    navigate(destination);
  }

  function completePhone(
    phone: string,
  ) {
    setProfile((current) =>
      current
        ? {
            ...current,
            phone,
          }
        : current,
    );

    navigate("client");
  }

  if (
    initializationStatus ===
    "initializing"
  ) {
    return (
      <div
        className="auth-loading"
        role="status"
        aria-live="polite"
      >
        <div className="auth-loading-content">
          <span
            className="auth-loading-symbol"
            aria-hidden="true"
          >
            ✦
          </span>

          <p>Preparando seu espaço...</p>
        </div>
      </div>
    );
  }

  let content: React.ReactNode;

  if (view === "admin") {
    content = (
      <AdminDashboard
        profile={profile}
        goPublic={() =>
          navigate("public")
        }
        logout={() =>
          logout("login-admin")
        }
      />
    );
  } else if (
    view === "staff" &&
    professionalAccess
  ) {
    content = (
      <ProfessionalDashboard
        access={professionalAccess}
        goPublic={() =>
          navigate("public")
        }
        logout={() =>
          logout("login-admin")
        }
      />
    );
  } else if (
    view ===
      "complete-client-profile" &&
    profile
  ) {
    content = (
      <CompleteClientProfile
        profile={profile}
        onComplete={completePhone}
        onLogout={() =>
          logout("login-client")
        }
      />
    );
  } else if (view === "client") {
    content = (
      <ClientDashboard
        profile={profile}
        logout={() =>
          logout("login-client")
        }
      />
    );
  } else if (
    view === "login-admin"
  ) {
    content = (
      <LoginScreen
        role="admin"
        close={() =>
          navigate("public")
        }
        onLogin={handleLogin}
      />
    );
  } else if (
    view === "login-client"
  ) {
    content = (
      <LoginScreen
        role="client"
        close={() =>
          navigate("public")
        }
        onLogin={handleLogin}
      />
    );
  } else {
    content = (
      <PublicSite
        goAdmin={() =>
          navigate("login-client")
        }
        openBooking={() =>
          navigate("login-client")
        }
      />
    );
  }

  return (
    <div
      className="page-transition"
      key={view}
    >
      {content}
    </div>
  );
}