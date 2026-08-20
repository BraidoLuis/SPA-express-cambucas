import { createClient } from "../../../lib/supabase/client";

import {
  validateServiceDuration,
} from "../validations/service-duration";

export type ProfessionalService = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  duration: number;
  price: number;
  image: string | null;
  active: boolean;
};

type ProfessionalServiceRow = {
  active: boolean;
  custom_duration_minutes: number | null;
  custom_price: number | null;
  services: {
    id: string;
    name: string;
    category: string;
    description: string | null;
    duration_minutes: number;
    price: number;
    image_url: string | null;
  };
};

export type CreateProfessionalServiceInput = {
  name: string;
  category: string;
  description?: string;
  duration: number;
  price: number;
  image?: string;
};

export async function getProfessionalServices(
  professionalId: string,
): Promise<ProfessionalService[]> {
  const { data, error } = await createClient()
    .from("professional_services")
    .select(`
      active,
      custom_duration_minutes,
      custom_price,
      services!inner(
        id,
        name,
        category,
        description,
        duration_minutes,
        price,
        image_url
      )
    `)
    .eq("professional_id", professionalId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data || []) as unknown as ProfessionalServiceRow[]).map((row) => ({
    id: row.services.id,
    name: row.services.name,
    category: row.services.category,
    description: row.services.description,
    duration:
      row.custom_duration_minutes ?? row.services.duration_minutes,
    price: Number(row.custom_price ?? row.services.price),
    image: row.services.image_url,
    active: row.active,
  }));
}

export async function createProfessionalService(
  input: CreateProfessionalServiceInput,
): Promise<string> {
  validateServiceDuration(input.duration);

  const { data, error } = await createClient().rpc(
    "create_professional_service",
    {
      p_name: input.name,
      p_category: input.category,
      p_description: input.description || "",
      p_duration_minutes: input.duration,
      p_price: input.price,
      p_image_url: input.image || null,
    },
  );

  if (error) throw error;

  return data as string;
}

export async function updateProfessionalService(
  professionalId: string,
  serviceId: string,
  changes: {
    duration: number;
    price: number;
    active: boolean;
  },
) {
  validateServiceDuration(changes.duration);

  const { error } = await createClient()
    .from("professional_services")
    .update({
      custom_duration_minutes: changes.duration,
      custom_price: changes.price,
      active: changes.active,
    })
    .eq("professional_id", professionalId)
    .eq("service_id", serviceId);

  if (error) throw error;
}