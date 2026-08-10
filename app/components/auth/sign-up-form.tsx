"use client";

import { useState } from "react";
import { registerClient } from "../../lib/services/auth-service";
import { formatBrazilianPhone, validateClientSignup, type ClientSignupData, type SignupErrors } from "../../lib/validations/client-signup";
import { Logo } from "../shared/spa-ui";

const initialData: ClientSignupData = { fullName: "", phone: "", email: "", password: "", confirmPassword: "", emailNotifications: true, whatsappNotifications: true, privacyAccepted: false };

export function SignUpForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState(initialData);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const update = <K extends keyof ClientSignupData>(field: K, value: ClientSignupData[K]) => { setForm((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined })); };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validation = validateClientSignup(form);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setSubmitting(true); setServerError("");
    try { await registerClient(form); onSuccess(); } catch (error) { setServerError(error instanceof Error ? error.message : "Não foi possível criar a conta."); } finally { setSubmitting(false); }
  }
  return <div className="signup-overlay">
    <div className="signup-visual"><img src="/team-access.png" alt="Profissionais do SPA Express Cambucás" /><div className="signup-visual-shade" /><Logo /><div className="signup-visual-copy"><span className="eyebrow">SEU ESPAÇO DE AUTOCUIDADO</span><h1>Um novo momento<br /><em>começa por você.</em></h1><p>Crie sua conta para escolher serviços, conferir horários e acompanhar seus agendamentos.</p></div></div>
    <div className="signup-panel"><form className="signup-card" onSubmit={submit} noValidate>
      <button type="button" className="signup-back" onClick={onBack}>← Voltar ao login</button><span className="access-badge">♡ NOVA CLIENTE</span><h2>Crie sua conta</h2><p>Os dados abaixo também serão usados para enviar confirmações seguras de agendamento.</p>
      <div className="signup-grid">
        <label>Nome completo<div className={`login-input ${errors.fullName ? "invalid" : ""}`}><span>♡</span><input autoComplete="name" value={form.fullName} onChange={(event)=>update("fullName",event.target.value)} placeholder="Nome e sobrenome" /></div>{errors.fullName && <small className="field-error">{errors.fullName}</small>}</label>
        <label>WhatsApp<div className={`login-input ${errors.phone ? "invalid" : ""}`}><span>☏</span><input inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event)=>update("phone",formatBrazilianPhone(event.target.value))} placeholder="(21) 99999-9999" /></div>{errors.phone && <small className="field-error">{errors.phone}</small>}</label>
        <label className="wide">E-mail<div className={`login-input ${errors.email ? "invalid" : ""}`}><span>✉</span><input type="email" autoComplete="email" value={form.email} onChange={(event)=>update("email",event.target.value)} placeholder="seu@email.com" /></div>{errors.email && <small className="field-error">{errors.email}</small>}</label>
        <label>Senha<div className={`login-input ${errors.password ? "invalid" : ""}`}><span>⌑</span><input type={showPassword?"text":"password"} autoComplete="new-password" value={form.password} onChange={(event)=>update("password",event.target.value)} placeholder="8+ caracteres" /></div>{errors.password && <small className="field-error">{errors.password}</small>}</label>
        <label>Confirmar senha<div className={`login-input ${errors.confirmPassword ? "invalid" : ""}`}><span>⌑</span><input type={showPassword?"text":"password"} autoComplete="new-password" value={form.confirmPassword} onChange={(event)=>update("confirmPassword",event.target.value)} placeholder="Repita sua senha" /><button type="button" onClick={()=>setShowPassword(!showPassword)}>{showPassword?"Ocultar":"Exibir"}</button></div>{errors.confirmPassword && <small className="field-error">{errors.confirmPassword}</small>}</label>
      </div>
      <div className="signup-preferences"><h3>Confirmações de agendamento</h3><label><input type="checkbox" checked={form.emailNotifications} onChange={(event)=>update("emailNotifications",event.target.checked)} /><span><b>Receber por e-mail</b><small>Confirmações e alterações enviadas pelo Resend.</small></span></label><label><input type="checkbox" checked={form.whatsappNotifications} onChange={(event)=>update("whatsappNotifications",event.target.checked)} /><span><b>Receber pelo WhatsApp</b><small>Mensagens de serviço pelo WhatsApp Business.</small></span></label><label><input type="checkbox" checked={form.privacyAccepted} onChange={(event)=>update("privacyAccepted",event.target.checked)} /><span><b>Autorizo o uso dos dados para minha conta e agendamentos</b><small>Você pode alterar as preferências de comunicação no perfil.</small></span></label>{errors.privacyAccepted && <small className="field-error">{errors.privacyAccepted}</small>}</div>
      {serverError && <p className="form-server-error">{serverError}</p>}<button className="primary login-submit" disabled={submitting}>{submitting?"Criando conta...":"Criar conta e continuar →"}</button><p className="signup-terms">O WhatsApp informado é validado no formato brasileiro e o e-mail é confirmado pelo Supabase Auth.</p>
    </form></div>
  </div>;
}
