import { createClient } from "../../../lib/supabase/client";

const BUCKET = "service-media";
const MAX_SIZE = 20 * 1024 * 1024;
const ALLOWED = new Map<string, "image" | "video">([
  ["image/jpeg", "image"],
  ["image/png", "image"],
  ["image/webp", "image"],
  ["video/mp4", "video"],
]);

export function showcaseMegabytes(bytes: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(bytes / 1024 / 1024);
}

export type ShowcaseMedia = {
  id: string;
  title: string;
  caption: string | null;
  type: "image" | "video";
  storagePath: string;
  url: string | null;
  active: boolean;
  createdAt: string;
  expiresAt: string;
  serviceId: string | null;
  serviceName: string | null;
  professionalId: string | null;
  professionalName: string | null;
};

export type ShowcaseOption = { id: string; name: string };
export type ShowcaseInput = {
  title: string;
  caption: string;
  serviceId: string | null;
  professionalId: string | null;
  active: boolean;
};

type Row = {
  id: string;
  title: string;
  caption: string | null;
  media_type: "image" | "video";
  storage_path: string;
  public_url: string | null;
  active: boolean;
  created_at: string;
  expires_at: string;
  service_id: string | null;
  professional_id: string | null;
  services: { name: string } | { name: string }[] | null;
  professionals: { display_name: string } | { display_name: string }[] | null;
};

const relation = (
  value:
    | { name?: string; display_name?: string }
    | Array<{ name?: string; display_name?: string }>
    | null
) =>
  value
    ? (Array.isArray(value)
        ? value[0]?.name || value[0]?.display_name
        : value.name || value.display_name) || null
    : null;

const mapRow = (row: Row): ShowcaseMedia => ({
  id: row.id,
  title: row.title,
  caption: row.caption,
  type: row.media_type,
  storagePath: row.storage_path,
  url: row.public_url,
  active: row.active,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  serviceId: row.service_id,
  serviceName: relation(row.services),
  professionalId: row.professional_id,
  professionalName: relation(row.professionals),
});

export function validateShowcaseFile(file: File) {
  const type = ALLOWED.get(file.type);

  if (!type) {
    if (file.type.startsWith("image/")) {
      throw new Error("Formato de imagem não permitido. Utilize JPG, PNG ou WEBP.");
    }
    if (file.type.startsWith("video/")) {
      throw new Error("Formato de vídeo não permitido. Utilize MP4.");
    }
    throw new Error("Formato não permitido. Utilize JPG, PNG, WEBP ou MP4.");
  }

  if (file.size > MAX_SIZE) {
    if (type === "video") {
      throw new Error(
        `Este vídeo possui ${showcaseMegabytes(file.size)} MB e ultrapassa o limite de 20 MB.`
      );
    }
    throw new Error(
      `Esta imagem possui ${showcaseMegabytes(file.size)} MB. O limite permitido é 20 MB.`
    );
  }

  return type;
}

function safeName(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-90) || "media"
  );
}

function ownedPath(path: string | null | undefined) {
  return path?.startsWith("showcase/") && !path.includes("..") ? path : null;
}

export async function getShowcaseAdminData() {
  const supabase = createClient();

  const [media, services, professionals] = await Promise.all([
    supabase
      .from("service_media")
      .select(
        "id,title,caption,media_type,storage_path,public_url,active,created_at,expires_at,service_id,professional_id,services(name),professionals(display_name)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("services").select("id,name").eq("active", true).order("name"),
    supabase
      .from("professionals")
      .select("id,display_name")
      .eq("active", true)
      .order("display_name"),
  ]);

  if (media.error) throw media.error;
  if (services.error) throw services.error;
  if (professionals.error) throw professionals.error;

  return {
    media: ((media.data || []) as unknown as Row[]).map(mapRow),
    services: (services.data || []).map((x) => ({ id: x.id, name: x.name })),
    professionals: (professionals.data || []).map((x) => ({
      id: x.id,
      name: x.display_name,
    })),
  };
}

export async function getActiveShowcase(): Promise<ShowcaseMedia[]> {
  const { data, error } = await createClient()
    .from("service_media")
    .select(
      "id,title,caption,media_type,storage_path,public_url,active,created_at,expires_at,service_id,professional_id,services(name),professionals(display_name)"
    )
    .eq("active", true)
    .gt("expires_at", new Date().toISOString())
    .not("public_url", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data || []) as unknown as Row[])
    .map(mapRow)
    .filter((x) => Boolean(x.url));
}

export async function createShowcaseMedia(input: ShowcaseInput, file: File) {
  const type = validateShowcaseFile(file);
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) throw new Error("Sua sessão expirou.");

  const id = crypto.randomUUID();
  const path = `showcase/${id}/${Date.now()}-${safeName(file.name)}`;

  const uploaded = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploaded.error) {
    throw new Error("Não foi possível enviar a mídia.");
  }

  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const { error } = await supabase.from("service_media").insert({
    id,
    title: input.title.trim(),
    caption: input.caption.trim() || null,
    service_id: input.serviceId,
    professional_id: input.professionalId,
    media_type: type,
    storage_path: path,
    public_url: url,
    active: input.active,
    created_by: user.user.id,
    expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  });

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }

  return id;
}

export async function updateShowcaseMedia(
  item: ShowcaseMedia,
  input: ShowcaseInput,
  file?: File | null
) {
  const supabase = createClient();

  let path = item.storagePath;
  let url = item.url;
  let type = item.type;
  let newPath: string | null = null;

  if (file) {
    type = validateShowcaseFile(file);
    newPath = `showcase/${item.id}/${Date.now()}-${safeName(file.name)}`;

    const up = await supabase.storage
      .from(BUCKET)
      .upload(newPath, file, { contentType: file.type, upsert: false });

    if (up.error) {
      throw new Error("Não foi possível enviar a nova mídia.");
    }

    path = newPath;
    url = supabase.storage.from(BUCKET).getPublicUrl(newPath).data.publicUrl;
  }

  const { error } = await supabase
    .from("service_media")
    .update({
      title: input.title.trim(),
      caption: input.caption.trim() || null,
      service_id: input.serviceId,
      professional_id: input.professionalId,
      active: input.active,
      media_type: type,
      storage_path: path,
      public_url: url,
    })
    .eq("id", item.id);

  if (error) {
    if (newPath) await supabase.storage.from(BUCKET).remove([newPath]);
    throw error;
  }

  const old = ownedPath(item.storagePath);
  if (newPath && old) await supabase.storage.from(BUCKET).remove([old]);
}

export async function deleteShowcaseMedia(item: ShowcaseMedia) {
  const supabase = createClient();

  const { error } = await supabase
    .from("service_media")
    .delete()
    .eq("id", item.id);

  if (error) throw error;

  const path = ownedPath(item.storagePath);
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}

export async function setShowcaseActive(id: string, active: boolean) {
  const { error } = await createClient()
    .from("service_media")
    .update({ active })
    .eq("id", id);

  if (error) throw error;
}

export function showcaseAlt(item: ShowcaseMedia) {
  return (
    item.title ||
    item.serviceName ||
    item.professionalName ||
    "Conteúdo da vitrine do SPA Express Cambucás"
  );
}