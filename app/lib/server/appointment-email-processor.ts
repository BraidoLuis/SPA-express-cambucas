import "server-only";

import { createAdminClient } from "../../../lib/supabase/admin";
import {
  getResendClient,
  getResendFromEmail,
  isResendConfigured,
} from "./resend";

type AppointmentNotificationType =
  | "appointment_created"
  | "appointment_cancelled"
  | "appointment_reminder";

type EmailQueueRow = {
  id: string;
  recipient_id: string;
  notification_type: AppointmentNotificationType;
  status:
    | "pending"
    | "processing"
    | "sent"
    | "failed"
    | "cancelled";
  attempts: number;
};

type NotificationPreferences = {
  email_enabled: boolean;
  new_appointment: boolean;
  cancellation: boolean;
  reminder: boolean;
};

type GlobalNotificationSettings = {
  clientEmail?: boolean | null;
  professionalEmail?: boolean | null;
  newAppointment?: boolean | null;
  cancellation?: boolean | null;
  reminder?: boolean | null;
};

type ProcessingItem = {
  notificationId: string;
  recipientId: string;
  notificationType: AppointmentNotificationType;
  audience:
    | "client"
    | "professional"
    | "unknown";
  result:
    | "sent"
    | "failed"
    | "cancelled"
    | "skipped"
    | "error";
  providerId?: string;
  providerAccepted?: boolean;
  // Confirmação da atualização no banco, não apenas ausência de erro.
  recorded?: boolean;
  message?: string;
};

export type AppointmentEmailProcessingResult = {
  appointmentId: string;
  configured: boolean;
  processed: number;
  items: ProcessingItem[];
};

type NotificationUpdate = {
  status: EmailQueueRow["status"];
  attempts?: number;
  provider_id?: string | null;
  error_message: string | null;
  sent_at?: string | null;
};

// status + attempts identificam a fotografia reservada, sem usar timestamps como lease.
async function updateNotification(
  supabase: ReturnType<typeof createAdminClient>,
  expected: Pick<EmailQueueRow, "id" | "status" | "attempts">,
  update: NotificationUpdate,
): Promise<"updated" | "stale" | "error"> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .update(update)
      .eq("id", expected.id)
      .eq("status", expected.status)
      .eq("attempts", expected.attempts)
      .select("id,status,attempts")
      .maybeSingle();

    if (error) return "error";
    if (!data) return "stale";
    if (
      data.id !== expected.id ||
      data.status !== update.status ||
      data.attempts !== (update.attempts ?? expected.attempts)
    ) return "error";

    return "updated";
  } catch {
    return "error";
  }
}

const SPA_LOGO_URL =
  "https://spaexpresscambucas.com.br/logo-spa.png";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message.slice(0, 500);
  }

  return "Não foi possível enviar o e-mail.";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatAppointmentDate(
  value: string,
): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function processAppointmentEmails(
  appointmentId: string,
): Promise<AppointmentEmailProcessingResult> {
  const result: AppointmentEmailProcessingResult = {
    appointmentId,
    configured: isResendConfigured(),
    processed: 0,
    items: [],
  };

  if (!result.configured) {
    return result;
  }

  const supabase = createAdminClient();

  const {
    data: appointment,
    error: appointmentError,
  } = await supabase
    .from("appointments")
    .select(`
      id,
      start_at,
      end_at,
      status,
      cancellation_reason,
      client_id,
      client_name,
      client_email,
      professional_id,
      service_id
    `)
    .eq("id", appointmentId)
    .maybeSingle();

  if (appointmentError) {
    throw new Error(
      `Não foi possível consultar o agendamento: ${appointmentError.message}`,
    );
  }

  if (!appointment) {
    throw new Error(
      "Agendamento não encontrado.",
    );
  }

  const [
    clientResult,
    professionalResult,
    serviceResult,
    paymentResult,
    professionalServiceResult,
    settingsResult,
    queueResult,
  ] = await Promise.all([
    appointment.client_id
      ? supabase
          .from("profiles")
          .select("id,full_name,email")
          .eq("id", appointment.client_id)
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null,
        }),

    supabase
      .from("professionals")
      .select(
        "id,profile_id,display_name",
      )
      .eq("id", appointment.professional_id)
      .maybeSingle(),

    supabase
      .from("services")
      .select(
        "id,name,price,duration_minutes",
      )
      .eq("id", appointment.service_id)
      .maybeSingle(),

    supabase
      .from("payments")
      .select("amount,status")
      .eq(
        "appointment_id",
        appointment.id,
      )
      .maybeSingle(),

    supabase
      .from("professional_services")
      .select(
        "custom_price,custom_duration_minutes",
      )
      .eq(
        "professional_id",
        appointment.professional_id,
      )
      .eq(
        "service_id",
        appointment.service_id,
      )
      .maybeSingle(),

    supabase
      .from("spa_settings")
      .select("notifications")
      .eq("id", true)
      .maybeSingle(),

    supabase
      .from("notifications")
      .select(`
        id,
        recipient_id,
        notification_type,
        status,
        attempts
      `)
      .eq(
        "appointment_id",
        appointment.id,
      )
      .eq("channel", "email")
      .in("notification_type", [
        "appointment_created",
        "appointment_cancelled",
        "appointment_reminder",
      ])
      .in("status", [
        "pending",
        "failed",
      ])
      .lt("attempts", 3),
  ]);

  if (clientResult.error) {
    throw new Error(
      `Não foi possível consultar a cliente: ${clientResult.error.message}`,
    );
  }

  if (professionalResult.error) {
    throw new Error(
      `Não foi possível consultar a profissional: ${professionalResult.error.message}`,
    );
  }

  if (serviceResult.error) {
    throw new Error(
      `Não foi possível consultar o serviço: ${serviceResult.error.message}`,
    );
  }

  if (paymentResult.error) {
    throw new Error(
      `Não foi possível consultar o pagamento: ${paymentResult.error.message}`,
    );
  }

  if (professionalServiceResult.error) {
    throw new Error(
      `Não foi possível consultar os dados do serviço: ${professionalServiceResult.error.message}`,
    );
  }

  if (settingsResult.error) {
    throw new Error(
      `Não foi possível consultar as configurações: ${settingsResult.error.message}`,
    );
  }

  if (queueResult.error) {
    throw new Error(
      `Não foi possível consultar a fila de e-mails: ${queueResult.error.message}`,
    );
  }

  const client = clientResult.data;
  const professional =
    professionalResult.data;
  const service = serviceResult.data;

  if (!professional || !service) {
    throw new Error(
      "O agendamento não possui os dados necessários para o e-mail.",
    );
  }

  const professionalProfileResult =
    professional.profile_id
      ? await supabase
          .from("profiles")
          .select("id,full_name,email")
          .eq(
            "id",
            professional.profile_id,
          )
          .maybeSingle()
      : {
          data: null,
          error: null,
        };

  if (professionalProfileResult.error) {
    throw new Error(
      `Não foi possível consultar o perfil profissional: ${professionalProfileResult.error.message}`,
    );
  }

  const professionalProfile =
    professionalProfileResult.data;

  const globalSettings =
    settingsResult.data?.notifications as
      | GlobalNotificationSettings
      | undefined;

  const queue =
    (queueResult.data ?? []) as EmailQueueRow[];

  const appointmentDate =
    formatAppointmentDate(
      appointment.start_at,
    );

  const duration = Number(
    professionalServiceResult.data
      ?.custom_duration_minutes ??
      service.duration_minutes,
  );

  const price = Number(
    paymentResult.data?.amount ??
      professionalServiceResult.data
        ?.custom_price ??
      service.price,
  );

  const clientName =
    client?.full_name?.trim() ||
    appointment.client_name?.trim() ||
    "Cliente";

  const resend = getResendClient();
  const from = getResendFromEmail();

  for (const notification of queue) {
    const isClient =
      appointment.client_id !== null &&
      notification.recipient_id ===
        appointment.client_id;

    const isProfessional =
      professionalProfile?.id ===
      notification.recipient_id;

    const audience:
      ProcessingItem["audience"] =
      isClient
        ? "client"
        : isProfessional
          ? "professional"
          : "unknown";

    const item = {
      notificationId: notification.id,
      recipientId: notification.recipient_id,
      notificationType: notification.notification_type,
      audience,
    };

    async function finishQueuedNotification(
      status: "failed" | "cancelled",
      message: string,
    ) {
      const updated = await updateNotification(supabase, notification, {
        status,
        attempts: status === "failed" ? notification.attempts + 1 : notification.attempts,
        error_message: status === "failed" ? message : null,
      });
      result.items.push({
        ...item,
        result: updated === "updated" ? status : updated === "stale" ? "skipped" : "error",
        providerAccepted: false,
        recorded: updated === "updated",
        message: updated === "updated" ? message : updated === "stale"
          ? "A notificação foi alterada por outra execução."
          : "Não foi possível registrar o resultado da notificação.",
      });
    }

    if (audience === "unknown") {
      await finishQueuedNotification("failed", "Destinatário da notificação não reconhecido.");
      continue;
    }

    const recipient = isClient
      ? {
          full_name: clientName,
          email:
            client?.email ||
            appointment.client_email ||
            "",
        }
      : {
          full_name:
            professionalProfile?.full_name ||
            professional.display_name,
          email:
            professionalProfile?.email ||
            "",
        };

    const isCreated =
      notification.notification_type ===
      "appointment_created";

    const isCancellation =
      notification.notification_type ===
      "appointment_cancelled";

    const isReminder =
      notification.notification_type ===
      "appointment_reminder";

    /*
     * Impede e-mails antigos ou incompatíveis
     * com o estado atual do agendamento.
     */
    const eventStillValid = isCreated
      ? ["pending", "confirmed"].includes(
          String(appointment.status),
        )
      : isCancellation
        ? appointment.status === "cancelled"
        : isReminder
          ? ["pending", "confirmed"].includes(
              String(appointment.status),
            ) &&
            new Date(
              appointment.start_at,
            ).getTime() > Date.now()
          : false;

    if (!eventStillValid) {
      await finishQueuedNotification(
        "cancelled",
        "O estado atual do agendamento não corresponde mais à notificação.",
      );
      continue;
    }

    const {
      data: storedPreferences,
      error: preferencesError,
    } = await supabase
      .from("notification_preferences")
      .select(`
        email_enabled,
        new_appointment,
        cancellation,
        reminder
      `)
      .eq(
        "profile_id",
        notification.recipient_id,
      )
      .maybeSingle();

    if (preferencesError) {
      result.items.push({
        ...item,
        result: "error",
        providerAccepted: false,
        recorded: false,
        message: "Não foi possível consultar as preferências de e-mail.",
      });
      continue;
    }

    const preferences:
      NotificationPreferences = {
      email_enabled:
        storedPreferences?.email_enabled ??
        true,
      new_appointment:
        storedPreferences
          ?.new_appointment ?? true,
      cancellation:
        storedPreferences?.cancellation ??
        true,
      reminder:
        storedPreferences?.reminder ??
        true,
    };

    const channelEnabled =
      audience === "client"
        ? globalSettings?.clientEmail ===
          true
        : globalSettings
              ?.professionalEmail === true;

    const eventEnabled = isCreated
      ? globalSettings
            ?.newAppointment !== false &&
        preferences.new_appointment
      : isCancellation
        ? globalSettings?.cancellation !==
            false &&
          preferences.cancellation
        : isReminder
          ? globalSettings?.reminder ===
              true &&
            preferences.reminder
          : false;

    if (!channelEnabled || !eventEnabled || !preferences.email_enabled) {
      await finishQueuedNotification("cancelled", "Envio desativado nas preferências.");
      continue;
    }

    if (!recipient.email.trim()) {
      await finishQueuedNotification("failed", "Destinatário sem endereço de e-mail.");
      continue;
    }

    const nextAttempt = notification.attempts + 1;
    const claim = await updateNotification(supabase, notification, {
      status: "processing",
      attempts: nextAttempt,
      error_message: null,
    });

    if (claim !== "updated") {
      result.items.push({
        ...item,
        result: claim === "stale" ? "skipped" : "error",
        providerAccepted: false,
        recorded: false,
        message: claim === "stale"
          ? "A notificação foi alterada por outra execução."
          : "Não foi possível reservar a notificação.",
      });
      continue;
    }

    const claimedAttempt = {
      id: notification.id,
      status: "processing" as const,
      attempts: nextAttempt,
    };

    const title = isCancellation
      ? audience === "client"
        ? "Seu agendamento foi cancelado"
        : "Agendamento cancelado"
      : isReminder
        ? audience === "client"
          ? "Lembrete do seu agendamento"
          : "Lembrete da sua agenda"
        : audience === "client"
          ? "Seu agendamento está confirmado"
          : "Novo agendamento na sua agenda";

    const description = isCancellation
      ? audience === "client"
        ? `${service.name} com ${professional.display_name} foi cancelado.`
        : `O agendamento de ${clientName} para ${service.name} foi cancelado.`
      : isReminder
        ? audience === "client"
          ? `Seu atendimento de ${service.name} com ${professional.display_name} está se aproximando.`
          : `Você tem um atendimento de ${clientName} para ${service.name} se aproximando.`
        : audience === "client"
          ? `${service.name} com ${professional.display_name}.`
          : `${clientName} agendou ${service.name}.`;

    const closingMessage = isCancellation
      ? audience === "client"
        ? "Se desejar, acesse sua conta para escolher um novo horário."
        : "O horário foi liberado novamente na sua agenda."
      : isReminder
        ? audience === "client"
          ? "Estamos te esperando no SPA Express Cambucás."
          : "Consulte sua agenda para conferir todos os detalhes do atendimento."
        : "O pagamento será realizado diretamente no local.";

    const cancellationReason =
      isCancellation
        ? appointment.cancellation_reason?.trim()
        : "";

    const reasonHtml =
      cancellationReason
        ? `
          <p style="margin:0">
            <strong>Motivo:</strong>
            ${escapeHtml(cancellationReason)}
          </p>
        `
        : "";

    const html = `
      <div style="margin:0;background:#fbf5f9;padding:32px 16px;font-family:Arial,sans-serif;color:#3b2538">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #eadbe6;border-radius:20px;padding:32px">

          <div style="margin:0 0 24px;text-align:center">
            <img
              src="${escapeHtml(SPA_LOGO_URL)}"
              alt="SPA Express Cambucás"
              width="160"
              style="display:block;width:160px;max-width:100%;height:auto;margin:0 auto;border:0"
            />
          </div>

          <h1 style="margin:0 0 20px;color:#5f1f58;font-size:28px;line-height:1.2;text-align:center">
            ${escapeHtml(title)}
          </h1>

          <p style="margin:0 0 16px;font-size:16px;line-height:1.6">
            Olá, ${escapeHtml(recipient.full_name)}.
          </p>

          <p style="margin:0 0 24px;font-size:16px;line-height:1.6">
            ${escapeHtml(description)}
          </p>

          <div style="margin:0 0 24px;background:#f8eff6;border-radius:14px;padding:20px">
            <p style="margin:0 0 10px">
              <strong>Serviço:</strong>
              ${escapeHtml(service.name)}
            </p>

            <p style="margin:0 0 10px">
              <strong>Profissional:</strong>
              ${escapeHtml(
                professional.display_name,
              )}
            </p>

            <p style="margin:0 0 10px">
              <strong>Data:</strong>
              ${escapeHtml(appointmentDate)}
            </p>

            <p style="margin:0 0 10px">
              <strong>Duração:</strong>
              ${escapeHtml(duration)} minutos
            </p>

            <p style="${
              cancellationReason
                ? "margin:0 0 10px"
                : "margin:0"
            }">
              <strong>Valor:</strong>
              ${escapeHtml(
                formatCurrency(price),
              )}
            </p>

            ${reasonHtml}
          </div>

          <p style="margin:0;font-size:14px;line-height:1.6;color:#6f596b">
            ${escapeHtml(closingMessage)}
          </p>
        </div>
      </div>
    `;

    const text = [
      "SPA Express Cambucás",
      "",
      title,
      "",
      `Olá, ${recipient.full_name}.`,
      description,
      "",
      `Serviço: ${service.name}`,
      `Profissional: ${professional.display_name}`,
      `Data: ${appointmentDate}`,
      `Duração: ${duration} minutos`,
      `Valor: ${formatCurrency(price)}`,
      cancellationReason
        ? `Motivo: ${cancellationReason}`
        : "",
      "",
      closingMessage,
    ]
      .filter(Boolean)
      .join("\n");

    const idempotencyPrefix =
      isCancellation
        ? "appointment-cancelled"
        : isReminder
          ? "appointment-reminder"
          : "appointment-created";

    let providerId: string;
    try {
      const { data: emailData, error: emailError } = await resend.emails.send(
        {
          from,
          to: [recipient.email.trim()],
          subject: title,
          html,
          text,
        },
        { idempotencyKey: `${idempotencyPrefix}/${notification.id}` },
      );

      if (emailError) throw emailError;
      if (typeof emailData?.id !== "string" || !emailData.id.trim()) {
        result.items.push({
          ...item,
          result: "error",
          recorded: false,
          message: "O provedor não retornou a identificação do envio.",
        });
        continue;
      }
      providerId = emailData.id;
    } catch (error) {
      const updated = await updateNotification(supabase, claimedAttempt, {
        status: "failed",
        error_message: errorMessage(error),
        sent_at: null,
      });
      result.items.push({
        ...item,
        result: updated === "updated" ? "failed" : "error",
        providerAccepted: false,
        recorded: updated === "updated",
        message: updated === "updated"
          ? "O provedor não confirmou o envio."
          : "O envio falhou, mas o banco não confirmou o registro da falha.",
      });
      continue;
    }

    // O aceite já ocorreu. Uma falha de registro não pode voltar a fila para failed.
    const updated = await updateNotification(supabase, claimedAttempt, {
      status: "sent",
      provider_id: providerId,
      error_message: null,
      sent_at: new Date().toISOString(),
    });
    if (updated === "updated") result.processed += 1;
    result.items.push({
      ...item,
      result: updated === "updated" ? "sent" : "error",
      providerId,
      providerAccepted: true,
      recorded: updated === "updated",
      ...(updated === "updated" ? {} : {
        message: "O provedor aceitou o e-mail, mas o banco não confirmou o registro do envio.",
      }),
    });
  }

  return result;
}

/*
 * Mantém compatibilidade com a rota
 * já utilizada por confirmação e
 * cancelamento.
 */
export async function processAppointmentCreatedEmails(
  appointmentId: string,
): Promise<AppointmentEmailProcessingResult> {
  return processAppointmentEmails(
    appointmentId,
  );
}