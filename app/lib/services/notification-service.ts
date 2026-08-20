import { createClient } from "../../../lib/supabase/client";

export type InAppNotification = {
  id: string;
  appointmentId: string | null;
  notificationType: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  appointment_id: string | null;
  notification_type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export async function getMyInAppNotifications(
  limit = 20,
): Promise<InAppNotification[]> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Sessão expirada.");
  }

  const { data, error } = await supabase
    .from("notifications")
    .select(`
      id,
      appointment_id,
      notification_type,
      title,
      body,
      read_at,
      created_at
    `)
    .eq("recipient_id", user.id)
    .eq("channel", "in_app")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error("Não foi possível carregar as notificações.");
  }

  return ((data || []) as NotificationRow[]).map((item) => ({
    id: item.id,
    appointmentId: item.appointment_id,
    notificationType: item.notification_type,
    title: item.title,
    body: item.body,
    readAt: item.read_at,
    createdAt: item.created_at,
  }));
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<void> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Sessão expirada.");
  }

  const { error } = await supabase
    .from("notifications")
    .update({
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("recipient_id", user.id)
    .eq("channel", "in_app");

  if (error) {
    throw new Error("Não foi possível marcar a notificação como lida.");
  }
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Sessão expirada.");
  }

  const { error } = await supabase
    .from("notifications")
    .update({
      read_at: new Date().toISOString(),
    })
    .eq("recipient_id", user.id)
    .eq("channel", "in_app")
    .is("read_at", null);

  if (error) {
    throw new Error("Não foi possível marcar as notificações como lidas.");
  }
}