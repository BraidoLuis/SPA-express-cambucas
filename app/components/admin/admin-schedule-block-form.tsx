"use client";
/* eslint-disable react-hooks/set-state-in-effect -- opening the modal intentionally resets its transient form state. */
import { FormEvent, useEffect, useRef, useState } from "react";
import { Ban, Check, X } from "lucide-react";
import {
  createAdminScheduleBlock,
  getAdminActiveProfessionals,
} from "../../lib/services/admin-appointment-service";

export function AdminScheduleBlockForm({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}) {
  const [professionals, setProfessionals] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  const professional = professionals.find((x) => x.id === professionalId);

  useEffect(() => {
    if (!open) return;

    setSuccess(false);
    setReview(false);
    setError("");

    getAdminActiveProfessionals()
      .then(setProfessionals)
      .catch(() => setError("Não foi possível carregar as profissionais."));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => ref.current?.focus());

    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    document.addEventListener("keydown", key);

    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
    };
  }, [onClose, open, saving]);

  function submit(event: FormEvent) {
    event.preventDefault();

    const start = new Date(`${date}T${startTime}:00-03:00`);
    const end = new Date(`${date}T${endTime}:00-03:00`);

    if (
      !professional ||
      !date ||
      !startTime ||
      !endTime ||
      start <= new Date() ||
      end <= start
    ) {
      setError("Informe profissional e um período futuro válido.");
      return;
    }

    setError("");
    setReview(true);
  }

  async function confirm() {
    if (!professional || saving) return;

    setSaving(true);

    try {
      await createAdminScheduleBlock({
        professionalId,
        date,
        startTime,
        endTime,
        reason: reason.slice(0, 300),
      });

      setReview(false);
      setSuccess(true);
      await onCreated();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível criar o bloqueio."
      );
      setReview(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="admin-flow-dialog admin-block-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-block-title"
        tabIndex={-1}
        ref={ref}
      >
        <button
          className="modal-close icon-button"
          onClick={onClose}
          disabled={saving}
          aria-label="Fechar"
        >
          <X aria-hidden="true" />
        </button>

        <span className="eyebrow">AGENDA</span>
        <h2 id="admin-block-title">Bloquear horário</h2>

        {success ? (
          <div className="admin-flow-success">
            <Check aria-hidden="true" />
            <h3>Horário bloqueado</h3>
            <button className="primary" onClick={onClose}>
              Concluir
            </button>
          </div>
        ) : review && professional ? (
          <div className="admin-appointment-review">
            <h3>Confirmar bloqueio?</h3>
            <p>
              <b>{professional.name}</b>
              <br />
              {new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "long",
              }).format(new Date(`${date}T12:00:00-03:00`))}
              , das {startTime} às {endTime}
              {reason.trim() ? ` · ${reason.trim()}` : ""}
            </p>
            <footer>
              <button onClick={() => setReview(false)}>Voltar</button>
              <button
                className="danger button-with-icon"
                disabled={saving}
                onClick={() => void confirm()}
              >
                <Ban aria-hidden="true" />
                {saving ? "Bloqueando..." : "Confirmar bloqueio"}
              </button>
            </footer>
          </div>
        ) : (
          <form onSubmit={submit} className="admin-flow-grid">
            <label className="wide">
              Profissional
              <select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
              >
                <option value="">Selecione</option>
                {professionals.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Data
              <input
                type="date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <label>
              Início
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>

            <label>
              Fim
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>

            <label className="wide">
              Motivo
              <textarea
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Opcional"
              />
            </label>

            {error && (
              <p className="form-error wide" role="alert">
                {error}
              </p>
            )}

            <footer className="wide">
              <button type="button" onClick={onClose}>
                Cancelar
              </button>
              <button className="primary">Revisar bloqueio</button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}