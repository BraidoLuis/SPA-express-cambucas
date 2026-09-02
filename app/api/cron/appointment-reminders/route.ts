import { createAdminClient } from "../../../../lib/supabase/admin";
import { processAppointmentEmails } from "../../../lib/server/appointment-email-processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReminderQueueRow = {
  appointment_id: string;
};

type FailedAppointment = {
  appointmentId: string;
  message: string;
};

function getBearerToken(
  request: Request,
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (
    !authorization?.startsWith("Bearer ")
  ) {
    return null;
  }

  return (
    authorization
      .slice("Bearer ".length)
      .trim() || null
  );
}

function errorMessage(
  error: unknown,
): string {
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

  return "Erro desconhecido.";
}

export async function GET(
  request: Request,
) {
  try {
    const configuredSecret =
      process.env.CRON_SECRET?.trim();

    if (!configuredSecret) {
      return Response.json(
        {
          error:
            "CRON_SECRET não está configurado.",
        },
        {
          status: 503,
        },
      );
    }

    const receivedSecret =
      getBearerToken(request);

    if (
      !receivedSecret ||
      receivedSecret !== configuredSecret
    ) {
      return Response.json(
        {
          error:
            "Não autorizado.",
        },
        {
          status: 401,
        },
      );
    }

    const supabase =
      createAdminClient();

    const {
      data: queueData,
      error: queueError,
    } = await supabase.rpc(
      "queue_due_appointment_reminders",
    );

    if (queueError) {
      throw new Error(
        `Não foi possível preparar os lembretes: ${queueError.message}`,
      );
    }

    const appointmentIds = [
      ...new Set(
        (
          (queueData ?? []) as
            ReminderQueueRow[]
        )
          .map(
            (item) =>
              item.appointment_id,
          )
          .filter(Boolean),
      ),
    ].slice(0, 50);

    const processedResults = [];
    const failedAppointments:
      FailedAppointment[] = [];

    /*
     * Processamento sequencial para evitar
     * disparar muitos e-mails simultaneamente
     * no Resend.
     */
    for (
      const appointmentId of
      appointmentIds
    ) {
      try {
        const processingResult =
          await processAppointmentEmails(
            appointmentId,
          );

        processedResults.push(
          processingResult,
        );
      } catch (error) {
        failedAppointments.push({
          appointmentId,
          message:
            errorMessage(error),
        });
      }
    }

    const sentEmails =
      processedResults.reduce(
        (total, processingResult) =>
          total +
          processingResult.processed,
        0,
      );

    const failedEmails =
      processedResults.reduce(
        (total, processingResult) =>
          total +
          processingResult.items.filter(
            (item) =>
              item.result === "failed",
          ).length,
        0,
      );

    return Response.json({
      ok:
        failedAppointments.length === 0 &&
        failedEmails === 0,
      appointmentsFound:
        appointmentIds.length,
      appointmentsProcessed:
        processedResults.length,
      emailsSent: sentEmails,
      emailsFailed: failedEmails,
      failedAppointments,
      results: processedResults,
      executedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Falha ao processar lembretes:",
      errorMessage(error),
    );

    return Response.json(
      {
        error:
          "Não foi possível processar os lembretes.",
        details:
          errorMessage(error),
      },
      {
        status: 500,
      },
    );
  }
}