import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  createAdmin: vi.fn(), rpc: vi.fn(), from: vi.fn(), storage: vi.fn(), processEmails: vi.fn(),
}));
vi.mock("../../../../lib/supabase/admin", () => ({ createAdminClient: mocks.createAdmin }));
vi.mock("../../../lib/server/appointment-email-processor", () => ({
  processAppointmentEmails: mocks.processEmails,
}));

const secret = "cron-secret-test-only";
function request(authorization?: string) {
  return new Request("https://spa.example.test/api/cron/appointment-reminders", {
    headers: authorization === undefined ? {} : { Authorization: authorization },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", secret);
  mocks.createAdmin.mockReturnValue({ rpc: mocks.rpc, from: mocks.from, storage: { from: mocks.storage } });
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  mocks.processEmails.mockImplementation(async (appointmentId: string) => ({
    appointmentId, configured: true, processed: 1,
    items: [{ notificationId: "mock-notification", result: "sent" }],
  }));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("autenticação e preservação do cron de lembretes", () => {
  it.each([undefined, "", "   ", "undefined"])("rejeita CRON_SECRET inválido %s antes de acessar serviços", async (configured) => {
    vi.stubEnv("CRON_SECRET", configured);
    const response = await GET(request("Bearer undefined"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "CRON_SECRET não está configurado." });
    expect(mocks.createAdmin).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
    expect(mocks.processEmails).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([undefined, "Bearer", "Bearer ", "Bearer incorrect", "Bearer undefined", `Basic ${secret}`])(
    "retorna 401 para Authorization inválido %s sem banco, Storage ou mensagens",
    async (authorization) => {
      const response = await GET(request(authorization));
      expect(response.status).toBe(401);
      expect(mocks.createAdmin).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.storage).not.toHaveBeenCalled();
      expect(mocks.processEmails).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
      expect(await response.text()).not.toContain(secret);
    },
  );

  it("aceita o Bearer da Vercel e preserva deduplicação e processamento dos lembretes", async () => {
    mocks.rpc.mockResolvedValue({ data: [
      { appointment_id: "appointment-1" }, { appointment_id: "appointment-1" }, { appointment_id: "appointment-2" },
    ], error: null });
    const response = await GET(request(`Bearer ${secret}`));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("queue_due_appointment_reminders");
    expect(mocks.processEmails.mock.calls).toEqual([["appointment-1"], ["appointment-2"]]);
    expect(await response.json()).toMatchObject({
      ok: true, appointmentsFound: 2, appointmentsProcessed: 2, emailsSent: 2, emailsFailed: 0, failedAppointments: [],
    });
  });

  it("lote vazio autorizado não processa e-mails", async () => {
    const response = await GET(request(`Bearer ${secret}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, appointmentsFound: 0, emailsSent: 0 });
    expect(mocks.processEmails).not.toHaveBeenCalled();
  });

  it("preserva o limite de 50 agendamentos autorizados", async () => {
    mocks.rpc.mockResolvedValue({
      data: Array.from({ length: 55 }, (_, i) => ({ appointment_id: `appointment-${i}` })), error: null,
    });
    const response = await GET(request(`Bearer ${secret}`));
    expect(await response.json()).toMatchObject({ appointmentsFound: 50, appointmentsProcessed: 50, emailsSent: 50 });
    expect(mocks.processEmails).toHaveBeenCalledTimes(50);
  });

  it("erro ao preparar a fila autorizada não processa e-mails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Queue offline" } });
    const response = await GET(request(`Bearer ${secret}`));
    expect(response.status).toBe(500);
    expect(mocks.processEmails).not.toHaveBeenCalled();
  });
});

describe("sigilo de CRON_SECRET nos erros dos lembretes", () => {
  it("omite o segredo de uma falha de fila em logs e resposta", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: `Queue error with ${secret}` } });
    const response = await GET(request(`Bearer ${secret}`));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(secret);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(secret);
    expect(mocks.processEmails).not.toHaveBeenCalled();
  });

  it("omite o segredo do erro por agendamento, preservando o resultado de falha", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ appointment_id: "appointment-1" }], error: null });
    mocks.processEmails.mockRejectedValue(new Error(`Provider error with ${secret}`));
    const response = await GET(request(`Bearer ${secret}`));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toMatchObject({
      ok: false, appointmentsFound: 1, appointmentsProcessed: 0,
      failedAppointments: [{ appointmentId: "appointment-1", message: "Provider error with [segredo omitido]" }],
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(secret);
  });
});
