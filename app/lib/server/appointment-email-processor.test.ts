import { beforeEach, describe, expect, it, vi } from "vitest";
import { processAppointmentCreatedEmails, processAppointmentEmails } from "./appointment-email-processor";

const mocks = vi.hoisted(() => ({
  createAdmin: vi.fn(), configured: vi.fn(), send: vi.fn(), read: vi.fn(), update: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../../lib/supabase/admin", () => ({ createAdminClient: mocks.createAdmin }));
vi.mock("./resend", () => ({
  isResendConfigured: mocks.configured,
  getResendClient: () => ({ emails: { send: mocks.send } }),
  getResendFromEmail: () => "SPA <sender@example.test>",
}));

type Row = Record<string, unknown>;
type Filter = { field: string; op: "eq" | "in" | "lt"; value: unknown };
type Query = { table: string; filters: Filter[]; values: Row | null; selection?: string };
type DbResult = { data: unknown; error: { message: string } | null };
type EmailResponse = { data: { id: string } | null; error: { message: string } | null };
let notification: Row;
let appointment: Row;
let client: Row;
let preferences: Row;
let settings: Row;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function matches(row: Row, filters: Filter[]) {
  return filters.every(({ field, op, value }) => {
    if (op === "eq") return row[field] === value;
    if (op === "in") return (value as unknown[]).includes(row[field]);
    return Number(row[field]) < Number(value);
  });
}

function applyUpdate(query: Query): DbResult {
  if (!matches(notification, query.filters)) return { data: null, error: null };
  Object.assign(notification, query.values);
  return { data: { ...notification }, error: null };
}

function read(query: Query): DbResult {
  const data: Record<string, unknown> = {
    appointments: appointment,
    profiles: query.filters.some((filter) => filter.value === "professional-profile")
      ? { id: "professional-profile", full_name: "Profissional", email: "professional@example.test" }
      : client,
    professionals: { id: "professional", profile_id: "professional-profile", display_name: "Profissional" },
    services: { id: "service", name: "Serviço", price: 100, duration_minutes: 60 },
    payments: { amount: 100, status: "pending" },
    professional_services: { custom_price: null, custom_duration_minutes: null },
    spa_settings: { notifications: settings },
    notification_preferences: preferences,
    notifications: matches(notification, query.filters) ? [{ ...notification }] : [],
  };
  if (!(query.table in data)) throw new Error("Tabela inesperada: " + query.table);
  return { data: data[query.table], error: null };
}

function queryBuilder(table: string) {
  const query: Query = { table, filters: [], values: null };
  let execution: Promise<DbResult> | undefined;
  const execute = () => {
    execution ??= Promise.resolve().then(() =>
      query.values ? mocks.update(query) : mocks.read(query),
    );
    return execution;
  };
  const builder = {
    select: (fields: string) => { query.selection = fields; return builder; },
    eq: (field: string, value: unknown) => {
      query.filters.push({ field, op: "eq", value }); return builder;
    },
    in: (field: string, value: unknown[]) => {
      query.filters.push({ field, op: "in", value }); return builder;
    },
    lt: (field: string, value: number) => {
      query.filters.push({ field, op: "lt", value }); return builder;
    },
    update: (values: Row) => { query.values = values; return builder; },
    maybeSingle: execute,
    then: (resolve: (value: DbResult) => unknown, reject: (reason: unknown) => unknown) =>
      execute().then(resolve, reject),
  };
  return builder;
}

beforeEach(() => {
  vi.resetAllMocks();
  notification = {
    id: "notification", appointment_id: "appointment", recipient_id: "client",
    notification_type: "appointment_created", channel: "email", status: "pending",
    attempts: 0, provider_id: null, error_message: null, sent_at: null,
  };
  appointment = {
    id: "appointment", client_id: "client", client_name: "Cliente",
    client_email: "client@example.test", professional_id: "professional", service_id: "service",
    start_at: "2099-01-15T13:00:00.000Z", end_at: "2099-01-15T14:00:00.000Z",
    status: "confirmed", cancellation_reason: null,
  };
  client = { id: "client", full_name: "Cliente", email: "client@example.test" };
  preferences = { email_enabled: true, new_appointment: true, cancellation: true, reminder: true };
  settings = { clientEmail: true, professionalEmail: true, newAppointment: true, cancellation: true, reminder: true };
  mocks.configured.mockReturnValue(true);
  mocks.createAdmin.mockReturnValue({ from: queryBuilder });
  mocks.read.mockImplementation(read);
  mocks.update.mockImplementation(applyUpdate);
  mocks.send.mockResolvedValue({ data: { id: "provider-id" }, error: null });
});

describe("reserva e identidade da tentativa de e-mail", () => {
  it("não acessa banco ou provedor quando o e-mail não está configurado", async () => {
    mocks.configured.mockReturnValue(false);
    expect(await processAppointmentEmails("appointment")).toEqual({
      appointmentId: "appointment", configured: false, processed: 0, items: [],
    });
    expect(mocks.createAdmin).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("duas execuções com a mesma fotografia da fila enviam apenas uma vez", async () => {
    const releaseQueue = deferred<void>();
    const sendStarted = deferred<void>();
    const email = deferred<EmailResponse>();
    let queueReads = 0;
    mocks.read.mockImplementation(async (query: Query) => {
      const response = read(query);
      if (query.table === "notifications") {
        queueReads += 1;
        if (queueReads === 2) releaseQueue.resolve();
        await releaseQueue.promise;
      }
      return response;
    });
    mocks.send.mockImplementation(() => {
      sendStarted.resolve();
      return email.promise;
    });

    const first = processAppointmentEmails("appointment");
    const second = processAppointmentEmails("appointment");
    await sendStarted.promise;
    const loser = await second;
    expect(loser.items[0]).toMatchObject({ result: "skipped", recorded: false });
    expect(notification).toMatchObject({ status: "processing", attempts: 1 });
    expect(mocks.send).toHaveBeenCalledOnce();

    email.resolve({ data: { id: "provider-id" }, error: null });
    expect((await first).items[0]).toMatchObject({
      result: "sent", providerAccepted: true, recorded: true,
    });
    expect(notification).toMatchObject({ status: "sent", attempts: 1 });
  });

  it("uma fotografia antiga não pode reservar uma tentativa depois de outra já falhar", async () => {
    notification.status = "failed";
    notification.attempts = 1;
    const staleReadStarted = deferred<void>();
    const releaseStaleRead = deferred<void>();
    let queueReads = 0;
    mocks.read.mockImplementation(async (query: Query) => {
      const response = read(query);
      if (query.table === "notifications" && ++queueReads === 1) {
        staleReadStarted.resolve();
        await releaseStaleRead.promise;
      }
      return response;
    });
    mocks.send.mockResolvedValue({ data: null, error: { message: "Provedor rejeitou" } });
    const stale = processAppointmentEmails("appointment");
    await staleReadStarted.promise;
    const current = await processAppointmentEmails("appointment");
    expect(current.items[0].result).toBe("failed");
    expect(notification).toMatchObject({ status: "failed", attempts: 2 });

    releaseStaleRead.resolve();
    expect((await stale).items[0].result).toBe("skipped");
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(notification.attempts).toBe(2);
  });

  it.each(["error", "throw", "zero"] as const)("não envia se a reserva retorna %s", async (failure) => {
    mocks.update.mockImplementation((query: Query) => {
      if (query.values?.status === "processing") {
        if (failure === "throw") throw new Error("Banco indisponível");
        return { data: null, error: failure === "error" ? { message: "Banco indisponível" } : null };
      }
      return applyUpdate(query);
    });
    const result = await processAppointmentEmails("appointment");
    expect(result.processed).toBe(0);
    expect(result.items[0]).toMatchObject({
      result: failure === "zero" ? "skipped" : "error", recorded: false,
    });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(notification).toMatchObject({ status: "pending", attempts: 0 });
  });

  it.each([true, false])("a finalização antiga não altera uma tentativa mais recente (aceito=%s)", async (accepted) => {
    const sendStarted = deferred<void>();
    const email = deferred<EmailResponse>();
    mocks.send.mockImplementation(() => { sendStarted.resolve(); return email.promise; });
    const processing = processAppointmentEmails("appointment");
    await sendStarted.promise;
    // Simula outra tentativa iniciada por um ator externo; não implementa recuperação.
    notification.attempts = 2;
    email.resolve(accepted
      ? { data: { id: "provider-id" }, error: null }
      : { data: null, error: { message: "Rejeitado" } });
    const result = await processing;
    expect(result.processed).toBe(0);
    expect(result.items[0]).toMatchObject({
      result: "error", providerAccepted: accepted, recorded: false,
    });
    expect(notification).toMatchObject({ status: "processing", attempts: 2, provider_id: null });
  });
});

describe("resultados confirmados no banco e aceitos pelo provedor", () => {
  it.each([
    ["appointment_created", "confirmed", "appointment-created"],
    ["appointment_cancelled", "cancelled", "appointment-cancelled"],
    ["appointment_reminder", "confirmed", "appointment-reminder"],
  ])("preserva o evento %s e sua chave de idempotência", async (type, status, prefix) => {
    notification.notification_type = type;
    appointment.status = status;
    const result = await processAppointmentCreatedEmails("appointment");
    expect(result.processed).toBe(1);
    expect(result.items[0]).toMatchObject({
      result: "sent", providerAccepted: true, recorded: true, providerId: "provider-id",
    });
    expect(mocks.send).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey: prefix + "/notification",
    });
    expect(notification).toMatchObject({ status: "sent", attempts: 1, provider_id: "provider-id" });
  });

  it.each(["error", "throw", "zero"] as const)(
    "aceite do provedor seguido de %s no banco não vira falha de envio ou retry",
    async (failure) => {
      mocks.update.mockImplementation((query: Query) => {
        if (query.values?.status === "sent") {
          if (failure === "throw") throw new Error("Falha de registro");
          return { data: null, error: failure === "error" ? { message: "Falha de registro" } : null };
        }
        return applyUpdate(query);
      });
      const result = await processAppointmentEmails("appointment");
      expect(result.processed).toBe(0);
      expect(result.items[0]).toMatchObject({
        result: "error", providerAccepted: true, recorded: false, providerId: "provider-id",
      });
      expect(notification).toMatchObject({ status: "processing", attempts: 1 });
      expect(mocks.update.mock.calls.some(([query]) => query.values.status === "failed")).toBe(false);

      expect((await processAppointmentEmails("appointment")).items).toEqual([]);
      expect(mocks.send).toHaveBeenCalledOnce();
    },
  );

  it("uma rejeição do provedor só é anunciada como failed depois de gravar", async () => {
    mocks.send.mockResolvedValue({ data: null, error: { message: "Envio rejeitado" } });
    const result = await processAppointmentEmails("appointment");
    expect(result.processed).toBe(0);
    expect(result.items[0]).toMatchObject({ result: "failed", providerAccepted: false, recorded: true });
    expect(notification).toMatchObject({ status: "failed", attempts: 1, sent_at: null });
  });

  it.each(["error", "throw", "zero"] as const)("não anuncia failed se o registro do erro retorna %s", async (failure) => {
    mocks.send.mockRejectedValue(new Error("Envio rejeitado"));
    mocks.update.mockImplementation((query: Query) => {
      if (query.values?.status === "failed") {
        if (failure === "throw") throw new Error("Falha ao registrar erro");
        return { data: null, error: failure === "error" ? { message: "Falha ao registrar erro" } : null };
      }
      return applyUpdate(query);
    });
    const result = await processAppointmentEmails("appointment");
    expect(result.items[0]).toMatchObject({ result: "error", providerAccepted: false, recorded: false });
    expect(notification.status).toBe("processing");
  });

  it("mantém a chave de idempotência na segunda tentativa legítima", async () => {
    mocks.send.mockResolvedValueOnce({ data: null, error: { message: "Falha temporária" } });
    await processAppointmentEmails("appointment");
    await processAppointmentEmails("appointment");
    expect(mocks.send.mock.calls.map(([, options]) => options.idempotencyKey))
      .toEqual(["appointment-created/notification", "appointment-created/notification"]);
    expect(notification).toMatchObject({ status: "sent", attempts: 2 });
  });

  it("confere o estado e a tentativa devolvidos pelo banco", async () => {
    mocks.update.mockImplementation((query: Query) => {
      const response = applyUpdate(query);
      return query.values?.status === "sent"
        ? { data: { ...(response.data as Row), attempts: 99 }, error: null }
        : response;
    });
    const result = await processAppointmentEmails("appointment");
    expect(result.processed).toBe(0);
    expect(result.items[0]).toMatchObject({ result: "error", providerAccepted: true, recorded: false });
  });
});

describe("preferências, destinatários e cancelamento condicional", () => {
  it.each(["email", "event", "global"] as const)("não envia quando %s está desativado", async (disabled) => {
    if (disabled === "email") preferences.email_enabled = false;
    if (disabled === "event") preferences.new_appointment = false;
    if (disabled === "global") settings.clientEmail = false;
    const result = await processAppointmentEmails("appointment");
    expect(result.items[0]).toMatchObject({ result: "cancelled", recorded: true, providerAccepted: false });
    expect(notification).toMatchObject({ status: "cancelled", attempts: 0 });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(["error", "throw", "zero"] as const)("não anuncia cancelamento se o banco retorna %s", async (failure) => {
    preferences.email_enabled = false;
    mocks.update.mockImplementation(() => {
      if (failure === "throw") throw new Error("Falha no cancelamento");
      return { data: null, error: failure === "error" ? { message: "Falha no cancelamento" } : null };
    });
    const result = await processAppointmentEmails("appointment");
    expect(result.items[0]).toMatchObject({
      result: failure === "zero" ? "skipped" : "error", recorded: false,
    });
    expect(notification.status).toBe("pending");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("cancela uma confirmação incompatível somente após confirmar a atualização", async () => {
    appointment.status = "cancelled";
    const result = await processAppointmentEmails("appointment");
    expect(result.items[0]).toMatchObject({ result: "cancelled", recorded: true });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(["unknown", "missing_email"] as const)("registra falha sem envio para %s", async (invalid) => {
    if (invalid === "unknown") notification.recipient_id = "unknown";
    else { client.email = ""; appointment.client_email = ""; }
    const result = await processAppointmentEmails("appointment");
    expect(result.items[0]).toMatchObject({ result: "failed", recorded: true, providerAccepted: false });
    expect(notification).toMatchObject({ status: "failed", attempts: 1 });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(["unknown", "missing_email", "disabled"] as const)(
    "uma decisão antiga de %s não sobrescreve quem já reservou",
    async (invalid) => {
      if (invalid === "unknown") notification.recipient_id = "unknown";
      if (invalid === "missing_email") { client.email = ""; appointment.client_email = ""; }
      if (invalid === "disabled") preferences.email_enabled = false;
      const queueRead = deferred<void>();
      const releaseRead = deferred<void>();
      mocks.read.mockImplementation(async (query: Query) => {
        const response = read(query);
        if (query.table === "notifications") {
          queueRead.resolve();
          await releaseRead.promise;
        }
        return response;
      });
      const processing = processAppointmentEmails("appointment");
      await queueRead.promise;
      notification.status = "processing";
      notification.attempts = 1;
      releaseRead.resolve();
      expect((await processing).items[0]).toMatchObject({ result: "skipped", recorded: false });
      expect(notification).toMatchObject({ status: "processing", attempts: 1 });
      expect(mocks.send).not.toHaveBeenCalled();
    },
  );

  it("trata erro de preferências como erro de processamento sem enviar ou reservar", async () => {
    mocks.read.mockImplementation((query: Query) => query.table === "notification_preferences"
      ? { data: null, error: { message: "Falha de preferências" } } : read(query));
    const result = await processAppointmentEmails("appointment");
    expect(result.items[0]).toMatchObject({ result: "error", recorded: false, providerAccepted: false });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe("respostas incompletas do provedor e falhas parciais do lote", () => {
  it("não confirma envio nem registra rejeição quando a resposta não identifica o e-mail", async () => {
    mocks.send.mockResolvedValue({ data: null, error: null });
    const result = await processAppointmentEmails("appointment");
    expect(result.processed).toBe(0);
    expect(result.items[0]).toMatchObject({ result: "error", recorded: false });
    expect(result.items[0].providerAccepted).toBeUndefined();
    expect(notification).toMatchObject({ status: "processing", attempts: 1 });
    expect(mocks.update.mock.calls.map(([query]) => query.values.status)).toEqual(["processing"]);
  });

  it("uma falha de registro não impede o próximo e-mail do lote", async () => {
    const second: Row = { ...notification, id: "notification-2" };
    mocks.read.mockImplementation((query: Query) => query.table === "notifications"
      ? { data: [notification, second].filter((row) => matches(row, query.filters)).map((row) => ({ ...row })), error: null }
      : read(query));
    mocks.update.mockImplementation((query: Query) => {
      const id = query.filters.find((filter) => filter.field === "id")?.value;
      if (id === "notification" && query.values?.status === "sent") {
        return { data: null, error: { message: "Registro indisponível" } };
      }
      const row = id === "notification-2" ? second : notification;
      if (!matches(row, query.filters)) return { data: null, error: null };
      Object.assign(row, query.values);
      return { data: { ...row }, error: null };
    });
    const result = await processAppointmentEmails("appointment");
    expect(result.processed).toBe(1);
    expect(result.items.map((item) => ({
      result: item.result, providerAccepted: item.providerAccepted, recorded: item.recorded,
    }))).toEqual([
      { result: "error", providerAccepted: true, recorded: false },
      { result: "sent", providerAccepted: true, recorded: true },
    ]);
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(notification.status).toBe("processing");
    expect(second.status).toBe("sent");
  });
});
