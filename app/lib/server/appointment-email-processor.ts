import "server-only";

import { createAdminClient } from "../../../lib/supabase/admin";
import {
  getResendClient,
  getResendFromEmail,
  isResendConfigured,
} from "./resend";

type EmailQueueRow = {
  id: string;
  recipient_id: string;
  status: "pending" | "processing" | "sent" | "failed" | "cancelled";
  attempts: number;
};

type NotificationPreferences = {
  email_enabled: boolean;
  new_appointment: boolean;
};

type GlobalNotificationSettings = {
  clientEmail?: boolean | null;
  professionalEmail?: boolean | null;
  newAppointment?: boolean | null;
};

type ProcessingItem = {
  notificationId: string;
  recipientId: string;
  audience: "client" | "professional" | "unknown";
  result: "sent" | "failed" | "cancelled" | "skipped";
  providerId?: string;
  message?: string;
};

export type AppointmentEmailProcessingResult = {
  appointmentId: string;
  configured: boolean;
  processed: number;
  items: ProcessingItem[];
};

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

function formatAppointmentDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function processAppointmentCreatedEmails(
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

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select(
      "id,start_at,end_at,client_id,professional_id,service_id",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (appointmentError) {
    throw new Error(
      `Não foi possível consultar o agendamento: ${appointmentError.message}`,
    );
  }

  if (!appointment) {
    throw new Error("Agendamento não encontrado.");
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
      : Promise.resolve({ data: null, error: null }),

    supabase
      .from("professionals")
      .select("id,profile_id,display_name")
      .eq("id", appointment.professional_id)
      .maybeSingle(),

    supabase
      .from("services")
      .select("id,name,price,duration_minutes")
      .eq("id", appointment.service_id)
      .maybeSingle(),

    supabase
      .from("payments")
      .select("amount,status")
      .eq("appointment_id", appointment.id)
      .maybeSingle(),

    supabase
      .from("professional_services")
      .select("custom_price,custom_duration_minutes")
      .eq("professional_id", appointment.professional_id)
      .eq("service_id", appointment.service_id)
      .maybeSingle(),

    supabase
      .from("spa_settings")
      .select("notifications")
      .eq("id", true)
      .maybeSingle(),

    supabase
      .from("notifications")
      .select("id,recipient_id,status,attempts")
      .eq("appointment_id", appointment.id)
      .eq("channel", "email")
      .eq("notification_type", "appointment_created")
      .in("status", ["pending", "failed"])
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

  if (queueResult.error) {
    throw new Error(
      `Não foi possível consultar a fila de e-mails: ${queueResult.error.message}`,
    );
  }

  const client = clientResult.data;
  const professional = professionalResult.data;
  const service = serviceResult.data;

  if (!client || !professional || !service) {
    throw new Error(
      "O agendamento não possui todos os dados necessários para o e-mail.",
    );
  }

  const { data: professionalProfile, error: professionalProfileError } =
    await supabase
      .from("profiles")
      .select("id,full_name,email")
      .eq("id", professional.profile_id)
      .maybeSingle();

  if (professionalProfileError) {
    throw new Error(
      `Não foi possível consultar o perfil profissional: ${professionalProfileError.message}`,
    );
  }

  const globalSettings = settingsResult.data?.notifications as
    | GlobalNotificationSettings
    | undefined;

  const queue = (queueResult.data ?? []) as EmailQueueRow[];
  const appointmentDate = formatAppointmentDate(appointment.start_at);

  const duration = Number(
    professionalServiceResult.data?.custom_duration_minutes ??
      service.duration_minutes,
  );

  const price = Number(
    paymentResult.data?.amount ??
      professionalServiceResult.data?.custom_price ??
      service.price,
  );

  const resend = getResendClient();
  const from = getResendFromEmail();

  for (const notification of queue) {
    const isClient = notification.recipient_id === client.id;
    const isProfessional =
      notification.recipient_id === professionalProfile?.id;

    const audience: ProcessingItem["audience"] = isClient
      ? "client"
      : isProfessional
        ? "professional"
        : "unknown";

    if (audience === "unknown") {
      await supabase
        .from("notifications")
        .update({
          status: "failed",
          attempts: notification.attempts + 1,
          error_message: "Destinatário da notificação não reconhecido.",
        })
        .eq("id", notification.id);

      result.items.push({
        notificationId: notification.id,
        recipientId: notification.recipient_id,
        audience,
        result: "failed",
        message: "Destinatário não reconhecido.",
      });

      continue;
    }

    const recipient = isClient ? client : professionalProfile;

    const { data: storedPreferences, error: preferencesError } =
      await supabase
        .from("notification_preferences")
        .select("email_enabled,new_appointment")
        .eq("profile_id", notification.recipient_id)
        .maybeSingle();

    if (preferencesError) {
      result.items.push({
        notificationId: notification.id,
        recipientId: notification.recipient_id,
        audience,
        result: "skipped",
        message: preferencesError.message,
      });

      continue;
    }

    const preferences: NotificationPreferences = {
      email_enabled: storedPreferences?.email_enabled ?? true,
      new_appointment: storedPreferences?.new_appointment ?? true,
    };

    const globallyEnabled =
      globalSettings?.newAppointment !== false &&
      (audience === "client"
        ? globalSettings?.clientEmail === true
        : globalSettings?.professionalEmail === true);

    if (
      !globallyEnabled ||
      !preferences.email_enabled ||
      !preferences.new_appointment
    ) {
      await supabase
        .from("notifications")
        .update({
          status: "cancelled",
          error_message: null,
        })
        .eq("id", notification.id)
        .in("status", ["pending", "failed"]);

      result.items.push({
        notificationId: notification.id,
        recipientId: notification.recipient_id,
        audience,
        result: "cancelled",
        message: "Envio desativado nas preferências.",
      });

      continue;
    }

    if (!recipient?.email?.trim()) {
      await supabase
        .from("notifications")
        .update({
          status: "failed",
          attempts: notification.attempts + 1,
          error_message: "Destinatário sem endereço de e-mail.",
        })
        .eq("id", notification.id);

      result.items.push({
        notificationId: notification.id,
        recipientId: notification.recipient_id,
        audience,
        result: "failed",
        message: "Destinatário sem endereço de e-mail.",
      });

      continue;
    }

    const nextAttempt = notification.attempts + 1;

    const { data: claimedNotification, error: claimError } =
      await supabase
        .from("notifications")
        .update({
          status: "processing",
          attempts: nextAttempt,
          error_message: null,
        })
        .eq("id", notification.id)
        .eq("status", notification.status)
        .select("id")
        .maybeSingle();

    if (claimError || !claimedNotification) {
      result.items.push({
        notificationId: notification.id,
        recipientId: notification.recipient_id,
        audience,
        result: "skipped",
        message: "A notificação já está sendo processada.",
      });

      continue;
    }

    const title =
      audience === "client"
        ? "Seu agendamento está confirmado"
        : "Novo agendamento na sua agenda";

    const description =
      audience === "client"
        ? `${service.name} com ${professional.display_name}.`
        : `${client.full_name} agendou ${service.name}.`;

    const html = `
      <div style="margin:0;background:#fbf5f9;padding:32px 16px;font-family:Arial,sans-serif;color:#3b2538">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #eadbe6;border-radius:20px;padding:32px">
          <p style="margin:0 0 8px;color:#8b4f82;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">
            SPA Express Cambucás
          </p>

          <h1 style="margin:0 0 20px;color:#5f1f58;font-size:28px;line-height:1.2">
            ${escapeHtml(title)}
          </h1>

          <p style="margin:0 0 16px;font-size:16px;line-height:1.6">
            Olá, ${escapeHtml(recipient.full_name)}.
          </p>

          <p style="margin:0 0 24px;font-size:16px;line-height:1.6">
            ${escapeHtml(description)}
          </p>

          <div style="margin:0 0 24px;background:#f8eff6;border-radius:14px;padding:20px">
            <p style="margin:0 0 10px"><strong>Serviço:</strong> ${escapeHtml(service.name)}</p>
            <p style="margin:0 0 10px"><strong>Profissional:</strong> ${escapeHtml(professional.display_name)}</p>
            <p style="margin:0 0 10px"><strong>Data:</strong> ${escapeHtml(appointmentDate)}</p>
            <p style="margin:0 0 10px"><strong>Duração:</strong> ${escapeHtml(duration)} minutos</p>
            <p style="margin:0"><strong>Valor:</strong> ${escapeHtml(formatCurrency(price))}</p>
          </div>

          <p style="margin:0;font-size:14px;line-height:1.6;color:#6f596b">
            O pagamento será realizado diretamente no local.
          </p>
        </div>
      </div>
    `;

    try {
      const { data: emailData, error: emailError } =
        await resend.emails.send(
          {
            from,
            to: [recipient.email.trim()],
            subject: title,
            html,
          },
          {
            idempotencyKey: `appointment-created/${notification.id}`,
          },
        );

      if (emailError) {
        throw emailError;
      }

      await supabase
        .from("notifications")
        .update({
          status: "sent",
          provider_id: emailData?.id ?? null,
          error_message: null,
          sent_at: new Date().toISOString(),
        })
        .eq("id", notification.id)
        .eq("status", "processing");

      result.processed += 1;
      result.items.push({
        notificationId: notification.id,
        recipientId: notification.recipient_id,
        audience,
        result: "sent",
        providerId: emailData?.id,
      });
    } catch (error) {
      const message = errorMessage(error);

      await supabase
        .from("notifications")
        .update({
          status: "failed",
          error_message: message,
          sent_at: null,
        })
        .eq("id", notification.id)
        .eq("status", "processing");

      result.items.push({
        notificationId: notification.id,
        recipientId: notification.recipient_id,
        audience,
        result: "failed",
        message,
      });
    }
  }

  return result;
}