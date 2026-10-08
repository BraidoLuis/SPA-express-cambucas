import { describe, expect, it, vi } from "vitest";
import { BookingRequests } from "./booking-requests";
import { createClientAppointment, cancelClientAppointment } from "./services/appointment-service";
import { createAdminAppointment } from "./services/admin-appointment-service";
import { createProfessionalExtraAppointment } from "./services/professional-extra-appointment-service";
import { afterEach, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), session: vi.fn(), row: vi.fn(), fetch: vi.fn(), update: vi.fn() }));
vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mocks.rpc, auth: { getSession: mocks.session },
    from: () => { const q = { update: mocks.update, eq: () => q, in: () => q, select: () => q, maybeSingle: mocks.row }; mocks.update.mockReturnValue(q); return q; },
  }),
}));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ data: { session: null }, error: null });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());
const input = { professionalId: "p", serviceId: "s", slotStart: "2099-01-01T13:00:00Z" };
const extra = { serviceId: "s", clientName: "Teste", date: "2099-01-01", time: "13:00", duration: 60 };

describe("operações pendentes usadas pelos painéis", () => {
  it.each(["client", "admin", "professional", "cancel"] as const)("bloqueia cliques simultâneos antes da renderização: %s", async (flow) => {
    const requests = new BookingRequests(); requests.start();
    const pending = deferred<{ data: string; error: null }>();
    mocks.rpc.mockReturnValue(pending.promise);
    const row = deferred<{ data: { id: string; status: string }; error: null }>();
    mocks.row.mockReturnValue(row.promise);
    const response = deferred<Response>();
    mocks.session.mockResolvedValue({ data: { session: { access_token: "test-only" } }, error: null });
    mocks.fetch.mockReturnValue(response.promise);
    const operation = () => flow === "client" ? createClientAppointment(input) : flow === "professional" ? createProfessionalExtraAppointment(extra) : flow === "cancel" ? cancelClientAppointment("id") : createAdminAppointment({ ...input, clientId: "c" });
    const publish = vi.fn();
    async function click() {
      const ticket = requests.begin("mutation", true);
      if (!ticket) return;
      try { const result = await operation(); if (requests.current(ticket)) publish(result); } finally { requests.finish(ticket); }
    }
    const first = click(), second = click();
    await Promise.resolve();
    if (flow === "admin") expect(mocks.fetch).toHaveBeenCalledTimes(1);
    else if (flow === "cancel") expect(mocks.update).toHaveBeenCalledTimes(1);
    else expect(mocks.rpc).toHaveBeenCalledTimes(1);
    // As notificações também usam fetch, sem trabalho real.
    response.resolve(new Response(JSON.stringify({ id: "id" }), { status: 201 }));
    row.resolve({ data: { id: "id", status: "cancelled" }, error: null });
    pending.resolve({ data: "id", error: null });
    await Promise.all([first, second]);
    expect(publish).toHaveBeenCalledTimes(1);
  });
  it.each(["desmontagem", "outra conta", "mesma conta em novo acesso"])("descarta criação antiga após %s e não libera o bloqueio novo", async () => {
    const requests = new BookingRequests(); requests.start();
    const oldResponse = deferred<{ data: string; error: null }>();
    const newResponse = deferred<{ data: string; error: null }>();
    mocks.rpc.mockReturnValueOnce(oldResponse.promise).mockReturnValueOnce(newResponse.promise);
    const publish = vi.fn();
    async function submit() {
      const ticket = requests.begin("create", true);
      if (!ticket) return;
      try { const id = await createClientAppointment(input); if (requests.current(ticket)) publish(id); } finally { requests.finish(ticket); }
    }
    const old = submit();
    requests.stop();
    requests.start();
    const current = submit();
    oldResponse.resolve({ data: "old", error: null });
    await old;
    expect(publish).not.toHaveBeenCalled();
    expect(requests.begin("create", true)).toBeNull();
    newResponse.resolve({ data: "new", error: null });
    await current;
    expect(publish).toHaveBeenCalledExactlyOnceWith("new");
  });
  it("descarta resposta após desmontagem sem reabertura", async () => {
    const requests = new BookingRequests(); requests.start();
    const pending = deferred<string>();
    const ticket = requests.begin("agenda")!;
    const publish = vi.fn();
    const load = pending.promise.then((data) => { if (requests.current(ticket)) publish(data); });
    requests.stop();
    pending.resolve("old account");
    await load;
    expect(publish).not.toHaveBeenCalled();
    expect(requests.begin("agenda")).toBeNull();
  });
  it("uma consulta antiga não substitui a agenda mais recente", async () => {
    const requests = new BookingRequests(); requests.start();
    const old = deferred<string>(), current = deferred<string>();
    const publish = vi.fn();
    const oldTicket = requests.begin("agenda")!;
    const oldLoad = old.promise.then((data) => { if (requests.current(oldTicket)) publish(data); });
    const newTicket = requests.begin("agenda")!;
    const newLoad = current.promise.then((data) => { if (requests.current(newTicket)) publish(data); });
    current.resolve("current"); await newLoad;
    old.resolve("old"); await oldLoad;
    expect(publish).toHaveBeenCalledExactlyOnceWith("current");
  });
  it("expõe bloqueio síncrono para impedir alteração dos dados antes da renderização", () => {
    const requests = new BookingRequests();
    requests.start();
    const ticket = requests.begin("create", true)!;
    expect(requests.busy("create")).toBe(true);
    requests.finish(ticket);
    expect(requests.busy("create")).toBe(false);
    requests.stop();
    expect(requests.busy("create")).toBe(false);
  });

});
