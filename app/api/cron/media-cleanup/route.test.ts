import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageApiError } from "@supabase/supabase-js";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  createAdmin: vi.fn(), from: vi.fn(), select: vi.fn(), expired: vi.fn(),
  like: vi.fn(), not: vi.fn(), order: vi.fn(), read: vi.fn(),
  bucket: vi.fn(), remove: vi.fn(), info: vi.fn(),
  delete: vi.fn(), deleteIds: vi.fn(), deletePath: vi.fn(),
  deleteExpired: vi.fn(), deleted: vi.fn(),
}));

vi.mock("../../../../lib/supabase/admin", () => ({ createAdminClient: mocks.createAdmin }));

const secret = "cron-secret-test-only";
const first = { id: "media-1", storage_path: "showcase/media-1/photo.png" };
const second = { id: "media-2", storage_path: "showcase/media-2/video.mp4" };

function request(authorization: string | undefined = `Bearer ${secret}`) {
  return new Request("https://spa.example.test/api/cron/media-cleanup", {
    headers: authorization === undefined ? {} : { Authorization: authorization },
  });
}

function missingFile() {
  return new StorageApiError("Object not found", 404, "404", "storage", "NoSuchKey");
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", secret);
  const query = {
    lt: mocks.expired, like: mocks.like, not: mocks.not, order: mocks.order, limit: mocks.read,
  };
  mocks.select.mockReturnValue(query);
  for (const method of [mocks.expired, mocks.like, mocks.not, mocks.order]) method.mockReturnValue(query);
  const deletion = {
    in: mocks.deleteIds, eq: mocks.deletePath, lt: mocks.deleteExpired, select: mocks.deleted,
  };
  mocks.delete.mockReturnValue(deletion);
  for (const method of [mocks.deleteIds, mocks.deletePath, mocks.deleteExpired]) method.mockReturnValue(deletion);
  mocks.from.mockReturnValue({ select: mocks.select, delete: mocks.delete });
  mocks.read.mockResolvedValue({ data: [first, second], error: null });
  mocks.bucket.mockReturnValue({ remove: mocks.remove, info: mocks.info });
  mocks.remove.mockImplementation(async (paths: string[]) => ({
    data: paths.map((name) => ({ name })), error: null,
  }));
  mocks.info.mockResolvedValue({ data: null, error: missingFile() });
  mocks.deleted.mockImplementation(async () => ({
    data: (mocks.deleteIds.mock.calls.at(-1)![1] as string[]).map((id) => ({ id })), error: null,
  }));
  mocks.createAdmin.mockReturnValue({ from: mocks.from, storage: { from: mocks.bucket } });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("autenticação do cron de limpeza", () => {
  it.each([undefined, "", "   ", "undefined"])("rejeita configuração ausente/inválida %s antes de acessar serviços", async (configured) => {
    vi.stubEnv("CRON_SECRET", configured);
    const response = await GET(request("Bearer undefined"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "CRON_SECRET não está configurado." });
    expect(mocks.createAdmin).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.bucket).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([undefined, "Bearer", "Bearer ", "Bearer incorrect", "Bearer undefined", `Basic ${secret}`])(
    "retorna 401 para Authorization inválido %s sem acessar serviços",
    async (authorization) => {
      const unauthorized = new Request("https://spa.example.test/api/cron/media-cleanup", {
        headers: authorization === undefined ? {} : { Authorization: authorization },
      });
      const response = await GET(unauthorized);
      expect(response.status).toBe(401);
      expect(mocks.createAdmin).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.bucket).not.toHaveBeenCalled();
      expect(mocks.remove).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
      expect(await response.text()).not.toContain(secret);
    },
  );
});

describe("limpeza de mídias com banco e Storage simulados", () => {
  it("aceita o Bearer correto, preserva expiração/elegibilidade e exclui só IDs confirmados", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true, filesRemoved: 2, filesAlreadyAbsent: 0, recordsDeleted: 2, recordsRetained: 0,
      mediaFound: 2, batchLimit: 100, batchFull: false, failures: [],
    });
    expect(mocks.from).toHaveBeenCalledWith("service_media");
    expect(mocks.expired).toHaveBeenCalledWith("expires_at", expect.any(String));
    expect(mocks.like).toHaveBeenCalledWith("storage_path", "showcase/%");
    expect(mocks.not).toHaveBeenCalledWith("storage_path", "like", "%..%");
    expect(mocks.read).toHaveBeenCalledWith(100);
    expect(mocks.bucket).toHaveBeenCalledWith("service-media");
    expect(mocks.remove.mock.calls).toEqual([[[first.storage_path]], [[second.storage_path]]]);
    expect(mocks.deleteIds.mock.calls).toEqual([["id", [first.id]], ["id", [second.id]]]);
    expect(mocks.deletePath.mock.calls).toEqual([
      ["storage_path", first.storage_path], ["storage_path", second.storage_path],
    ]);
    expect(mocks.deleteExpired).toHaveBeenCalledWith("expires_at", mocks.expired.mock.calls[0][1]);
    expect(mocks.deleted).toHaveBeenCalledWith("id");
    expect(mocks.info).not.toHaveBeenCalled();
  });

  it("lote vazio não acessa Storage nem tenta excluir registros", async () => {
    mocks.read.mockResolvedValue({ data: [], error: null });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, mediaFound: 0, filesRemoved: 0, recordsDeleted: 0 });
    expect(mocks.bucket).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it.each(["returned", "thrown", "invalid"] as const)("trata erro de consulta %s sem acessar Storage ou exclusão", async (kind) => {
    if (kind === "thrown") mocks.read.mockRejectedValue(new Error("Database offline"));
    else mocks.read.mockResolvedValue({ data: null, error: kind === "returned" ? new Error("Database offline") : null });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, filesRemoved: 0, recordsDeleted: 0, failures: [{ stage: "query" }] });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("erro de configuração do cliente admin é informado sem expor valores de ambiente", async () => {
    mocks.createAdmin.mockImplementation(() => { throw new Error(`Configuration error ${secret}`); });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(secret);
    expect(console.error).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it.each(["returned", "thrown"] as const)("falha total do Storage %s mantém todos os registros", async (kind) => {
    if (kind === "thrown") mocks.remove.mockRejectedValue(new Error("Storage offline"));
    else mocks.remove.mockResolvedValue({ data: null, error: new Error("Storage offline") });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      ok: false, filesRemoved: 0, recordsDeleted: 0, recordsRetained: 2,
      failures: [{ mediaIds: [first.id], stage: "storage" }, { mediaIds: [second.id], stage: "storage" }],
    });
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.info).not.toHaveBeenCalled();
  });

  it("falha parcial do Storage exclui apenas o registro do arquivo removido", async () => {
    mocks.remove.mockResolvedValueOnce({ data: null, error: new Error("Storage denied") });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      ok: false, filesRemoved: 1, recordsDeleted: 1, recordsRetained: 1,
      failures: [{ mediaIds: [first.id], stage: "storage" }],
    });
    expect(mocks.deleteIds.mock.calls).toEqual([["id", [second.id]]]);
  });

  it.each(["returned", "thrown"] as const)("falha de exclusão %s diferencia arquivos removidos e registros preservados", async (kind) => {
    if (kind === "thrown") mocks.deleted.mockRejectedValue(new Error("Delete failed"));
    else mocks.deleted.mockResolvedValue({ data: null, error: new Error("Delete failed") });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      ok: false, filesRemoved: 2, recordsDeleted: 0, recordsRetained: 2,
      failures: [{ mediaIds: [first.id], stage: "database" }, { mediaIds: [second.id], stage: "database" }],
    });
  });

  it("continua o lote após falha de uma exclusão e informa resultado parcial", async () => {
    mocks.deleted.mockResolvedValueOnce({ data: null, error: new Error("Delete failed") });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      ok: false, filesRemoved: 2, recordsDeleted: 1, recordsRetained: 1,
      failures: [{ mediaIds: [first.id], stage: "database" }],
    });
  });

  it("não anuncia exclusão se o banco não confirmar os IDs, inclusive após edição concorrente", async () => {
    mocks.deleted.mockResolvedValue({ data: [], error: null });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, filesRemoved: 2, recordsDeleted: 0, recordsRetained: 2 });
    expect(mocks.deletePath).toHaveBeenCalledWith("storage_path", first.storage_path);
  });

  it("retoma após arquivo removido e erro no banco, confirmando ausência específica na segunda execução", async () => {
    mocks.read.mockResolvedValue({ data: [first], error: null });
    mocks.deleted.mockResolvedValueOnce({ data: null, error: new Error("Delete failed") });
    const firstResponse = await GET(request());
    expect(firstResponse.status).toBe(500);
    expect(await firstResponse.json()).toMatchObject({
      filesRemoved: 1, filesAlreadyAbsent: 0, recordsDeleted: 0, recordsRetained: 1,
    });

    mocks.remove.mockResolvedValueOnce({ data: [], error: null });
    const retryResponse = await GET(request());
    expect(retryResponse.status).toBe(200);
    expect(await retryResponse.json()).toMatchObject({
      ok: true, filesRemoved: 0, filesAlreadyAbsent: 1, recordsDeleted: 1, recordsRetained: 0, failures: [],
    });
    expect(mocks.info).toHaveBeenCalledWith(first.storage_path);
    expect(mocks.deleteIds.mock.calls).toEqual([["id", [first.id]], ["id", [first.id]]]);
  });

  it.each([
    new StorageApiError("Bucket not found", 404, "404", "storage", "NoSuchBucket"),
    new StorageApiError("Access denied", 403, "403", "storage", "AccessDenied"),
    new StorageApiError("Invalid request", 400, "400", "storage", "InvalidRequest"),
    new StorageApiError("Legacy not found", 404, "404"),
    new Error("Object not found"),
  ])("não confunde erro genérico/bucket/permissão com arquivo ausente (%s)", async (error) => {
    mocks.read.mockResolvedValue({ data: [first], error: null });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    mocks.info.mockResolvedValue({ data: null, error });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, filesAlreadyAbsent: 0, recordsDeleted: 0, recordsRetained: 1 });
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it.each(["exists", "network", "invalid"] as const)("não confirma ausência quando info retorna %s", async (kind) => {
    mocks.read.mockResolvedValue({ data: [first], error: null });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    if (kind === "network") mocks.info.mockRejectedValue(new Error("Network offline"));
    else mocks.info.mockResolvedValue({ data: kind === "exists" ? { name: first.storage_path } : null, error: null });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("não considera remoção confirmada uma resposta sem dados", async () => {
    mocks.remove.mockResolvedValue({ data: null, error: null });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("preserva caminhos fora da vitrine e caminhos com .., sem tentar removê-los", async () => {
    mocks.read.mockResolvedValue({ data: [
      { id: "cover", storage_path: "covers/service/photo.png" },
      { id: "unsafe", storage_path: "showcase/../photo.png" },
      { id: "missing-path", storage_path: null },
      first,
    ], error: null });
    const response = await GET(request());
    expect(await response.json()).toMatchObject({ filesRemoved: 1, recordsDeleted: 1, skipped: 3 });
    expect(mocks.remove.mock.calls).toEqual([[[first.storage_path]]]);
    expect(mocks.deleteIds.mock.calls).toEqual([["id", [first.id]]]);
  });

  it("conta um arquivo e dois registros quando compartilham o caminho", async () => {
    mocks.read.mockResolvedValue({ data: [first, { ...second, storage_path: first.storage_path }], error: null });
    const response = await GET(request());
    expect(await response.json()).toMatchObject({ ok: true, filesRemoved: 1, recordsDeleted: 2 });
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(mocks.deleteIds).toHaveBeenCalledWith("id", [first.id, second.id]);
  });

  it("informa exclusão parcial de IDs de um caminho compartilhado", async () => {
    mocks.read.mockResolvedValue({ data: [first, { ...second, storage_path: first.storage_path }], error: null });
    mocks.deleted.mockResolvedValue({ data: [{ id: first.id }], error: null });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      filesRemoved: 1, recordsDeleted: 1, recordsRetained: 1,
      failures: [{ mediaIds: [second.id], stage: "database" }],
    });
  });

  it("limita a consulta e o processamento a 100 mídias por execução", async () => {
    const rows = Array.from({ length: 105 }, (_, i) => ({ id: `media-${i}`, storage_path: `showcase/media-${i}/photo.png` }));
    mocks.read.mockResolvedValue({ data: rows, error: null });
    const response = await GET(request());
    expect(await response.json()).toMatchObject({
      ok: true, mediaFound: 100, filesRemoved: 100, recordsDeleted: 100, batchFull: true,
    });
    expect(mocks.read).toHaveBeenCalledWith(100);
    expect(mocks.remove).toHaveBeenCalledTimes(100);
    expect(mocks.deleteIds.mock.calls.flatMap((call) => call[1])).not.toContain("media-100");
  });

  it("processa sequencialmente, sem iniciar outra remoção enquanto a primeira está pendente", async () => {
    let release!: (value: { data: { name: string }[]; error: null }) => void;
    const pending = new Promise<{ data: { name: string }[]; error: null }>((resolve) => { release = resolve; });
    mocks.remove.mockReturnValueOnce(pending);
    const cleanup = GET(request());
    try {
      await vi.waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(1));
      expect(mocks.delete).not.toHaveBeenCalled();
    } finally {
      release({ data: [{ name: first.storage_path }], error: null });
    }
    expect((await cleanup).status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledTimes(2);
  });
});
