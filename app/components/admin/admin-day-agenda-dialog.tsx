"use client";

import {
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  CalendarDays,
  Clock3,
  UserRound,
  X,
} from "lucide-react";
import type {
  AdminCalendarItem,
} from "../../lib/services/admin-dashboard-service";

type AdminDayAgendaDialogProps = {
  open: boolean;
  date: Date | null;
  items: AdminCalendarItem[];
  onClose: () => void;
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
  blocked: "Bloqueado",
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
    .format(value)
    .replace(/[\u00A0\u202F]/g, " ");
}

function appointmentDuration(
  startAt: string,
  endAt: string,
) {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start
  ) {
    return 0;
  }

  return Math.round((end - start) / 60000);
}

function itemClass(item: AdminCalendarItem) {
  const professional = item.professionalName
    .split(" ")[0]
    .toLocaleLowerCase("pt-BR");

  return [
    "admin-day-agenda-item",
    professional,
    item.type === "block" ? "block" : "",
    item.outsideSchedule ? "outside" : "",
    item.status === "cancelled" ? "cancelled" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function AdminDayAgendaDialog({
  open,
  date,
  items,
  onClose,
}: AdminDayAgendaDialogProps) {
  const closeButtonRef =
    useRef<HTMLButtonElement>(null);

  const orderedItems = useMemo(
    () =>
      [...items].sort((first, second) => {
        const firstCancelled =
          first.status === "cancelled" ? 1 : 0;
        const secondCancelled =
          second.status === "cancelled" ? 1 : 0;

        if (firstCancelled !== secondCancelled) {
          return firstCancelled - secondCancelled;
        }

        return (
          new Date(first.startAt).getTime() -
          new Date(second.startAt).getTime()
        );
      }),
    [items],
  );

  useEffect(() => {
    if (!open) return;

    const previousOverflow =
      document.body.style.overflow;
    const previouslyFocused =
      document.activeElement as HTMLElement | null;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

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

  const activeAppointments = orderedItems.filter(
    (item) =>
      item.type === "appointment" &&
      item.status !== "cancelled",
  ).length;

  const cancelledAppointments =
    orderedItems.filter(
      (item) =>
        item.type === "appointment" &&
        item.status === "cancelled",
    ).length;

  const blocks = orderedItems.filter(
    (item) => item.type === "block",
  ).length;

  return (
    <div
      className="admin-day-agenda-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="admin-day-agenda-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-day-agenda-title"
      >
        <header className="admin-day-agenda-header">
          <div>
            <span className="eyebrow">
              AGENDA DO DIA
            </span>

            <h2 id="admin-day-agenda-title">
              {new Intl.DateTimeFormat("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              }).format(date)}
            </h2>

            <p>
              Todos os compromissos da equipe nesta
              data.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="admin-day-agenda-close"
            onClick={onClose}
            aria-label="Fechar agenda do dia"
            title="Fechar"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="admin-day-agenda-summary">
          <span>
            <CalendarDays aria-hidden="true" />
            <b>{activeAppointments}</b>
            {activeAppointments === 1
              ? " agendamento ativo"
              : " agendamentos ativos"}
          </span>

          {blocks > 0 && (
            <span>
              <Clock3 aria-hidden="true" />
              <b>{blocks}</b>
              {blocks === 1
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
          {orderedItems.map((item) => {
            const duration = appointmentDuration(
              item.startAt,
              item.endAt,
            );

            return (
              <article
                className={itemClass(item)}
                key={`${item.type}-${item.id}`}
              >
                <div className="admin-day-agenda-time">
                  <b>{formatTime(item.startAt)}</b>

                  <span>
                    até {formatTime(item.endAt)}
                  </span>

                  {duration > 0 && (
                    <small>{duration} minutos</small>
                  )}
                </div>

                <div className="admin-day-agenda-content">
                  <div className="admin-day-agenda-title">
                    <div>
                      <h3>
                        {item.type === "block"
                          ? "Horário bloqueado"
                          : item.serviceName}
                      </h3>

                      {item.outsideSchedule && (
                        <em>Encaixe</em>
                      )}
                    </div>

                    <span
                      className={`admin-day-agenda-status ${item.status}`}
                    >
                      {statusLabels[item.status] ||
                        item.status}
                    </span>
                  </div>

                  {item.type === "block" ? (
                    <p>
                      {item.reason ||
                        "Nenhum motivo informado."}
                    </p>
                  ) : (
                    <>
                      <div className="admin-day-agenda-person">
                        <UserRound aria-hidden="true" />

                        <div>
                          <small>CLIENTE</small>
                          <b>
                            {item.clientName ||
                              "Cliente não informado"}
                          </b>
                        </div>
                      </div>

                      <div className="admin-day-agenda-meta">
                        <span>
                          Profissional:
                          <b>
                            {" "}
                            {item.professionalName}
                          </b>
                        </span>

                        <span>
                          Valor:
                          <b>
                            {" "}
                            {formatPrice(item.price)}
                          </b>
                        </span>

                        <span>
                          Pagamento:
                          <b>
                            {" "}
                            {item.paymentStatus ===
                            "paid"
                              ? "Pago"
                              : "Pendente"}
                          </b>
                        </span>
                      </div>
                    </>
                  )}

                  {item.type === "block" && (
                    <div className="admin-day-agenda-meta">
                      <span>
                        Profissional:
                        <b>
                          {" "}
                          {item.professionalName}
                        </b>
                      </span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}