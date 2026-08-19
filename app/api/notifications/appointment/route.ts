import { createAdminClient } from "../../../../lib/supabase/admin";
import { processAppointmentCreatedEmails } from "../../../lib/server/appointment-email-processor";

export const runtime = "nodejs";

type RequestBody = {
  appointmentId?: unknown;
};

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();

  return token || null;
}

export async function POST(request: Request) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return Response.json(
        { error: "Sessão não informada." },
        { status: 401 },
      );
    }

    let body: RequestBody;

    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return Response.json(
        { error: "Corpo da requisição inválido." },
        { status: 400 },
      );
    }

    const appointmentId =
      typeof body.appointmentId === "string"
        ? body.appointmentId.trim()
        : "";

    if (!appointmentId) {
      return Response.json(
        { error: "O identificador do agendamento é obrigatório." },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return Response.json(
        { error: "Sessão inválida ou expirada." },
        { status: 401 },
      );
    }

    const [{ data: profile, error: profileError }, appointmentResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id,role,active")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("appointments")
          .select("id,client_id,professional_id")
          .eq("id", appointmentId)
          .maybeSingle(),
      ]);

    if (profileError) {
      return Response.json(
        { error: "Não foi possível validar o perfil." },
        { status: 500 },
      );
    }

    if (!profile?.active) {
      return Response.json(
        { error: "Perfil inexistente ou inativo." },
        { status: 403 },
      );
    }

    if (appointmentResult.error) {
      return Response.json(
        { error: "Não foi possível consultar o agendamento." },
        { status: 500 },
      );
    }

    const appointment = appointmentResult.data;

    if (!appointment) {
      return Response.json(
        { error: "Agendamento não encontrado." },
        { status: 404 },
      );
    }

    let professionalProfileId: string | null = null;

    if (profile.role === "professional") {
      const { data: professional, error: professionalError } =
        await supabase
          .from("professionals")
          .select("profile_id")
          .eq("id", appointment.professional_id)
          .maybeSingle();

      if (professionalError) {
        return Response.json(
          { error: "Não foi possível validar a profissional." },
          { status: 500 },
        );
      }

      professionalProfileId = professional?.profile_id ?? null;
    }

    const isAppointmentClient =
      appointment.client_id === user.id;

    const isAppointmentProfessional =
      profile.role === "professional" &&
      professionalProfileId === user.id;

    const isAdministrator =
      profile.role === "admin";

    if (
      !isAppointmentClient &&
      !isAppointmentProfessional &&
      !isAdministrator
    ) {
      return Response.json(
        { error: "Você não possui acesso a este agendamento." },
        { status: 403 },
      );
    }

    const processingResult =
      await processAppointmentCreatedEmails(appointment.id);

    if (!processingResult.configured) {
      return Response.json(
        {
          error: "O serviço de e-mail ainda não está configurado.",
          result: processingResult,
        },
        { status: 503 },
      );
    }

    const failedItems = processingResult.items.filter(
      (item) => item.result === "failed",
    );

    return Response.json({
      ok: failedItems.length === 0,
      result: processingResult,
    });
  } catch (error) {
    console.error(
      "Falha ao processar e-mails do agendamento:",
      error instanceof Error ? error.message : "Erro desconhecido",
    );

    return Response.json(
      {
        error:
          "Não foi possível processar os e-mails deste agendamento.",
      },
      { status: 500 },
    );
  }
}