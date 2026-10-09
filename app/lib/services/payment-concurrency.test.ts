import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeProfessionalAppointment, updateProfessionalAppointmentStatus } from "./professional-agenda-service";
import { confirmAdminPayment } from "./admin-dashboard-service";
import { PaymentRequests, runPaymentAction } from "../payment-requests";

// Mocks verificam consumo do contrato e feedback; NÃO provam locks/atomicidade PostgreSQL.
type Query = { table: string; values: Record<string, unknown> | null; filters: Map<string, unknown> };
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), existing: vi.fn(), saved: vi.fn(), update: vi.fn(), user: vi.fn(),
  queries: [] as Query[],
}));
vi.mock("../../../lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mocks.rpc, auth: { getUser: mocks.user, getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
    from: (table: string) => {
      const state: Query = { table, values: null, filters: new Map() };
      mocks.queries.push(state);
      const query = {
        update: (values: Record<string, unknown>) => { state.values = values; return query; },
        select: () => query,
        eq: (key: string, value: unknown) => { state.filters.set(key, value); return query; },
        maybeSingle: () => state.values ? mocks.update(state) : table === "payments" ? mocks.existing(state) : mocks.saved(state),
      };
      return query;
    },
  }),
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const input = { appointmentId: "appointment-test", paymentReceived: true, paymentMethod: "dinheiro" as const };
const paid = { id: "payment-test", appointment_id: "appointment-test", status: "paid", amount: 120,
  method: "pix", notes: "Admin manteve", confirmed_by: "admin-test", paid_at: "2026-10-08T09:00:00Z" };
const outcome = { appointment_id: "appointment-test", appointment_status: "completed", payment_status: "paid",
  payment_updated: false, payment_id: "payment-test" };
function handlers() {
  return { onStart: vi.fn(), onConfirmed: vi.fn(), reload: vi.fn().mockResolvedValue(undefined),
    onError: vi.fn(), onRefreshFailure: vi.fn(), onFinish: vi.fn() };
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.queries.length = 0;
  mocks.existing.mockResolvedValue({ data: { ...paid, status: "pending" }, error: null });
  mocks.saved.mockResolvedValue({ data: { id: input.appointmentId, status: "completed", payments: { ...paid } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { ...outcome }, error: null });
  mocks.user.mockResolvedValue({ data: { user: { id: "admin-test" } }, error: null });
  mocks.update.mockResolvedValue({ data: { ...paid }, error: null });
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("Serviços reais proibidos"); }));
});
afterEach(() => vi.unstubAllGlobals());

describe("contrato de conclusão protegido e concorrência (mocks)", () => {
  it("admin confirmou antes da consulta: preserva a compatibilidade e não escreve pagamentos no navegador", async () => {
    mocks.existing.mockResolvedValue({ data: { ...paid }, error: null });
    await expect(completeProfessionalAppointment(input)).resolves.toMatchObject({ paymentStatus: "paid" });
    expect(mocks.rpc.mock.calls[0][1].p_payment_received).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(paid).toMatchObject({ amount: 120, method: "pix", notes: "Admin manteve", confirmed_by: "admin-test" });
  });
  it("admin confirma durante o RPC: aceita payment_updated=false com método/responsável da admin", async () => {
    const gate = deferred<{ data: typeof outcome; error: null }>(), entered = deferred<void>();
    mocks.rpc.mockImplementation(() => { entered.resolve(); return gate.promise; });
    const finishing = completeProfessionalAppointment(input);
    await entered.promise;
    await expect(confirmAdminPayment({ appointmentId: input.appointmentId, method: "pix", notes: paid.notes }))
      .resolves.toMatchObject({ status: "paid" });
    gate.resolve({ data: { ...outcome }, error: null });
    await expect(finishing).resolves.toMatchObject({ appointmentStatus: "completed", paymentStatus: "paid" });
    expect(mocks.rpc.mock.calls[0][1].p_payment_received).toBe(true); // snapshot prévio pending
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.queries.find((q) => q.values)?.filters.get("status")).toBe("pending");
    expect(mocks.rpc).toHaveBeenCalledOnce(); // nenhuma repetição para ajustar o método
  });
  it("pending confirmado pelo RPC exige o método salvo correto", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...outcome, payment_updated: true }, error: null });
    mocks.saved.mockResolvedValue({ data: { id: input.appointmentId, status: "completed", payments: { ...paid, method: "dinheiro", confirmed_by: "professional-test" } }, error: null });
    await expect(completeProfessionalAppointment(input)).resolves.toMatchObject({ paymentStatus: "paid" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("payment_updated=true não aceita método diferente do pedido", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...outcome, payment_updated: true }, error: null });
    await expect(completeProfessionalAppointment(input)).rejects.toThrow("pode ter sido salva");
  });
  it.each([
    { ...outcome, payment_updated: "false" }, { ...outcome, payment_updated: null },
    { ...outcome, payment_updated: false, payment_id: undefined },
    { ...outcome, payment_updated: false, payment_id: "" },
    { ...outcome, payment_updated: false, payment_id: "other" },
    { ...outcome, payment_updated: false, payment_id: null },
    { appointment_id: input.appointmentId, appointment_status: "completed", payment_status: "paid", payment_updated: false },
  ])("resultado aditivo parcial/incompatível nunca anuncia confirmação: %j", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(completeProfessionalAppointment(input)).rejects.toThrow("pode ter sido salva");
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
  it.each(["pending", "paid", "cancelled", "refunded"] as const)("sem recebimento preserva o pagamento %s", async (status) => {
    mocks.rpc.mockResolvedValue({ data: { ...outcome, payment_status: status }, error: null });
    mocks.saved.mockResolvedValue({ data: { id: input.appointmentId, status: "completed", payments: { ...paid, status } }, error: null });
    await expect(completeProfessionalAppointment({ ...input, paymentReceived: false })).resolves.toMatchObject({ paymentStatus: status });
    expect(mocks.existing).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls[0][1].p_payment_received).toBe(false);
  });
  it("sem recebimento e pagamento ausente mantém o fallback legado", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...outcome, payment_status: "pending", payment_id: null }, error: null });
    mocks.saved.mockResolvedValue({ data: { id: input.appointmentId, status: "completed", payments: null }, error: null });
    await expect(completeProfessionalAppointment({ ...input, paymentReceived: false })).resolves.toMatchObject({ paymentStatus: "pending" });
  });
  it("não aceita contrato que declara recebimento numa conclusão sem recebimento", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...outcome, payment_updated: true }, error: null });
    await expect(completeProfessionalAppointment({ ...input, paymentReceived: false })).rejects.toThrow("pode ter sido salva");
    expect(mocks.saved).not.toHaveBeenCalled();
  });
  it.each(["inativo", "cliente", "sem vínculo", "outra profissional"])("nega %s sem publicar conclusão ou detalhes internos", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "private policy/identity" } });
    const requests = new PaymentRequests(); requests.activate(); const callbacks = handlers();
    expect(await runPaymentAction(requests, () => completeProfessionalAppointment(input), callbacks)).toBe("failed");
    expect(callbacks.onError.mock.calls[0][0].message).toContain("sessão");
    expect(callbacks.onError.mock.calls[0][0].message).not.toContain("private");
    expect(callbacks.onConfirmed).not.toHaveBeenCalled(); expect(callbacks.reload).not.toHaveBeenCalled();
  });
  it.each([
    ["P0001", "Um atendimento futuro não pode ser concluído.", "ainda não"],
    ["P0001", "Somente atendimentos confirmados podem ser concluídos.", "não está mais confirmado"],
    ["P0001", "O pagamento não está elegível para confirmação.", "não está pendente"],
    ["P0001", "Pagamento do atendimento não encontrado.", "não foi encontrado"],
    ["40001", "zero rows/private internal", "confirmar o resultado"],
    ["XX000", "private audit/trigger error", "confirmar o resultado"],
  ])("falha de estado/reserva/registro tem mensagem pública: %s %s", async (code, message, expected) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message } });
    await expect(completeProfessionalAppointment(input)).rejects.toThrow(expected);
    expect(mocks.saved).not.toHaveBeenCalled(); expect(mocks.rpc).toHaveBeenCalledOnce();
  });
  it("duas conclusões: publica somente a resposta confirmada; a perdedora não repete o RPC", async () => {
    const first = deferred<{ data: typeof outcome; error: null }>();
    const second = deferred<{ data: null; error: { code: string; message: string } }>();
    const entered = deferred<void>(); let count = 0;
    mocks.rpc.mockImplementation(() => { if (++count === 2) entered.resolve(); return count === 1 ? first.promise : second.promise; });
    const a = new PaymentRequests(), b = new PaymentRequests(); a.activate(); b.activate();
    const ca = handlers(), cb = handlers();
    const operations = [runPaymentAction(a, () => completeProfessionalAppointment(input), ca),
      runPaymentAction(b, () => completeProfessionalAppointment(input), cb)];
    await entered.promise;
    first.resolve({ data: { ...outcome }, error: null });
    second.resolve({ data: null, error: { code: "P0001", message: "Somente atendimentos confirmados podem ser concluídos." } });
    expect(await Promise.all(operations)).toEqual(["confirmed", "failed"]);
    expect(ca.onConfirmed).toHaveBeenCalledOnce(); expect(cb.onConfirmed).not.toHaveBeenCalled();
    expect(cb.reload).not.toHaveBeenCalled(); expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
  it("cancelamento vence durante a conclusão: não publica conclusão nem inicia recarga de sucesso", async () => {
    const gate = deferred<{ data: null; error: { code: string; message: string } }>(), entered = deferred<void>();
    mocks.rpc.mockImplementation((name: string) => name === "complete_professional_appointment"
      ? (entered.resolve(), gate.promise) : Promise.resolve({ data: { id: input.appointmentId, status: "cancelled" }, error: null }));
    const requests = new PaymentRequests(); requests.activate(); const callbacks = handlers();
    const finishing = runPaymentAction(requests, () => completeProfessionalAppointment(input), callbacks);
    await entered.promise;
    mocks.saved.mockResolvedValue({ data: { id: input.appointmentId, status: "cancelled" }, error: null });
    await updateProfessionalAppointmentStatus(input.appointmentId, "cancelled", "Motivo teste");
    gate.resolve({ data: null, error: { code: "P0001", message: "Somente atendimentos confirmados podem ser concluídos." } });
    expect(await finishing).toBe("failed"); expect(callbacks.onConfirmed).not.toHaveBeenCalled();
    expect(callbacks.reload).not.toHaveBeenCalled(); expect(callbacks.onRefreshFailure).not.toHaveBeenCalled();
  });
  it("conclusão confirmada com pagamento preservado continua confirmada quando a recarga falha", async () => {
    const requests = new PaymentRequests(); requests.activate(); const callbacks = handlers();
    callbacks.reload.mockRejectedValue(Error("private refresh"));
    expect(await runPaymentAction(requests, () => completeProfessionalAppointment(input), callbacks)).toBe("confirmed-refresh-failed");
    expect(callbacks.onConfirmed).toHaveBeenCalledOnce(); expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onRefreshFailure).toHaveBeenCalledOnce(); expect(mocks.rpc).toHaveBeenCalledOnce();
  });
});
