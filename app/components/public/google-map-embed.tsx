"use client";

import { useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";

const MAP_EMBED_URL =
  "https://www.google.com/maps?q=Esta%C3%A7%C3%A3o%20Cambuc%C3%A1s%2C%20Avenida%20Dedo%20de%20Deus%2C%201200%2C%20Centro%2C%20Guapimirim%2C%20RJ%2C%2025940-000&output=embed";

const MAP_EXTERNAL_URL =
  "https://www.google.com/maps/search/?api=1&query=Esta%C3%A7%C3%A3o%20Cambuc%C3%A1s%2C%20Avenida%20Dedo%20de%20Deus%2C%201200%2C%20Centro%2C%20Guapimirim%2C%20RJ%2C%2025940-000";

export function GoogleMapEmbed() {
  const [allowed, setAllowed] = useState(false);

  if (allowed) {
    return (
      <div className="map-frame">
        <iframe
          title="Localização do SPA Express Cambucás na Estação Cambucás"
          src={MAP_EMBED_URL}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="map-consent">
      <span className="map-consent-icon" aria-hidden="true">
        <MapPin />
      </span>

      <div className="map-consent-copy">
        <strong>Mapa do Google</strong>

        <p>
          O mapa é fornecido pelo Google. Ao carregá-lo, o Google
          poderá processar dados técnicos e utilizar cookies de
          acordo com sua própria Política de Privacidade.
        </p>
      </div>

      <div className="map-consent-actions">
        <button
          type="button"
          className="primary"
          onClick={() => setAllowed(true)}
        >
          Carregar mapa
        </button>

        <a
          href={MAP_EXTERNAL_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir no Google Maps
          <ExternalLink aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}