import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ createAdmin: vi.fn(), getUser: vi.fn(), process: vi.fn() }));
vi.mock("../../../../lib/supabase/admin", () => ({ createAdminClient: mocks.createAdmin }));
vi.mock("../../../lib/server/appointment-email-processor", () => ({
  processAppointmentCreatedEmails: mocks.process,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "client" } }, error: null });
  mocks.createAdmin.mockReturnValue({
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data: table === "profiles"
            ? { id: "client", role: "client", active: true }
            : { id: "appointment", client_id: "client", professional_id: "professional" },
          error: null,
        }),
      };
      return query;
    },
  });
});

function request() {
  return new Request("https://spa.example.test/api/notifications/appointment", {
    method: "POST",
    headers: { Authorization: "Bearer token-test-only", "Content-Type": "application/json" },
    body: JSON.stringify({ appointmentId: "appointment" }),
  });
}

describe("resultados do processador no endpoint da cliente (somente mocks)", () => {
  it.each([
    { result: "sent", providerAccepted: true, recorded: true, ok: true },
    { result: "failed", providerAccepted: false, recorded: true, ok: false },
    { result: "error", providerAccepted: true, recorded: false, ok: false },
    { result: "error", providerAccepted: false, recorded: false, ok: false },
    { result: "skipped", providerAccepted: false, recorded: false, ok: true },
  ])("não confunde $result com sucesso integral (aceito=$providerAccepted)", async (item) => {
    const { ok, ...outcome } = item;
    mocks.process.mockResolvedValue({
      appointmentId: "appointment", configured: true, processed: item.result === "sent" ? 1 : 0,
      items: [{ notificationId: "notification", ...outcome }],
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok,
      result: { items: [outcome] },
    });
    expect(mocks.process).toHaveBeenCalledExactlyOnceWith("appointment");
  });

  it("preserva o resultado sem configuração e não o anuncia como envio", async () => {
    mocks.process.mockResolvedValue({
      appointmentId: "appointment", configured: false, processed: 0, items: [],
    });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ result: { configured: false, processed: 0 } });
  });
});
