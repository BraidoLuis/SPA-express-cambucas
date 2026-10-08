import { describe, expect, it, vi } from "vitest";
import {
  canClientCancelAppointment, cancellationMessage, cancellationUnavailableMessage,
  parseCancellationRules, revalidateCancellation,
} from "./cancellation-rules";

const hour = 3_600_000;
const rules = { cancellationEnabled: true, cancellationNoticeHours: 5 };
const start = new Date(10 * hour).toISOString();
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("antecedência configurada de cancelamento (sem banco)", () => {
  it("true aplica as horas configuradas, sem prazo fixo de duas horas", () => {
    expect(canClientCancelAppointment(start, rules, 4 * hour)).toBe(true);
    expect(canClientCancelAppointment(start, rules, 6 * hour)).toBe(false);
    expect(cancellationMessage(rules)).toContain("5 hora(s)");
  });
  it("rejeita a igualdade no limite, conforme <= do trigger", () => {
    expect(canClientCancelAppointment(start, rules, 5 * hour)).toBe(false);
  });
  it.each([0, 5, 99999])("false não exige a antecedência armazenada (%s horas)", (hours) => {
    const noNotice = { cancellationEnabled: false, cancellationNoticeHours: hours };
    expect(canClientCancelAppointment(start, noNotice, 9 * hour)).toBe(true);
    expect(cancellationMessage(noNotice)).toContain("Não há antecedência mínima");
    expect(cancellationMessage(noNotice)).not.toContain("desativado");
  });
  it.each([10 * hour, 11 * hour])("false continua exigindo atendimento futuro: %s", (now) => {
    expect(canClientCancelAppointment(start, { ...rules, cancellationEnabled: false }, now)).toBe(false);
  });
  it("configuração indisponível continua bloqueando a ação", () => {
    expect(canClientCancelAppointment(start, null, 0)).toBe(false);
    expect(cancellationUnavailableMessage(null)).toContain("consultar");
  });
  it.each([true, false])("data inválida não permite cancelar, flag=%s", (cancellationEnabled) => {
    expect(canClientCancelAppointment("inválida", { ...rules, cancellationEnabled }, 0)).toBe(false);
  });
  it.each([null, {}, { cancellationEnabled: "false" }, { cancellationEnabled: null }, { cancellationEnabled: 1 }])("não inventa uma configuração identificável: %j", (value) => {
    expect(parseCancellationRules(value)).toBeNull();
  });
  it.each([
    [0, 0], [7, 7], ["7", 7], ["00007", 7], ["99999", 99999],
  ])("normaliza horas cujo texto tem de 1 a 5 dígitos: %j", (value, expected) => {
    expect(parseCancellationRules({ cancellationEnabled: true, cancellationNoticeHours: value }))
      .toEqual({ cancellationEnabled: true, cancellationNoticeHours: expected });
  });
  it.each([undefined, null, "", -1, "-1", "2.0", 2.5, " 2", "2 ", "+2", "1e2", "2\n", "2\r", "2\u2028", "100000", "000007", Infinity, {}, false])("usa zero conforme o trigger para horas fora do formato: %j", (value) => {
    expect(parseCancellationRules({ cancellationEnabled: true, cancellationNoticeHours: value }))
      .toEqual({ cancellationEnabled: true, cancellationNoticeHours: 0 });
  });
  it("true com horas nulas usa zero e mantém a restrição de atendimento futuro", () => {
    const normalized = parseCancellationRules({ cancellationEnabled: true, cancellationNoticeHours: null });
    expect(canClientCancelAppointment(start, normalized, 9 * hour)).toBe(true);
    expect(canClientCancelAppointment(start, normalized, 10 * hour)).toBe(false);
  });
  it("false com horas ausentes continua sendo configuração válida", () => {
    const normalized = parseCancellationRules({ cancellationEnabled: false });
    expect(normalized).toEqual({ cancellationEnabled: false, cancellationNoticeHours: 0 });
    expect(canClientCancelAppointment(start, normalized, 9 * hour)).toBe(true);
  });
  it("reconsulta na abertura e na confirmação e barra o prazo vencido com o diálogo aberto", async () => {
    let now = 4 * hour;
    const load = vi.fn().mockResolvedValue(rules);
    await expect(revalidateCancellation(start, load, () => now)).resolves.toEqual(rules);
    now = 5 * hour;
    await expect(revalidateCancellation(start, load, () => now)).rejects.toThrow("prazo");
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("confere o relógio após consulta pendente antes de chamar a mutação", async () => {
    const pending = deferred<typeof rules>();
    let now = 4 * hour;
    const mutate = vi.fn();
    const confirmation = revalidateCancellation(start, () => pending.promise, () => now).then(mutate);
    now = 6 * hour;
    pending.resolve(rules);
    await expect(confirmation).rejects.toThrow("prazo");
    expect(mutate).not.toHaveBeenCalled();
  });
  it("troca para false na confirmação remove só a antecedência", async () => {
    const noNotice = { ...rules, cancellationEnabled: false };
    const load = vi.fn().mockResolvedValueOnce(rules).mockResolvedValueOnce(noNotice);
    await revalidateCancellation(start, load, () => 4 * hour);
    await expect(revalidateCancellation(start, load, () => 9 * hour)).resolves.toEqual(noNotice);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("troca para true na confirmação revalida a antecedência configurada", async () => {
    const load = vi.fn().mockResolvedValueOnce({ ...rules, cancellationEnabled: false }).mockResolvedValueOnce(rules);
    await revalidateCancellation(start, load, () => 9 * hour);
    await expect(revalidateCancellation(start, load, () => 9 * hour)).rejects.toThrow("prazo");
  });
  it("false não permite confirmar depois do início durante uma consulta pendente", async () => {
    const pending = deferred<typeof rules>();
    let now = 9 * hour;
    const confirmation = revalidateCancellation(start, () => pending.promise, () => now);
    now = 10 * hour;
    pending.resolve({ ...rules, cancellationEnabled: false });
    await expect(confirmation).rejects.toThrow("não é futuro");
  });
  it("falha de configuração ao confirmar não chama a mutação", async () => {
    const mutate = vi.fn();
    const confirmation = revalidateCancellation(start, async () => { throw new Error("Configuração indisponível"); }).then(mutate);
    await expect(confirmation).rejects.toThrow("indisponível");
    expect(mutate).not.toHaveBeenCalled();
  });
});
