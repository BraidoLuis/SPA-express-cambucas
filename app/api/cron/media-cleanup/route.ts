import { createAdminClient } from "../../../../lib/supabase/admin";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Não autorizado", { status: 401 });
  const supabase = createAdminClient();
  const { data: expired, error } = await supabase.from("service_media").select("id,storage_path").lt("expires_at", new Date().toISOString());
  if (error) return Response.json({ error }, { status: 500 });
  const paths = (expired ?? [])
    .map((item) => item.storage_path)
    .filter((path): path is string => Boolean(path?.startsWith("showcase/") && !path.includes("..")));
  if (paths.length) await supabase.storage.from("service-media").remove(paths);
  if (expired?.length) await supabase.from("service_media").delete().in("id", expired.map((item) => item.id));
  return Response.json({ removed: expired?.length ?? 0 });
}
