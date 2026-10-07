import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppointmentEmailProcessingResult } from "../../../lib/server/appointment-email-processor";
import { createAdminAppointment } from "../../../lib/services/admin-appointment-service";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  createAdmin: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  profile: vi.fn(),
  link: vi.fn(),
  slots: vi.fn(),
  insert: vi.fn(),
  created: vi.fn(),
  processEmails: vi.fn(),
  createBrowser: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("../../../../lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdmin,
}));
vi.mock("../../../lib/server/appointment-email-processor", () => ({
  processAppointmentCreatedEmails: mocks.processEmails,
}));
vi.mock("../../../../lib/supabase/client", () => ({
  createClient: mocks.createBrowser,
}));

const appointmentId = "appointment-test-only";
const slotStart = "2099-01-15T13:00:00.000Z";
const input = {
  clientId: "client-test-only",
  professionalId: "professional-test-only",
  serviceId: "service-test-only",
  slotStart,
  notes: "Observação de teste",
};

function processingResult(
  outcomes: Array<AppointmentEmailProcessingResult["items"][number]["result"]>,
  configured = true,
): AppointmentEmailProcessingResult {
  return {
    appointmentId,
    configured,
    processed: outcomes.filter((outcome) => outcome === "sent").length,
    items: outcomes.map((outcome, index) => ({
      notificationId: `notification-${index}`,
      recipientId: `recipient-${index}`,
      notificationType: "appointment_created",
      audience: index === 0 ? "client" : "professional",
      result: outcome,
      providerId: "provider-test-only",
      message: "Detalhe interno do provedor",
    })),
  };
}

function request(authorization: string | null = "Bearer token-test-only") {
  return new Request("https://spa.example.test/api/admin/appointments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization === null ? {} : { Authorization: authorization }),
    },
    body: JSON.stringify(input),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-only");
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "admin-test-only" } },
    error: null,
  });
  mocks.profile
    .mockResolvedValueOnce({ data: { role: "admin", active: true }, error: null })
    .mockResolvedValue({
      data: {
        id: input.clientId,
        full_name: "Cliente de teste",
        email: "client@example.test",
        phone: "00000000000",
      },
      error: null,
    });
  mocks.link.mockResolvedValue({ data: { active: true }, error: null });
  mocks.slots.mockResolvedValue({
    data: [{ slot_start: slotStart, slot_end: "2099-01-15T14:00:00.000Z" }],
    error: null,
  });
  mocks.created.mockResolvedValue({ data: { id: appointmentId }, error: null });
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      single: table === "profiles" ? mocks.profile :
        table === "professional_services" ? mocks.link : mocks.created,
      insert: mocks.insert,
    };
    if (!["profiles", "professional_services", "appointments"].includes(table)) {
      throw new Error(`Tabela inesperada no teste: ${table}`);
    }
    mocks.insert.mockReturnValue(query);
    return query;
  });
  mocks.createAdmin.mockReturnValue({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.slots,
  });
  mocks.processEmails.mockResolvedValue(processingResult(["sent", "sent"]));
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: "token-test-only" } },
    error: null,
  });
  mocks.createBrowser.mockReturnValue({
    auth: { getSession: mocks.getSession },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("e-mails de reservas administrativas (somente mocks)", () => {
  it("não acessa serviços sem configuração administrativa", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(mocks.createAdmin).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.processEmails).not.toHaveBeenCalled();
  });

  it.each([null, "Basic token-test-only"])(
    "não cria nem processa sem autorização Bearer: %s",
    async (authorization) => {
      const response = await POST(request(authorization));
      expect(response.status).toBe(401);
      expect(mocks.createAdmin).not.toHaveBeenCalled();
      expect(mocks.insert).not.toHaveBeenCalled();
      expect(mocks.processEmails).not.toHaveBeenCalled();
    },
  );

  it("rejeita sessão inválida antes de consultar ou criar reservas", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Sessão de teste inválida"),
    });
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.processEmails).not.toHaveBeenCalled();
  });

  it.each([
    { role: "admin", active: false },
    { role: "client", active: true },
    { role: "professional", active: true },
    null,
  ])("exige perfil de administrador ativo: %j", async (profile) => {
    mocks.profile.mockReset().mockResolvedValue({ data: profile, error: null });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.processEmails).not.toHaveBeenCalled();
  });

  it("não cria nem processa quando a validação do perfil falha", async () => {
    mocks.profile.mockReset().mockResolvedValue({
      data: null,
      error: new Error("Consulta de teste indisponível"),
    });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.processEmails).not.toHaveBeenCalled();
  });

  it.each(["23P01", "XX000"])(
    "não processa e-mails quando a criação falha com %s",
    async (code) => {
      mocks.created.mockResolvedValue({
        data: null,
        error: { code, message: "Detalhe interno do banco" },
      });
      const response = await POST(request());
      expect(response.status).toBe(409);
      expect(await response.text()).not.toContain("Detalhe interno");
      expect(mocks.insert).toHaveBeenCalledOnce();
      expect(mocks.processEmails).not.toHaveBeenCalled();
    },
  );

  it("processa uma única vez o ID criado e retorna um resumo sem dados internos", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: appointmentId,
      notification: { status: "sent", sent: 2, accepted: 2, failed: 0, skipped: 0, errors: 0 },
    });
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.processEmails).toHaveBeenCalledExactlyOnceWith(appointmentId);
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain("notifications");
    expect(mocks.created.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.processEmails.mock.invocationCallOrder[0]);
  });

  it("aguarda o processamento antes de encerrar a resposta", async () => {
    let complete!: (value: AppointmentEmailProcessingResult) => void;
    let started!: () => void;
    const processing = new Promise<AppointmentEmailProcessingResult>((resolve) => {
      complete = resolve;
    });
    const processingStarted = new Promise<void>((resolve) => { started = resolve; });
    mocks.processEmails.mockImplementation(() => {
      started();
      return processing;
    });
    let finished = false;
    const responsePromise = POST(request()).then((response) => {
      finished = true;
      return response;
    });

    await Promise.race([
      processingStarted,
      responsePromise.then(() => {
        throw new Error("A resposta terminou antes de iniciar o processamento.");
      }),
    ]);
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(finished).toBe(false);
    complete(processingResult(["sent"]));

    expect((await responsePromise).status).toBe(201);
    expect(finished).toBe(true);
    expect(mocks.processEmails).toHaveBeenCalledOnce();
  });

  it.each([
    { outcomes: ["failed"], expected: { status: "failed", sent: 0, accepted: 0, failed: 1, skipped: 0, errors: 0 } },
    { outcomes: ["sent", "failed"], expected: { status: "partial", sent: 1, accepted: 1, failed: 1, skipped: 0, errors: 0 } },
    { outcomes: ["sent", "skipped"], expected: { status: "partial", sent: 1, accepted: 1, failed: 0, skipped: 1, errors: 0 } },
  ] as const)("preserva a reserva quando o envio é $expected.status", async ({ outcomes, expected }) => {
    mocks.processEmails.mockResolvedValue(processingResult([...outcomes]));
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: appointmentId, notification: expected });
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.processEmails).toHaveBeenCalledExactlyOnceWith(appointmentId);
  });

  it("preserva sucesso e ID da reserva quando o processador lança exceção", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.processEmails.mockRejectedValue(new Error("Detalhe interno do provedor"));
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: appointmentId,
      notification: { status: "failed" },
    });
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.processEmails).toHaveBeenCalledExactlyOnceWith(appointmentId);
  });

  it.each([true, false])(
    "preserva a reserva e distingue erro de processamento de aceite do provedor: %s",
    async (accepted) => {
      const result = processingResult(["error"]);
      result.items[0].providerAccepted = accepted;
      result.items[0].recorded = false;
      mocks.processEmails.mockResolvedValue(result);
      const response = await POST(request());
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
        id: appointmentId,
        notification: {
          status: "failed", sent: 0, accepted: accepted ? 1 : 0,
          failed: 0, skipped: 0, errors: 1,
        },
      });
      expect(mocks.insert).toHaveBeenCalledOnce();
      expect(mocks.processEmails).toHaveBeenCalledExactlyOnceWith(appointmentId);
    },
  );

  it("não anuncia envio quando o e-mail está sem configuração", async () => {
    mocks.processEmails.mockResolvedValue(processingResult([], false));
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: appointmentId,
      notification: { status: "not_configured" },
    });
  });

  it.each([
    { outcomes: [] },
    { outcomes: ["skipped"] },
    { outcomes: ["cancelled"] },
    { outcomes: ["skipped", "cancelled"] },
  ] as const)(
    "não anuncia envio para fila vazia ou itens ignorados: $outcomes",
    async ({ outcomes }) => {
      mocks.processEmails.mockResolvedValue(processingResult([...outcomes]));
      const response = await POST(request());
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
        id: appointmentId,
        notification: { status: "skipped", sent: 0, accepted: 0, failed: 0, skipped: outcomes.length, errors: 0 },
      });
    },
  );
});

describe("caminho administrativo completo pela interface/serviço", () => {
  it.each(["sent", "failed", "error", "exception", "not_configured"] as const)(
    "retorna o ID com resultado %s sem disparar outro endpoint de notificações",
    async (outcome) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      if (outcome === "exception") {
        mocks.processEmails.mockRejectedValue(new Error("Falha interna simulada"));
      } else {
        mocks.processEmails.mockResolvedValue(
          processingResult(outcome === "not_configured" ? [] : [outcome], outcome !== "not_configured"),
        );
      }
      const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
        expect(url).toBe("/api/admin/appointments");
        return POST(new Request(new URL(String(url), "https://spa.example.test"), init));
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(createAdminAppointment(input)).resolves.toBe(appointmentId);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(mocks.getUser).toHaveBeenCalledExactlyOnceWith("token-test-only");
      expect(mocks.insert).toHaveBeenCalledOnce();
      expect(mocks.processEmails).toHaveBeenCalledExactlyOnceWith(appointmentId);
    },
  );
});
