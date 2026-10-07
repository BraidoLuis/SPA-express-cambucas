import { createClient } from "../../../lib/supabase/client";
import { getProfile, loginWithPassword, logoutUser, discardPasswordSession, type AuthProfile } from "./auth-service";
import { resolvePortalAccount, type AccountView, type Portal } from "./portal-access";
import type { ProfessionalAccess } from "./professional-access-service";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export type View = "public" | "login-admin" | "login-client" | AccountView;
export type PortalAuthState = {
  view: View;
  profile: AuthProfile | null;
  accountGeneration: number | null;
  professionalAccess: ProfessionalAccess | null;
  initializationStatus: "initializing" | "unauthenticated" | "authenticated";
  recovering: boolean;
  oauthError: string;
  recoveryError: string;
};

type PasswordAttempt = { generation: number; token: string | null; pending: boolean };

export const initialPortalAuthState: PortalAuthState = {
  view: "public",
  profile: null,
  accountGeneration: null,
  professionalAccess: null,
  initializationStatus: "initializing",
  recovering: false,
  oauthError: "",
  recoveryError: "",
};

// O estado publicado é atômico e cada operação pertence a uma geração.
// Assim, respostas de uma conta anterior não restauram um painel.
export class PortalAuth {
  private state = initialPortalAuthState;
  private listeners = new Set<() => void>();
  private active = false;
  private generation = 0;
  private userId: string | null = null;
  private authenticatedToken: string | null = null;
  private currentPortal: Portal = "client";
  private recoveryRequested = false;
  private passwordAttempts = new Set<PasswordAttempt>();
  private pendingSignIns = new Map<string, { session: Session; generation: number }>();
  private rejectedPasswordTokens = new Set<string>();
  private lastSignInToken: string | null = null;
  private unsubscribe?: () => void;

  constructor(
    private readonly getUrl: () => URL,
    private readonly writeView: (view: View) => void,
  ) {}

  getSnapshot = () => this.state;
  getServerSnapshot = () => initialPortalAuthState;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(state: PortalAuthState) {
    if (!this.active) return;
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  private isCurrent = (generation: number) => this.active && this.generation === generation;

  private hasPendingPasswordRequest() {
    return [...this.passwordAttempts].some((attempt) => attempt.pending);
  }

  private isPasswordSession(session: Session) {
    return this.rejectedPasswordTokens.has(session.access_token) ||
      [...this.passwordAttempts].some((attempt) => attempt.token === session.access_token);
  }

  private identifyPasswordSession(attempt: PasswordAttempt, session: Session | null) {
    attempt.pending = false;
    attempt.token = session?.access_token ?? null;
    if (session) {
      // A resposta identifica o token antes de qualquer espera pela limpeza.
      this.pendingSignIns.delete(session.access_token);
      if (!this.isCurrent(attempt.generation)) this.rejectedPasswordTokens.add(session.access_token);
      else this.userId = session.user.id;
    }
    queueMicrotask(this.reconcilePendingSignIn);
  }

  private reconcilePendingSignIn = () => {
    if (!this.active || this.hasPendingPasswordRequest()) return;
    const pending = this.lastSignInToken ? this.pendingSignIns.get(this.lastSignInToken) : undefined;
    this.pendingSignIns.clear();
    if (pending && this.isCurrent(pending.generation) && !this.isPasswordSession(pending.session)) {
      this.onAuthStateChange("SIGNED_IN", pending.session);
    }
  };

  private portal(): Portal {
    const access = this.getUrl().searchParams.get("access");
    if (access === "admin" || access === "client") this.currentPortal = access;
    return this.currentPortal;
  }

  private clear(view: View, status: PortalAuthState["initializationStatus"] = "unauthenticated") {
    this.publish({ ...initialPortalAuthState, view, initializationStatus: status });
  }

  start() {
    this.active = true;
    const { data } = createClient().auth.onAuthStateChange(this.onAuthStateChange);
    this.unsubscribe = () => data.subscription.unsubscribe();
    const generation = ++this.generation;
    return this.reconcile(generation);
  }

  stop() {
    this.active = false;
    ++this.generation;
    this.unsubscribe?.();
  }

  // Não chama nem aguarda APIs do Supabase. A reconciliação roda após o callback.
  private onAuthStateChange = (event: AuthChangeEvent, session: Session | null) => {
    if (!this.active || event === "INITIAL_SESSION") return;
    if (event === "SIGNED_OUT") {
      ++this.generation;
      this.userId = null;
      this.recoveryRequested = false;
      const view = this.portal() === "admin" ? "login-admin" : "login-client";
      const oauthError = this.getUrl().searchParams.get("oauth_error") ?? "";
      this.writeView(view);
      this.publish({ ...initialPortalAuthState, view, initializationStatus: "unauthenticated", oauthError });
      return;
    }
    if (!session) return;
    if (event === "SIGNED_IN") {
      this.lastSignInToken = session.access_token;
      if (this.isPasswordSession(session)) return;
      if (this.hasPendingPasswordRequest()) {
        // O SDK pode emitir antes de resolver a senha. Adia até conhecer o token,
        // sem descartar eventos de OAuth ou de outra aba.
        this.pendingSignIns.set(session.access_token, { session, generation: this.generation });
        return;
      }
      if (this.state.initializationStatus === "authenticated" && this.authenticatedToken === session.access_token) return;
    } else if (event !== "PASSWORD_RECOVERY" && this.userId === session.user.id) {
      return;
    }
    if (event === "PASSWORD_RECOVERY") this.recoveryRequested = true;
    this.userId = session.user.id;
    const generation = ++this.generation;
    this.clear(this.portal() === "admin" ? "login-admin" : "login-client", "initializing");
    queueMicrotask(() => {
      if (this.isCurrent(generation)) void this.reconcile(generation);
    });
  };

  private async reconcile(generation: number) {
    try {
      const url = this.getUrl();
      const access = url.searchParams.get("access");
      const portal = this.portal();
      const fallback: View = access === "admin" ? "login-admin" : access === "client" ? "login-client" : "public";
      const oauthError = url.searchParams.get("oauth_error") ?? "";
      const recovery = this.recoveryRequested || (access === "client" && url.searchParams.get("reset") === "1");
      const { data, error } = await createClient().auth.getSession();
      if (!this.isCurrent(generation)) return;
      if (error) throw error;
      this.userId = data.session?.user.id ?? null;
      if (data.session && (this.isPasswordSession(data.session) || this.pendingSignIns.has(data.session.access_token))) {
        this.clear(fallback);
        return;
      }
      if (!data.session) {
        this.publish({
          ...initialPortalAuthState, view: fallback, initializationStatus: "unauthenticated", oauthError,
          recoveryError: recovery ? "O link expirou ou é inválido. Solicite uma nova recuperação." : "",
        });
        return;
      }
      if (recovery) {
        // reset=1 só escolhe a tela; a sessão é validada pelo Supabase.
        const { data: verified, error: validationError } = await createClient().auth.getUser();
        if (!this.isCurrent(generation) || this.isPasswordSession(data.session)) return;
        if (validationError || verified.user?.id !== data.session.user.id) {
          throw validationError || new Error("Sessão de recuperação inválida.");
        }
        this.authenticatedToken = data.session.access_token;
        this.publish({
          ...initialPortalAuthState, view: "login-client", recovering: true,
          initializationStatus: "authenticated",
        });
        return;
      }
      if ((access !== "admin" && access !== "client") || oauthError) {
        this.publish({ ...initialPortalAuthState, view: fallback, initializationStatus: "unauthenticated", oauthError });
        return;
      }
      const profile = await getProfile(data.session.user.id);
      if (!this.isCurrent(generation) || this.isPasswordSession(data.session)) return;
      const account = await resolvePortalAccount(profile, portal);
      if (!this.isCurrent(generation) || this.isPasswordSession(data.session)) return;
      this.authenticatedToken = data.session.access_token;
      this.publish({
        ...initialPortalAuthState, ...account, accountGeneration: generation, initializationStatus: "authenticated",
      });
    } catch {
      if (!this.isCurrent(generation)) return;
      const url = this.getUrl();
      this.publish({
        ...initialPortalAuthState,
        view: this.portal() === "admin" ? "login-admin" : "login-client",
        initializationStatus: "unauthenticated",
        oauthError: url.searchParams.get("oauth_error") ?? "",
        recoveryError: this.recoveryRequested || url.searchParams.get("reset") === "1"
          ? "O link expirou ou é inválido. Solicite uma nova recuperação." : "",
      });
    }
  }

  navigate = (view: View) => {
    ++this.generation;
    this.recoveryRequested = false;
    if (view === "login-admin") this.currentPortal = "admin";
    if (view === "login-client") this.currentPortal = "client";
    this.writeView(view);
    this.clear(view);
  };

  login = async (email: string, password: string) => {
    const portal = this.portal();
    const generation = ++this.generation;
    const attempt: PasswordAttempt = { generation, token: null, pending: true };
    this.passwordAttempts.add(attempt);
    const isCurrentAttempt = () => this.isCurrent(generation) &&
      (!this.lastSignInToken || !this.pendingSignIns.has(this.lastSignInToken) || this.lastSignInToken === attempt.token);
    try {
      const account = await loginWithPassword(
        email, password, portal, isCurrentAttempt,
        (session) => this.identifyPasswordSession(attempt, session),
      );
      if (!isCurrentAttempt()) {
        this.rejectedPasswordTokens.add(account.session.access_token);
        await discardPasswordSession(account.session).catch(() => undefined);
        return { error: "A tentativa de login foi interrompida." };
      }
      this.userId = account.user.id;
      this.authenticatedToken = account.session.access_token;
      this.writeView(account.view);
      this.publish({
        ...initialPortalAuthState, profile: account.profile,
        professionalAccess: account.professionalAccess, view: account.view,
        accountGeneration: generation, initializationStatus: "authenticated",
      });
      return {};
    } catch (error) {
      if (attempt.token) this.rejectedPasswordTokens.add(attempt.token);
      if (this.isCurrent(generation)) this.clear(portal === "admin" ? "login-admin" : "login-client");
      const message = error && typeof error === "object" && "message" in error
        ? String(error.message).toLowerCase() : "";
      return { error: message.includes("invalid login")
        ? "E-mail ou senha incorretos."
        : message.includes("email not confirmed")
        ? "Confirme seu e-mail antes de entrar."
        : "Não foi possível entrar. Verifique os dados e tente novamente." };
    } finally {
      attempt.pending = false;
      this.passwordAttempts.delete(attempt);
      queueMicrotask(this.reconcilePendingSignIn);
    }
  };

  logout = async (destination: "login-admin" | "login-client") => {
    // Desmonta o painel antes de qualquer espera de rede.
    this.navigate(destination);
    this.userId = null;
    await logoutUser().catch(() => undefined);
  };

  finishRecovery = () => {
    if (!this.state.recovering) return;
    this.navigate("login-client");
  };

  completePhone = (phone: string, profileId: string, accountGeneration: number) => {
    if (!this.isCurrent(accountGeneration) || this.state.accountGeneration !== accountGeneration ||
        this.state.initializationStatus !== "authenticated" ||
        this.state.view !== "complete-client-profile" || this.state.profile?.id !== profileId) return;
    this.writeView("client");
    this.publish({
      ...this.state, profile: { ...this.state.profile, phone }, view: "client",
    });
  };
}
