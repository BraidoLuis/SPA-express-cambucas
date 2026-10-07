import { StorageApiError } from "@supabase/supabase-js";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { authorizeCron } from "../../../lib/server/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_LIMIT = 100;

type ExpiredMedia = { id: string; storage_path: string | null };
type CleanupFailure = {
  mediaIds: string[];
  stage: "query" | "storage" | "database";
  message: string;
};

export async function GET(request: Request) {
  const authorizationError = authorizeCron(request);
  if (authorizationError) return authorizationError;

  const cutoff = new Date().toISOString();
  const result = {
    mediaFound: 0,
    filesRemoved: 0,
    filesAlreadyAbsent: 0,
    recordsDeleted: 0,
    skipped: 0,
    batchLimit: BATCH_LIMIT,
    batchFull: false,
    failures: [] as CleanupFailure[],
  };
  const respond = () => Response.json(
    {
      ...result,
      ok: result.failures.length === 0,
      recordsRetained: result.mediaFound - result.recordsDeleted,
    },
    { status: result.failures.length ? 500 : 200 },
  );

  let supabase: ReturnType<typeof createAdminClient>;
  let expired: ExpiredMedia[];
  try {
    supabase = createAdminClient();
    const { data, error } = await supabase
      .from("service_media")
      .select("id,storage_path")
      .lt("expires_at", cutoff)
      .like("storage_path", "showcase/%")
      .not("storage_path", "like", "%..%")
      .order("expires_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(BATCH_LIMIT);

    if (error || !Array.isArray(data)) throw new Error("Consulta de mídias falhou.");
    expired = data.slice(0, BATCH_LIMIT) as ExpiredMedia[];
    result.mediaFound = expired.length;
    result.batchFull = expired.length === BATCH_LIMIT;
  } catch {
    result.failures.push({
      mediaIds: [], stage: "query", message: "Não foi possível consultar as mídias expiradas.",
    });
    return respond();
  }

  // Um arquivo pode corresponder a mais de um registro; ele só é removido uma vez.
  const idsByPath = new Map<string, string[]>();
  for (const item of expired) {
    const path = item.storage_path;
    if (typeof path !== "string" || !path.startsWith("showcase/") || path.includes("..")) {
      result.skipped++;
      continue;
    }
    const ids = idsByPath.get(path) ?? [];
    if (!ids.includes(item.id)) ids.push(item.id);
    idsByPath.set(path, ids);
  }

  // No máximo 100 arquivos, sequencialmente, sem disparar um Promise.all ilimitado.
  for (const [path, mediaIds] of idsByPath) {
    try {
      const bucket = supabase.storage.from("service-media");
      const { data, error } = await bucket.remove([path]);
      if (error || !Array.isArray(data)) throw new Error("Remoção no Storage falhou.");

      if (data.some((file) => file.name === path)) {
        result.filesRemoved++;
      } else {
        // remove() retorna os objetos removidos. Uma lista vazia não confirma
        // ausência: info() precisa devolver o erro tipado específico NoSuchKey.
        // Não aceitamos 404 genérico, bucket ausente, permissão ou falha de rede.
        const { error: infoError } = await bucket.info(path);
        if (!(infoError instanceof StorageApiError) ||
            infoError.status !== 404 || infoError.code !== "NoSuchKey") {
          throw new Error("Ausência do arquivo não confirmada.");
        }
        result.filesAlreadyAbsent++;
      }
    } catch {
      result.failures.push({
        mediaIds, stage: "storage", message: "Não foi possível remover o arquivo ou confirmar sua ausência.",
      });
      continue;
    }

    try {
      const { data, error } = await supabase
        .from("service_media")
        .delete()
        .in("id", mediaIds)
        // Uma edição durante a espera não pode apagar o registro de um arquivo novo.
        .eq("storage_path", path)
        .lt("expires_at", cutoff)
        .select("id");

      if (error || !Array.isArray(data)) throw new Error("Exclusão no banco falhou.");
      const deletedIds = new Set(data.map((row) => row.id as string));
      result.recordsDeleted += mediaIds.filter((id) => deletedIds.has(id)).length;
      const retainedIds = mediaIds.filter((id) => !deletedIds.has(id));
      if (retainedIds.length) {
        result.failures.push({
          mediaIds: retainedIds, stage: "database", message: "A exclusão destes registros não foi confirmada.",
        });
      }
    } catch {
      // O registro permanece elegível. A próxima execução confirma NoSuchKey
      // e tenta excluir novamente, sem contar o arquivo como uma nova remoção.
      result.failures.push({
        mediaIds, stage: "database", message: "O arquivo foi removido ou já estava ausente, mas a exclusão dos registros falhou.",
      });
    }
  }

  return respond();
}
