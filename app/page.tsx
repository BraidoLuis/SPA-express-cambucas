"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AdminDashboard } from "./components/admin/admin-dashboard";
import { CompleteClientProfile } from "./components/auth/complete-client-profile";
import { LoginScreen } from "./components/auth/login-screen";
import { ClientDashboard } from "./components/client/client-dashboard";
import { ProfessionalDashboard } from "./components/professional/professional-dashboard";
import { PublicSite } from "./components/public/public-site";
import { PortalAuth, type View } from "./lib/services/portal-auth";

export default function Home() {
  const [auth] = useState(() => new PortalAuth(
    () => new URL(window.location.href),
    (next: View) => {
      const adminView = next === "login-admin" || next === "staff" || next === "admin";
      const clientView = next === "login-client" || next === "complete-client-profile" || next === "client";
      window.history.pushState({}, "", adminView ? "?access=admin" : clientView ? "?access=client" : "/");
    },
  ));
  const {
    view, profile, professionalAccess, initializationStatus,
    recovering, oauthError, recoveryError, accountGeneration,
  } = useSyncExternalStore(auth.subscribe, auth.getSnapshot, auth.getServerSnapshot);

  useEffect(() => {
    void auth.start();
    return () => auth.stop();
  }, [auth]);

  const navigate = auth.navigate;
  const logout = auth.logout;
  const completePhone = auth.completePhone;

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

  if (view === "admin" && profile) {
    content = (
      <AdminDashboard
        key={accountGeneration}
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
        key={accountGeneration}
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
    profile && accountGeneration !== null
  ) {
    content = (
      <CompleteClientProfile
        profile={profile}
        onComplete={(phone) => completePhone(phone, profile.id, accountGeneration)}
        onLogout={() =>
          logout("login-client")
        }
      />
    );
  } else if (view === "client" && profile) {
    content = (
      <ClientDashboard
        key={accountGeneration}
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
        onLogin={auth.login}
      />
    );
  } else if (
    view === "login-client"
  ) {
    content = (
      <LoginScreen
        role="client"
        recovering={recovering}
        oauthError={oauthError}
        recoveryError={recoveryError}
        onPasswordUpdated={auth.finishRecovery}
        close={() =>
          navigate("public")
        }
        onLogin={auth.login}
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