import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  exchange: vi.fn(), signOut: vi.fn(), lookup: vi.fn(), insert: vi.fn(), createAdmin: vi.fn(),
}));

vi.mock("../../../lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { exchangeCodeForSession: mocks.exchange, signOut: mocks.signOut },
  }),
}));
vi.mock("../../../lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdmin,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exchange.mockResolvedValue({
    data: { user: { id: "google-client", email: "client@example.test", user_metadata: {} }, session: { access_token: "test-only" } },
    error: null,
  });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.lookup.mockResolvedValue({ data: { id: "google-client", role: "client", active: true }, error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.createAdmin.mockImplementation(() => ({
    from: () => {
      const query = {
        select: () => query, eq: () => query,
        maybeSingle: mocks.lookup, single: mocks.lookup, insert: mocks.insert,
      };
      return query;
    },
  }));
});

function redirectedError(response: Response) {
  return new URL(response.headers.get("location")!).searchParams.get("oauth_error");
}

describe("callback Google OAuth (somente mocks)", () => {
  it("preserva access=client no retorno bem-sucedido", async () => {
    const response = await GET(new Request("https://spa.example.test/auth/callback?code=fake-code"));
    expect(response.headers.get("location")).toBe("https://spa.example.test/?access=client");
    expect(mocks.exchange).toHaveBeenCalledWith("fake-code");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("preserva a mensagem de cancelamento sem chamar serviços", async () => {
    const response = await GET(new Request("https://spa.example.test/auth/callback?error=access_denied"));
    expect(redirectedError(response)).toBe("cancelled");
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it("não encerra sessão preexistente quando a troca de código não criou sessão", async () => {
    mocks.exchange.mockResolvedValue({ data: { user: null, session: null }, error: new Error("Código inválido") });
    const response = await GET(new Request("https://spa.example.test/auth/callback?code=fake-code"));
    expect(redirectedError(response)).toBe("exchange");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it.each([
    ["team_account", { id: "google-client", role: "admin", active: true }],
    ["inactive", { id: "google-client", role: "client", active: false }],
  ])("rejeita %s após a troca bem-sucedida", async (code, profile) => {
    mocks.lookup.mockResolvedValue({ data: profile, error: null });
    const response = await GET(new Request("https://spa.example.test/auth/callback?code=fake-code"));
    expect(redirectedError(response)).toBe(code);
    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("encerra sessão nova se a leitura do perfil OAuth falhar", async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: new Error("Falha de perfil") });
    const response = await GET(new Request("https://spa.example.test/auth/callback?code=fake-code"));
    expect(redirectedError(response)).toBe("profile");
    expect(mocks.signOut).toHaveBeenCalled();
  });
});
