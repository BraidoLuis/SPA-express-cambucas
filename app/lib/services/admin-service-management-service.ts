import { createClient } from "../../../lib/supabase/client";
import {
  validateServiceDuration,
} from "../validations/service-duration";

export type AdminServiceProfessional = {
  id: string;
  name: string;
  active: boolean;
};

export type AdminServiceLink = {
  professionalId: string;
  professionalName: string;
  active: boolean;
  customDuration: number | null;
  customPrice: number | null;
};

export type AdminManagedService = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  duration: number;
  price: number;
  active: boolean;
  imageUrl: string | null;
  links: AdminServiceLink[];
};

export type AdminServiceLinkInput = {
  professionalId: string;
  customDuration: number | null;
  customPrice: number | null;
};

export type SaveAdminServiceInput = {
  id?: string;
  name: string;
  category: string;
  description: string;
  duration: number;
  price: number;
  active: boolean;
  links: AdminServiceLinkInput[];
};

type ServiceRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  duration_minutes: number;
  price: number | string;
  active: boolean;
  image_url: string | null;
  professional_services: Array<{
    professional_id: string;
    active: boolean;
    custom_duration_minutes: number | null;
    custom_price: number | string | null;
    professionals: { display_name: string } | Array<{ display_name: string }> | null;
  }> | null;
};

function relationName(
  relation: { display_name: string } | Array<{ display_name: string }> | null,
) {
  if (!relation) return "Profissional";
  return Array.isArray(relation)
    ? relation[0]?.display_name || "Profissional"
    : relation.display_name;
}

function readableError(error: unknown, fallback: string) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "";

  if (/duplicate key|unique constraint/i.test(message)) {
    return new Error("Já existe um serviço com estes dados. Revise o nome e tente novamente.");
  }
  if (/row-level security|permission denied/i.test(message)) {
    return new Error("Sua conta não tem permissão para administrar serviços.");
  }
  if (/network|fetch/i.test(message)) {
    return new Error("Não foi possível conectar ao Supabase. Verifique sua conexão.");
  }
  return new Error(message || fallback);
}

export async function getAdminServiceManagementData(): Promise<{
  services: AdminManagedService[];
  professionals: AdminServiceProfessional[];
}> {
  const supabase = createClient();
  const [servicesResult, professionalsResult] = await Promise.all([
    supabase
      .from("services")
      .select(`
        id,name,category,description,duration_minutes,price,active,image_url,
        professional_services(
          professional_id,active,custom_duration_minutes,custom_price,
          professionals(display_name)
        )
      `)
      .order("name", { ascending: true }),
    supabase
      .from("professionals")
      .select("id,display_name,active")
      .order("display_name", { ascending: true }),
  ]);

  if (servicesResult.error) {
    throw readableError(servicesResult.error, "Não foi possível carregar os serviços.");
  }
  if (professionalsResult.error) {
    throw readableError(professionalsResult.error, "Não foi possível carregar as profissionais.");
  }

  const services = ((servicesResult.data || []) as unknown as ServiceRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    duration: row.duration_minutes,
    price: Number(row.price),
    active: row.active,
    imageUrl: row.image_url,
    links: (row.professional_services || []).map((link) => ({
      professionalId: link.professional_id,
      professionalName: relationName(link.professionals),
      active: link.active,
      customDuration: link.custom_duration_minutes,
      customPrice: link.custom_price === null ? null : Number(link.custom_price),
    })),
  }));

  return {
    services,
    professionals: (professionalsResult.data || []).map((row) => ({
      id: row.id,
      name: row.display_name,
      active: row.active,
    })),
  };
}

function createSlug(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "servico";
  return `${base}-${Date.now().toString(36)}`;
}

export async function saveAdminService(
  input: SaveAdminServiceInput,
): Promise<string> {
  validateServiceDuration(
    input.duration,
    "A duração base",
  );

  for (const link of input.links) {
    if (link.customDuration !== null) {
      validateServiceDuration(
        link.customDuration,
        "A duração personalizada",
      );
    }
  }

  const supabase = createClient();

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) {
    throw new Error("Sua sessão expirou. Entre novamente para salvar o serviço.");
  }

  const serviceValues = {
    name: input.name.trim(),
    category: input.category.trim(),
    description: input.description.trim() || null,
    duration_minutes: input.duration,
    price: input.price,
    active: input.active,
    updated_at: new Date().toISOString(),
  };

  let serviceId = input.id;
  if (serviceId) {
    const { error } = await supabase.from("services").update(serviceValues).eq("id", serviceId);
    if (error) throw readableError(error, "Não foi possível atualizar o serviço.");
  } else {
    const { data, error } = await supabase
      .from("services")
      .insert({
        ...serviceValues,
        slug: createSlug(input.name),
        created_by: userResult.user.id,
      })
      .select("id")
      .single();
    if (error || !data) throw readableError(error, "Não foi possível criar o serviço.");
    serviceId = data.id;
  }

  const resolvedServiceId = serviceId as string;
  const selectedIds = new Set(input.links.map((link) => link.professionalId));

  if (selectedIds.size > 0) {
    const { error: deactivateError } = await supabase
      .from("professional_services")
      .update({ active: false })
      .eq("service_id", resolvedServiceId)
      .not("professional_id", "in", `(${[...selectedIds].join(",")})`);

    if (deactivateError) {
      throw readableError(deactivateError, "O serviço foi salvo, mas não foi possível atualizar todos os vínculos.");
    }
  }

  if (selectedIds.size === 0) {
    const { error } = await supabase
      .from("professional_services")
      .update({ active: false })
      .eq("service_id", resolvedServiceId);
    if (error) throw readableError(error, "O serviço foi salvo, mas não foi possível atualizar os vínculos.");
  } else {
    const { error } = await supabase.from("professional_services").upsert(
      input.links.map((link) => ({
        professional_id: link.professionalId,
        service_id: resolvedServiceId,
        custom_duration_minutes: link.customDuration,
        custom_price: link.customPrice,
        active: true,
      })),
      { onConflict: "professional_id,service_id" },
    );
    if (error) throw readableError(error, "O serviço foi salvo, mas não foi possível atualizar os vínculos.");
  }

  return resolvedServiceId;
}

export async function setAdminServiceActive(serviceId: string, active: boolean) {
  const { error } = await createClient()
    .from("services")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", serviceId);
  if (error) throw readableError(error, "Não foi possível alterar o status do serviço.");
}
