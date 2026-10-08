import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmAdminPayment } from "./admin-dashboard-service";
import { completeProfessionalAppointment } from "./professional-agenda-service";
import { PaymentRequests, runPaymentAction } from "../payment-requests";

type Query = { table: string; values: Record<string, unknown> | null; filters: Map<string, unknown>; columns: string };
const mocks = vi.hoisted(() => ({
  user: vi.fn(), update: vi.fn(), existing: vi.fn(), saved: vi.fn(), rpc: vi.fn(),
  queries: [] as Query[],
}));
vi.mock("../../../lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.user },
    rpc: mocks.rpc,
    from: (table: string) => {
      const state: Query = { table, values: null, filters: new Map(), columns: "" };
      mocks.queries.push(state);
      const query = {
        update: (values: Record<string, unknown>) => { state.values = values; return query; },
        eq: (key: string, value: unknown) => { state.filters.set(key, value); return query; },
        select: (columns: string) => { state.columns = columns; return query; },
        maybeSingle: () => state.values ? mocks.update(state)
          : table === "payments" ? mocks.existing(state) : mocks.saved(state),
      };
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
const input = { appointmentId: "appointment-test", method: "pix" as const, notes: " teste " };
const paid = {
  id: "payment-test", appointment_id: "appointment-test", status: "paid",
  method: "pix", notes: "teste", confirmed_by: "actor-test", paid_at: "2026-10-08T12:00:00.000Z",
};
const completion = { appointmentId: "appointment-test", paymentReceived: true, paymentMethod: "pix" as const };
const json = { appointment_id: "appointment-test", appointment_status: "completed", payment_status: "paid" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.queries.length = 0;
  mocks.user.mockResolvedValue({ data: { user: { id: "actor-test" } }, error: null });
  mocks.update.mockResolvedValue({ data: { ...paid }, error: null });
  mocks.existing.mockResolvedValue({ data: { id: "payment-test", appointment_id: "appointment-test", status: "pending" }, error: null });
  mocks.rpc.mockResolvedValue({ data: { ...json }, error: null });
  mocks.saved.mockResolvedValue({ data: { id: "appointment-test", status: "completed", payments: { ...paid } }, error: null });
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("Serviço real proibido nos testes"); }));
});
afterEach(() => vi.unstubAllGlobals());

describe("confirmação administrativa de pagamento", () => {
  it("exige confirmação do ID, vínculo, estado e metadados salvos", async () => {
    await expect(confirmAdminPayment(input)).resolves.toEqual({ appointmentId: input.appointmentId, paymentId: paid.id, status: "paid" });
    const query = mocks.queries[0];
    expect(query.filters.get("appointment_id")).toBe(input.appointmentId);
    expect(query.filters.get("status")).toBe("pending");
    expect(query.columns).toBe("id,appointment_id,status,method,notes,confirmed_by,paid_at");
    expect(query.values).toMatchObject({ status: "paid", method: "pix", notes: "teste", confirmed_by: "actor-test" });
  });
  it.each([
    null, {}, { id: "payment-test" }, { ...paid, id: "" }, { ...paid, appointment_id: "other" },
    { ...paid, status: "pending" }, { ...paid, method: "dinheiro" },
    { ...paid, notes: "other" }, { ...paid, confirmed_by: "other" },
    { ...paid, paid_at: null }, { ...paid, paid_at: "invalid" },
  ])("zero linhas ou confirmação incompleta nunca anuncia sucesso: %j", async (data) => {
    mocks.update.mockResolvedValue({ data, error: null });
    await expect(confirmAdminPayment(input)).rejects.toThrow("não teve confirmação completa");
  });
  it.each([
    { code: "42501", message: "private RLS policy" },
    { code: "XX000", message: "internal payments trigger, private SQL" },
  ])("erro do banco não expõe detalhes: %j", async (error) => {
    mocks.update.mockResolvedValue({ data: null, error });
    await expect(confirmAdminPayment(input)).rejects.not.toThrow("private");
  });
  it("erro de conexão pode ser confirmação incerta sem detalhes internos", async () => {
    mocks.update.mockRejectedValue(Error("private connection host"));
    await expect(confirmAdminPayment(input)).rejects.toThrow("confirmar o resultado");
  });
  it.each([
    { data: { user: null }, error: null },
    { data: { user: null }, error: { code: "PGRST301", message: "private auth" } },
  ])("não atualiza sem sessão verificada: %j", async (response) => {
    mocks.user.mockResolvedValue(response);
    await expect(confirmAdminPayment(input)).rejects.toThrow();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("duas confirmações concorrentes preservam método, responsável e data da primeira", async () => {
    const gate = deferred<void>();
    const entered = deferred<void>();
    let row: Record<string, unknown> = { ...paid, status: "pending" };
    let count = 0;
    mocks.user.mockResolvedValueOnce({ data: { user: { id: "first-admin" } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: "second-admin" } }, error: null });
    mocks.update.mockImplementation(async (query: Query) => {
      if (++count === 2) entered.resolve();
      await gate.promise;
      if (query.filters.get("status") !== row.status) return { data: null, error: null };
      row = { ...row, ...query.values };
      return { data: { ...row }, error: null };
    });
    const first = confirmAdminPayment(input);
    const second = confirmAdminPayment({ ...input, method: "dinheiro" });
    const outcomes = Promise.allSettled([first, second]);
    await entered.promise;
    gate.resolve();
    const result = await outcomes;
    expect(result[0].status).toBe("fulfilled");
    expect(result[1].status).toBe("rejected");
    expect(row).toMatchObject({ method: "pix", confirmed_by: "first-admin", status: "paid" });
    expect(row.paid_at).toBe(mocks.queries[0].values?.paid_at);
    const repeated = confirmAdminPayment({ ...input, method: "cartao" });
    await expect(repeated).rejects.toThrow("não teve confirmação completa");
    expect(row).toMatchObject({ method: "pix", confirmed_by: "first-admin" });
  });
  it("zero linhas não publica sucesso local nem recarrega como confirmação", async () => {
    mocks.update.mockResolvedValue({ data: null, error: null });
    const requests = new PaymentRequests(); requests.activate();
    const callbacks = { onStart: vi.fn(), onConfirmed: vi.fn(), reload: vi.fn(),
      onError: vi.fn(), onRefreshFailure: vi.fn(), onFinish: vi.fn() };
    expect(await runPaymentAction(requests, () => confirmAdminPayment(input), callbacks)).toBe("failed");
    expect(callbacks.onConfirmed).not.toHaveBeenCalled();
    expect(callbacks.reload).not.toHaveBeenCalled();
    expect(callbacks.onError).toHaveBeenCalledOnce();
  });
});

describe("contrato de conclusão profissional fornecido da produção", () => {
  it("confere JSON e estado salvo, sem usar apenas ausência de erro", async () => {
    await expect(completeProfessionalAppointment(completion)).resolves.toEqual({
      appointmentId: "appointment-test", appointmentStatus: "completed", paymentStatus: "paid",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("complete_professional_appointment", {
      p_appointment_id: "appointment-test", p_payment_received: true, p_payment_method: "pix", p_payment_notes: null,
    });
    expect(mocks.queries.find((query) => query.table === "appointments")?.filters.get("id")).toBe("appointment-test");
  });
  it.each([
    null, {}, [], { ...json, appointment_id: "other" }, { ...json, appointment_status: "confirmed" },
    { ...json, payment_status: "pending" }, { ...json, payment_status: "unknown" },
  ])("retorno incompleto ou incompatível não anuncia conclusão: %j", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(completeProfessionalAppointment(completion)).rejects.toThrow("pode ter sido salva");
    expect(mocks.saved).not.toHaveBeenCalled();
  });
  it.each([
    null, { id: "other", status: "completed", payments: paid },
    { id: "appointment-test", status: "confirmed", payments: paid },
    { id: "appointment-test", status: "completed" },
    { id: "appointment-test", status: "completed", payments: null },
    { id: "appointment-test", status: "completed", payments: { ...paid, status: "pending" } },
    { id: "appointment-test", status: "completed", payments: { ...paid, method: "cartao" } },
    { id: "appointment-test", status: "completed", payments: { ...paid, confirmed_by: null } },
    { id: "appointment-test", status: "completed", payments: { ...paid, paid_at: null } },
    { id: "appointment-test", status: "completed", payments: [paid, paid] },
  ])("zero linhas ou estado salvo incompatível é confirmação incerta: %j", async (data) => {
    mocks.saved.mockResolvedValue({ data, error: null });
    await expect(completeProfessionalAppointment(completion)).rejects.toThrow("pode ter sido salva");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("falha da leitura após o RPC não incentiva repetir a mutação", async () => {
    mocks.saved.mockResolvedValue({ data: null, error: { message: "private select error" } });
    await expect(completeProfessionalAppointment(completion)).rejects.toThrow("pode ter sido salva");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("rejeição da leitura posterior mantém mensagem de confirmação incerta", async () => {
    mocks.saved.mockRejectedValue(Error("private connection host"));
    await expect(completeProfessionalAppointment(completion)).rejects.toThrow("pode ter sido salva");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("zero linhas na consulta prévia não envia recebimento às cegas", async () => {
    mocks.existing.mockResolvedValue({ data: null, error: null });
    await expect(completeProfessionalAppointment(completion)).rejects.toThrow("consultar o pagamento");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("mesmo sem novo recebimento, registro parcial não confirma pagamento existente", async () => {
    mocks.saved.mockResolvedValue({ data: { id: "appointment-test", status: "completed", payments: { status: "paid" } }, error: null });
    await expect(completeProfessionalAppointment({ ...completion, paymentReceived: false })).rejects.toThrow("pode ter sido salva");
  });
  it("aguarda o RPC e a confirmação posterior antes de devolver sucesso", async () => {
    const rpc = deferred<{ data: typeof json; error: null }>();
    const saved = deferred<{ data: { id: string; status: string; payments: typeof paid }; error: null }>();
    const readStarted = deferred<void>();
    mocks.rpc.mockReturnValue(rpc.promise);
    mocks.saved.mockImplementation(() => { readStarted.resolve(); return saved.promise; });
    let completed = false;
    const operation = completeProfessionalAppointment(completion).then((result) => { completed = true; return result; });
    expect(mocks.saved).not.toHaveBeenCalled();
    rpc.resolve({ data: json, error: null });
    await readStarted.promise;
    expect(completed).toBe(false);
    saved.resolve({ data: { id: "appointment-test", status: "completed", payments: paid }, error: null });
    await operation;
    expect(completed).toBe(true);
  });
  it.each(["pending", "paid", "refunded", "cancelled"] as const)("conclui sem receber, preservando pagamento %s", async (status) => {
    mocks.rpc.mockResolvedValue({ data: { ...json, payment_status: status }, error: null });
    mocks.saved.mockResolvedValue({ data: { id: "appointment-test", status: "completed", payments: { ...paid, status } }, error: null });
    await expect(completeProfessionalAppointment({ ...completion, paymentReceived: false, paymentMethod: undefined }))
      .resolves.toMatchObject({ paymentStatus: status, appointmentStatus: "completed" });
    expect(mocks.existing).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_payment_received: false, p_payment_method: null });
  });
  it("sem recebimento e sem registro de pagamento aceita o fallback pending do contrato", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...json, payment_status: "pending" }, error: null });
    mocks.saved.mockResolvedValue({ data: { id: "appointment-test", status: "completed", payments: null }, error: null });
    await expect(completeProfessionalAppointment({ ...completion, paymentReceived: false })).resolves.toMatchObject({ paymentStatus: "pending" });
  });
  it("pagamento já confirmado pela administradora não é regravado e não bloqueia conclusão", async () => {
    const adminPaid = { ...paid, method: "cartao", confirmed_by: "admin-test", paid_at: "2026-10-07T10:00:00.000Z" };
    mocks.existing.mockResolvedValue({ data: adminPaid, error: null });
    mocks.saved.mockResolvedValue({ data: { id: "appointment-test", status: "completed", payments: adminPaid }, error: null });
    await expect(completeProfessionalAppointment({ ...completion, paymentMethod: "dinheiro" })).resolves.toMatchObject({ paymentStatus: "paid" });
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_payment_received: false, p_payment_method: null });
    expect(adminPaid).toMatchObject({ method: "cartao", confirmed_by: "admin-test", paid_at: "2026-10-07T10:00:00.000Z" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("consulta prévia falha sem lançar uma chamada de recebimento às cegas", async () => {
    mocks.existing.mockResolvedValue({ data: null, error: { message: "private read" } });
    await expect(completeProfessionalAppointment(completion)).rejects.toThrow("consultar o pagamento");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("dois cliques de conclusão antes da renderização iniciam somente um RPC", async () => {
    const gate = deferred<{ data: typeof json; error: null }>();
    mocks.rpc.mockReturnValue(gate.promise);
    const requests = new PaymentRequests(); requests.activate();
    const callbacks = { onStart: vi.fn(), onConfirmed: vi.fn(), reload: vi.fn().mockResolvedValue(undefined),
      onError: vi.fn(), onRefreshFailure: vi.fn(), onFinish: vi.fn() };
    const action = () => completeProfessionalAppointment(completion);
    const first = runPaymentAction(requests, action, callbacks);
    const second = runPaymentAction(requests, action, callbacks);
    expect(await second).toBe("ignored");
    gate.resolve({ data: json, error: null });
    expect(await first).toBe("confirmed");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(callbacks.onConfirmed).toHaveBeenCalledTimes(1);
  });
  it("pagamento não pago encontrado depois da consulta continua sujeito à corrida do RPC", async () => {
    const gate = deferred<{ data: Record<string, unknown>; error: null }>();
    mocks.existing.mockReturnValue(gate.promise);
    const operation = completeProfessionalAppointment(completion);
    expect(mocks.rpc).not.toHaveBeenCalled();
    // O snapshot prévio era pending; um escritor externo pode ter confirmado antes do RPC.
    gate.resolve({ data: { id: "payment-test", appointment_id: "appointment-test", status: "pending" }, error: null });
    await operation;
    expect(mocks.rpc.mock.calls[0][1].p_payment_received).toBe(true);
    // Este teste documenta a limitação, não simula uma proteção atômica inexistente.
  });
  it.each([
    [{ code: "P0001", message: "Um atendimento futuro não pode ser concluído." }, "ainda não"],
    [{ code: "P0001", message: "Somente atendimentos confirmados podem ser concluídos." }, "não está mais confirmado"],
    [{ code: "42501", message: "private access policy" }, "sessão"],
    [{ code: "XX000", message: "private audit_logs exception" }, "confirmar o resultado"],
  ])("erros do RPC têm mensagem pública: %j", async (error, message) => {
    mocks.rpc.mockResolvedValue({ data: null, error });
    await expect(completeProfessionalAppointment(completion)).rejects.toThrow(message);
    expect(mocks.saved).not.toHaveBeenCalled();
  });
});
