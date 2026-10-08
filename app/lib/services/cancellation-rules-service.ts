import { createClient } from "../../../lib/supabase/client";
import { BookingError } from "../booking-errors";
import { parseCancellationRules, type CancellationRules } from "../cancellation-rules";

export async function getCancellationRules(): Promise<CancellationRules> {
  try {
    const { data, error } = await createClient().auth.getSession();
    if (error || !data.session?.access_token) {
      throw new BookingError("Sua sessão expirou. Entre novamente.");
    }
    const response = await fetch("/api/appointments/cancellation-rules", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) {
      throw new BookingError("Sua sessão não permite consultar o cancelamento. Entre novamente.");
    }
    const rules = response.ok ? parseCancellationRules(await response.json()) : null;
    if (!rules) throw new Error("Configuração indisponível");
    return rules;
  } catch (error) {
    if (error instanceof BookingError) throw error;
    throw new BookingError("Não foi possível consultar as regras de cancelamento. Atualize seus agendamentos e tente novamente.");
  }
}
