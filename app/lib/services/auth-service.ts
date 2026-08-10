import { createClient } from "../../../lib/supabase/client";
import { normalizeBrazilianPhone, type ClientSignupData } from "../validations/client-signup";

export async function registerClient(data: ClientSignupData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return { demo: true };
  const supabase = createClient();
  const { data: auth, error } = await supabase.auth.signUp({
    email: data.email.trim().toLowerCase(),
    password: data.password,
    options: {
      data: {
        full_name: data.fullName.trim(),
        phone: `55${normalizeBrazilianPhone(data.phone)}`,
        role: "client",
        email_notifications: data.emailNotifications,
        whatsapp_notifications: data.whatsappNotifications,
      },
    },
  });
  if (error) throw error;
  if (auth.user) {
    await supabase.from("notification_preferences").upsert({ profile_id: auth.user.id, email_enabled: data.emailNotifications, whatsapp_enabled: data.whatsappNotifications, in_app_enabled: true });
  }
  return { demo: false, user: auth.user };
}
