"use client";
import { useEffect, useRef, useState } from "react";
import { services, type Booking } from "../../lib/spa-data";
import { Icon, Logo, NotificationBell, ThemeToggle } from "../shared/spa-ui";
import type { AuthProfile } from "../../lib/services/auth-service";
import {
  confirmAdminPayment,
  getAdminAppointments,
  getAdminCalendar,
  getAdminOverview,
  type AdminAppointment,
  type AdminCalendarItem,
  type AdminOverview,
  type AdminPaymentMethod,
} from "../../lib/services/admin-dashboard-service";
import { AdminServicesSection } from "./admin-services-section";
import { ArrowLeft, Ban, CalendarDays, ChartNoAxesCombined, Contact, Home, Image, LogOut, Menu, Plus, Settings, Sparkles, UserRound, Users, X } from "lucide-react";
import { useDashboardDrawer } from "../shared/use-dashboard-drawer";
import { AdminShowcaseSection } from "./admin-showcase-section";
import { AdminProfessionalsSection } from "./admin-professionals-section";
import { AdminClientsSection } from "./admin-clients-section";
import { AdminReportsSection } from "./admin-reports-section";
import { AdminAppointmentForm } from "./admin-appointment-form";
import { AdminScheduleBlockForm } from "./admin-schedule-block-form";
import type { AdminAppointmentClient } from "../../lib/services/admin-appointment-service";
import { AdminSettingsSection } from "./admin-settings-section";
import {
  AdminDayAgendaDialog,
} from "./admin-day-agenda-dialog";
function AdminContent({
  section,
  filter,
  setFilter,
  setAddOpen,
  overview,
  overviewLoading,
  overviewError,
  reloadOverview,
  adminAppointments,
  adminAppointmentsLoading,
  adminAppointmentsError,
  serviceCreateRequest,
  professionalCreateRequest,
  onQuickAction,
  onScheduleClient,
  dataRevision,
  }: {
  section: string;
  filter: string;
  setFilter: (v: string) => void;
  setAddOpen: (v: boolean) => void;
  overview: AdminOverview | null;
  overviewLoading: boolean;
  overviewError: string;
  reloadOverview: () => Promise<void>;
  adminAppointments: AdminAppointment[];
  adminAppointmentsLoading: boolean;
  adminAppointmentsError: string;
  serviceCreateRequest: number;
  professionalCreateRequest: number;
  onQuickAction: (action: "appointment" | "service" | "professional" | "block") => void;
  onScheduleClient: (client: AdminAppointmentClient) => void;
  dataRevision: number;
}) {
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [appointmentStatus, setAppointmentStatus] = useState("Todos");
  const [appointmentProfessional, setAppointmentProfessional] =
    useState("Todos");
  const todayAppointments = overview?.todayAppointments ?? [];

  const filteredTodayAppointments =
    filter === "Todos"
      ? todayAppointments
      : todayAppointments.filter(
          (appointment) => appointment.professionalName === filter,
        );
  
  const [adminCalendarDate, setAdminCalendarDate] = useState(
    () => {
      const now = new Date();

      return new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      );
    },
  );

  const [adminCalendarItems, setAdminCalendarItems] = useState<
    AdminCalendarItem[]
  >([]);

  const [adminCalendarLoading, setAdminCalendarLoading] =
    useState(false);

  const [adminCalendarError, setAdminCalendarError] =
    useState("");

  const [
    adminCalendarProfessional,
    setAdminCalendarProfessional,
  ] = useState("Todos");

  const adminCalendarMonthKey = [
    adminCalendarDate.getFullYear(),
    String(adminCalendarDate.getMonth() + 1).padStart(2, "0"),
  ].join("-");

  const todayLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
  const normalizedAppointmentSearch = appointmentSearch
    .trim()
    .toLocaleLowerCase("pt-BR");

  const filteredAdminAppointments = adminAppointments.filter(
    (appointment) => {
      const matchesSearch =
        !normalizedAppointmentSearch ||
        appointment.clientName
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedAppointmentSearch) ||
        appointment.serviceName
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedAppointmentSearch);

      const matchesStatus =
        appointmentStatus === "Todos" ||
        (appointmentStatus === "payment_pending" &&
          appointment.paymentStatus === "pending") ||
        (appointmentStatus === "payment_paid" &&
          appointment.paymentStatus === "paid") ||
        (!appointmentStatus.startsWith("payment_") &&
          appointment.status === appointmentStatus);

      const matchesProfessional =
        appointmentProfessional === "Todos" ||
        appointment.professionalName === appointmentProfessional;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesProfessional
      );
    },
  );

  useEffect(() => {
    if (section !== "Agenda") return;

    let active = true;

    async function loadCalendar() {
      setAdminCalendarLoading(true);
      setAdminCalendarError("");

      try {
        const data = await getAdminCalendar(
          adminCalendarMonthKey,
        );

        if (active) {
          setAdminCalendarItems(data);
        }
      } catch (error) {
        if (active) {
          setAdminCalendarError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar a agenda.",
          );
        }
      } finally {
        if (active) {
          setAdminCalendarLoading(false);
        }
      }
    }

    void loadCalendar();

    return () => {
      active = false;
    };
  }, [section, adminCalendarMonthKey, dataRevision]);

  if (section.startsWith("Servi")) return <AdminServicesSection createRequest={serviceCreateRequest} />;

  if (section === "Visão geral")
    return (
      <>
        {overviewError && (
          <div className="admin-data-message admin-data-message--error">
            {overviewError}
          </div>
        )}

        {overviewLoading && (
          <div className="admin-data-message">
            Carregando informações do SPA...
          </div>
        )}

        <section className="stats">
          <article>
            <div>
              <span>Agendamentos hoje</span>
              <Icon>◷</Icon>
            </div>

            <b>{overviewLoading ? "..." : overview?.appointmentsToday ?? 0}</b>

            <p>
              <small>Horários ativos na agenda de hoje</small>
            </p>
          </article>

          <article>
            <div>
              <span>Agendamentos no mês</span>
              <Icon>✓</Icon>
            </div>

            <b>{overviewLoading ? "..." : overview?.appointmentsThisMonth ?? 0}</b>

            <p>
              <small>
                {overview?.completedThisMonth ?? 0} atendimento(s) concluído(s)
              </small>
            </p>
          </article>

          <article>
            <div>
              <span>Receita recebida</span>
              <Icon>R$</Icon>
            </div>

            <b>
              {overviewLoading
                ? "..."
                : (overview?.receivedThisMonth ?? 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
            </b>

            <p>
              <small>
                {(overview?.pendingThisMonth ?? 0).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}{" "}
                pendente
              </small>
            </p>
          </article>

          <article>
            <div>
              <span>Clientes cadastrados</span>
              <Icon>♧</Icon>
            </div>

            <b>{overviewLoading ? "..." : overview?.clientsTotal ?? 0}</b>

            <p>
              <small>Contas de clientes ativas</small>
            </p>
          </article>
        </section>
        <section className="admin-grid">
          <div className="panel appointments">
            <div className="panel-head">
              <div>
                <h2>Agenda de hoje</h2>
                <p>{todayLabel}</p>
              </div>
              <div className="filters">
                {[
                  "Todos",
                  ...(overview?.professionals.map(
                    (professional) => professional.professionalName,
                  ) ?? []),
                ].map((professionalName) => (
                  <button
                    className={filter === professionalName ? "active" : ""}
                    onClick={() => setFilter(professionalName)}
                    key={professionalName}
                  >
                    {professionalName === "Todos"
                      ? "Todos"
                      : professionalName.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
            <AdminTodayTable
              rows={filteredTodayAppointments}
              onPaymentConfirmed={reloadOverview}
            />
            <button className="see-all">Ver agenda completa →</button>
          </div>
          <div className="right-column">
          <ServiceRanking rows={overview?.serviceRanking ?? []} />
          <TeamCard rows={overview?.professionals ?? []} />
          </div>
        </section>
        <QuickActions onAction={onQuickAction} />
      </>
    );
    if (section === "Agenda")
      return (
        <AdminMonthlyCalendar
          date={adminCalendarDate}
          setDate={setAdminCalendarDate}
          items={adminCalendarItems}
          loading={adminCalendarLoading}
          error={adminCalendarError}
          professionalFilter={adminCalendarProfessional}
          setProfessionalFilter={
            setAdminCalendarProfessional
          }
          professionals={
            overview?.professionals ?? []
          }
        />
      );
  if (section === "Agendamentos")
    return (
      <div className="screen-card">
        <ScreenTop
          title="Todos os agendamentos"
          text="Acompanhe, confirme ou cancele os horários."
          button="＋ Novo agendamento"
          action={() => setAddOpen(true)}
        />
        <div className="table-filters">
          <input
            value={appointmentSearch}
            onChange={(event) =>
              setAppointmentSearch(event.target.value)
            }
            placeholder="⌕ Buscar por cliente ou serviço"
          />

          <select
            value={appointmentStatus}
            onChange={(event) =>
              setAppointmentStatus(event.target.value)
            }
          >
            <option value="Todos">Todos os status</option>

            <optgroup label="Pagamento">
              <option value="payment_pending">
                Pagamento pendente
              </option>

              <option value="payment_paid">
                Pagamento pago
              </option>
            </optgroup>

            <optgroup label="Atendimento">
              <option value="pending">
                Atendimento pendente
              </option>

              <option value="confirmed">
                Atendimento confirmado
              </option>

              <option value="completed">
                Atendimento concluído
              </option>

              <option value="cancelled">
                Atendimento cancelado
              </option>

              <option value="no_show">
                Não compareceu
              </option>
            </optgroup>
          </select>

          <select
            value={appointmentProfessional}
            onChange={(event) =>
              setAppointmentProfessional(event.target.value)
            }
          >
            <option value="Todos">Todas as profissionais</option>

            {(overview?.professionals ?? []).map((professional) => (
              <option
                key={professional.professionalName}
                value={professional.professionalName}
              >
                {professional.professionalName}
              </option>
            ))}
          </select>
        </div>

        {adminAppointmentsError && (
          <div className="admin-data-message admin-data-message--error">
            {adminAppointmentsError}
          </div>
        )}

        {adminAppointmentsLoading ? (
          <div className="admin-data-message">
            Carregando agendamentos...
          </div>
        ) : (
          <>
            <div className="admin-results-count">
              {filteredAdminAppointments.length}{" "}
              {filteredAdminAppointments.length === 1
                ? "agendamento encontrado"
                : "agendamentos encontrados"}
            </div>

            <AdminTodayTable
              rows={filteredAdminAppointments}
              onPaymentConfirmed={reloadOverview}
              showDate
            />
          </>
        )}
      </div>
    );
  if (section === "Serviços")
    return (
      <div>
        <ScreenTop
          title="Serviços cadastrados"
          text="Gerencie procedimentos, duração, valor e profissionais."
          button="＋ Adicionar serviço"
          action={() => setAddOpen(true)}
        />
        <div className="admin-service-grid">
          {services.map((s, i) => (
            <article key={s.name}>
              <div className="service-admin-icon">
                {["♨", "≈", "✧", "✦", "♢", "◇"][i]}
              </div>
              <span className="active-pill">Ativo</span>
              <h3>{s.name}</h3>
              <p>
                {s.category} · {s.duration} minutos
              </p>
              <div>
                <b>R$ {s.price},00</b>
                <span>{s.professional}</span>
              </div>
              <footer>
                <button>Editar</button>
                <button>•••</button>
              </footer>
            </article>
          ))}
        </div>
      </div>
    );
  if (section === "Conteúdo") return <AdminShowcaseSection />;
  if (section === "Profissionais")
    return <AdminProfessionalsSection createRequest={professionalCreateRequest} />;
  if (section === "Clientes")
    return <AdminClientsSection onSchedule={onScheduleClient} />;
  if (section === "Relatórios")
    return <AdminReportsSection />;
  return <AdminSettingsSection />;
}

function AdminMonthlyCalendar({
  date,
  setDate,
  items,
  loading,
  error,
  professionalFilter,
  setProfessionalFilter,
  professionals,
}: {
  date: Date;
  setDate: React.Dispatch<React.SetStateAction<Date>>;
  items: AdminCalendarItem[];
  loading: boolean;
  error: string;
  professionalFilter: string;
  setProfessionalFilter: (value: string) => void;
  professionals: AdminOverview["professionals"];
}) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const [selectedDay, setSelectedDay] = useState<{
    date: Date;
    items: AdminCalendarItem[];
  } | null>(null);
  const firstWeekday = new Date(
    year,
    month,
    1,
  ).getDay();

  const totalDays = new Date(
    year,
    month + 1,
    0,
  ).getDate();

  const previousMonthDays = new Date(
    year,
    month,
    0,
  ).getDate();

  const totalCells = Math.ceil(
    (firstWeekday + totalDays) / 7,
  ) * 7;

  const calendarCells = Array.from(
    { length: totalCells },
    (_, index) => {
      const currentDay = index - firstWeekday + 1;

      if (currentDay < 1) {
        return {
          day:
            previousMonthDays + currentDay,
          date: new Date(
            year,
            month - 1,
            previousMonthDays + currentDay,
          ),
          currentMonth: false,
        };
      }

      if (currentDay > totalDays) {
        return {
          day: currentDay - totalDays,
          date: new Date(
            year,
            month + 1,
            currentDay - totalDays,
          ),
          currentMonth: false,
        };
      }

      return {
        day: currentDay,
        date: new Date(
          year,
          month,
          currentDay,
        ),
        currentMonth: true,
      };
    },
  );

  const filteredItems =
    professionalFilter === "Todos"
      ? items
      : items.filter(
          (item) =>
            item.professionalName ===
            professionalFilter,
        );

  function changeMonth(amount: number) {
    setDate(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + amount,
          1,
        ),
    );
  }

  function goToday() {
    const now = new Date();

    setDate(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ),
    );
  }

  function sameDay(
    first: Date,
    second: Date,
  ) {
    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
  }

  function itemTime(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  }

  function itemClass(item: AdminCalendarItem) {
    const professional =
      item.professionalName
        .split(" ")[0]
        .toLocaleLowerCase("pt-BR");

    return [
      "admin-calendar-item",
      professional,
      item.type === "block" ? "block" : "",
      item.outsideSchedule ? "outside" : "",
      item.status === "cancelled"
        ? "cancelled"
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  function orderDayItems(
    dayItems: AdminCalendarItem[],
  ) {
    return [...dayItems].sort((first, second) => {
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
    });
  }

  const monthInputValue = [
    year,
    String(month + 1).padStart(2, "0"),
  ].join("-");

  return (
    <div className="screen-card admin-calendar-screen">
      <div className="screen-toolbar admin-calendar-toolbar">
        <div>
          <h2>
            {new Intl.DateTimeFormat("pt-BR", {
              month: "long",
              year: "numeric",
            }).format(date)}
          </h2>

          <p>
            Acompanhe os compromissos de toda a equipe.
          </p>
        </div>

        <div className="admin-calendar-controls">
          <select
            value={professionalFilter}
            onChange={(event) =>
              setProfessionalFilter(
                event.target.value,
              )
            }
          >
            <option value="Todos">
              Todas as profissionais
            </option>

            {professionals.map((professional) => (
              <option
                value={professional.professionalName}
                key={professional.professionalName}
              >
                {professional.professionalName}
              </option>
            ))}
          </select>

          <input
            type="month"
            value={monthInputValue}
            onChange={(event) => {
              const [selectedYear, selectedMonth] =
                event.target.value
                  .split("-")
                  .map(Number);

              if (
                !selectedYear ||
                !selectedMonth
              ) {
                return;
              }

              setDate(
                new Date(
                  selectedYear,
                  selectedMonth - 1,
                  1,
                ),
              );
            }}
          />

          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="Mês anterior"
          >
            ‹
          </button>

          <button type="button" onClick={goToday}>
            Hoje
          </button>

          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="Próximo mês"
          >
            ›
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-data-message admin-data-message--error">
          {error}
        </div>
      )}

      {loading && (
        <div className="admin-data-message">
          Carregando agenda...
        </div>
      )}

      <div className="admin-calendar-weekdays">
        {[
          "DOM",
          "SEG",
          "TER",
          "QUA",
          "QUI",
          "SEX",
          "SÁB",
        ].map((weekday) => (
          <b key={weekday}>{weekday}</b>
        ))}
      </div>

      <div
        className={`admin-calendar-month ${
          loading ? "is-loading" : ""
        }`}
      >
        {calendarCells.map((cell) => {
          const cellItems = cell.currentMonth
            ? filteredItems.filter((item) =>
                sameDay(
                  new Date(item.startAt),
                  cell.date,
                ),
              )
            : [];

          const orderedCellItems =
            orderDayItems(cellItems);

          const previewItems =
            orderedCellItems.slice(0, 2);

          const hiddenItems =
            Math.max(orderedCellItems.length - 2, 0);

          const isToday = sameDay(
            cell.date,
            new Date(),
          );

          return (
            <article
              className={[
                "admin-calendar-day",
                !cell.currentMonth
                  ? "outside-month"
                  : "",
                isToday ? "today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={cell.date.toISOString()}
            >
              <header>
                <span>{cell.day}</span>

                {cellItems.length > 0 && (
                  <small>
                    {cellItems.length}
                  </small>
                )}
              </header>

              <div className="admin-calendar-day-items">
                {previewItems.map((item) => (
                  <div
                    className={itemClass(item)}
                    key={`${item.type}-${item.id}`}
                    title={`${item.professionalName} — ${
                      item.type === "block"
                        ? item.reason ||
                          "Horário bloqueado"
                        : item.serviceName
                    }`}
                  >
                    <b>
                      {itemTime(item.startAt)}

                      {item.outsideSchedule &&
                        " · encaixe"}
                    </b>

                    {item.type === "block" ? (
                      <>
                        <span>Horário bloqueado</span>
                        <small>
                          {item.reason ||
                            "Sem motivo informado"}
                        </small>
                      </>
                    ) : (
                      <>
                        <span>
                          {item.serviceName}
                        </span>

                        <small>
                          {item.clientName}
                        </small>
                      </>
                    )}

                    <em>
                      {
                        item.professionalName.split(
                          " ",
                        )[0]
                      }
                    </em>
                  </div>
                ))}
              </div>
              {cell.currentMonth &&
              orderedCellItems.length > 0 && (
                <button
                  type="button"
                  className="admin-calendar-day-open"
                  onClick={() =>
                    setSelectedDay({
                      date: cell.date,
                      items: orderedCellItems,
                    })
                  }
                  aria-label={`Abrir agenda de ${cell.date.toLocaleDateString(
                    "pt-BR",
                  )}`}
                >
                  {hiddenItems > 0
                    ? `Ver agenda completa +${hiddenItems}`
                    : "Ver detalhes do dia"}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {!loading &&
        filteredItems.length === 0 && (
          <div className="admin-calendar-empty">
            Nenhum compromisso encontrado neste mês.
          </div>
        )}

      <div className="admin-calendar-legend">
        <span>
          <i className="eliane" />
          Eliane
        </span>

        <span>
          <i className="dayanne" />
          Dayanne
        </span>

        <span>
          <i className="outside" />
          Encaixe
        </span>

        <span>
          <i className="block" />
          Horário bloqueado
        </span>

        <span>
          <i className="cancelled" />
          Cancelado
        </span>
      </div>
      <AdminDayAgendaDialog
        open={selectedDay !== null}
        date={selectedDay?.date || null}
        items={selectedDay?.items || []}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
}

function ScreenTop({
  title,
  text,
  button,
  action,
}: {
  title: string;
  text: string;
  button?: string;
  action?: () => void;
}) {
  return (
    <div className="screen-top">
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      {button && (
        <button className="primary" onClick={action}>
          {button}
        </button>
      )}
    </div>
  );
}

function AdminTodayTable({
  rows,
  onPaymentConfirmed,
  showDate = false,
}: {
  rows: AdminOverview["todayAppointments"];
  onPaymentConfirmed: () => Promise<void>;
  showDate?: boolean;
}) {
  const [paymentAppointment, setPaymentAppointment] = useState<
    AdminOverview["todayAppointments"][number] | null
  >(null);

  const [paymentMethod, setPaymentMethod] =
    useState<AdminPaymentMethod>("pix");

  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  function appointmentTime(date: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(date));
  }

  function appointmentDate(date: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
      .format(new Date(date))
      .replace(".", "");
  }

  function appointmentDuration(start: string, end: string) {
    const duration =
      new Date(end).getTime() - new Date(start).getTime();

    return Math.max(0, Math.round(duration / 60000));
  }

  function appointmentStatus(status: string) {
    const labels: Record<string, string> = {
      pending: "Pendente",
      confirmed: "Confirmado",
      completed: "Concluído",
      cancelled: "Cancelado",
      no_show: "Não compareceu",
    };

    return labels[status] ?? status;
  }

  function openPayment(
    appointment: AdminOverview["todayAppointments"][number],
  ) {
    setPaymentAppointment(appointment);
    setPaymentMethod("pix");
    setPaymentNotes("");
    setPaymentError("");
  }

  function closePayment() {
    if (paymentSaving) return;

    setPaymentAppointment(null);
    setPaymentNotes("");
    setPaymentError("");
  }

  async function submitPayment(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!paymentAppointment) return;

    setPaymentSaving(true);
    setPaymentError("");

    try {
      await confirmAdminPayment({
        appointmentId: paymentAppointment.id,
        method: paymentMethod,
        notes: paymentNotes,
      });

      await onPaymentConfirmed();
      setPaymentAppointment(null);
      setPaymentNotes("");
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar o pagamento.",
      );
    } finally {
      setPaymentSaving(false);
    }
  }

  return (
    <>
      {rows.length === 0 ? (
        <div className="admin-empty-state">
          <Icon>◷</Icon>

          <div>
            <b>Nenhum atendimento para hoje</b>
            <p>A agenda está livre no momento.</p>
          </div>
        </div>
      ) : (
        <div className="booking-list">
          {rows.map((appointment) => {
            const professionalFirstName =
              appointment.professionalName.split(" ")[0];

            const professionalClass =
              professionalFirstName.toLowerCase();

            const isPaid = appointment.paymentStatus === "paid";
            const canConfirm =
              appointment.paymentStatus === "pending";

            return (
              <div className="booking-row" key={appointment.id}>
                <div className="booking-time">
                  <b>{appointmentTime(appointment.startAt)}</b>
                    <span>
                      {showDate && (
                        <>
                          {appointmentDate(appointment.startAt)}
                          {" · "}
                        </>
                      )}

                      {appointmentDuration(
                        appointment.startAt,
                        appointment.endAt,
                      )}{" "}
                      min
                    </span>
                </div>

                <span className={`line ${professionalClass}`} />

                <div className="client-avatar">
                  {appointment.clientName
                    .split(" ")
                    .map((name) => name[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div className="booking-info">
                  <b>{appointment.clientName}</b>
                  <span>{appointment.serviceName}</span>
                </div>

                <div className="professional">
                  <span>{professionalFirstName[0]}</span>
                  {professionalFirstName}
                </div>

                <em className={appointment.status}>
                  {appointmentStatus(appointment.status)}
                </em>

                <div className="payment-control">
                  <strong>
                    {appointment.price.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </strong>

                  <button
                    type="button"
                    className={isPaid ? "paid" : ""}
                    disabled={!canConfirm}
                    onClick={() => openPayment(appointment)}
                  >
                    {isPaid
                      ? "✓ Pago"
                      : canConfirm
                        ? "Confirmar pagamento"
                        : "Pagamento indisponível"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {paymentAppointment && (
        <div
          className="modal-backdrop"
          onMouseDown={closePayment}
        >
          <form
            className="simple-modal admin-payment-modal"
            onSubmit={submitPayment}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close icon-button"
              onClick={closePayment}
              disabled={paymentSaving}
              aria-label="Fechar"
              title="Fechar"
            >
              <X aria-hidden="true" />
            </button>

            <span className="eyebrow">PAGAMENTO NO LOCAL</span>
            <h2>Confirmar pagamento</h2>

            <p className="admin-payment-description">
              Confirme o recebimento de{" "}
              <strong>
                {paymentAppointment.price.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </strong>{" "}
              referente ao serviço{" "}
              <strong>{paymentAppointment.serviceName}</strong> de{" "}
              {paymentAppointment.clientName}.
            </p>

            {paymentError && (
              <div className="admin-data-message admin-data-message--error">
                {paymentError}
              </div>
            )}

            <div className="admin-payment-fields">
              <label>
                Forma de pagamento

                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target.value as AdminPaymentMethod,
                    )
                  }
                  disabled={paymentSaving}
                >
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao">Cartão</option>
                  <option value="outro">Outro</option>
                </select>
              </label>

              <label>
                Observação

                <textarea
                  value={paymentNotes}
                  onChange={(event) =>
                    setPaymentNotes(event.target.value)
                  }
                  placeholder="Opcional"
                  maxLength={500}
                  disabled={paymentSaving}
                />
              </label>
            </div>

            <div className="admin-payment-actions">
              <button
                type="button"
                onClick={closePayment}
                disabled={paymentSaving}
              >
                Voltar
              </button>

              <button
                type="submit"
                className="primary"
                disabled={paymentSaving}
              >
                {paymentSaving
                  ? "Confirmando..."
                  : "Confirmar recebimento"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function AdminTable({ rows }: { rows: Booking[] }) {
  const [paid, setPaid] = useState<string[]>(
    rows.filter((row) => row.paymentStatus === "Pago").map((row) => `${row.time}-${row.client}`),
  );
  return (
    <div className="booking-list">
      {rows.map((b, i) => {
        const paymentId = `${b.time}-${b.client}`;
        const isPaid = paid.includes(paymentId);
        return <div className="booking-row" key={b.time + b.client + i}>
          <div className="booking-time">
            <b>{b.time}</b>
            <span>60 min</span>
          </div>
          <span className={`line ${b.professional.toLowerCase()}`} />
          <div className="client-avatar">
            {b.client
              .split(" ")
              .map((x) => x[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div className="booking-info">
            <b>{b.client}</b>
            <span>{b.service}</span>
          </div>
          <div className="professional">
            <span>{b.professional[0]}</span>
            {b.professional}
          </div>
          <em className={b.status.toLowerCase()}>{b.status}</em>
          <div className="payment-control">
            <strong>R$ {b.price ?? 0},00</strong>
            <button
              className={isPaid ? "paid" : ""}
              onClick={() => setPaid((current) => isPaid ? current.filter((id) => id !== paymentId) : [...current, paymentId])}
              title="O valor será registrado no financeiro"
            >{isPaid ? "✓ Pago" : "Confirmar pagamento"}</button>
          </div>
        </div>;
      })}
    </div>
  );
}
function ServiceRanking({
  rows,
}: {
  rows: AdminOverview["serviceRanking"];
}) {
  const highestTotal = Math.max(
    ...rows.map((service) => service.total),
    1,
  );

  return (
    <div className="panel performance">
      <div className="panel-head">
        <div>
          <h2>Serviços mais agendados</h2>
          <p>Mês atual</p>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="admin-ranking-empty">
          Nenhum serviço agendado neste mês.
        </div>
      )}

      {rows.map((service, index) => (
        <div className="bar-row" key={service.serviceName}>
          <span>{index + 1}</span>

          <div>
            <b>{service.serviceName}</b>

            <div className="bar">
              <i
                style={{
                  width: `${Math.round(
                    (service.total / highestTotal) * 100,
                  )}%`,
                }}
              />
            </div>
          </div>

          <strong>{service.total}</strong>
        </div>
      ))}
    </div>
  );
}

function TeamCard({
  rows,
}: {
  rows: AdminOverview["professionals"];
}) {
  return (
    <div className="panel professionals">
      <div className="panel-head">
        <div>
          <h2>Equipe hoje</h2>
          <p>Atendimentos das profissionais</p>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="admin-ranking-empty">
          Nenhuma profissional ativa encontrada.
        </div>
      )}

      {rows.map((professional) => {
        const firstName =
          professional.professionalName.split(" ")[0];

        return (
          <div
            className="pro-row"
            key={professional.professionalName}
          >
            <span
              className={`pro-avatar ${firstName.toLowerCase()}`}
            >
              {firstName[0]}
            </span>

            <div>
              <b>{professional.professionalName}</b>
              <small>{professional.specialty}</small>
            </div>

            <em>
              {professional.appointmentsToday}{" "}
              {professional.appointmentsToday === 1
                ? "atendimento"
                : "atendimentos"}
            </em>
          </div>
        );
      })}
    </div>
  );
}

function QuickActions({ onAction }: { onAction: (action: "appointment" | "service" | "professional" | "block") => void }) {
  const actions = [
    { label: "Novo agendamento", description: "Agendar um horário", action: "appointment" as const, icon: CalendarDays },
    { label: "Adicionar serviço", description: "Cadastre um procedimento", action: "service" as const, icon: Sparkles },
    { label: "Cadastrar profissional", description: "Adicione à equipe", action: "professional" as const, icon: Users },
    { label: "Bloquear horário", description: "Indisponibilidade na agenda", action: "block" as const, icon: Ban },
  ];
  return (
    <section className="quick-actions">
      <h2>Ações rápidas</h2>
      <div>
        {actions.map((item) => {
          const ActionIcon = item.icon;
          return <button onClick={() => onAction(item.action)} key={item.label}>
            <span className="icon"><ActionIcon aria-hidden="true"/></span>
            <span>
              <b>{item.label}</b>
              <small>{item.description}</small>
            </span>
            <Plus aria-hidden="true"/>
          </button>
        ;})}
      </div>
    </section>
  );
}

export function AdminDashboard({
  goPublic,
  logout,
  profile,
}: {
  goPublic: () => void;
  logout: () => void;
  profile: AuthProfile | null;
}) {
  const { open: drawerOpen, setOpen: setDrawerOpen, close: closeDrawer, drawerRef, triggerRef } = useDashboardDrawer();
  const [section, setSection] = useState("Visão geral");
  const [filter, setFilter] = useState("Todos");
  const [addOpen, setAddOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [appointmentClient, setAppointmentClient] = useState<AdminAppointmentClient | null>(null);
  const [serviceCreateRequest, setServiceCreateRequest] = useState(0);
  const [professionalCreateRequest, setProfessionalCreateRequest] = useState(0);
  const [dataRevision, setDataRevision] = useState(0);
  const flowOpenerRef = useRef<HTMLElement | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [adminAppointments, setAdminAppointments] = useState<
    AdminAppointment[]
  >([]);

  const [
    adminAppointmentsLoading,
    setAdminAppointmentsLoading,
  ] = useState(true);

  const [
    adminAppointmentsError,
    setAdminAppointmentsError,
  ] = useState("");
  const adminName = profile?.full_name || "Administradora";
  const adminInitials = adminName.split(" ").slice(0, 2).map((name) => name[0]).join("").toUpperCase();
  const menu = [
    "Visão geral",
    "Agenda",
    "Agendamentos",
    "Serviços",
    "Conteúdo",
    "Profissionais",
    "Clientes",
    "Relatórios",
    "Configurações",
  ];
  const menuIcons = [Home, CalendarDays, CalendarDays, Sparkles, Image, Users, Contact, ChartNoAxesCombined, Settings];

  async function loadOverview() {
    setOverviewLoading(true);
    setOverviewError("");

    try {
      const data = await getAdminOverview();
      setOverview(data);
    } catch (error) {
      setOverviewError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os dados administrativos.",
      );
    } finally {
      setOverviewLoading(false);
    }
  }

  async function loadAdminAppointments() {
    setAdminAppointmentsLoading(true);
    setAdminAppointmentsError("");

    try {
      const data = await getAdminAppointments();
      setAdminAppointments(data);
    } catch (error) {
      setAdminAppointmentsError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os agendamentos.",
      );
    } finally {
      setAdminAppointmentsLoading(false);
    }
  }

  async function reloadAdminData() {
    await Promise.all([
      loadOverview(),
      loadAdminAppointments(),
    ]);
  }

  async function handleScheduleChanged() {
    await reloadAdminData();
    setDataRevision((value) => value + 1);
  }

  function quickAction(action: "appointment" | "service" | "professional" | "block") {
    flowOpenerRef.current = document.activeElement as HTMLElement | null;
    if (action === "appointment") { setAppointmentClient(null); setAddOpen(true); return; }
    if (action === "block") { setBlockOpen(true); return; }
    if (action === "service") { setSection("Serviços"); setServiceCreateRequest((value) => value + 1); return; }
    setSection("Profissionais"); setProfessionalCreateRequest((value) => value + 1);
  }

  function closeAdminFlow(setter: (open: boolean) => void) {
    setter(false);
    requestAnimationFrame(() => flowOpenerRef.current?.focus());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadAdminData();

    // Os dados devem ser carregados somente na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="admin-shell">
      {drawerOpen && <button className="dashboard-drawer-backdrop" type="button" aria-label="Fechar menu" onClick={() => closeDrawer()} />}
      <aside id="admin-navigation" ref={drawerRef} tabIndex={-1} className={drawerOpen ? "dashboard-drawer-open" : ""}>
        <Logo compact />
        <button className="dashboard-drawer-close icon-button" type="button" aria-label="Fechar menu" title="Fechar menu" onClick={() => closeDrawer()}><X aria-hidden="true" /></button>
        <nav>
          {menu.map((m, i) => {
            const MenuIcon = menuIcons[i] || UserRound;
            return (
            <button
              className={section === m ? "active" : ""}
              onClick={() => { setSection(m); closeDrawer(false); }}
              key={m}
            >
              <span><MenuIcon aria-hidden="true" /></span>
              {m}
              {m === "Agendamentos" &&
                adminAppointments.filter((appointment) =>
                  ["pending", "confirmed"].includes(
                    appointment.status,
                  ),
                ).length > 0 && (
                  <i>
                    {
                      adminAppointments.filter((appointment) =>
                        ["pending", "confirmed"].includes(
                          appointment.status,
                        ),
                      ).length
                    }
                  </i>
                )}
            </button>
          );})}
        </nav>
        <div className="support">
          <span>?</span>
          <b>Precisa de ajuda?</b>
          <small>Fale com o suporte</small>
        </div>
        <button className="view-site button-with-icon" onClick={goPublic}>
          <ArrowLeft aria-hidden="true" /> Ver site público
        </button>
        <button className="view-site logout button-with-icon" onClick={logout}>
          <LogOut aria-hidden="true" /> Sair da conta
        </button>
      </aside>
      <main className="admin-main">
        <header>
          <div>
            <span>PAINEL ADMINISTRATIVO</span>
            <h1>{section}</h1>
            <p>Gerencie o SPA Express Cambucás.</p>
          </div>
          <div className="admin-actions">
            <ThemeToggle />
            <NotificationBell audience="admin" />
            <div className="profile">
              <span>{adminInitials}</span>
              <div>
                <b>{adminName}</b>
                <small>Administradora</small>
              </div>
            </div>
            <button ref={triggerRef} className="dashboard-menu-button icon-button" type="button" aria-label="Abrir menu" title="Abrir menu" aria-expanded={drawerOpen} aria-controls="admin-navigation" onClick={() => setDrawerOpen(true)}><Menu aria-hidden="true" /></button>
          </div>
        </header>
        <AdminContent
          section={section}
          filter={filter}
          setFilter={setFilter}
          setAddOpen={(open) => { if (open) flowOpenerRef.current = document.activeElement as HTMLElement | null; setAppointmentClient(null); setAddOpen(open); }}
          overview={overview}
          overviewLoading={overviewLoading}
          overviewError={overviewError}
          reloadOverview={reloadAdminData}
          adminAppointments={adminAppointments}
          adminAppointmentsLoading={adminAppointmentsLoading}
          adminAppointmentsError={adminAppointmentsError}
          serviceCreateRequest={serviceCreateRequest}
          professionalCreateRequest={professionalCreateRequest}
          onQuickAction={quickAction}
          onScheduleClient={(client) => { flowOpenerRef.current = document.activeElement as HTMLElement | null; setAppointmentClient(client); setAddOpen(true); }}
          dataRevision={dataRevision}
          />
        <AdminAppointmentForm open={addOpen} initialClient={appointmentClient} onClose={() => { closeAdminFlow(setAddOpen); setAppointmentClient(null); }} onCreated={handleScheduleChanged}/>
        <AdminScheduleBlockForm open={blockOpen} onClose={() => closeAdminFlow(setBlockOpen)} onCreated={handleScheduleChanged}/>
      </main>
    </div>
  );
}
