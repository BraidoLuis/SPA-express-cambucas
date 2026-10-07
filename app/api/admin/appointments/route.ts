import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { processAppointmentCreatedEmails } from "../../../lib/server/appointment-email-processor";

type Input = {
  clientId?: string;
  serviceId?: string;
  professionalId?: string;
  slotStart?: string;
  notes?: string;
};

type Slot = {
  slot_start: string;
  slot_end: string;
};

type NotificationResult =
  | { status: "not_configured" | "failed" }
  | {
      status: "sent" | "partial" | "failed" | "skipped";
      sent: number;
      failed: number;
      skipped: number;
      accepted: number;
      errors: number;
    };

export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Agendamento administrativo não configurado." },
      { status: 503 }
    );
  }

  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) {
    return NextResponse.json(
      { error: "Sessão administrativa ausente." },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  const auth = await admin.auth.getUser(token);

  if (auth.error || !auth.data.user) {
    return NextResponse.json(
      { error: "Sessão administrativa inválida." },
      { status: 401 }
    );
  }

  const actor = await admin
    .from("profiles")
    .select("role,active")
    .eq("id", auth.data.user.id)
    .single();

  if (actor.error || !actor.data || actor.data.role !== "admin" || !actor.data.active) {
    return NextResponse.json(
      { error: "Apenas administradores ativos podem criar agendamentos." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as Input;
  const start = body.slotStart ? new Date(body.slotStart) : null;

  if (
    !body.clientId ||
    !body.serviceId ||
    !body.professionalId ||
    !start ||
    Number.isNaN(start.getTime()) ||
    start <= new Date()
  ) {
    return NextResponse.json(
      { error: "Revise cliente, serviço, profissional e horário." },
      { status: 400 }
    );
  }

  const [client, link] = await Promise.all([
    admin
      .from("profiles")
      .select("id,full_name,email,phone")
      .eq("id", body.clientId)
      .eq("role", "client")
      .eq("active", true)
      .single(),
    admin
      .from("professional_services")
      .select(
        "professional_id,service_id,active,services!inner(active),professionals!inner(active)"
      )
      .eq("professional_id", body.professionalId)
      .eq("service_id", body.serviceId)
      .eq("active", true)
      .eq("services.active", true)
      .eq("professionals.active", true)
      .single(),
  ]);

  if (client.error || link.error) {
    return NextResponse.json(
      {
        error:
          "Cliente, serviço ou vínculo profissional não está mais disponível.",
      },
      { status: 409 }
    );
  }

  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(start);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((item) => item.type === type)?.value || "";

  const date = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;

  const slots = await admin.rpc("get_available_slots", {
    p_professional_id: body.professionalId,
    p_service_id: body.serviceId,
    p_date: date,
  });

  if (slots.error) {
    return NextResponse.json(
      { error: "Não foi possível revalidar a disponibilidade." },
      { status: 409 }
    );
  }

  const slot = ((slots.data || []) as Slot[]).find(
    (item) => new Date(item.slot_start).getTime() === start.getTime()
  );

  if (!slot) {
    return NextResponse.json(
      { error: "Este horário não está mais disponível." },
      { status: 409 }
    );
  }

  const notes = body.notes?.trim().replace(/\s+/g, " ").slice(0, 500) || null;

  const created = await admin
    .from("appointments")
    .insert({
      client_id: client.data.id,
      professional_id: body.professionalId,
      service_id: body.serviceId,
      client_name: client.data.full_name,
      client_email: client.data.email,
      client_phone: client.data.phone,
      start_at: slot.slot_start,
      end_at: slot.slot_end,
      status: "confirmed",
      notes,
      outside_schedule: false,
      created_by: auth.data.user.id,
    })
    .select("id")
    .single();

  if (created.error) {
    return NextResponse.json(
      {
        error:
          created.error.code === "23P01"
            ? "Este horário acabou de ser reservado por outra pessoa."
            : "Não foi possível concluir o agendamento.",
      },
      { status: 409 }
    );
  }

  const appointmentId = created.data.id;
  let notification: NotificationResult;

  // O trigger já criou a fila. Reutilizamos o processador, sem inserir notificações.
  try {
    const result = await processAppointmentCreatedEmails(appointmentId);

    if (!result.configured) {
      notification = { status: "not_configured" };
    } else {
      const sent = result.items.filter((item) => item.result === "sent").length;
      const failed = result.items.filter((item) => item.result === "failed").length;
      // Preferências desativadas e itens já em processamento não confirmam envio.
      const errors = result.items.filter((item) => item.result === "error").length;
      const accepted = result.items.filter(
        (item) => item.providerAccepted === true || item.result === "sent",
      ).length;
      const skipped = result.items.length - sent - failed - errors;
      const status = sent > 0
        ? failed > 0 || skipped > 0 || errors > 0 ? "partial" : "sent"
        : failed > 0 || errors > 0 ? "failed" : "skipped";

      notification = { status, sent, accepted, failed, skipped, errors };
    }
  } catch {
    // A reserva já foi criada: falhas de e-mail não podem incentivar outra criação.
    notification = { status: "failed" };
    console.error("Agendamento criado, mas o processamento de e-mails falhou.");
  }

  return NextResponse.json({ id: appointmentId, notification }, { status: 201 });
}