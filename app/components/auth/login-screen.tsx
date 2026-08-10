"use client";
import { useState } from "react";
import { Logo, ThemeToggle } from "../shared/spa-ui";
import { SignUpForm } from "./sign-up-form";
export type TeamAccount = "admin" | "Eliane" | "Dayanne";
export function LoginScreen({
  role,
  close,
  onLogin,
  onTeamLogin,
}: {
  role: "admin" | "client";
  close: () => void;
  onLogin?: (role: "client") => void;
  onTeamLogin?: (account: TeamAccount) => void;
}) {
  const [show, setShow] = useState(false);
  const admin = role === "admin";
  const [account, setAccount] = useState<TeamAccount>("admin");
  const [creating, setCreating] = useState(false);
  const teamEmail =
    account === "admin"
      ? "admin@spaexpress.com.br"
      : account === "Eliane"
        ? "eliane@spaexpress.com.br"
        : "dayanne@spaexpress.com.br";
  return (
    <div className={`login-screen ${admin ? "admin-access" : "client-access"}`}>
      <div className="login-theme-control">
        <ThemeToggle />
      </div>
      {!admin && creating && <SignUpForm onBack={() => setCreating(false)} onSuccess={() => onLogin?.("client")} />}
      <div className="login-brand">
        <img
          className="login-photo"
          src={admin ? "/team-access.png" : "/client-access.png"}
          alt={
            admin
              ? "Equipe do SPA Express Cambucás"
              : "Profissional do SPA Express Cambucás"
          }
        />
        <div className="login-overlay" />
        <button onClick={close}>← Voltar ao site</button>
        <Logo />
        <div className="login-message">
          <span className="eyebrow">
            {admin ? "GESTÃO SPA EXPRESS" : "SEU MOMENTO DE CUIDADO"}
          </span>
          <h1>
            {admin ? (
              <>
                Cada profissional,
                <br />
                <em>seu próprio espaço.</em>
              </>
            ) : (
              <>
                Seu bem-estar
                <br />
                <em>começa aqui.</em>
              </>
            )}
          </h1>
          <p>
            {admin
              ? "A administradora acompanha toda a operação, enquanto cada profissional acessa somente sua agenda e seus serviços."
              : "Entre para acompanhar seus horários, rever seus cuidados favoritos e reservar seu próximo momento."}
          </p>
        </div>
        <div className="login-quote">
          <span>✦</span>
          <p>
            {admin
              ? "Organização para cuidar ainda melhor."
              : "Você merece um tempo só seu."}
          </p>
        </div>
      </div>
      <div className="login-side">
        <div className="mobile-login-hero">
          <img src={admin ? "/team-access.png" : "/client-access.png"} alt="" />
          <div className="mobile-login-shade" />
          <button onClick={close} aria-label="Voltar ao site">
            ←
          </button>
          <Logo compact />
          <div>
            <span>✦</span>
            <p>
              {admin
                ? "Seu espaço de trabalho, do seu jeito."
                : "Você merece um momento só seu."}
            </p>
          </div>
        </div>
        <div className="login-box">
          <div className="access-badge">
            {admin ? "⚙ ACESSO DA EQUIPE" : "♡ ÁREA DA CLIENTE"}
          </div>
          <span className="eyebrow">
            {admin ? "SPA EXPRESS CAMBUCÁS" : "BEM-VINDA DE VOLTA"}
          </span>
          <h2>{admin ? "Quem está acessando?" : "Entre na sua conta"}</h2>
          <p>
            {admin
              ? "Escolha um perfil para visualizar como será cada ambiente."
              : "Acompanhe seus agendamentos e cuide de você com tranquilidade."}
          </p>
          {admin && (
            <div className="team-account-picker">
              {(["admin", "Eliane", "Dayanne"] as TeamAccount[]).map(
                (item, i) => (
                  <button
                    className={account === item ? "active" : ""}
                    onClick={() => setAccount(item)}
                    key={item}
                  >
                    <span>{["AD", "EC", "DC"][i]}</span>
                    <div>
                      <b>{item === "admin" ? "Administradora" : item}</b>
                      <small>
                        {item === "admin"
                          ? "Acesso completo"
                          : item === "Eliane"
                            ? "Estética e massagens"
                            : "Manicure e unhas"}
                      </small>
                    </div>
                    {account === item && <strong>✓</strong>}
                  </button>
                ),
              )}
            </div>
          )}
          <label>E-mail</label>
          <div className="login-input">
            <span>✉</span>
            <input
              type="email"
              key={teamEmail}
              defaultValue={admin ? teamEmail : "cliente@email.com"}
            />
          </div>
          <label>Senha</label>
          <div className="login-input">
            <span>⌑</span>
            <input type={show ? "text" : "password"} defaultValue="12345678" />
            <button onClick={() => setShow(!show)}>
              {show ? "Ocultar" : "Exibir"}
            </button>
          </div>
          <div className="login-options">
            <label>
              <input type="checkbox" /> Manter conectado
            </label>
            <button>Esqueci minha senha</button>
          </div>
          <button
            className="primary login-submit"
            onClick={() =>
              admin ? onTeamLogin?.(account) : onLogin?.("client")
            }
          >
            {admin
              ? account === "admin"
                ? "Acessar painel administrativo"
                : `Acessar como ${account}`
              : "Entrar na minha conta"}{" "}
            →
          </button>
          {!admin && (
            <>
              <div className="login-divider">
                <span>ou</span>
              </div>
              <p className="signup">
                Primeira vez por aqui?{" "}
                <button onClick={() => setCreating(true)}>
                  Criar minha conta
                </button>
              </p>
            </>
          )}
          <div className="login-security">
            <span>⌾</span>
            <p>
              <b>Acesso individual e seguro</b>
              <small>
                {admin
                  ? "Cada conta visualiza apenas as informações permitidas ao seu perfil."
                  : "Seus dados são protegidos e usados apenas para seus atendimentos."}
              </small>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

