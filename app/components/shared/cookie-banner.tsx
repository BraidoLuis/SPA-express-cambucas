"use client";

import { useBrowserPreference, writeBrowserPreference } from "./browser-preferences";
import { Cookie } from "lucide-react";

const COOKIE_NOTICE_KEY = "spaexpress-cookie-notice-v1";

export function CookieBanner() {
  const acknowledged = useBrowserPreference(COOKIE_NOTICE_KEY, "", "acknowledged");
  const visible = acknowledged !== "acknowledged";

  function acknowledgeCookies() {
    writeBrowserPreference(COOKIE_NOTICE_KEY, "acknowledged");
  }

  if (!visible) {
    return null;
  }

  return (
    <section
      className="cookie-banner"
      role="region"
      aria-label="Aviso sobre cookies"
    >
      <div className="cookie-banner-icon" aria-hidden="true">
        <Cookie />
      </div>

      <div className="cookie-banner-content">
        <strong>Sua privacidade importa</strong>

        <p>
            Utilizamos cookies e tecnologias semelhantes estritamente
            necessários para manter sua sessão, permitir o login seguro e
            disponibilizar os agendamentos. Conteúdos externos, como o Google
            Maps, somente são carregados após sua escolha.
        </p>

        <a href="/politica-de-privacidade">
          Consulte nossa Política de Privacidade
        </a>
      </div>

      <button
        type="button"
        className="cookie-banner-button"
        onClick={acknowledgeCookies}
      >
        Entendi
      </button>
    </section>
  );
}