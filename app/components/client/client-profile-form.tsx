"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { AuthProfile } from "../../lib/services/auth-service";
import { getClientProfileSettings, updateClientProfileSettings, type ClientProfileSettings } from "../../lib/services/profile-service";
import { formatBrazilianPhone, normalizeBrazilianPhone } from "../../lib/validations/client-signup";

const emptySettings: ClientProfileSettings = { fullName: "", email: "", phone: "", birthDate: "", notes: "", emailNotifications: true, whatsappNotifications: true, inAppNotifications: true };

export function ClientProfileForm({ profile, onNameChange }: { profile: AuthProfile | null; onNameChange: (name: string) => void }) {
  const [form, setForm] = useState<ClientProfileSettings>({ ...emptySettings, fullName: profile?.full_name || "", email: profile?.email || "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    getClientProfileSettings().then((settings) => { setForm({ ...settings, phone: formatBrazilianPhone(settings.phone) }); onNameChange(settings.fullName); }).catch(() => setError("Não foi possível carregar seu perfil.")).finally(() => setLoading(false));
  }, [onNameChange]);

  const update = <K extends keyof ClientProfileSettings>(field: K, value: ClientProfileSettings[K]) => { setForm((current) => ({ ...current, [field]: value })); setError(""); setSuccess(""); };

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    if (form.fullName.trim().split(/\s+/).length < 2) return setError("Informe seu nome e sobrenome.");
    if (normalizeBrazilianPhone(form.phone).length !== 11) return setError("Informe um WhatsApp com DDD e 11 dígitos.");
    if (form.birthDate && new Date(`${form.birthDate}T12:00:00`) > new Date()) return setError("A data de nascimento não pode estar no futuro.");
    setSaving(true);
    try { await updateClientProfileSettings(form); onNameChange(form.fullName.trim()); setSuccess("Dados atualizados com sucesso."); }
    catch { setError("Não foi possível salvar seus dados."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="profile-feedback">Carregando seus dados...</div>;

  return <form className="screen-card profile-form" onSubmit={save}>
    <h2>Meus dados</h2><p>Mantenha seus dados de contato e suas preferências atualizados.</p>
    <div className="form-grid">
      <label>Nome completo<input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} /></label>
      <label>WhatsApp<input inputMode="tel" value={form.phone} onChange={(event) => update("phone", formatBrazilianPhone(event.target.value))} /></label>
      <label>E-mail<input type="email" value={form.email} readOnly /><small>Para sua segurança, a alteração de e-mail terá confirmação separada.</small></label>
      <label>Data de nascimento<input type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={(event) => update("birthDate", event.target.value)} /></label>
      <label className="wide">Observações importantes<textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Preferências de horário ou informações que deseja lembrar." /></label>
    </div>
    <section className="profile-preferences"><h3>Como deseja receber confirmações?</h3>
      <label><input type="checkbox" checked={form.inAppNotifications} onChange={(event) => update("inAppNotifications", event.target.checked)} /><span><b>Notificações no aplicativo</b><small>Avisos dentro da sua conta.</small></span></label>
      <label><input type="checkbox" checked={form.emailNotifications} onChange={(event) => update("emailNotifications", event.target.checked)} /><span><b>E-mail</b><small>Confirmações e alterações pelo Resend quando a integração estiver ativa.</small></span></label>
      <label><input type="checkbox" checked={form.whatsappNotifications} onChange={(event) => update("whatsappNotifications", event.target.checked)} /><span><b>WhatsApp</b><small>Mensagens pelo WhatsApp Business quando a integração estiver ativa.</small></span></label>
    </section>
    {error && <div className="profile-message error">{error}</div>}{success && <div className="profile-message success">{success}</div>}
    <button className="primary" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button>
  </form>;
}