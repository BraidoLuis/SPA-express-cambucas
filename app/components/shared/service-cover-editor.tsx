"use client";

import { useEffect, useId, useState } from "react";
import {
  serviceCoverMegabytes,
  validateServiceCover,
  type CoverImageChange,
} from "../../lib/services/service-cover-image-service";
import { ServiceCoverImage } from "./service-cover-image";
import { ImagePlus, RotateCcw, Trash2 } from "lucide-react";

function revokePreview(url: string) {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
}

export function ServiceCoverEditor({
  currentUrl,
  serviceName,
  disabled = false,
  onChange,
  onError,
}: {
  currentUrl?: string | null;
  serviceName: string;
  disabled?: boolean;
  onChange: (change: CoverImageChange) => void;
  onError: (message: string) => void;
}) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [removed, setRemoved] = useState(false);

  useEffect(() => () => revokePreview(previewUrl), [previewUrl]);

  function clearSelection(next: CoverImageChange = { kind: "keep" }) {
    revokePreview(previewUrl);
    setPreviewUrl("");
    setFile(null);
    setRemoved(next.kind === "remove");
    onChange(next);
  }

  return (
    <fieldset className="service-cover-fieldset">
      <legend>Imagem de capa</legend>

      <div className="service-cover-editor">
        <ServiceCoverImage
          src={previewUrl || (!removed ? currentUrl : null)}
          alt={serviceName || "serviço"}
        />

        <div className="service-cover-controls">
          <div className="service-file-row">
            <label
              className="button button--outline service-cover-picker"
              htmlFor={inputId}
              tabIndex={disabled ? -1 : 0}
            >
              <ImagePlus aria-hidden="true" />{" "}
              {file || currentUrl ? "Trocar imagem" : "Selecionar imagem"}
            </label>

            <input
              className="visually-hidden-file"
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={disabled}
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (!selected) return;

                try {
                  validateServiceCover(selected);

                  revokePreview(previewUrl);

                  const nextPreview = URL.createObjectURL(selected);
                  setPreviewUrl(nextPreview);
                  setFile(selected);
                  setRemoved(false);
                  onChange({ kind: "replace", file: selected });
                  onError("");
                } catch (error) {
                  event.currentTarget.value = "";
                  onError(
                    error instanceof Error ? error.message : "Imagem inválida."
                  );
                }
              }}
            />

            <span className="service-file-name" title={file?.name}>
              {file?.name ||
                (currentUrl && !removed ? "Imagem atual" : "Nenhum arquivo selecionado")}
            </span>
          </div>

          <small>
            {file
              ? `${serviceCoverMegabytes(file.size)} MB de 3 MB · JPG, PNG ou WEBP.`
              : "JPG, PNG ou WEBP, até 3 MB."}
          </small>

          <div className="service-cover-actions">
            {file && (
              <button
                type="button"
                className="button button--ghost"
                disabled={disabled}
                onClick={() => clearSelection()}
              >
                <RotateCcw aria-hidden="true" /> Cancelar nova seleção
              </button>
            )}

            {!file && currentUrl && !removed && (
              <button
                type="button"
                className="button button--danger-ghost"
                disabled={disabled}
                onClick={() => clearSelection({ kind: "remove" })}
              >
                <Trash2 aria-hidden="true" /> Remover imagem
              </button>
            )}

            {removed && currentUrl && (
              <button
                type="button"
                className="button button--ghost"
                disabled={disabled}
                onClick={() => clearSelection()}
              >
                <RotateCcw aria-hidden="true" /> Manter imagem atual
              </button>
            )}
          </div>
        </div>
      </div>
    </fieldset>
  );
}