import { BookingError, bookingErrorMessage } from "../booking-errors";
import { PaymentOperationError, paymentErrorMessage, completionConfirmationUncertain } from "../payment-errors";
import { createClient } from "../../../lib/supabase/client";
import {
  appointmentDurationMinutes,
} from "../appointment-duration";
export type ProfessionalAppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type ProfessionalAppointment = {
  id: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  serviceName: string;
  duration: number;
  start: string;
  end: string;
  status: ProfessionalAppointmentStatus;
  outsideSchedule: boolean;
  paymentAmount: number;
  paymentStatus:
    | "pending"
    | "paid"
    | "refunded"
    | "cancelled";
};

type AgendaRow = {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  start_at: string;
  end_at: string;
  status: ProfessionalAppointmentStatus;
  outside_schedule: boolean;
  services: {
    name: string;
    duration_minutes: number;
  } | null;
  payments:
    | {
        amount: number;
        status: ProfessionalAppointment["paymentStatus"];
      }
    | Array<{
        amount: number;
        status: ProfessionalAppointment["paymentStatus"];
      }>
    | null;
};

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function getProfessionalAgenda(
  professionalId: string,
  month: string,
): Promise<ProfessionalAppointment[]> {
  const range = monthRange(month);

  const { data, error } = await createClient()
    .from("appointments")
    .select(`
      id,
      client_name,
      client_email,
      client_phone,
      start_at,
      end_at,
      status,
      outside_schedule,
      services(name,duration_minutes),
      payments(amount,status)
    `)
    .eq("professional_id", professionalId)
    .gte("start_at", range.start)
    .lt("start_at", range.end)
    .order("start_at", { ascending: true });

  if (error) throw error;

  return ((data || []) as unknown as AgendaRow[]).map(
    (row) => {
      const payment = Array.isArray(row.payments)
        ? row.payments[0]
        : row.payments;

      const actualDuration =
        appointmentDurationMinutes(
          row.start_at,
          row.end_at,
          row.services?.duration_minutes ?? 0,
        );

      return {
        id: row.id,
        clientName: row.client_name,
        clientEmail: row.client_email,
        clientPhone: row.client_phone,
        serviceName:
          row.services?.name ||
          "Serviço não informado",
        duration: actualDuration,
        start: row.start_at,
        end: row.end_at,
        status: row.status,
        outsideSchedule: row.outside_schedule,
        paymentAmount: Number(payment?.amount || 0),
        paymentStatus:
          payment?.status || "pending",
      };
    },
  );
}

export async function updateProfessionalAppointmentStatus(
  appointmentId: string,
  status: ProfessionalAppointmentStatus,
  reason?: string,
) {
  const supabase = createClient();

  const { error } = await supabase.rpc(
    "update_professional_appointment_status",
    {
      p_appointment_id: appointmentId,
      p_status: status,
      p_reason:
        reason?.trim() || null,
    },
  );

  if (error) {
    throw new BookingError(bookingErrorMessage(error, "update"));
  }
  await confirmProfessionalStatus(supabase, appointmentId, status);

  /*
   * Confirmação, conclusão e ausência não
   * utilizam o e-mail de cancelamento.
   */
  if (status !== "cancelled") {
    return;
  }

  /*
   * O cancelamento já foi salvo pelo RPC.
   * Uma falha no Resend não deve desfazer
   * a alteração no agendamento.
   */
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      await fetch(
        "/api/notifications/appointment",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
            authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            appointmentId,
          }),
        },
      );
    }
  } catch {
    /*
     * A notificação permanece pendente
     * no banco para outra tentativa.
     */
  }
}

export type CompleteProfessionalAppointmentInput = {
  appointmentId: string;
  paymentReceived: boolean;
  paymentMethod?: "pix" | "dinheiro" | "cartao" | "outro";
  paymentNotes?: string;
};

export type ConfirmedProfessionalCompletion = {
  appointmentId: string;
  appointmentStatus: "completed";
  paymentStatus: ProfessionalAppointment["paymentStatus"];
};

export async function completeProfessionalAppointment(
  input: CompleteProfessionalAppointmentInput,
): Promise<ConfirmedProfessionalCompletion> {
  const supabase = createClient();
  try {
    const paymentStatuses = ["pending", "paid", "refunded", "cancelled"];
    let paymentReceived = input.paymentReceived;
    if (paymentReceived) {
      // Evita regravar um pagamento já confirmado (inclusive pela administradora).
      // Compatibilidade com a versão anterior do RPC; a proteção é feita pelos locks/UPDATE do SQL.
      // Esta leitura NÃO elimina a corrida entre sessões.
      const existing = await supabase.from("payments").select("id,appointment_id,status")
        .eq("appointment_id", input.appointmentId).maybeSingle();
      if (existing.error || !existing.data || typeof existing.data.id !== "string" ||
          !existing.data.id.trim() || existing.data.appointment_id !== input.appointmentId ||
          !paymentStatuses.includes(existing.data.status)) {
        throw new PaymentOperationError("Não foi possível consultar o pagamento. Atualize a agenda antes de concluir.");
      }
      if (existing.data.status === "paid") paymentReceived = false;
    }

    const { data, error } = await supabase.rpc("complete_professional_appointment", {
      p_appointment_id: input.appointmentId,
      p_payment_received: paymentReceived,
      p_payment_method: paymentReceived ? input.paymentMethod : null,
      p_payment_notes: input.paymentNotes?.trim() || null,
    });
    if (error) throw error;

    // Contrato jsonb fornecido da função de produção, sem inferir retornos das migrations.
    const result = data as { appointment_id?: unknown; appointment_status?: unknown; payment_status?: unknown;
      payment_updated?: unknown; payment_id?: unknown } | null;
    if (!result || result.appointment_id !== input.appointmentId ||
        result.appointment_status !== "completed" || typeof result.payment_status !== "string" ||
        !paymentStatuses.includes(result.payment_status) || (paymentReceived && result.payment_status !== "paid")) {
      throw new PaymentOperationError(completionConfirmationUncertain);
    }

    // Campos aditivos do RPC protegido. O JSON legado continua aceito com as verificações anteriores.
    const hasPaymentOutcome = Object.hasOwn(result, "payment_updated") || Object.hasOwn(result, "payment_id");
    if (hasPaymentOutcome && (typeof result.payment_updated !== "boolean" ||
        !Object.hasOwn(result, "payment_id") || (result.payment_id !== null &&
         (typeof result.payment_id !== "string" || !result.payment_id.trim())) ||
        (result.payment_updated && (!paymentReceived || result.payment_status !== "paid")))) {
      throw new PaymentOperationError(completionConfirmationUncertain);
    }
    const paymentPreserved = hasPaymentOutcome && result.payment_updated === false;

    // Confirmamos também o estado legível salvo, inclusive o ID retornado pelo RPC protegido.
    const saved = await Promise.resolve(supabase.from("appointments")
      .select("id,status,payments(id,status,method,confirmed_by,paid_at)")
      .eq("id", input.appointmentId).maybeSingle())
      .catch(() => ({ data: null, error: true }));
    if (saved.error || !saved.data || saved.data.id !== input.appointmentId ||
        saved.data.status !== "completed" || !Object.hasOwn(saved.data, "payments")) {
      throw new PaymentOperationError(completionConfirmationUncertain);
    }
    const relation = saved.data.payments;
    if (Array.isArray(relation) && relation.length > 1) throw new PaymentOperationError(completionConfirmationUncertain);
    const payment = Array.isArray(relation) ? relation[0] : relation;
    if (relation === undefined || (payment && (typeof payment.id !== "string" ||
        !payment.id.trim() || !paymentStatuses.includes(payment.status)))) {
      throw new PaymentOperationError(completionConfirmationUncertain);
    }
    if (hasPaymentOutcome && result.payment_id !== (payment?.id ?? null)) {
      throw new PaymentOperationError(completionConfirmationUncertain);
    }
    const savedStatus = payment?.status ?? "pending";
    if (savedStatus !== result.payment_status || (paymentReceived &&
        (!payment || typeof payment.id !== "string" || !payment.id.trim() ||
         (!paymentPreserved && payment.method !== input.paymentMethod) ||
         (paymentPreserved && !["pix", "dinheiro", "cartao", "outro"].includes(payment.method)) ||
         typeof payment.confirmed_by !== "string" ||
         !payment.confirmed_by.trim() || typeof payment.paid_at !== "string" ||
         !Number.isFinite(Date.parse(payment.paid_at))))) {
      throw new PaymentOperationError(completionConfirmationUncertain);
    }
    return {
      appointmentId: input.appointmentId,
      appointmentStatus: "completed",
      paymentStatus: result.payment_status as ProfessionalAppointment["paymentStatus"],
    };
  } catch (error) {
    throw new PaymentOperationError(paymentErrorMessage(error, "completion"));
  }
}

async function confirmProfessionalStatus(
  supabase: ReturnType<typeof createClient>,
  appointmentId: string,
  status: ProfessionalAppointmentStatus,
) {
  // Não presumimos o retorno deste RPC de produção: conferimos o registro legível.
  const result = await supabase.from("appointments").select("id,status").eq("id", appointmentId).maybeSingle();
  if (result.error || result.data?.id !== appointmentId || result.data.status !== status) {
    throw new BookingError("Não foi possível confirmar a alteração. Atualize sua agenda para conferir o resultado.");
  }
}
