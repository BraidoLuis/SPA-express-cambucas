"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { Check, TriangleAlert, X } from "lucide-react";

type ActionDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  danger?: boolean;
  input?: {
    label: string;
    placeholder?: string;
    minLength?: number;
    required?: boolean;
  };
  onCancel: () => void;
  onConfirm: (value: string) => void;
};

export function ActionDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Voltar",
  loading = false,
  danger = false,
  input,
  onCancel,
  onConfirm,
}: ActionDialogProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const cancelRef = useRef(onCancel);
  const loadingRef = useRef(loading);

  useEffect(() => {
    cancelRef.current = onCancel;
    loadingRef.current = loading;
  }, [loading, onCancel]);

  /* Resetting controlled confirmation input for each fresh opening is intentional. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setValue("");
      setError("");
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loadingRef.current) cancelRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [open]);

  if (!open) return null;

  function confirmAction() {
    const normalizedValue = value.trim();
    const minimumLength = input?.minLength || 0;

    if (
      input?.required &&
      normalizedValue.length < minimumLength
    ) {
      setError(
        `Preencha o campo com pelo menos ${minimumLength} caracteres.`,
      );
      return;
    }

    onConfirm(normalizedValue);
  }

  return (
    <div
      className="action-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      <section
        className="action-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-dialog-title"
      >
        <button
          type="button"
          className="action-dialog-close"
          aria-label="Fechar"
          disabled={loading}
          onClick={onCancel}
        >
          <X aria-hidden="true" />
        </button>

        <span
          className={`action-dialog-icon ${
            danger ? "danger" : ""
          }`}
        >
          {danger ? <TriangleAlert aria-hidden="true" /> : <Check aria-hidden="true" />}
        </span>

        <h2 id="action-dialog-title">{title}</h2>
        <p>{description}</p>

        {input && (
          <label className="action-dialog-field">
            {input.label}

            <textarea
              autoFocus
              value={value}
              minLength={input.minLength}
              required={input.required}
              placeholder={input.placeholder}
              onChange={(event) => {
                setValue(event.target.value);
                setError("");
              }}
            />
          </label>
        )}

        {error && (
          <p className="action-dialog-error">
            {error}
          </p>
        )}

        <footer>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={danger ? "danger" : "confirm"}
            disabled={loading}
            onClick={confirmAction}
          >
            {loading ? "Aguarde..." : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
