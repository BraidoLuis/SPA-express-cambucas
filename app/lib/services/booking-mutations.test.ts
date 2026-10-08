import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClientAppointment, cancelClientAppointment } from "./appointment-service";
import { createProfessionalExtraAppointment } from "./professional-extra-appointment-service";
import { updateProfessionalAppointmentStatus, completeProfessionalAppointment } from "./professional-agenda-service";
import { createAdminAppointment } from "./admin-appointment-service";
import { bookingErrorMessage } from "../booking-errors";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), row: vi.fn(), session: vi.fn(), fetch: vi.fn(), eq: vi.fn(), select: vi.fn(), in: vi.fn(), update: vi.fn() }));
vi.mock("../../../lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mocks.rpc, auth: { getSession: mocks.session },
    from: (table: string) => {
      if (table !== "appointments") throw Error("Tabela inesperada");
      const q = { update: mocks.update, eq: mocks.eq, select: mocks.select, in: mocks.in, maybeSingle: mocks.row };
      mocks.update.mockReturnValue(q); mocks.eq.mockReturnValue(q); mocks.select.mockReturnValue(q); mocks.in.mockReturnValue(q); return q;
    },
  }),
}));
const clientInput = { professionalId: "professional-test", serviceId: "service-test", slotStart: "2099-01-01T13:00:00Z" };
const extraInput = { serviceId: "service-test", clientName: "Cliente teste", date: "2099-01-01", time: "13:00", duration: 60 };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: "appointment-test", error: null });
  mocks.row.mockResolvedValue({ data: { id: "appointment-test", status: "cancelled" }, error: null });
  mocks.session.mockResolvedValue({ data: { session: { access_token: "test-only" } }, error: null });
  mocks.fetch.mockResolvedValue(new Response("{}", { status: 500 }));
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("confirmação das operações de agendamento (somente mocks)", () => {
  it.each([null, "", false, {}, ["id"]])("cliente não anuncia criação sem identificador: %j", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(createClientAppointment(clientInput)).rejects.toThrow("Confira seus agendamentos");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([null, "", false, {}, ["id"]])("equipe não anuncia criação sem identificador: %j", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(createProfessionalExtraAppointment(extraInput)).rejects.toThrow("Confira seus agendamentos");
  });
  it.each([null, { id: "other", status: "cancelled" }, { id: "appointment-test", status: "confirmed" }])("cliente não anuncia cancelamento sem registro confirmado: %j", async (data) => {
    mocks.row.mockResolvedValue({ data, error: null });
    await expect(cancelClientAppointment("appointment-test")).rejects.toThrow("não foi confirmado");
    expect(mocks.select).toHaveBeenCalledWith("id,status");
    expect(mocks.eq).toHaveBeenCalledWith("id", "appointment-test");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("preserva a validação definitiva e sanitiza o prazo negado pelo banco", async () => {
    mocks.row.mockResolvedValue({ data: null, error: { code: "P0001", message: "cancelamento deve ser solicitado com antecedência; internal_private" } });
    await expect(cancelClientAppointment("appointment-test")).rejects.toThrow("prazo");
    await expect(cancelClientAppointment("appointment-test")).rejects.not.toThrow("internal_private");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each(["create", "cancel"] as const)("HTTP de e-mail com erro preserva %s e não repete a mutação", async (operation) => {
    if (operation === "create") await expect(createClientAppointment(clientInput)).resolves.toBe("appointment-test");
    else await expect(cancelClientAppointment("appointment-test")).resolves.toBeUndefined();
    expect(operation === "create" ? mocks.rpc : mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["create", "cancel"] as const)("exceção posterior de e-mail preserva %s", async (operation) => {
    mocks.fetch.mockRejectedValue(new Error("Network test"));
    if (operation === "create") await expect(createClientAppointment(clientInput)).resolves.toBe("appointment-test");
    else await expect(cancelClientAppointment("appointment-test")).resolves.toBeUndefined();
    expect(operation === "create" ? mocks.rpc : mocks.update).toHaveBeenCalledTimes(1);
  });
  it.each(["cancelled", "confirmed", "no_show", "completed"] as const)("confere o registro depois do RPC de equipe: %s", async (status) => {
    mocks.rpc.mockResolvedValue({ data: null, error: null }); // Sem presumir contrato de retorno.
    mocks.row.mockResolvedValue({ data: { id: "appointment-test", status }, error: null });
    await expect(updateProfessionalAppointmentStatus("appointment-test", status, "Motivo teste")).resolves.toBeUndefined();
    expect(mocks.select).toHaveBeenCalledWith("id,status");
    expect(mocks.fetch).toHaveBeenCalledTimes(status === "cancelled" ? 1 : 0);
  });
  it.each([{ data: null, error: null }, { data: { id: "appointment-test", status: "confirmed" }, error: null }, { data: null, error: { message: "private" } }])("não confirma RPC de cancelamento sem leitura correspondente: %j", async (result) => {
    mocks.row.mockResolvedValue(result);
    await expect(updateProfessionalAppointmentStatus("appointment-test", "cancelled", "Motivo")).rejects.toThrow("conferir o resultado");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("não consulta nem envia e-mail após erro do RPC de equipe", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "private" } });
    await expect(updateProfessionalAppointmentStatus("appointment-test", "cancelled", "Motivo")).rejects.toThrow("sessão");
    expect(mocks.row).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("cancelamento de equipe confirmado não falha por exceção de e-mail", async () => {
    mocks.fetch.mockRejectedValue(new Error("test"));
    await expect(updateProfessionalAppointmentStatus("appointment-test", "cancelled", "Motivo")).resolves.toBeUndefined();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("conclusão de equipe também precisa de registro confirmado", async () => {
    // Contrato JSON de produção validado na revisão de pagamentos já integrada à main.
    mocks.rpc.mockResolvedValue({ data: { appointment_id: "appointment-test", appointment_status: "completed", payment_status: "pending" }, error: null });
    await expect(completeProfessionalAppointment({ appointmentId: "appointment-test", paymentReceived: false })).rejects.toThrow("pode ter sido salva");
    mocks.row.mockResolvedValue({ data: { id: "appointment-test", status: "completed", payments: null }, error: null });
    await expect(completeProfessionalAppointment({ appointmentId: "appointment-test", paymentReceived: false })).resolves.toEqual({ appointmentId: "appointment-test", appointmentStatus: "completed", paymentStatus: "pending" });
  });
  it.each([null, false, {}, ""])("admin não aceita identificador inválido: %j", async (id) => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ id }), { status: 201 }));
    await expect(createAdminAppointment({ ...clientInput, clientId: "client-test" })).rejects.toThrow("Confira seus agendamentos");
  });
  it("admin sanitiza falhas internas retornadas pelo servidor", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ error: "private SQL" }), { status: 500 }));
    await expect(createAdminAppointment({ ...clientInput, clientId: "client-test" })).rejects.not.toThrow("private SQL");
  });
  it.each([
    [{ code: "23P01", message: "private" }, "create", "disponível"],
    [{ code: "42501", message: "private" }, "cancel", "sessão"],
    [new TypeError("Failed to fetch private"), "create", "Confira seus agendamentos"],
    [{ message: "private SQL" }, "cancel", "conferir o resultado"],
  ] as const)("mensagem pública para erro %j", (error, operation, expected) => {
    expect(bookingErrorMessage(error, operation)).toContain(expected);
    expect(bookingErrorMessage(error, operation)).not.toContain("private");
  });
  it.each(["pending", "confirmed"] as const)("UPDATE condicionado aceita somente estado elegível: %s", async (initialStatus) => {
    let databaseStatus: string = initialStatus;
    mocks.row.mockImplementation(async () => {
      const states = mocks.in.mock.calls.at(-1)?.[1] as string[] | undefined;
      if (!states?.includes(databaseStatus)) return { data: null, error: null };
      databaseStatus = "cancelled";
      return { data: { id: "appointment-test", status: databaseStatus }, error: null };
    });
    await expect(cancelClientAppointment("appointment-test")).resolves.toBeUndefined();
    expect(mocks.in).toHaveBeenCalledWith("status", ["pending", "confirmed"]);
    expect(databaseStatus).toBe("cancelled");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["cancelled", "completed", "no_show"] as const)("não sobrescreve estado inelegível nem processa novo cancelamento: %s", async (status) => {
    let databaseStatus: string = status;
    mocks.row.mockImplementation(async () => {
      const states = mocks.in.mock.calls.at(-1)?.[1] as string[] | undefined;
      if (!states?.includes(databaseStatus)) return { data: null, error: null };
      databaseStatus = "cancelled";
      return { data: { id: "appointment-test", status: databaseStatus }, error: null };
    });
    await expect(cancelClientAppointment("appointment-test")).rejects.toThrow("pode ter sido cancelado ou alterado");
    expect(mocks.in).toHaveBeenCalledWith("status", ["pending", "confirmed"]);
    expect(databaseStatus).toBe(status);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("alteração da equipe antes de executar o UPDATE pendente impede o cancelamento antigo", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    let databaseStatus: string = "confirmed";
    mocks.row.mockImplementation(async () => {
      await pending;
      const states = mocks.in.mock.calls.at(-1)?.[1] as string[] | undefined;
      if (!states?.includes(databaseStatus)) return { data: null, error: null };
      databaseStatus = "cancelled";
      return { data: { id: "appointment-test", status: databaseStatus }, error: null };
    });
    const operation = cancelClientAppointment("appointment-test");
    databaseStatus = "completed";
    release();
    await expect(operation).rejects.toThrow("pode ter sido cancelado ou alterado");
    expect(databaseStatus).toBe("completed");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.in).toHaveBeenCalledWith("status", ["pending", "confirmed"]);
  });

});
