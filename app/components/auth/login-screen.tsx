"use client";

import { useState } from "react";
import { Logo, ThemeToggle } from "../shared/spa-ui";
import { SignUpForm } from "./sign-up-form";
import { requestPasswordReset, updatePassword } from "../../lib/services/auth-service";
import { ArrowLeft, Heart, Settings } from "lucide-react";

type LoginResult = { error?: string };

export function LoginScreen({ role, close, onLogin }: {
  role: "admin" | "client";
  close: () => void;
  onLogin: (email: string, password: string) => Promise<LoginResult>;
}) {
  const admin = role === "admin";
  const recovering = !admin && new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("reset") === "1";
  const [show, setShow] = useState(false);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    if (!email || !password) return setError("Informe seu e-mail e sua senha.");
    setSubmitting(true);
    const result = await onLogin(email, password);
    setSubmitting(false);
    if (result.error) setError(result.error);
  }

  async function forgotPassword() {
    setError(""); setMessage("");
    if (!email) return setError("Digite seu e-mail para receber o link de recuperação.");
    setSubmitting(true);
    try { await requestPasswordReset(email); setMessage("Enviamos o link de recuperação para o seu e-mail."); }
    catch { setError("Não foi possível enviar o link. Verifique o e-mail e tente novamente."); }
    finally { setSubmitting(false); }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (password.length < 8) return setError("A nova senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirmPassword) return setError("As senhas não coincidem.");
    setSubmitting(true);
    try { await updatePassword(password); setMessage("Senha alterada. Você já pode entrar com a nova senha."); window.history.replaceState({}, "", "?access=client"); }
    catch { setError("O link expirou ou é inválido. Solicite uma nova recuperação."); }
    finally { setSubmitting(false); }
  }

  return <div className={`login-screen ${admin ? "admin-access" : "client-access"}`}>
    <div className="login-theme-control"><ThemeToggle /></div>
    {!admin && creating && <SignUpForm onBack={() => setCreating(false)} onSuccess={() => { setCreating(false); setMessage("Conta criada! Confirme seu e-mail antes de entrar."); }} />}
    <div className="login-brand">
      <img className="login-photo" src={admin ? "/team-access.png" : "/client-access.png"} alt={admin ? "Equipe do SPA Express Cambucás" : "Profissional do SPA Express Cambucás"} />
      <div className="login-overlay" /><button className="button-with-icon" onClick={close}><ArrowLeft aria-hidden="true" /> Voltar ao site</button><Logo />
      <div className="login-message"><span className="eyebrow">{admin ? "GESTÃO SPA EXPRESS" : "SEU MOMENTO DE CUIDADO"}</span><h1>{admin ? <>Cada profissional,<br /><em>seu próprio espaço.</em></> : <>Seu bem-estar<br /><em>começa aqui.</em></>}</h1><p>{admin ? "A administradora acompanha toda a operação, enquanto cada profissional acessa somente sua agenda e seus serviços." : "Entre para acompanhar seus horários e reservar seu próximo momento."}</p></div>
      <div className="login-quote"><span>✦</span><p>{admin ? "Organização para cuidar ainda melhor." : "Você merece um tempo só seu."}</p></div>
    </div>
    <div className="login-side"><div className="mobile-login-hero"><img src={admin ? "/team-access.png" : "/client-access.png"} alt="" /><div className="mobile-login-shade" /><button className="icon-button" onClick={close} aria-label="Voltar ao site" title="Voltar ao site"><ArrowLeft aria-hidden="true" /></button><Logo compact /><div><span>✦</span><p>{admin ? "Seu espaço de trabalho, do seu jeito." : "Você merece um momento só seu."}</p></div></div>
      <form className="login-box" onSubmit={recovering ? savePassword : submit}>
      <div className="logo-box">
        <div className="access-badge">{admin ? <> ACESSO DA EQUIPE</> : <> ÁREA DA CLIENTE</>}</div>
        <span className="eyebrow">SPA EXPRESS CAMBUCÁS</span>
      </div>
        <h2>{recovering ? "Crie uma nova senha" : admin ? "Acesse seu espaço" : "Entre na sua conta"}</h2>
        <p>{recovering ? "Escolha uma senha segura para recuperar o acesso." : admin ? "Administradora e profissionais entram com seus próprios e-mails." : "Acompanhe seus agendamentos e cuide de você com tranquilidade."}</p>
        {!recovering && <><label>E-mail</label><div className="login-input"><span>✉</span><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" /></div></>}
        <label>{recovering ? "Nova senha" : "Senha"}</label><div className="login-input"><span>⌑</span><input type={show ? "text" : "password"} autoComplete={recovering ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" /><button type="button" onClick={() => setShow(!show)}>{show ? "Ocultar" : "Exibir"}</button></div>
        {recovering && <><label>Confirmar nova senha</label><div className="login-input"><span>⌑</span><input type={show ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div></>}
        {!recovering && <div className="login-options"><button type="button" onClick={forgotPassword}>Esqueci minha senha</button></div>}
        {error && <p className="form-server-error">{error}</p>}{message && <p className="form-success-message">{message}</p>}
        <button className="primary login-submit" disabled={submitting}>{submitting ? "Aguarde..." : recovering ? "Salvar nova senha →" : admin ? "Entrar no painel →" : "Entrar na minha conta →"}</button>
        {!admin && !recovering && <><div className="login-divider"><span>ou</span></div><p className="signup">Primeira vez por aqui? <button type="button" onClick={() => setCreating(true)}>Criar minha conta</button></p></>}
        <div className="login-security"><span>⌾</span><p><b>Acesso individual e seguro</b><small>{admin ? "Cada conta visualiza apenas as informações permitidas ao seu perfil." : "Seus dados são protegidos pelo Supabase Auth."}</small></p></div>
      </form>
    </div>
  </div>;
}
