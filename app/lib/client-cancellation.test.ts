import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyConfirmedClientCancellation, cancelAndRefreshClientAppointment } from "./client-cancellation";
import { BookingRequests } from "./booking-requests";
import type { ClientAppointment } from "./services/appointment-service";

const mocks = vi.hoisted(() => ({ row: vi.fn(), update: vi.fn(), in: vi.fn(), fetch: vi.fn() }));
vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    from: (table: string) => {
      if (table !== "appointments") throw Error("Tabela inesperada no teste");
      const query = { update: mocks.update, eq: () => query, in: mocks.in, select: () => query, maybeSingle: mocks.row };
      mocks.update.mockReturnValue(query);
      mocks.in.mockReturnValue(query);
      return query;
    },
  }),
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function appointment(id: string, status: ClientAppointment["status"] = "confirmed"): ClientAppointment {
  return {
    id, status, start: "2099-01-01T13:00:00Z", end: "2099-01-01T14:00:00Z",
    notes: null, serviceName: "Serviço teste", category: "Teste", duration: 60,
    professionalName: "Profissional teste", professionalId: "professional-test", price: 60,
    paymentStatus: "pending",
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.row.mockResolvedValue({ data: { id: "appointment-test", status: "cancelled" }, error: null });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("cancelamento confirmado e estado local", () => {
  it("marca somente o ID confirmado, preservando os demais dados e agendamentos", () => {
    const local = [appointment("appointment-test"), appointment("other")];
    const next = applyConfirmedClientCancellation(local, "appointment-test");
    expect(next[0]).toEqual({ ...local[0], status: "cancelled" });
    expect(next[1]).toBe(local[1]);
    expect(local[0].status).toBe("confirmed");
  });
  it.each(["cancelled", "completed", "no_show"] as const)("não sobrescreve estado local já alterado: %s", (status) => {
    const current = appointment("appointment-test", status);
    expect(applyConfirmedClientCancellation([current], current.id)[0]).toBe(current);
  });
  it("confirma localmente antes da recarga e mantém o cancelamento quando a recarga falha", async () => {
    const database = deferred<{ data: { id: string; status: string }; error: null }>();
    const refresh = deferred<void>();
    const refreshStarted = deferred<void>();
    mocks.row.mockReturnValue(database.promise);
    let local = [appointment("appointment-test")];
    const onConfirmed = vi.fn(() => { local = applyConfirmedClientCancellation(local, "appointment-test"); });
    const reload = vi.fn(() => { refreshStarted.resolve(); return refresh.promise; });
    const operation = cancelAndRefreshClientAppointment("appointment-test", { isCurrent: () => true, onConfirmed, reload });
    expect(local[0].status).toBe("confirmed");
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    database.resolve({ data: { id: "appointment-test", status: "cancelled" }, error: null });
    await refreshStarted.promise;
    expect(local[0].status).toBe("cancelled");
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    const rejection = expect(operation).rejects.toThrow("recarga de teste");
    refresh.reject(new Error("recarga de teste"));
    await rejection;
    expect(local[0].status).toBe("cancelled");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.in).toHaveBeenCalledWith("status", ["pending", "confirmed"]);
  });
  it("zero registros não publica cancelamento local, fecha diálogo ou recarrega como sucesso", async () => {
    mocks.row.mockResolvedValue({ data: null, error: null });
    const onConfirmed = vi.fn(), reload = vi.fn();
    await expect(cancelAndRefreshClientAppointment("appointment-test", { isCurrent: () => true, onConfirmed, reload })).rejects.toThrow("pode ter sido cancelado ou alterado");
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("falha da mutação mantém o estado local sem anunciar cancelamento", async () => {
    mocks.row.mockResolvedValue({ data: null, error: { code: "42501", message: "private" } });
    const onConfirmed = vi.fn(), reload = vi.fn();
    await expect(cancelAndRefreshClientAppointment("appointment-test", { isCurrent: () => true, onConfirmed, reload })).rejects.toThrow("sessão");
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
  it("resposta antiga não cancela o estado do novo acesso nem recarrega sua tela", async () => {
    const database = deferred<{ data: { id: string; status: string }; error: null }>();
    mocks.row.mockReturnValue(database.promise);
    const requests = new BookingRequests();
    requests.start();
    const old = requests.begin("cancellation", true)!;
    const onConfirmed = vi.fn(), reload = vi.fn();
    const operation = cancelAndRefreshClientAppointment("appointment-test", { isCurrent: () => requests.current(old), onConfirmed, reload });
    requests.stop();
    requests.start();
    const current = requests.begin("cancellation", true)!;
    database.resolve({ data: { id: "appointment-test", status: "cancelled" }, error: null });
    await operation;
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(requests.current(current)).toBe(true);
  });
  it("mantém cancelamento local quando a recarga captura seu erro como no painel", async () => {
    const refresh = deferred<ClientAppointment[]>();
    const refreshStarted = deferred<void>();
    let local = [appointment("appointment-test")];
    let loadingError = "";
    const operation = cancelAndRefreshClientAppointment("appointment-test", {
      isCurrent: () => true,
      onConfirmed: () => { local = applyConfirmedClientCancellation(local, "appointment-test"); },
      reload: async () => {
        refreshStarted.resolve();
        try { local = await refresh.promise; } catch { loadingError = "Não foi possível carregar seus agendamentos."; }
      },
    });
    await refreshStarted.promise;
    expect(local[0].status).toBe("cancelled");
    refresh.reject(new Error("falha de conexão de teste"));
    await expect(operation).resolves.toBeUndefined();
    expect(loadingError).toContain("carregar seus agendamentos");
    expect(local[0].status).toBe("cancelled");
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

});
