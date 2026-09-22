"use client";

import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";

const COOKIE_NOTICE_KEY = "spaexpress-cookie-notice-v1";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const acknowledged = window.localStorage.getItem(COOKIE_NOTICE_KEY);
      setVisible(acknowledged !== "acknowledged");
    } catch {
      setVisible(true);
    }
  }, []);

  function acknowledgeCookies() {
    try {
      window.localStorage.setItem(
        COOKIE_NOTICE_KEY,
        "acknowledged",
      );
    } finally {
      setVisible(false);
    }
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