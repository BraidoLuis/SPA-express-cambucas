import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { PortalAuth, type View } from "./portal-auth";
import { loginWithPassword, updatePassword, type AuthProfile } from "./auth-service";

const mocks = vi.hoisted(() => ({
  session: null as Session | null,
  callback: undefined as ((event: AuthChangeEvent, session: Session | null) => void) | undefined,
  getSession: vi.fn(),
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  profileRead: vi.fn(),
  professionalRead: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("../../../lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mocks.getSession,
      getUser: mocks.getUser,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
      updateUser: mocks.updateUser,
      onAuthStateChange: (callback: typeof mocks.callback) => {
        mocks.callback = callback;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
    },
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        single: table === "profiles" ? mocks.profileRead : mocks.professionalRead,
      };
      return query;
    },
  }),
}));

const profile: AuthProfile = {
  id: "client-1", full_name: "Cliente de teste", email: "client@example.test",
  phone: "5511999999999", role: "client", active: true,
};

function sessionFor(id = profile.id, token = `token-${id}`): Session {
  return {
    access_token: token, refresh_token: `refresh-${id}`, token_type: "bearer", expires_in: 3600,
    user: {
      id, email: `${id}@example.test`, aud: "authenticated",
      app_metadata: {}, user_metadata: {}, created_at: "2026-10-07T00:00:00Z",
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

let auth: PortalAuth;
let url: URL;
let writtenViews: View[];

function createPortal(query = "?access=client") {
  url = new URL(`https://spa.example.test/${query}`);
  writtenViews = [];
  auth = new PortalAuth(
    () => url,
    (view) => {
      writtenViews.push(view);
      const admin = view === "login-admin" || view === "admin" || view === "staff";
      url = new URL(`https://spa.example.test/${view === "public" ? "" : admin ? "?access=admin" : "?access=client"}`);
    },
  );
  return auth;
}

function emit(event: AuthChangeEvent, session: Session | null) {
  mocks.session = session;
  return mocks.callback?.(event, session);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callback = undefined;
  mocks.session = null;
  mocks.getSession.mockImplementation(async () => ({ data: { session: mocks.session }, error: null }));
  mocks.getUser.mockImplementation(async () => ({ data: { user: mocks.session?.user ?? null }, error: null }));
  mocks.profileRead.mockResolvedValue({ data: profile, error: null });
  mocks.professionalRead.mockResolvedValue({ data: null, error: new Error("Conta profissional não vinculada.") });
  mocks.signInWithPassword.mockImplementation(async () => {
    const session = sessionFor();
    emit("SIGNED_IN", session);
    return { data: { user: session.user, session }, error: null };
  });
  mocks.signOut.mockImplementation(async () => {
    emit("SIGNED_OUT", null);
    return { error: null };
  });
  mocks.updateUser.mockResolvedValue({ data: { user: sessionFor().user }, error: null });
  createPortal();
});

afterEach(() => auth.stop());

describe("autenticação por senha e validação do portal", () => {
  it("encerra a sessão criada quando a leitura do perfil falha e limpa a conta", async () => {
    await auth.start();
    mocks.profileRead.mockRejectedValueOnce(new Error("Falha ao carregar perfil"));
    const result = await auth.login(" CLIENT@EXAMPLE.TEST ", "senha-de-teste");
    expect(result.error).toBeTruthy();
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "client@example.test", password: "senha-de-teste" });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(auth.getSnapshot()).toMatchObject({
      view: "login-client", profile: null, professionalAccess: null, initializationStatus: "unauthenticated",
    });
  });

  it.each([
    ["perfil inativo", { ...profile, active: false }, "?access=client"],
    ["cliente na equipe", profile, "?access=admin"],
    ["admin em clientes", { ...profile, role: "admin" }, "?access=client"],
    ["profissional em clientes", { ...profile, role: "professional" }, "?access=client"],
  ] as const)("rejeita %s e encerra a nova sessão", async (_name, found, query) => {
    createPortal(query);
    await auth.start();
    mocks.profileRead.mockResolvedValue({ data: found, error: null });
    expect((await auth.login("client@example.test", "senha-de-teste")).error).toBeTruthy();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(auth.getSnapshot().profile).toBeNull();
    expect(auth.getSnapshot().initializationStatus).toBe("unauthenticated");
  });

  it("rejeita profissional sem vínculo quando getProfessionalAccess lança erro", async () => {
    createPortal("?access=admin");
    await auth.start();
    mocks.profileRead.mockResolvedValue({ data: { ...profile, role: "professional" }, error: null });
    expect((await auth.login("staff@example.test", "senha-de-teste")).error).toBeTruthy();
    expect(mocks.professionalRead).toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(auth.getSnapshot()).toMatchObject({ view: "login-admin", professionalAccess: null, profile: null });
  });

  it("só libera profissional com vínculo ativo pertencente ao perfil", async () => {
    createPortal("?access=admin");
    await auth.start();
    mocks.profileRead.mockResolvedValue({ data: { ...profile, role: "professional" }, error: null });
    mocks.professionalRead.mockResolvedValue({
      data: { id: "professional-1", profile_id: profile.id, display_name: "Equipe teste", specialty: "Teste", bio: null },
      error: null,
    });
    expect(await auth.login("staff@example.test", "senha-de-teste")).toEqual({});
    expect(auth.getSnapshot()).toMatchObject({
      view: "staff", professionalAccess: { id: "professional-1", profileId: profile.id },
      initializationStatus: "authenticated",
    });
  });

  it("não encerra uma sessão preexistente quando a senha é inválida", async () => {
    mocks.session = sessionFor("existing-account");
    mocks.signInWithPassword.mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: "Invalid login credentials" } });
    await expect(loginWithPassword("client@example.test", "errada", "client")).rejects.toMatchObject({ message: "Invalid login credentials" });
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.session?.user.id).toBe("existing-account");
  });

  it("não encerra uma conta mais recente após falha na leitura de um perfil antigo", async () => {
    const pending = deferred<{ data: AuthProfile | null; error: Error | null }>();
    mocks.profileRead.mockReturnValueOnce(pending.promise);
    const login = loginWithPassword("client@example.test", "senha-de-teste", "client");
    await vi.waitFor(() => expect(mocks.profileRead).toHaveBeenCalled());
    mocks.session = sessionFor("new-account");
    pending.resolve({ data: null, error: new Error("Falha antiga") });
    await expect(login).rejects.toThrow("Falha antiga");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.session?.user.id).toBe("new-account");
  });

  it("cliente sem telefone passa pelo complemento do perfil antes do painel", async () => {
    await auth.start();
    mocks.profileRead.mockResolvedValue({ data: { ...profile, phone: "  " }, error: null });
    expect(await auth.login("client@example.test", "senha-de-teste")).toEqual({});
    expect(auth.getSnapshot()).toMatchObject({ view: "complete-client-profile", initializationStatus: "authenticated" });
    const accountGeneration = auth.getSnapshot().accountGeneration!;
    auth.completePhone("5511999999999", profile.id, accountGeneration);
    expect(auth.getSnapshot()).toMatchObject({ view: "client", profile: { phone: "5511999999999" } });
    emit("SIGNED_OUT", null);
    auth.completePhone("5511888888888", profile.id, accountGeneration);
    expect(auth.getSnapshot().view).toBe("login-client");
  });

  it("atualiza o status após login e limpa o painel antes de aguardar logout", async () => {
    await auth.start();
    await auth.login("client@example.test", "senha-de-teste");
    expect(auth.getSnapshot().initializationStatus).toBe("authenticated");
    const pending = deferred<{ error: null }>();
    mocks.signOut.mockReturnValueOnce(pending.promise);
    const logout = auth.logout("login-client");
    expect(auth.getSnapshot()).toMatchObject({ view: "login-client", profile: null, initializationStatus: "unauthenticated" });
    pending.resolve({ error: null });
    await logout;
  });
});

describe("inicialização e respostas concorrentes", () => {
  it("complemento de telefone de uma conta antiga não libera o painel de outra conta", async () => {
    mocks.session = sessionFor("new-client");
    mocks.profileRead.mockResolvedValue({ data: { ...profile, id: "new-client", phone: null }, error: null });
    await auth.start();
    auth.completePhone("5511999999999", profile.id, auth.getSnapshot().accountGeneration!);
    expect(auth.getSnapshot()).toMatchObject({ view: "complete-client-profile", profile: { id: "new-client", phone: null } });
  });

  it("navegação durante inicialização invalida o resultado anterior", async () => {
    mocks.session = sessionFor();
    const pending = deferred<{ data: AuthProfile; error: null }>();
    mocks.profileRead.mockReturnValueOnce(pending.promise);
    const initialization = auth.start();
    await vi.waitFor(() => expect(mocks.profileRead).toHaveBeenCalled());
    auth.navigate("login-admin");
    pending.resolve({ data: profile, error: null });
    await initialization;
    expect(auth.getSnapshot()).toMatchObject({ view: "login-admin", profile: null });
  });

  it.each(["client", "admin"] as const)("SIGNED_OUT desmonta o painel de %s e usa o portal atual", async (portal) => {
    mocks.session = sessionFor();
    await auth.start();
    url = new URL(`https://spa.example.test/?access=${portal}`);
    expect(emit("SIGNED_OUT", null)).toBeUndefined();
    expect(auth.getSnapshot()).toMatchObject({
      view: portal === "admin" ? "login-admin" : "login-client",
      profile: null, professionalAccess: null, initializationStatus: "unauthenticated",
    });
    expect(writtenViews.at(-1)).toBe(portal === "admin" ? "login-admin" : "login-client");
  });

  it("logout durante getSession impede inicialização antiga de restaurar o painel", async () => {
    const pending = deferred<{ data: { session: Session | null }; error: null }>();
    mocks.getSession.mockReturnValueOnce(pending.promise);
    const initialization = auth.start();
    emit("SIGNED_OUT", null);
    pending.resolve({ data: { session: sessionFor() }, error: null });
    await initialization;
    expect(mocks.profileRead).not.toHaveBeenCalled();
    expect(auth.getSnapshot()).toMatchObject({ view: "login-client", profile: null, initializationStatus: "unauthenticated" });
  });

  it("logout durante leitura do perfil impede restauração do painel", async () => {
    mocks.session = sessionFor();
    const pending = deferred<{ data: AuthProfile; error: null }>();
    mocks.profileRead.mockReturnValueOnce(pending.promise);
    const initialization = auth.start();
    await vi.waitFor(() => expect(mocks.profileRead).toHaveBeenCalled());
    emit("SIGNED_OUT", null);
    pending.resolve({ data: profile, error: null });
    await initialization;
    expect(auth.getSnapshot()).toMatchObject({ view: "login-client", profile: null, initializationStatus: "unauthenticated" });
  });

  it("a troca de conta invalida a leitura anterior sem chamar Supabase dentro do callback", async () => {
    mocks.session = sessionFor();
    const pending = deferred<{ data: AuthProfile; error: null }>();
    mocks.profileRead.mockReturnValueOnce(pending.promise);
    const initialization = auth.start();
    await vi.waitFor(() => expect(mocks.profileRead).toHaveBeenCalled());
    mocks.profileRead.mockResolvedValue({ data: { ...profile, id: "new-client" }, error: null });
    const callsBeforeEvent = mocks.getSession.mock.calls.length;
    expect(emit("SIGNED_IN", sessionFor("new-client"))).toBeUndefined();
    expect(mocks.getSession).toHaveBeenCalledTimes(callsBeforeEvent);
    expect(auth.getSnapshot().profile).toBeNull();
    pending.resolve({ data: profile, error: null });
    await initialization;
    await vi.waitFor(() => expect(auth.getSnapshot().profile?.id).toBe("new-client"));
    expect(auth.getSnapshot().view).toBe("client");
  });

  it("respostas após desmontagem não publicam estado e a assinatura é removida", async () => {
    mocks.session = sessionFor();
    const pending = deferred<{ data: AuthProfile; error: null }>();
    mocks.profileRead.mockReturnValueOnce(pending.promise);
    const initialization = auth.start();
    await vi.waitFor(() => expect(mocks.profileRead).toHaveBeenCalled());
    const subscriber = vi.fn();
    auth.subscribe(subscriber);
    auth.stop();
    pending.resolve({ data: profile, error: null });
    await initialization;
    expect(subscriber).not.toHaveBeenCalled();
    expect(mocks.unsubscribe).toHaveBeenCalled();
  });

  it("logout durante login não permite que sua resposta abra um painel", async () => {
    await auth.start();
    const pending = deferred<{ data: AuthProfile; error: null }>();
    mocks.profileRead.mockReturnValueOnce(pending.promise);
    const login = auth.login("client@example.test", "senha-de-teste");
    await vi.waitFor(() => expect(mocks.profileRead).toHaveBeenCalled());
    emit("SIGNED_OUT", null);
    pending.resolve({ data: profile, error: null });
    expect((await login).error).toBeTruthy();
    expect(auth.getSnapshot()).toMatchObject({ view: "login-client", profile: null });
  });

  it("profissional sem vínculo na inicialização permanece no login", async () => {
    createPortal("?access=admin");
    mocks.session = sessionFor();
    mocks.profileRead.mockResolvedValue({ data: { ...profile, role: "professional" }, error: null });
    await auth.start();
    expect(auth.getSnapshot()).toMatchObject({ view: "login-admin", professionalAccess: null, initializationStatus: "unauthenticated" });
  });
});

describe("recuperação de senha e primeiro acesso OAuth", () => {
  it("um portal desconhecido não restaura uma sessão no dashboard", async () => {
    createPortal("?access=unknown");
    mocks.session = sessionFor();
    await auth.start();
    expect(auth.getSnapshot()).toMatchObject({ view: "public", profile: null, initializationStatus: "unauthenticated" });
    expect(mocks.profileRead).not.toHaveBeenCalled();
  });

  it("SIGNED_OUT durante inicialização preserva oauth_error para a tela de login", async () => {
    createPortal("?access=client&oauth_error=cancelled");
    const pending = deferred<{ data: { session: Session | null }; error: null }>();
    mocks.getSession.mockReturnValueOnce(pending.promise);
    const initialization = auth.start();
    emit("SIGNED_OUT", null);
    pending.resolve({ data: { session: null }, error: null });
    await initialization;
    expect(auth.getSnapshot()).toMatchObject({ view: "login-client", oauthError: "cancelled", profile: null });
  });

  it("sessão válida com reset=1 mantém a tela de nova senha e não consulta o perfil", async () => {
    createPortal("?access=client&reset=1");
    mocks.session = sessionFor();
    await auth.start();
    expect(mocks.getUser).toHaveBeenCalled();
    expect(mocks.profileRead).not.toHaveBeenCalled();
    expect(auth.getSnapshot()).toMatchObject({ view: "login-client", recovering: true, profile: null, initializationStatus: "authenticated" });
    emit("SIGNED_IN", mocks.session);
    emit("USER_UPDATED", mocks.session);
    expect(auth.getSnapshot().recovering).toBe(true);
    await updatePassword("nova-senha-de-teste");
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "nova-senha-de-teste" });
    auth.finishRecovery();
    expect(auth.getSnapshot()).toMatchObject({ view: "login-client", recovering: false });
    expect(url.searchParams.has("reset")).toBe(false);
  });

  it("reset=1 sem sessão não concede acesso nem libera alteração de senha", async () => {
    createPortal("?access=client&reset=1");
    await auth.start();
    expect(auth.getSnapshot()).toMatchObject({ recovering: false, view: "login-client", initializationStatus: "unauthenticated" });
    await expect(updatePassword("nova-senha-de-teste")).rejects.toThrow();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("sessão de recuperação rejeitada pelo Supabase não libera o formulário", async () => {
    createPortal("?access=client&reset=1");
    mocks.session = sessionFor();
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("JWT inválido") });
    await auth.start();
    expect(auth.getSnapshot()).toMatchObject({ recovering: false, view: "login-client", initializationStatus: "unauthenticated" });
    await expect(updatePassword("nova-senha-de-teste")).rejects.toThrow("JWT inválido");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("PASSWORD_RECOVERY invalida um dashboard em carregamento e reconcilia fora do callback", async () => {
    mocks.session = sessionFor();
    const pending = deferred<{ data: AuthProfile; error: null }>();
    mocks.profileRead.mockReturnValueOnce(pending.promise);
    const initialization = auth.start();
    await vi.waitFor(() => expect(mocks.profileRead).toHaveBeenCalled());
    const callsBefore = mocks.getUser.mock.calls.length;
    expect(emit("PASSWORD_RECOVERY", mocks.session)).toBeUndefined();
    expect(mocks.getUser).toHaveBeenCalledTimes(callsBefore);
    pending.resolve({ data: profile, error: null });
    await initialization;
    await vi.waitFor(() => expect(auth.getSnapshot().recovering).toBe(true));
    expect(auth.getSnapshot().view).toBe("login-client");
  });

  it("primeiro acesso OAuth sem telefone mantém complemento do perfil", async () => {
    mocks.session = sessionFor("google-client");
    mocks.profileRead.mockResolvedValue({ data: { ...profile, id: "google-client", phone: null }, error: null });
    await auth.start();
    expect(auth.getSnapshot()).toMatchObject({ view: "complete-client-profile", profile: { id: "google-client" } });
  });

  it("oauth_error é preservado para exibição mesmo com sessão preexistente", async () => {
    createPortal("?access=client&oauth_error=cancelled");
    mocks.session = sessionFor();
    await auth.start();
    expect(auth.getSnapshot()).toMatchObject({ view: "login-client", oauthError: "cancelled" });
    expect(mocks.profileRead).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});

describe("regressões da revisão externa: operações abandonadas", () => {
  it.each(["logout", "login-client", "public"] as const)(
    "SIGNED_IN tardio após %s nunca publica conta enquanto signOut está pendente",
    async (action) => {
      await auth.start();
      const request = deferred<{ data: { user: Session["user"]; session: Session }; error: null }>();
      const cleanup = deferred<{ error: null }>();
      const abandonedSession = sessionFor(profile.id, "abandoned-password-session");
      mocks.signInWithPassword.mockImplementationOnce(async () => {
        const response = await request.promise;
        emit("SIGNED_IN", response.data.session);
        return response;
      });
      const publishedViews: View[] = [];
      const publishedStatuses: string[] = [];
      auth.subscribe(() => {
        publishedViews.push(auth.getSnapshot().view);
        publishedStatuses.push(auth.getSnapshot().initializationStatus);
      });
      const login = auth.login("client@example.test", "senha-de-teste");
      expect(mocks.signInWithPassword).toHaveBeenCalled();
      if (action === "logout") await auth.logout("login-client");
      else auth.navigate(action);
      mocks.signOut.mockImplementationOnce(async () => {
        const result = await cleanup.promise;
        emit("SIGNED_OUT", null);
        return result;
      });
      request.resolve({ data: { user: abandonedSession.user, session: abandonedSession }, error: null });
      try {
        await vi.waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" }));
        // Esgota as microtasks de reconciliação sem liberar a limpeza.
        for (let turn = 0; turn < 12; turn++) await Promise.resolve();
        expect(mocks.profileRead).not.toHaveBeenCalled();
        expect(auth.getSnapshot().profile).toBeNull();
        expect(auth.getSnapshot().view).toBe(action === "public" ? "public" : "login-client");
        expect(publishedViews).not.toContain("client");
        expect(publishedViews).not.toContain("complete-client-profile");
        expect(publishedStatuses).not.toContain("authenticated");
        emit("SIGNED_IN", abandonedSession);
        for (let turn = 0; turn < 12; turn++) await Promise.resolve();
        expect(auth.getSnapshot().profile).toBeNull();
        expect(publishedStatuses).not.toContain("authenticated");
      } finally {
        cleanup.resolve({ error: null });
        await login;
      }
      expect(publishedStatuses).not.toContain("authenticated");
    },
  );

  it("resposta de telefone do primeiro acesso não libera novo acesso com o mesmo perfil", async () => {
    await auth.start();
    mocks.profileRead.mockResolvedValue({ data: { ...profile, phone: null }, error: null });
    await auth.login("client@example.test", "senha-de-teste");
    const firstAccess = auth.getSnapshot();
    const firstSave = deferred<string>();
    const completeFirst = (phone: string) =>
      auth.completePhone(phone, profile.id, firstAccess.accountGeneration!);
    const firstCompletion = firstSave.promise.then(completeFirst);
    await auth.logout("login-client");
    mocks.signInWithPassword.mockImplementationOnce(async () => {
      const session = sessionFor(profile.id, "second-access-same-profile");
      emit("SIGNED_IN", session);
      return { data: { user: session.user, session }, error: null };
    });
    await auth.login("client@example.test", "senha-de-teste");
    const secondAccess = auth.getSnapshot();
    expect(secondAccess.view).toBe("complete-client-profile");
    expect(secondAccess.accountGeneration).not.toBe(firstAccess.accountGeneration);
    firstSave.resolve("5511999999999");
    await firstCompletion;
    expect(auth.getSnapshot()).toMatchObject({
      view: "complete-client-profile", profile: { id: profile.id, phone: null },
    });
    expect(writtenViews.at(-1)).toBe("complete-client-profile");

    const secondSave = deferred<string>();
    const secondCompletion = secondSave.promise.then((phone) =>
      auth.completePhone(phone, profile.id, secondAccess.accountGeneration!),
    );
    secondSave.resolve("5511888888888");
    await secondCompletion;
    expect(auth.getSnapshot()).toMatchObject({
      view: "client", profile: { id: profile.id, phone: "5511888888888" },
    });
  });
});

describe("eventos legítimos durante tentativas de senha abandonadas", () => {
  it.each(["other-client", profile.id])(
    "preserva SIGNED_IN de outra aba para %s durante a limpeza antiga",
    async (nextId) => {
      await auth.start();
      const request = deferred<{ data: { user: Session["user"]; session: Session }; error: null }>();
      const cleanupRead = deferred<{ data: { session: Session | null }; error: null }>();
      const oldSession = sessionFor(profile.id, "old-password-session");
      const nextSession = sessionFor(nextId, "legitimate-tab-session");
      mocks.signInWithPassword.mockImplementationOnce(async () => {
        const response = await request.promise;
        emit("SIGNED_IN", response.data.session);
        return response;
      });
      const login = auth.login("client@example.test", "senha-de-teste");
      auth.navigate("login-client");
      mocks.getSession.mockReturnValueOnce(cleanupRead.promise);
      request.resolve({ data: { user: oldSession.user, session: oldSession }, error: null });
      try {
        await vi.waitFor(() => expect(mocks.getSession).toHaveBeenCalledTimes(2));
        expect(auth.getSnapshot().profile).toBeNull();
        mocks.profileRead.mockResolvedValue({ data: { ...profile, id: nextId }, error: null });
        const callsBefore = mocks.getSession.mock.calls.length;
        expect(emit("SIGNED_IN", nextSession)).toBeUndefined();
        expect(mocks.getSession).toHaveBeenCalledTimes(callsBefore);
        await vi.waitFor(() => expect(auth.getSnapshot()).toMatchObject({
          view: "client", profile: { id: nextId }, initializationStatus: "authenticated",
        }));
      } finally {
        cleanupRead.resolve({ data: { session: nextSession }, error: null });
        await login;
      }
      expect(mocks.signOut).not.toHaveBeenCalled();
      expect(auth.getSnapshot()).toMatchObject({ view: "client", profile: { id: nextId } });
    },
  );

  it("reconcilia OAuth legítimo adiado até uma requisição antiga falhar sem criar sessão", async () => {
    await auth.start();
    const request = deferred<never>();
    mocks.signInWithPassword.mockReturnValueOnce(request.promise);
    const login = auth.login("client@example.test", "senha-de-teste");
    auth.navigate("login-client");
    const googleSession = sessionFor("google-client", "legitimate-oauth-session");
    googleSession.user.app_metadata.provider = "google";
    mocks.profileRead.mockResolvedValue({ data: { ...profile, id: "google-client", phone: null }, error: null });
    const callsBefore = mocks.getSession.mock.calls.length;
    emit("SIGNED_IN", googleSession);
    expect(mocks.getSession).toHaveBeenCalledTimes(callsBefore);
    expect(auth.getSnapshot().profile).toBeNull();
    request.reject(new Error("Invalid login credentials"));
    expect((await login).error).toBeTruthy();
    await vi.waitFor(() => expect(auth.getSnapshot()).toMatchObject({
      view: "complete-client-profile", profile: { id: "google-client", phone: null },
      initializationStatus: "authenticated",
    }));
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("aceita recuperação válida enquanto uma requisição de senha antiga está pendente", async () => {
    await auth.start();
    const request = deferred<never>();
    mocks.signInWithPassword.mockReturnValueOnce(request.promise);
    const login = auth.login("client@example.test", "senha-de-teste");
    auth.navigate("login-client");
    const recoverySession = sessionFor(profile.id, "valid-recovery-session");
    const callsBefore = mocks.getSession.mock.calls.length;
    emit("PASSWORD_RECOVERY", recoverySession);
    expect(mocks.getSession).toHaveBeenCalledTimes(callsBefore);
    try {
      await vi.waitFor(() => expect(auth.getSnapshot()).toMatchObject({
        view: "login-client", recovering: true, initializationStatus: "authenticated", profile: null,
      }));
    } finally {
      request.reject(new Error("Invalid login credentials"));
      await login;
    }
    expect(auth.getSnapshot().recovering).toBe(true);
    expect(mocks.signOut).not.toHaveBeenCalled();
    await updatePassword("nova-senha-de-teste");
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "nova-senha-de-teste" });
  });

  it("não trata o evento legítimo recebido durante validação de senha como parte da tentativa", async () => {
    await auth.start();
    const profileRead = deferred<{ data: AuthProfile; error: null }>();
    mocks.profileRead.mockReturnValueOnce(profileRead.promise);
    const login = auth.login("client@example.test", "senha-de-teste");
    await vi.waitFor(() => expect(mocks.profileRead).toHaveBeenCalledTimes(1));
    mocks.profileRead.mockResolvedValue({ data: { ...profile, id: "next-client" }, error: null });
    const nextSession = sessionFor("next-client", "next-client-valid-session");
    emit("SIGNED_IN", nextSession);
    try {
      await vi.waitFor(() => expect(auth.getSnapshot().profile?.id).toBe("next-client"));
    } finally {
      profileRead.resolve({ data: profile, error: null });
      await login;
    }
    expect(auth.getSnapshot()).toMatchObject({ view: "client", profile: { id: "next-client" } });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});

describe("identificação da resposta de senha antes da reconciliação", () => {
  it("distingue OAuth do token de senha quando os dois eventos chegam antes da resposta", async () => {
    await auth.start();
    const request = deferred<{ data: { user: Session["user"]; session: Session }; error: null }>();
    const oldSession = sessionFor(profile.id, "password-event-before-response");
    const googleSession = sessionFor("google-client", "oauth-after-password-event");
    mocks.signInWithPassword.mockReturnValueOnce(request.promise);
    const login = auth.login("client@example.test", "senha-de-teste");
    auth.navigate("login-client");
    emit("SIGNED_IN", oldSession);
    googleSession.user.app_metadata.provider = "google";
    mocks.profileRead.mockResolvedValue({ data: { ...profile, id: "google-client", phone: null }, error: null });
    emit("SIGNED_IN", googleSession);
    expect(auth.getSnapshot().profile).toBeNull();
    request.resolve({ data: { user: oldSession.user, session: oldSession }, error: null });
    expect((await login).error).toBeTruthy();
    await vi.waitFor(() => expect(auth.getSnapshot()).toMatchObject({
      view: "complete-client-profile", profile: { id: "google-client", phone: null },
      initializationStatus: "authenticated",
    }));
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.session?.access_token).toBe(googleSession.access_token);
  });

  it("evento repetido da mesma sessão não invalida salvamento de telefone em andamento", async () => {
    await auth.start();
    mocks.profileRead.mockResolvedValue({ data: { ...profile, phone: null }, error: null });
    await auth.login("client@example.test", "senha-de-teste");
    const access = auth.getSnapshot();
    const save = deferred<string>();
    const completion = save.promise.then((phone) => auth.completePhone(phone, profile.id, access.accountGeneration!));
    emit("SIGNED_IN", mocks.session);
    expect(auth.getSnapshot().accountGeneration).toBe(access.accountGeneration);
    save.resolve("5511999999999");
    await completion;
    expect(auth.getSnapshot()).toMatchObject({ view: "client", profile: { phone: "5511999999999" } });
  });
});
