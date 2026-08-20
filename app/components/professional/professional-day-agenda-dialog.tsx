"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  Clock3,
  UserRound,
  X,
} from "lucide-react";
import type {
  ProfessionalAppointment,
} from "../../lib/services/professional-agenda-service";
import type {
  ProfessionalScheduleBlock,
} from "../../lib/services/professional-schedule-block-service";

type ProfessionalDayAgendaDialogProps = {
  open: boolean;
  date: string | null;
  appointments: ProfessionalAppointment[];
  blocks: ProfessionalScheduleBlock[];
  blockRemoving: boolean;
  onClose: () => void;
  onRequestRemoveBlock: (
    block: ProfessionalScheduleBlock,
  ) => void;
  renderActions: (
    appointment: ProfessionalAppointment,
  ) => ReactNode;
  renderCompletion: (
    appointment: ProfessionalAppointment,
  ) => ReactNode;
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(
    "pt-BR",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
    .format(value)
    .replace(/[\u00A0\u202F]/g, " ");
}

export function ProfessionalDayAgendaDialog({
  open,
  date,
  appointments,
  blocks,
  blockRemoving,
  onClose,
  onRequestRemoveBlock,
  renderActions,
  renderCompletion,
}: ProfessionalDayAgendaDialogProps) {
  const closeButtonRef =
    useRef<HTMLButtonElement>(null);

  const orderedAppointments = useMemo(
    () =>
      [...appointments].sort((first, second) => {
        const firstCancelled =
          first.status === "cancelled" ? 1 : 0;
        const secondCancelled =
          second.status === "cancelled" ? 1 : 0;

        if (firstCancelled !== secondCancelled) {
          return firstCancelled - secondCancelled;
        }

        return (
          new Date(first.start).getTime() -
          new Date(second.start).getTime()
        );
      }),
    [appointments],
  );

  const orderedBlocks = useMemo(
    () =>
      [...blocks].sort(
        (first, second) =>
          new Date(first.start).getTime() -
          new Date(second.start).getTime(),
      ),
    [blocks],
  );

  useEffect(() => {
    if (!open) return;

    const previousOverflow =
      document.body.style.overflow;
    const previouslyFocused =
      document.activeElement as HTMLElement | null;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open || !date) return null;

  const activeAppointments =
    orderedAppointments.filter(
      (item) => item.status !== "cancelled",
    ).length;

  const cancelledAppointments =
    orderedAppointments.filter(
      (item) => item.status === "cancelled",
    ).length;

  return (
    <div
      className="admin-day-agenda-backdrop professional-day-agenda-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="admin-day-agenda-dialog professional-day-agenda-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="professional-day-agenda-title"
      >
        <header className="admin-day-agenda-header">
          <div>
            <span className="eyebrow">
              MINHA AGENDA
            </span>

            <h2 id="professional-day-agenda-title">
              {new Date(
                `${date}T12:00:00`,
              ).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </h2>

            <p>
              Atendimentos e bloqueios deste dia.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="admin-day-agenda-close"
            onClick={onClose}
            aria-label="Fechar agenda do dia"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="admin-day-agenda-summary">
          <span>
            <CalendarDays aria-hidden="true" />
            <b>{activeAppointments}</b>
            {activeAppointments === 1
              ? " atendimento ativo"
              : " atendimentos ativos"}
          </span>

          {orderedBlocks.length > 0 && (
            <span>
              <Clock3 aria-hidden="true" />
              <b>{orderedBlocks.length}</b>
              {orderedBlocks.length === 1
                ? " bloqueio"
                : " bloqueios"}
            </span>
          )}

          {cancelledAppointments > 0 && (
            <span>
              <X aria-hidden="true" />
              <b>{cancelledAppointments}</b>
              {cancelledAppointments === 1
                ? " cancelado"
                : " cancelados"}
            </span>
          )}
        </div>

        <div className="admin-day-agenda-list">
          {orderedAppointments.map((item) => (
            <article
              className={[
                "admin-day-agenda-item",
                "professional-day-agenda-item",
                item.outsideSchedule ? "outside" : "",
                item.status === "cancelled"
                  ? "cancelled"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={item.id}
            >
              <div className="admin-day-agenda-time">
                <b>{formatTime(item.start)}</b>
                <span>até {formatTime(item.end)}</span>
                <small>{item.duration} minutos</small>
              </div>

              <div className="admin-day-agenda-content">
                <div className="admin-day-agenda-title">
                  <div>
                    <h3>{item.serviceName}</h3>

                    {item.outsideSchedule && (
                      <em>Encaixe</em>
                    )}
                  </div>

                  <span
                    className={`admin-day-agenda-status ${item.status}`}
                  >
                    {statusLabels[item.status]}
                  </span>
                </div>

                <div className="admin-day-agenda-person">
                  <UserRound aria-hidden="true" />

                  <div>
                    <small>CLIENTE</small>
                    <b>{item.clientName}</b>
                  </div>
                </div>

                <div className="admin-day-agenda-meta">
                  {item.clientPhone && (
                    <span>
                      Telefone:
                      <b> {item.clientPhone}</b>
                    </span>
                  )}

                  <span>
                    Valor:
                    <b>
                      {" "}
                      {formatPrice(
                        item.paymentAmount,
                      )}
                    </b>
                  </span>

                  <span>
                    Pagamento:
                    <b>
                      {" "}
                      {item.paymentStatus === "paid"
                        ? "Pago"
                        : "Pendente"}
                    </b>
                  </span>
                </div>

                {renderActions(item)}
                {renderCompletion(item)}
              </div>
            </article>
          ))}

          {orderedBlocks.map((block) => (
            <article
              className="admin-day-agenda-item professional-day-agenda-item block"
              key={block.id}
            >
              <div className="admin-day-agenda-time">
                <b>{formatTime(block.start)}</b>
                <span>
                  até {formatTime(block.end)}
                </span>
              </div>

              <div className="admin-day-agenda-content">
                <div className="admin-day-agenda-title">
                  <h3>Horário bloqueado</h3>

                  <span className="admin-day-agenda-status blocked">
                    Bloqueado
                  </span>
                </div>

                <p>
                  {block.reason ||
                    "Nenhum motivo informado."}
                </p>

                <div className="professional-day-block-actions">
                  <button
                    type="button"
                    disabled={blockRemoving}
                    onClick={() =>
                      onRequestRemoveBlock(block)
                    }
                  >
                    Liberar horário
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}