"use client";

import { useState } from "react";

export function ServiceCoverImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;

  return failed ? (
    <div className={`service-cover-fallback ${className || ""}`} role="img" aria-label={`Imagem indisponível para ${alt}`}>
      <span aria-hidden="true">✦</span><small>SPA Express Cambucás</small>
    </div>
  ) : (
    <img className={className} src={src!} alt={alt} loading="lazy" onError={() => setFailedSrc(src!)} />
  );
}
