"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Play,
} from "lucide-react";
import {
  getActiveShowcase,
  showcaseAlt,
  type ShowcaseMedia,
} from "../../lib/services/showcase-media-service";

type ShowcaseVideoProps = {
  src: string;
  title?: string;
};

function ShowcaseVideo({
  src,
  title,
}: ShowcaseVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function handlePlay() {
    const video = videoRef.current;

    if (!video) return;

    video.play().catch(() => {
      setIsPlaying(false);
    });
  }

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        controls={isPlaying}
        playsInline
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {!isPlaying && (
        <button
          type="button"
          className="showcase-play-button"
          onClick={handlePlay}
          aria-label={`Reproduzir ${title || "vídeo"}`}
          title={`Reproduzir ${title || "vídeo"}`}
        >
          <Play
            aria-hidden="true"
            fill="currentColor"
          />
        </button>
      )}
    </>
  );
}

export function ShowcaseCarousel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [items, setItems] = useState<ShowcaseMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    getActiveShowcase()
      .then((data) => {
        if (active) {
          setItems(data);
        }
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível carregar a vitrine.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="showcase-feedback">
        Carregando inspirações...
      </div>
    );
  }

  if (error) {
    return (
      <div className="showcase-feedback error">
        {error}
      </div>
    );
  }

  if (!items.length) {
    return null;
  }

  return (
    <section
      className={`client-media-showcase showcase-section ${
        compact ? "compact" : ""
      }`}
    >
      <div className="client-media-heading">
        <div>
          <span className="eyebrow">
            INSPIRAÇÕES DO SPA
          </span>

          <h2>Veja nossos cuidados de perto</h2>

          <p>
            Novidades publicadas pela equipe para
            inspirar seu próximo momento.
          </p>
        </div>

        <div className="carousel-arrows">
          <button
            type="button"
            className="icon-button"
            aria-label="Conteúdo anterior"
            title="Conteúdo anterior"
            onClick={() =>
              track.current?.scrollBy({
                left: -380,
                behavior: "smooth",
              })
            }
          >
            <ChevronLeft aria-hidden="true" />
          </button>

          <button
            type="button"
            className="icon-button"
            aria-label="Próximo conteúdo"
            title="Próximo conteúdo"
            onClick={() =>
              track.current?.scrollBy({
                left: 380,
                behavior: "smooth",
              })
            }
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className="client-media-carousel"
        ref={track}
      >
        {items.map((item) => (
          <article key={item.id}>
            <div className="client-media-asset">
              {item.type === "video" ? (
                <ShowcaseVideo
                  src={item.url || ""}
                  title={item.title}
                />
              ) : (
                <img
                  src={item.url || ""}
                  alt={showcaseAlt(item)}
                  loading="lazy"
                />
              )}

              {item.professionalName && (
                <span>{item.professionalName}</span>
              )}
            </div>

            <div>
              {item.serviceName && (
                <small>{item.serviceName}</small>
              )}

              <h3>{item.title}</h3>

              {item.caption && (
                <p>{item.caption}</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}