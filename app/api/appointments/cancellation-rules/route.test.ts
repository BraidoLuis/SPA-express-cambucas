import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getCancellationRules } from "../../../lib/services/cancellation-rules-service";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), user: vi.fn(), profile: vi.fn(), settings: vi.fn(), from: vi.fn(), select: vi.fn(), session: vi.fn(), fetch: vi.fn() }));
vi.mock("../../../../lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("../../../../lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: mocks.session } }) }));
const rules = { cancellationEnabled: true, cancellationNoticeHours: 7 };
const request = (token: string | null = "Bearer test-only") => new Request("https://example.test/api/appointments/cancellation-rules", { headers: token ? { Authorization: token } : {} });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
  mocks.user.mockResolvedValue({ data: { user: { id: "client-test" } }, error: null });
  mocks.profile.mockResolvedValue({ data: { role: "client", active: true }, error: null });
  mocks.settings.mockResolvedValue({ data: { ...rules, cancellationNoticeHours: "7", unrelatedPrivateField: "private" }, error: null });
  mocks.from.mockImplementation((table: string) => {
    const query = { select: mocks.select, eq: () => query, single: mocks.profile, maybeSingle: mocks.settings };
    if (!["profiles", "spa_settings"].includes(table)) throw Error("Tabela inesperada");
    mocks.select.mockReturnValue(query);
    return query;
  });
  mocks.admin.mockReturnValue({ auth: { getUser: mocks.user }, from: mocks.from });
  mocks.session.mockResolvedValue({ data: { session: { access_token: "test-only" } }, error: null });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("consulta restrita da configuração de cancelamento", () => {
  it.each([null, "Basic test"])("não acessa banco sem Bearer: %s", async (token) => {
    expect((await GET(request(token))).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("não acessa banco sem configuração de servidor", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect((await GET(request())).status).toBe(503);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("sessão inválida não consulta perfis/configuração", async () => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: { message: "private" } });
    expect((await GET(request())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([{ role: "client", active: false }, { role: "professional", active: true }, { role: "admin", active: true }, null])("somente cliente ativa lê as regras: %j", async (profile) => {
    mocks.profile.mockResolvedValue({ data: profile, error: null });
    expect((await GET(request())).status).toBe(403);
    expect(mocks.settings).not.toHaveBeenCalled();
  });
  it("retorna somente a configuração necessária, sem cache", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(rules);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it.each([{ data: null, error: null }, { data: null, error: { message: "private" } }, { data: {}, error: null }])("não inventa regras quando a leitura não confirma configuração: %j", async (result) => {
    mocks.settings.mockResolvedValue(result);
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private");
  });
  it("exceção de rede não expõe detalhe interno", async () => {
    mocks.settings.mockRejectedValue(new Error("private connection"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private connection");
  });
  it("o navegador utiliza o token e a mesma configuração do endpoint", async () => {
    mocks.fetch.mockImplementation(async (_url, init) => GET(request(new Headers(init.headers).get("authorization"))));
    await expect(getCancellationRules()).resolves.toEqual(rules);
    expect(mocks.fetch).toHaveBeenCalledWith("/api/appointments/cancellation-rules", expect.objectContaining({ cache: "no-store" }));
  });
  it("falha de rede no navegador é informativa e não expõe detalhes", async () => {
    mocks.fetch.mockRejectedValue(new TypeError("private connection"));
    await expect(getCancellationRules()).rejects.toThrow("consultar as regras");
    await expect(getCancellationRules()).rejects.not.toThrow("private");
  });
  it("navegador sem sessão não consulta o endpoint", async () => {
    mocks.session.mockResolvedValue({ data: { session: null }, error: null });
    await expect(getCancellationRules()).rejects.toThrow("sessão");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("consulta horas como texto JSONB, preservando o formato do banco", async () => {
    mocks.settings.mockResolvedValue({ data: { cancellationEnabled: true, cancellationNoticeHours: "2.0" }, error: null });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.select).toHaveBeenCalledWith("cancellationEnabled:booking_rules->cancellationEnabled,cancellationNoticeHours:booking_rules->>cancellationNoticeHours");
    expect(await response.json()).toEqual({ cancellationEnabled: true, cancellationNoticeHours: 0 });
  });
  it.each(["7", null, undefined, "2.5", "100000"])("false permanece válido sem exigir antecedência, horas=%j", async (hours) => {
    mocks.settings.mockResolvedValue({ data: { cancellationEnabled: false, cancellationNoticeHours: hours }, error: null });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cancellationEnabled: false, cancellationNoticeHours: hours === "7" ? 7 : 0 });
  });
  it.each([null, undefined, "2.0", "-1", "100000"])("true usa zero para horas sem formato válido, conforme o trigger: %j", async (hours) => {
    mocks.settings.mockResolvedValue({ data: { cancellationEnabled: true, cancellationNoticeHours: hours }, error: null });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cancellationEnabled: true, cancellationNoticeHours: 0 });
  });

});
