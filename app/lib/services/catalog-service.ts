import { createClient } from "../../../lib/supabase/client";
import type { Service } from "../spa-data";

type CatalogRow = {
  custom_duration_minutes: number | null;
  custom_price: number | null;
  services: {
    id: string;
    name: string;
    slug: string;
    category: string;
    description: string | null;
    duration_minutes: number;
    price: number;
    image_url: string | null;
  };
  professionals: {
    id: string;
    display_name: string;
    specialty: string;
    whatsapp_number: string | null;
  };
};

export async function getClientCatalog(): Promise<Service[]> {
  const { data, error } = await createClient()
    .from("professional_services")
    .select(`
      custom_duration_minutes,
      custom_price,
      services!inner(id,name,slug,category,description,duration_minutes,price,image_url,active),
      professionals!inner(id,display_name,specialty,whatsapp_number,active)
    `)
    .eq("active", true)
    .eq("services.active", true)
    .eq("professionals.active", true);

  if (error) throw error;

  return ((data || []) as unknown as CatalogRow[])
    .map((row) => ({
      id: row.services.id,
      slug: row.services.slug,
      professionalId: row.professionals.id,
      professionalWhatsapp:
        row.professionals.whatsapp_number || undefined,
      name: row.services.name,
      category: row.services.category,
      description:
        row.services.description ||
        "Atendimento personalizado, realizado com cuidado e atenção.",
      duration:
        row.custom_duration_minutes ??
        row.services.duration_minutes,
      price: Number(
        row.custom_price ?? row.services.price,
      ),
      professional:
        row.professionals.display_name.split(" ")[0],
      professionalFullName:
        row.professionals.display_name,
      specialty: row.professionals.specialty,
      image: row.services.image_url || undefined,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}