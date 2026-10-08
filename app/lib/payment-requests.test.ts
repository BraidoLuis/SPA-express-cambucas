import { describe, expect, it, vi } from "vitest";
import { PaymentRequests, reloadConfirmedPayment, runPaymentAction } from "./payment-requests";
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function callbacks() {
  return { onStart: vi.fn(), onConfirmed: vi.fn(), reload: vi.fn().mockResolvedValue(undefined),
    onError: vi.fn(), onRefreshFailure: vi.fn(), onFinish: vi.fn() };
}
describe("operações de pagamento vinculadas ao acesso e à montagem", () => {
  it("bloqueia o segundo clique sincronamente antes de qualquer renderização", async () => {
    const requests = new PaymentRequests(); requests.activate();
    const database = deferred<string>(); const action = vi.fn(() => database.promise);
    const handlers = callbacks();
    const first = runPaymentAction(requests, action, handlers);
    const second = runPaymentAction(requests, action, handlers);
    expect(action).toHaveBeenCalledTimes(1);
    expect(requests.busy()).toBe(true);
    expect(await second).toBe("ignored");
    database.resolve("confirmed");
    expect(await first).toBe("confirmed");
    expect(handlers.onConfirmed).toHaveBeenCalledWith("confirmed");
    expect(requests.busy()).toBe(false);
  });
  it("confirma localmente antes da recarga e preserva sucesso quando ela falha", async () => {
    const requests = new PaymentRequests(); requests.activate();
    const refresh = deferred<void>(); const started = deferred<void>();
    const handlers = callbacks(); let local = "pending";
    handlers.onConfirmed.mockImplementation(() => { local = "paid"; });
    handlers.reload.mockImplementation(() => { started.resolve(); return refresh.promise; });
    const action = vi.fn().mockResolvedValue({ status: "paid" });
    const operation = runPaymentAction(requests, action, handlers);
    await started.promise;
    expect(local).toBe("paid");
    expect(requests.busy()).toBe(true);
    refresh.reject(Error("private reload"));
    expect(await operation).toBe("confirmed-refresh-failed");
    expect(local).toBe("paid");
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(handlers.onRefreshFailure).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledOnce();
  });
  it("aviso do painel persiste se a tabela desmonta na recarga após confirmação", async () => {
    const table = new PaymentRequests(); table.activate();
    const panel = new PaymentRequests(); panel.activate();
    const refresh = deferred<boolean>(), started = deferred<void>();
    const handlers = callbacks(); let local = "pending", notice = "";
    handlers.onConfirmed.mockImplementation(() => { local = "paid"; notice = "Pagamento confirmado."; });
    handlers.reload.mockImplementation(() => reloadConfirmedPayment(panel, [
      () => { started.resolve(); return refresh.promise; },
    ], () => { notice = "Pagamento confirmado; atualização falhou."; }));
    const action = vi.fn().mockResolvedValue("paid");
    const operation = runPaymentAction(table, action, handlers);
    await started.promise;
    table.deactivate(); // O loading da lista desmonta sua tabela, mas preserva o painel.
    refresh.resolve(false);
    expect(await operation).toBe("confirmed-refresh-failed");
    expect(local).toBe("paid");
    expect(notice).toBe("Pagamento confirmado; atualização falhou.");
    expect(handlers.onRefreshFailure).not.toHaveBeenCalled();
    expect(action).toHaveBeenCalledOnce();
  });
  it("recarga confirmada antiga não publica aviso no novo painel/acesso", async () => {
    const panel = new PaymentRequests(); panel.activate();
    const refresh = deferred<boolean>(); const notice = vi.fn();
    const operation = reloadConfirmedPayment(panel, [() => refresh.promise], notice);
    panel.deactivate(); panel.activate();
    refresh.resolve(false); await operation;
    expect(notice).not.toHaveBeenCalled();
  });
  it("exceção de recarga é falha posterior à confirmação, não erro da mutação", async () => {
    const panel = new PaymentRequests(); panel.activate(); const notice = vi.fn();
    await expect(reloadConfirmedPayment(panel, [
      async () => { throw Error("private reload"); },
    ], notice)).rejects.toThrow("após confirmação");
    expect(notice).toHaveBeenCalledOnce();
  });
  it("falha da operação não dispara confirmação nem recarga", async () => {
    const requests = new PaymentRequests(); requests.activate(); const handlers = callbacks();
    expect(await runPaymentAction(requests, vi.fn().mockRejectedValue(Error("database")), handlers)).toBe("failed");
    expect(handlers.onConfirmed).not.toHaveBeenCalled(); expect(handlers.reload).not.toHaveBeenCalled();
    expect(handlers.onRefreshFailure).not.toHaveBeenCalled(); expect(handlers.onError).toHaveBeenCalledOnce();
  });
  it("resposta antiga após desmontagem não publica estado nem inicia recarga", async () => {
    const requests = new PaymentRequests(); requests.activate();
    const pending = deferred<string>(); const handlers = callbacks();
    const operation = runPaymentAction(requests, () => pending.promise, handlers);
    requests.deactivate(); pending.resolve("paid"); await operation;
    expect(handlers.onConfirmed).not.toHaveBeenCalled(); expect(handlers.reload).not.toHaveBeenCalled();
    expect(handlers.onFinish).not.toHaveBeenCalled();
  });
  it("novo acesso da mesma conta não aceita a resposta antiga nem perde seu bloqueio", async () => {
    const requests = new PaymentRequests(); requests.activate();
    const old = deferred<string>(); const next = deferred<string>();
    const oldHandlers = callbacks(), newHandlers = callbacks();
    const oldOperation = runPaymentAction(requests, () => old.promise, oldHandlers);
    requests.deactivate(); requests.activate();
    const newOperation = runPaymentAction(requests, () => next.promise, newHandlers);
    old.resolve("old paid"); await oldOperation;
    expect(oldHandlers.onConfirmed).not.toHaveBeenCalled(); expect(requests.busy()).toBe(true);
    next.resolve("new paid"); await newOperation;
    expect(newHandlers.onConfirmed).toHaveBeenCalledWith("new paid"); expect(requests.busy()).toBe(false);
  });
  it("rejeição antiga e falha tardia de recarga não aparecem no novo acesso", async () => {
    const requests = new PaymentRequests(); requests.activate();
    const old = deferred<string>(); const handlers = callbacks();
    const operation = runPaymentAction(requests, () => old.promise, handlers);
    requests.deactivate(); requests.activate();
    old.reject(Error("old")); await operation;
    expect(handlers.onError).not.toHaveBeenCalled();
    const refresh = deferred<void>(), started = deferred<void>(); const later = callbacks();
    later.reload.mockImplementation(() => { started.resolve(); return refresh.promise; });
    const confirmed = runPaymentAction(requests, async () => "paid", later);
    await started.promise; requests.deactivate(); requests.activate();
    refresh.reject(Error("old refresh")); await confirmed;
    expect(later.onRefreshFailure).not.toHaveBeenCalled(); expect(later.onFinish).not.toHaveBeenCalled();
  });
  it("consultas antigas não desfazem confirmação e versões não colidem após invalidação", async () => {
    const requests = new PaymentRequests(); requests.activate();
    const old = requests.beginRead("agenda")!;
    const action = requests.beginAction()!;
    expect(requests.currentRead(old)).toBe(false);
    const whileSaving = requests.beginRead("agenda")!;
    requests.invalidateReads();
    const fresh = requests.beginRead("agenda")!;
    expect(requests.currentRead(whileSaving)).toBe(false);
    expect(requests.currentRead(fresh)).toBe(true);
    requests.finishAction(action);
    const older = requests.beginRead("overview")!; requests.beginRead("overview");
    expect(requests.currentRead(older)).toBe(false);
    expect(requests.currentRead(fresh)).toBe(true);
  });
  it("desmontagem e novo acesso invalidam consultas mesmo com o mesmo canal", () => {
    const requests = new PaymentRequests(); requests.activate();
    const old = requests.beginRead("agenda")!; requests.deactivate(); requests.activate();
    const current = requests.beginRead("agenda")!;
    expect(requests.currentRead(old)).toBe(false); expect(requests.currentRead(current)).toBe(true);
  });
  it("antes da montagem e depois da desmontagem não inicia operação nem consulta", async () => {
    const requests = new PaymentRequests(); const action = vi.fn();
    expect(await runPaymentAction(requests, action, callbacks())).toBe("ignored");
    expect(requests.beginRead("agenda")).toBeNull();
    requests.activate(); requests.deactivate();
    expect(await runPaymentAction(requests, action, callbacks())).toBe("ignored");
    expect(action).not.toHaveBeenCalled();
  });
});

// Observa a consulta pelos tokens reais, com callbacks equivalentes aos setters do painel.
function observeAgenda(
  requests: PaymentRequests,
  pending: ReturnType<typeof deferred<string>>,
  onLoadingFinished: () => void,
) {
  const token = requests.beginRead("agenda");
  if (!token) throw Error("Acesso inativo no teste");
  const publish = vi.fn(), readError = vi.fn();
  const completion = pending.promise.then(
    (data) => { if (requests.currentRead(token)) publish(data); },
    () => { if (requests.currentRead(token)) readError(); },
  ).finally(() => {
    if (requests.finishRead(token)) onLoadingFinished();
  });
  return { token, completion, publish, readError };
}

describe("loading de consultas invalidadas durante pagamentos", () => {
  it.each(["resolve", "reject"] as const)("agenda pendente, conclusão falha e consulta antiga termina (%s)", async (settlement) => {
    const requests = new PaymentRequests(); requests.activate();
    const pending = deferred<string>(), database = deferred<string>();
    let loading = true;
    const finishLoading = vi.fn(() => { loading = false; });
    const agenda = observeAgenda(requests, pending, finishLoading);
    const handlers = callbacks();
    const mutation = vi.fn(() => database.promise);
    const operation = runPaymentAction(requests, mutation, handlers);
    expect(requests.currentRead(agenda.token)).toBe(false);
    database.reject(Error("falha de conclusão de teste"));
    expect(await operation).toBe("failed");
    expect(handlers.onError).toHaveBeenCalledOnce();
    expect(handlers.onConfirmed).not.toHaveBeenCalled();
    expect(handlers.onRefreshFailure).not.toHaveBeenCalled();
    expect(handlers.reload).not.toHaveBeenCalled();
    expect(loading).toBe(true); // A consulta ainda está pendente.
    if (settlement === "resolve") pending.resolve("dados antigos");
    else pending.reject(Error("erro antigo da agenda"));
    await agenda.completion;
    expect(loading).toBe(false);
    expect(finishLoading).toHaveBeenCalledOnce();
    expect(agenda.publish).not.toHaveBeenCalled();
    expect(agenda.readError).not.toHaveBeenCalled();
    expect(mutation).toHaveBeenCalledOnce();
  });

  it.each(["resolve", "reject"] as const)("consulta invalidada não encerra o loading de uma nova consulta (%s)", async (settlement) => {
    const requests = new PaymentRequests(); requests.activate();
    const first = deferred<string>(), next = deferred<string>();
    let loading = true;
    const oldFinish = vi.fn(() => { loading = false; });
    const newFinish = vi.fn(() => { loading = false; });
    const old = observeAgenda(requests, first, oldFinish);
    requests.invalidateReads();
    const current = observeAgenda(requests, next, newFinish);
    if (settlement === "resolve") first.resolve("antiga");
    else first.reject(Error("erro antigo"));
    await old.completion;
    expect(loading).toBe(true);
    expect(oldFinish).not.toHaveBeenCalled();
    expect(newFinish).not.toHaveBeenCalled();
    expect(old.publish).not.toHaveBeenCalled();
    expect(old.readError).not.toHaveBeenCalled();
    next.resolve("atual"); await current.completion;
    expect(loading).toBe(false);
    expect(newFinish).toHaveBeenCalledOnce();
    expect(current.publish).toHaveBeenCalledWith("atual");
  });

  it("a consulta antiga também não encerra o loading outra vez se a nova já terminou", async () => {
    const requests = new PaymentRequests(); requests.activate();
    const first = deferred<string>(), next = deferred<string>();
    const oldFinish = vi.fn(), newFinish = vi.fn();
    const old = observeAgenda(requests, first, oldFinish);
    requests.invalidateReads();
    const current = observeAgenda(requests, next, newFinish);
    next.resolve("atual"); await current.completion;
    first.resolve("antiga"); await old.completion;
    expect(newFinish).toHaveBeenCalledOnce();
    expect(oldFinish).not.toHaveBeenCalled();
    expect(old.publish).not.toHaveBeenCalled();
    expect(current.publish).toHaveBeenCalledWith("atual");
  });

  it.each([
    ["desmontagem", false], ["desmontagem", true],
    ["novo acesso da mesma conta", false], ["novo acesso da mesma conta", true],
  ] as const)("%s protege callbacks com consulta substituta=%s", async (lifecycle, withReplacement) => {
    const requests = new PaymentRequests(); requests.activate();
    const first = deferred<string>(), replacement = deferred<string>(), database = deferred<string>();
    const oldFinish = vi.fn(), replacementFinish = vi.fn();
    const old = observeAgenda(requests, first, oldFinish);
    const handlers = callbacks(), mutation = vi.fn(() => database.promise);
    const operation = runPaymentAction(requests, mutation, handlers);
    const replaced = withReplacement ? observeAgenda(requests, replacement, replacementFinish) : null;

    requests.deactivate();
    const fresh = deferred<string>(); let newLoading = true;
    const newFinish = vi.fn(() => { newLoading = false; });
    if (lifecycle === "novo acesso da mesma conta") requests.activate();
    const current = lifecycle === "novo acesso da mesma conta" ? observeAgenda(requests, fresh, newFinish) : null;

    database.reject(Error("falha da operação antiga"));
    await operation;
    first.resolve("dados do acesso antigo"); await old.completion;
    if (replaced) {
      replacement.reject(Error("erro do acesso antigo")); await replaced.completion;
      expect(replaced.readError).not.toHaveBeenCalled();
      expect(replacementFinish).not.toHaveBeenCalled();
    }
    expect(oldFinish).not.toHaveBeenCalled();
    expect(old.publish).not.toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(handlers.onFinish).not.toHaveBeenCalled();
    expect(handlers.onConfirmed).not.toHaveBeenCalled();
    expect(handlers.reload).not.toHaveBeenCalled();
    expect(mutation).toHaveBeenCalledOnce();
    if (current) {
      expect(newLoading).toBe(true);
      expect(newFinish).not.toHaveBeenCalled();
      fresh.resolve("dados do novo acesso"); await current.completion;
      expect(newLoading).toBe(false);
      expect(current.publish).toHaveBeenCalledWith("dados do novo acesso");
      expect(newFinish).toHaveBeenCalledOnce();
    }
  });

  it.each(["agenda", "overview", "appointments"])("separa publicação e encerramento do loading em %s", (channel) => {
    const requests = new PaymentRequests(); requests.activate();
    const first = requests.beginRead(channel)!;
    requests.invalidateReads();
    expect(requests.currentRead(first)).toBe(false);
    expect(requests.finishRead(first)).toBe(true);
    expect(requests.finishRead(first)).toBe(false);
    const old = requests.beginRead(channel)!;
    const current = requests.beginRead(channel)!;
    expect(requests.finishRead(old)).toBe(false);
    expect(requests.currentRead(current)).toBe(true);
    expect(requests.finishRead(current)).toBe(true);
  });
});
