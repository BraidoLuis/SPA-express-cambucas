"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  Logo,
  ThemeToggle,
} from "../shared/spa-ui";
import { SignUpForm } from "./sign-up-form";
import {
  loginWithGoogle,
  requestPasswordReset,
  updatePassword,
} from "../../lib/services/auth-service";
import {
  ArrowLeft,
} from "lucide-react";

type LoginResult = {
  error?: string;
};

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 18"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.613z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.468-.806 5.956-2.182l-2.909-2.258c-.806.54-1.836.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.963 10.705A5.42 5.42 0 0 1 3.682 9c0-.592.102-1.167.281-1.705V4.963H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.037l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.963l3.007 2.332C4.672 5.166 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function oauthErrorMessage(
  errorCode: string,
) {
  switch (errorCode) {
    case "cancelled":
      return "O acesso com Google foi cancelado.";

    case "team_account":
      return "Esta conta pertence à equipe do SPA e não pode entrar pela área de clientes.";

    case "inactive":
      return "Esta conta está inativa. Entre em contato com o SPA.";

    case "missing_email":
      return "A conta Google não forneceu um endereço de e-mail.";

    case "profile_creation":
    case "profile":
      return "Sua conta Google foi autenticada, mas não foi possível preparar o perfil.";

    default:
      return "Não foi possível entrar com Google. Tente novamente.";
  }
}

export function LoginScreen({
  role,
  close,
  onLogin,
}: {
  role: "admin" | "client";
  close: () => void;
  onLogin: (
    email: string,
    password: string,
  ) => Promise<LoginResult>;
}) {
  const admin = role === "admin";

  const recovering =
    !admin &&
    new URLSearchParams(
      typeof window === "undefined"
        ? ""
        : window.location.search,
    ).get("reset") === "1";

  const [show, setShow] = useState(false);
  const [creating, setCreating] =
    useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");
  const [submitting, setSubmitting] =
    useState(false);
  const [
    googleSubmitting,
    setGoogleSubmitting,
  ] = useState(false);
  const [message, setMessage] =
    useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (admin || recovering) {
      return;
    }

    const url = new URL(
      window.location.href,
    );

    const oauthError =
      url.searchParams.get("oauth_error");

    if (!oauthError) {
      return;
    }

    setError(
      oauthErrorMessage(oauthError),
    );

    /*
     * Remove apenas o erro da URL, mantendo
     * ?access=client.
     */
    url.searchParams.delete("oauth_error");

    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [admin, recovering]);

  async function submit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!email || !password) {
      return setError(
        "Informe seu e-mail e sua senha.",
      );
    }

    setSubmitting(true);

    const result = await onLogin(
      email,
      password,
    );

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    }
  }

  async function continueWithGoogle() {
    setError("");
    setMessage("");
    setGoogleSubmitting(true);

    try {
      await loginWithGoogle();
    } catch {
      setError(
        "Não foi possível iniciar o acesso com Google. Tente novamente.",
      );
      setGoogleSubmitting(false);
    }
  }

  async function forgotPassword() {
    setError("");
    setMessage("");

    if (!email) {
      return setError(
        "Digite seu e-mail para receber o link de recuperação.",
      );
    }

    setSubmitting(true);

    try {
      await requestPasswordReset(email);

      setMessage(
        "Enviamos o link de recuperação para o seu e-mail.",
      );
    } catch {
      setError(
        "Não foi possível enviar o link. Verifique o e-mail e tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function savePassword(
    event: React.FormEvent,
  ) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      return setError(
        "A nova senha precisa ter pelo menos 8 caracteres.",
      );
    }

    if (password !== confirmPassword) {
      return setError(
        "As senhas não coincidem.",
      );
    }

    setSubmitting(true);

    try {
      await updatePassword(password);

      setMessage(
        "Senha alterada. Você já pode entrar com a nova senha.",
      );

      window.history.replaceState(
        {},
        "",
        "?access=client",
      );
    } catch {
      setError(
        "O link expirou ou é inválido. Solicite uma nova recuperação.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`login-screen ${
        admin
          ? "admin-access"
          : "client-access"
      }`}
    >
      <div className="login-theme-control">
        <ThemeToggle />
      </div>

      {!admin && creating && (
        <SignUpForm
          onBack={() =>
            setCreating(false)
          }
          onSuccess={() => {
            setCreating(false);
            setMessage(
              "Conta criada! Confirme seu e-mail antes de entrar.",
            );
          }}
        />
      )}

      <div className="login-brand">
        <img
          className="login-photo"
          src={
            admin
              ? "/team-access.png"
              : "/client-access.png"
          }
          alt={
            admin
              ? "Equipe do SPA Express Cambucás"
              : "Profissional do SPA Express Cambucás"
          }
        />

        <div className="login-overlay" />

        <button
          className="button-with-icon"
          onClick={close}
        >
          <ArrowLeft aria-hidden="true" />
          Voltar ao site
        </button>

        <Logo />

        <div className="login-message">
          <span className="eyebrow">
            {admin
              ? "GESTÃO SPA EXPRESS"
              : "SEU MOMENTO DE CUIDADO"}
          </span>

          <h1>
            {admin ? (
              <>
                Cada profissional,
                <br />
                <em>
                  seu próprio espaço.
                </em>
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
              : "Entre para acompanhar seus horários e reservar seu próximo momento."}
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
          <img
            src={
              admin
                ? "/team-access.png"
                : "/client-access.png"
            }
            alt=""
          />

          <div className="mobile-login-shade" />

          <button
            className="icon-button"
            onClick={close}
            aria-label="Voltar ao site"
            title="Voltar ao site"
          >
            <ArrowLeft aria-hidden="true" />
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

        <form
          className="login-box"
          onSubmit={
            recovering
              ? savePassword
              : submit
          }
        >
          <div className="logo-box">
            <span className="eyebrow">
              SPA EXPRESS CAMBUCÁS
            </span>
          </div>

          <h2>
            {recovering
              ? "Crie uma nova senha"
              : admin
              ? "Acesse seu espaço"
              : "Entre na sua conta"}
          </h2>

          <p>
            {recovering
              ? "Escolha uma senha segura para recuperar o acesso."
              : admin
              ? "Administradora e profissionais entram com seus próprios e-mails."
              : "Acompanhe seus agendamentos e cuide de você com tranquilidade."}
          </p>

          {!recovering && (
            <>
              <label>E-mail</label>

              <div className="login-input">
                <span>✉</span>

                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value,
                    )
                  }
                  placeholder="seu@email.com"
                />
              </div>
            </>
          )}

          <label>
            {recovering
              ? "Nova senha"
              : "Senha"}
          </label>

          <div className="login-input">
            <span>⌑</span>

            <input
              type={
                show
                  ? "text"
                  : "password"
              }
              autoComplete={
                recovering
                  ? "new-password"
                  : "current-password"
              }
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              placeholder="Mínimo de 8 caracteres"
            />

            <button
              type="button"
              onClick={() =>
                setShow(!show)
              }
            >
              {show
                ? "Ocultar"
                : "Exibir"}
            </button>
          </div>

          {recovering && (
            <>
              <label>
                Confirmar nova senha
              </label>

              <div className="login-input">
                <span>⌑</span>

                <input
                  type={
                    show
                      ? "text"
                      : "password"
                  }
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value,
                    )
                  }
                />
              </div>
            </>
          )}

          {!recovering && (
            <div className="login-options">
              <button
                type="button"
                onClick={forgotPassword}
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          {error && (
            <p className="form-server-error">
              {error}
            </p>
          )}

          {message && (
            <p className="form-success-message">
              {message}
            </p>
          )}

          <button
            className="primary login-submit"
            disabled={
              submitting ||
              googleSubmitting
            }
          >
            {submitting
              ? "Aguarde..."
              : recovering
              ? "Salvar nova senha →"
              : admin
              ? "Entrar no painel →"
              : "Entrar na minha conta →"}
          </button>

          {!admin && !recovering && (
            <>
              <div className="login-divider">
                <span>ou</span>
              </div>

              <button
                type="button"
                className="google-login-button"
                onClick={
                  continueWithGoogle
                }
                disabled={
                  submitting ||
                  googleSubmitting
                }
              >
                <GoogleIcon />

                <span>
                  {googleSubmitting
                    ? "Conectando ao Google..."
                    : "Continuar com Google"}
                </span>
              </button>

              <p className="signup" style={{ marginTop: '10px', marginBottom: '0' }}>
                Primeira vez por aqui?{" "}

                <button
                  type="button"
                  onClick={() =>
                    setCreating(true)
                  }
                >
                  Criar minha conta
                </button>
              </p>
            </>
          )}
        </form>
      </div>
    </div>
  );
}