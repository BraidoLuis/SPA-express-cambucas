"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Phone,
} from "lucide-react";
import {
  Logo,
  ThemeToggle,
} from "../shared/spa-ui";
import {
  formatBrazilianPhone,
  normalizeBrazilianPhone,
} from "../../lib/validations/client-signup";
import {
  saveClientPhone,
  type AuthProfile,
} from "../../lib/services/auth-service";

export function CompleteClientProfile({
  profile,
  onComplete,
  onLogout,
}: {
  profile: AuthProfile;
  onComplete: (phone: string) => void;
  onLogout: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] =
    useState(false);

  async function submit(
    event: React.FormEvent,
  ) {
    event.preventDefault();
    setError("");

    const normalized =
      normalizeBrazilianPhone(phone);

    if (!/^[1-9]{2}9\d{8}$/.test(normalized)) {
      setError(
        "Informe um celular válido com DDD.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const savedPhone =
        await saveClientPhone(phone);

      onComplete(savedPhone);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível salvar o celular.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="signup-overlay phone-completion-overlay">
      <div className="signup-visual">
        <img
          src="/client-access.png"
          alt="Profissional do SPA Express Cambucás"
        />

        <div className="signup-visual-shade" />

        <Logo />

        <div className="signup-visual-copy">
          <span className="eyebrow">
            SÓ MAIS UM PASSO
          </span>

          <h1>
            Seu cadastro está
            <br />
            <em>quase completo.</em>
          </h1>

          <p>
            Precisamos apenas do seu celular
            para completar seu perfil e
            identificar seus agendamentos.
          </p>
        </div>
      </div>

      <div className="signup-panel phone-completion-panel">
        <div className="phone-completion-theme">
          <ThemeToggle />
        </div>

        <form
          className="signup-card phone-completion-card"
          onSubmit={submit}
          noValidate
        >
        <div style={{ display: "flex", alignItems: "center" , justifyContent: "space-between" }}>
          <button
            type="button"
            className="signup-back phone-completion-logout"
            onClick={onLogout}
          >
            <ArrowLeft aria-hidden="true" />
            Sair da conta
          </button>

          <span className="access-badge" style={{ marginLeft: "1rem" }}>
            ♡ COMPLETE SEU PERFIL
          </span>
        </div>
          <h2>Qual é o seu celular?</h2>

          <p>
            O Google confirmou seu nome e
            e-mail, mas não compartilha o
            número de telefone.
          </p>

          <div className="phone-completion-account">
            <strong>{profile.full_name}</strong>
            <span>{profile.email}</span>
          </div>

          <label className="phone-completion-field">
            Celular com DDD

            <div
              className={`login-input ${
                error ? "invalid" : ""
              }`}
            >
              <Phone aria-hidden="true" />

              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(
                    formatBrazilianPhone(
                      event.target.value,
                    ),
                  );
                  setError("");
                }}
                placeholder="(21) 99999-9999"
                autoFocus
              />
            </div>
          </label>

          <small className="phone-completion-note">
            O número será usado somente para
            identificação da conta, contato
            relacionado aos atendimentos e
            agendamentos.
          </small>

          {error && (
            <p className="form-server-error">
              {error}
            </p>
          )}

          <button
            className="primary login-submit"
            disabled={submitting}
          >
            {submitting
              ? "Salvando celular..."
              : "Salvar e acessar meus serviços →"}
          </button>
        </form>
      </div>
    </div>
  );
}