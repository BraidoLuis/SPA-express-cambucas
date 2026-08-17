import { createClient } from "../../../lib/supabase/client";

const BUCKET = "service-media";
const MAX_SIZE = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function serviceCoverMegabytes(bytes: number) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);
}

export type CoverImageChange =
  | { kind: "keep" }
  | { kind: "remove" }
  | { kind: "replace"; file: File };

export function validateServiceCover(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    if (file.type.startsWith("video/")) throw new Error("Vídeos não são permitidos como capa. Utilize JPG, PNG ou WEBP.");
    throw new Error("Formato não permitido. Utilize JPG, PNG ou WEBP.");
  }
  if (file.size > MAX_SIZE) {
    throw new Error(`Esta imagem possui ${serviceCoverMegabytes(file.size)} MB. O limite permitido é 3 MB.`);
  }
}

function ownedStoragePath(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(parsed.pathname.slice(index + marker.length));
    return path.startsWith("services/") ? path : null;
  } catch {
    return null;
  }
}

async function safelyRemove(path: string | null) {
  if (!path) return;
  const { error } = await createClient().storage.from(BUCKET).remove([path]);
  if (error) throw new Error("A capa foi salva, mas não foi possível excluir o arquivo anterior.");
}

export async function applyServiceCoverChange(
  serviceId: string,
  currentUrl: string | null,
  change: CoverImageChange,
) {
  if (change.kind === "keep") return currentUrl;
  const supabase = createClient();
  const previousPath = ownedStoragePath(currentUrl);

  if (change.kind === "remove") {
    const { error } = await supabase
      .from("services")
      .update({ image_url: null, updated_at: new Date().toISOString() })
      .eq("id", serviceId);
    if (error) throw new Error("Não foi possível remover a capa no cadastro do serviço.");
    await safelyRemove(previousPath);
    return null;
  }

  validateServiceCover(change.file);
  const extension = ALLOWED_TYPES.get(change.file.type)!;
  const newPath = `services/${serviceId}/cover-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(newPath, change.file, { contentType: change.file.type, upsert: false });
  if (uploadError) throw new Error("Não foi possível enviar a nova imagem. Tente novamente.");

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(newPath);
  const newUrl = data.publicUrl;
  const { error: updateError } = await supabase
    .from("services")
    .update({ image_url: newUrl, updated_at: new Date().toISOString() })
    .eq("id", serviceId);
  if (updateError) {
    await supabase.storage.from(BUCKET).remove([newPath]);
    throw new Error("A imagem foi enviada, mas o cadastro não pôde ser atualizado. O novo arquivo foi descartado.");
  }

  await safelyRemove(previousPath);
  return newUrl;
}
