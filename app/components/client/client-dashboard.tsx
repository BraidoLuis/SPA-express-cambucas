"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Service } from "../../lib/spa-data";
import { bookingToday, formatBookingDate, isBookingDate, shiftBookingDate } from "../../lib/booking-calendar";
import { Logo, ThemeToggle } from "../shared/spa-ui";
import type { AuthProfile } from "../../lib/services/auth-service";
import { getClientCatalog } from "../../lib/services/catalog-service";
import {
  getAvailableSlots,
  getBookingGapSuggestions,
  type AvailableSlot,
  type BookingGapSuggestion,
} from "../../lib/services/availability-service";
import { createClientAppointment, getClientAppointments, type ClientAppointment } from "../../lib/services/appointment-service";
import { useBookingRequests } from "../shared/use-booking-requests";
import { bookingErrorMessage } from "../../lib/booking-errors";
import { canClientCancelAppointment, cancellationMessage, cancellationUnavailableMessage, revalidateCancellation, type CancellationRules } from "../../lib/cancellation-rules";
import { applyConfirmedClientCancellation, cancelAndRefreshClientAppointment } from "../../lib/client-cancellation";
import { getCancellationRules } from "../../lib/services/cancellation-rules-service";
import { ClientProfileForm } from "./client-profile-form";
import { ActionDialog } from "../shared/action-dialog";
import { ServiceCoverImage } from "../shared/service-cover-image";
import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Home, LogOut, Menu, Plus, UserRound, X } from "lucide-react";
import { ShowcaseCarousel } from "../shared/showcase-carousel";
import { ProfessionalFilter } from "../shared/professional-filter";
import { useDashboardDrawer } from "../shared/use-dashboard-drawer";
import {
  buildAppointmentWhatsAppUrl,
  buildBookingGapWhatsAppUrl,
} from "../../lib/appointment-whatsapp";

function ServiceScheduling({
  clientName,
  onAppointmentCreated,
}: {
  clientName: string;
  onAppointmentCreated: () => void | Promise<void>;
}) {
  const requests = useBookingRequests();
  const today = bookingToday();
  const [selected, setSelected] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState(bookingToday);
  const [time, setTime] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [appointmentId, setAppointmentId] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  type BookingErrorType =
    | "same-day"
    | "future-limit"
    | "availability"
    | "generic";

  const [bookingError, setBookingError] = useState("");
  const [bookingErrorType, setBookingErrorType] =
    useState<BookingErrorType>("generic");
  const [catalogFilter, setCatalogFilter] = useState("Todos");
  const [professionalFilter, setProfessionalFilter] = useState("all");
  const [catalog, setCatalog] = useState<Service[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [gapSuggestions, setGapSuggestions] =
    useState<BookingGapSuggestion[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [availabilityReload, setAvailabilityReload] = useState(0);
  const availabilityVersion = useRef(0);
  const selectedDateRef = useRef(selectedDate);
  const clientCarousel = useRef<HTMLDivElement>(null);
  const filters = ["Todos", ...Array.from(new Set(catalog.map((service) => service.category)))];
  const professionalOptions = useMemo(() => Array.from(new Map(catalog.filter((service) => service.professionalId).map((service) => [service.professionalId!, { id: service.professionalId!, name: service.professionalFullName || service.professional }])).values()).sort((a, b) => a.name.localeCompare(b.name)), [catalog]);
  const visibleServices = catalog.filter((service) => (catalogFilter === "Todos" || service.category === catalogFilter) && (professionalFilter === "all" || service.professionalId === professionalFilter));
  function resetClientCarousel() { clientCarousel.current?.scrollTo({ left: 0, behavior: "smooth" }); }
  const loadCatalog = useCallback(async () => {
    const ticket = requests.begin("catalog");
    if (!ticket) return;
    setCatalogLoading(true); setCatalogError("");
    try { const data = await getClientCatalog(); if (requests.current(ticket)) setCatalog(data); }
    catch { if (requests.current(ticket)) setCatalogError("Não foi possível carregar os serviços agora."); }
    finally { if (requests.current(ticket)) setCatalogLoading(false); requests.finish(ticket); }
  }, [requests]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void loadCatalog(); });
    return () => { cancelled = true; };
  }, [loadCatalog]);
  useEffect(() => {
    if (!selected?.id || !selected.professionalId) {
      return;
    }

    let cancelled = false;
    const version = availabilityVersion.current;
    const isCurrent = () => !cancelled && version === availabilityVersion.current;

    queueMicrotask(() => {
      if (!isCurrent()) return;

      setSlotsLoading(true);
      setSlotsError("");
      setAvailableSlots([]);
      setGapSuggestions([]);
      setTime("");
      setSelectedSlot(null);
      setBookingError("");

      Promise.all([
        getAvailableSlots(
          selected.professionalId!,
          selected.id!,
          selectedDate,
        ),

        /*
        * A consulta de encaixes é opcional.
        * Uma falha nela não impede o agendamento normal.
        */
        getBookingGapSuggestions(
          selected.professionalId!,
          selected.id!,
          selectedDate,
        ).catch(() => [] as BookingGapSuggestion[]),
      ])
        .then(([slots, gaps]) => {
          if (!isCurrent()) return;

          setAvailableSlots(slots);
          setGapSuggestions(gaps);
        })
        .catch(() => {
          if (isCurrent()) {
            setSlotsError(
              "Não foi possível consultar a agenda agora.",
            );
          }
        })
        .finally(() => {
          if (isCurrent()) {
            setSlotsLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [
    selected,
    selectedDate,
    availabilityReload,
  ]);
  function resetAvailability(loading: boolean) {
    // Invalida imediatamente, antes de o cleanup do efeito acompanhar a nova data.
    availabilityVersion.current += 1;
    setAvailableSlots([]);
    setGapSuggestions([]);
    setTime("");
    setSelectedSlot(null);
    setSlotsError("");
    setBookingError("");
    setSlotsLoading(loading);
  }

  function selectDate(value: string) {
    if (requests.busy("create") || !isBookingDate(value) || value < bookingToday()) return;
    if (value === selectedDateRef.current) return;
    selectedDateRef.current = value;
    resetAvailability(true);
    setSelectedDate(value);
  }

  function moveDate(days: number) {
    selectDate(shiftBookingDate(selectedDateRef.current, days));
  }

  function openService(service: Service) {
    if (requests.busy("create")) return;
    const date = bookingToday();
    selectedDateRef.current = date;
    resetAvailability(true);
    setSelectedDate(date);
    setSelected(service);
  }

  async function confirmAppointment() {
    if (
      !selected?.id ||
      !selected.professionalId ||
      !selectedSlot
    ) {
      return;
    }

    const ticket = requests.begin("create", true);
    if (!ticket) return;
    setBookingSubmitting(true);
    setBookingError("");
    setBookingErrorType("generic");

    try {
      const id = await createClientAppointment({
        professionalId: selected.professionalId,
        serviceId: selected.id,
        slotStart: selectedSlot.start,
      });

      if (!requests.current(ticket)) return;
      setAppointmentId(id);
      setConfirmed(true);

      try { await onAppointmentCreated(); } catch {
        if (requests.current(ticket)) setBookingError("Reserva confirmada. Não foi possível atualizar a lista; consulte Meus agendamentos.");
      }
    } catch (error) {
      if (!requests.current(ticket)) return;
      const message = bookingErrorMessage(error, "create");

      const normalizedMessage =
        message.toLocaleLowerCase("pt-BR");

      const isSameProfessionalDay =
        normalizedMessage.includes(
          "já possui um horário ativo",
        );

      const isFutureLimit =
        normalizedMessage.includes(
          "limite de 3 agendamentos futuros",
        );

      const isUnavailable =
        normalizedMessage.includes(
          "não está mais disponível",
        ) ||
        normalizedMessage.includes(
          "acabou de ser reservado",
        ) ||
        normalizedMessage.includes(
          "horário selecionado está ocupado",
        );

      if (isSameProfessionalDay) {
        setBookingErrorType("same-day");
        setBookingError(
          "Já existe um agendamento ativo com esta profissional na data selecionada. Escolha outro dia ou consulte seus agendamentos.",
        );
      } else if (isFutureLimit) {
        setBookingErrorType("future-limit");
        setBookingError(
          "Você já possui três agendamentos futuros ativos. Cancele um deles ou aguarde a realização de um atendimento antes de marcar outro.",
        );
      } else if (isUnavailable) {
        setBookingErrorType("availability");
        setBookingError(
          "Este horário acabou de ficar indisponível. Selecione outro horário para continuar.",
        );

        /*
        * Recarrega somente quando a disponibilidade mudou.
        * Erros de limite precisam permanecer visíveis.
        */
        setAvailabilityReload(
          (value) => value + 1,
        );
      } else {
        setBookingErrorType("generic");
        setBookingError(
          message,
        );
      }
    } finally {
      if (requests.current(ticket)) setBookingSubmitting(false);
      requests.finish(ticket);
    }
  }

  const whatsappUrl =
    confirmed && selected
      ? buildAppointmentWhatsAppUrl({
          whatsappNumber:
            selected.professionalWhatsapp,
          clientName,
          professionalName:
            selected.professionalFullName ||
            selected.professional,
          serviceName: selected.name,
          date: selectedDate,
          time,
          duration: selected.duration,
          price: selected.price,
          appointmentId,
        })
      : null;

  const slideClient = (direction: number) =>
    clientCarousel.current?.scrollBy({
      left: direction * clientCarousel.current.clientWidth * 0.82,
      behavior: "smooth",
    });

  if (confirmed && selected)
    return (
      <section className="schedule-success">
        <div><Check aria-hidden="true" /></div>
        <span className="eyebrow">AGENDAMENTO CONFIRMADO</span>
        <h2>Seu momento está reservado!</h2>
        <p>
          {selected.name} com {selected.professional}
        </p>
        <div className="confirmed-details">
          <span>▣ {formatBookingDate(selectedDate, {weekday:"long",day:"2-digit",month:"long",year:"numeric"})}</span>
          <span>
            ◷ {time} · {selected.duration} minutos
          </span>
          <span>⌖ SPA Express Cambucás</span>
        </div>
        <small>
          O pagamento de R$ {selected.price},00 será realizado no local.
        </small>
        <small className="appointment-reference">Código do agendamento: {appointmentId.slice(0, 8).toUpperCase()}</small>
        {bookingError && <p role="status">{bookingError}</p>}
        <div className="confirmation-channels">
          <span>✓ Agendamento registrado no aplicativo</span>
          <span>✉ Confirmação por e-mail preparada</span>

          {whatsappUrl ? (
            <>
              <small>
                Se desejar, envie os dados do agendamento diretamente
                para {selected.professional} pelo WhatsApp.
              </small>

              <button
                type="button"
                className="primary"
                onClick={() => {
                  window.location.href = whatsappUrl;
                }}
              >
                Enviar para {selected.professional} pelo WhatsApp
              </button>
            </>
          ) : (
            <small>
              O WhatsApp da profissional ainda não está disponível.
              Seu agendamento já está confirmado.
            </small>
          )}
        </div>
        <button
          className="primary"
          disabled={bookingSubmitting}
          onClick={() => {
            if (requests.busy("create")) return;
            setConfirmed(false);
            resetAvailability(false);
            setSelected(null);
            setAppointmentId("");
            setAvailabilityReload((value) => value + 1);
          }}
        >
          Ver outros serviços
        </button>
      </section>
    );
  if (selected)
    return (
      <div className="service-schedule-detail">
        <button
          className="schedule-back"
          disabled={bookingSubmitting}
          onClick={() => {
            if (requests.busy("create")) return;
            resetAvailability(false);
            setSelected(null);
            setBookingError("");
          }}
          style={{ display: "flex", alignItems: "center", gap: "4px" }}
        >
          <ArrowLeft aria-hidden="true" /> Voltar para serviços
        </button>
        <div className="schedule-layout">
          <section className="selected-service">
            <ServiceCoverImage src={selected.image} alt={selected.name} />
            <span className="eyebrow">{selected.category}</span>
            <h2>{selected.name}</h2>
            <p>{selected.description}</p>
            <div className="service-facts">
              <span>
                ◷ <b>{selected.duration} min</b>
              </span>
              <span>
                R$ <b>{selected.price},00</b>
              </span>
            </div>
            <div className="assigned-pro">
              <span>{selected.professional[0]}</span>
              <div>
                <small>PROFISSIONAL RESPONSÁVEL</small>
                <b>{selected.professionalFullName || selected.professional}</b>
                <em>{selected.specialty || "Profissional do SPA"}</em>
              </div>
            </div>
          </section>
          <section className="availability">
            <span className="eyebrow">ESCOLHA SEU HORÁRIO</span>
            <h2>Disponibilidade de {selected.professional}</h2>
            <p>Selecione uma data para ver os horários livres.</p>
            <div className="availability-month">
              <label htmlFor="client-booking-date">Data do atendimento</label>
              <div className="availability-date-controls">
                <button
                  type="button"
                  aria-label="Dia anterior"
                  disabled={bookingSubmitting || selectedDate <= today}
                  onClick={() => moveDate(-1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <input
                  id="client-booking-date"
                  type="date"
                  disabled={bookingSubmitting}
                  min={today}
                  value={selectedDate}
                  onChange={(event) => selectDate(event.target.value)}
                />
                <button
                  type="button"
                  aria-label="Próximo dia"
                  disabled={bookingSubmitting}
                  onClick={() => moveDate(1)}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="availability-days">
              {Array.from({ length: 6 }, (_, index) => shiftBookingDate(selectedDate, index)).map((value) => (
                <button
                  type="button"
                  disabled={bookingSubmitting}
                  className={selectedDate === value ? "active" : ""}
                  onClick={() => selectDate(value)}
                  key={value}
                >
                  <small>{formatBookingDate(value, { weekday: "short" }).replace(".", "").toUpperCase()}</small>
                  <b>{value.slice(8, 10)}</b>
                  <i>horários livres</i>
                </button>
              ))}
            </div>
            <label>Horários disponíveis</label>
            <div className="available-times">
              {availableSlots.map((slot) => (
                <button
                  disabled={bookingSubmitting}
                  className={time === slot.label ? "active" : ""}
                  onClick={() => { if (requests.busy("create")) return; setTime(slot.label); setSelectedSlot(slot); setBookingError(""); }}
                  key={slot.start}
                >
                  {slot.label}
                </button>
              ))}
            </div>
            {slotsLoading && <div className="slots-feedback"><span>✦</span> Consultando agenda...</div>}
            {slotsError && <div className="slots-feedback error"><span>{slotsError}</span><button disabled={bookingSubmitting} onClick={() => { if (!requests.busy("create")) setAvailabilityReload((value) => value + 1); }}>Tentar novamente</button></div>}
            {!slotsLoading &&
            !slotsError &&
            availableSlots.length === 0 &&
            gapSuggestions.length === 0 && (
              <div className="slots-feedback">
                Não há horários livres ou possíveis encaixes nesta
                data. Escolha outro dia.
              </div>
            )}
            {!slotsLoading &&
              !slotsError &&
              gapSuggestions.length > 0 &&
              selected.professionalWhatsapp && (
                <section className="booking-gap-suggestions">
                  <div className="booking-gap-heading">
                    <span>✦</span>

                    <div>
                      <strong>Possíveis encaixes</strong>
                      <small>
                        Estes intervalos são menores que os{" "}
                        {selected.duration} minutos necessários para o
                        serviço. Consulte a profissional para verificar
                        uma possibilidade.
                      </small>
                    </div>
                  </div>

                  <div className="booking-gap-list">
                    {gapSuggestions.map((gap) => {
                      const gapWhatsAppUrl =
                        buildBookingGapWhatsAppUrl({
                          whatsappNumber:
                            selected.professionalWhatsapp,
                          clientName,
                          professionalName:
                            selected.professionalFullName ||
                            selected.professional,
                          serviceName: selected.name,
                          date: selectedDate,
                          gapStart: gap.startLabel,
                          gapEnd: gap.endLabel,
                          availableMinutes:
                            gap.availableMinutes,
                          serviceDuration: selected.duration,
                        });

                      if (!gapWhatsAppUrl) return null;

                      return (
                        <article
                          className="booking-gap-card"
                          key={`${gap.start}-${gap.end}`}
                        >
                          <div>
                            <small>INTERVALO LIVRE</small>

                            <strong>
                              {gap.startLabel} às {gap.endLabel}
                            </strong>

                            <span>
                              {gap.availableMinutes} minutos disponíveis
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              window.location.href =
                                gapWhatsAppUrl;
                            }}
                          >
                            Consultar encaixe pelo WhatsApp
                          </button>
                        </article>
                      );
                    })}
                  </div>

                  <small className="booking-gap-warning">
                    O envio da mensagem não reserva o horário. O encaixe
                    depende da confirmação da profissional.
                  </small>
                </section>
              )}
            {bookingError && (
              <div
                className={`booking-error booking-error--${bookingErrorType}`}
                role="alert"
                aria-live="assertive"
              >
                <span
                  className="booking-error-icon"
                  aria-hidden="true"
                >
                  !
                </span>

                <div>
                  <strong>
                    {bookingErrorType === "same-day"
                      ? "Você já possui um horário neste dia"
                      : bookingErrorType === "future-limit"
                        ? "Limite de agendamentos atingido"
                        : bookingErrorType === "availability"
                          ? "Horário indisponível"
                          : "Não foi possível agendar"}
                  </strong>

                  <p>{bookingError}</p>
                </div>
              </div>
            )}
            <div className="schedule-summary">
              <div>
                <span>DATA</span>
                <b>{formatBookingDate(selectedDate)}</b>
              </div>
              <div>
                <span>HORÁRIO</span>
                <b>{time || "Selecione"}</b>
              </div>
              <div>
                <span>VALOR NO LOCAL</span>
                <b>R$ {selected.price},00</b>
              </div>
            </div>
            <button
              className="primary confirm-schedule"
              disabled={!selectedSlot || bookingSubmitting || selectedDate < today}
              onClick={confirmAppointment}
            >
              {bookingSubmitting ? "Confirmando horário..." : "Confirmar agendamento →"}
            </button>
            <small className="schedule-note">
              Nenhum pagamento será solicitado agora.
            </small>
          </section>
        </div>
      </div>
    );
  return (
    <div className="service-catalog">
      <div className="catalog-heading">
        <span className="eyebrow">ESCOLHA SEU CUIDADO</span>
        <h2>Qual momento você quer viver hoje?</h2>
        <p>
          Selecione um serviço para consultar a agenda da profissional
          responsável.
        </p>
      </div>
      <div className="services-tools client-tools">
        <div className="catalog-filter-group"><div className="catalog-filters">
          {filters.map((f) => (
            <button
              className={catalogFilter === f ? "active" : ""}
              onClick={() => {
                setCatalogFilter(f);
                resetClientCarousel();
              }}
              key={f}
            >
              {f}
            </button>
          ))}
        </div><ProfessionalFilter options={professionalOptions} value={professionalFilter} onChange={(value) => { setProfessionalFilter(value); resetClientCarousel(); }} /></div>
        <div className="carousel-arrows">
          <button
            onClick={() => slideClient(-1)}
            aria-label="Serviços anteriores"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button onClick={() => slideClient(1)} aria-label="Próximos serviços">
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      {catalogLoading && <div className="catalog-feedback"><span>✦</span><p>Carregando os serviços...</p></div>}
      {catalogError && <div className="catalog-feedback error"><p>{catalogError}</p><button onClick={loadCatalog}>Tentar novamente</button></div>}
      {!catalogLoading && !catalogError && catalog.length === 0 && <div className="catalog-feedback"><p>Nenhum serviço disponível no momento.</p></div>}
      {!catalogLoading && !catalogError && catalog.length > 0 && visibleServices.length === 0 && <div className="catalog-feedback empty"><p>Nenhum serviço encontrado para esta combinação.</p><button type="button" onClick={() => { setCatalogFilter("Todos"); setProfessionalFilter("all"); resetClientCarousel(); }}>Limpar filtros</button></div>}
      <div className="client-service-grid mobile-carousel" ref={clientCarousel}>
        {visibleServices.map((s) => (
          <article key={`${s.id}-${s.professionalId}`}>
            <div className="client-service-image">
              <ServiceCoverImage src={s.image} alt={s.name} />
              <span>{s.category}</span>
            </div>
            <div className="client-service-body">
              <h3>{s.name}</h3>
              <p>{s.description}</p>
              <div className="service-provider">
                <span>{s.professional[0]}</span>
                <div>
                  <small>COM</small>
                  <b>{s.professional}</b>
                </div>
              </div>
              <div className="service-price">
                <span>◷ {s.duration} min</span>
                <b>R$ {s.price},00</b>
              </div>
              <button onClick={() => openService(s)} style={{ marginTop: "auto" }}>
                Ver horários disponíveis →
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const appointmentStatusLabel: Record<ClientAppointment["status"], string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

function appointmentDay(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(" de ", " ").replace(".", "").toUpperCase();
}

function appointmentTime(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function appointmentLongDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

const clientTabs = [
  { label: "Início", icon: Home },
  { label: "Serviços", icon: Plus },
  { label: "Meus agendamentos", icon: CalendarDays },
  { label: "Histórico", icon: Clock3 },
  { label: "Meu perfil", icon: UserRound },
];

export function ClientDashboard({ logout, profile }: { logout: () => void; profile: AuthProfile | null }) {
  const requests = useBookingRequests();
  const [rules, setRules] = useState<CancellationRules | null>(null);
  const [cancellationFeedback, setCancellationFeedback] = useState("");
  const cancellationNotice = rules?.cancellationEnabled
    ? "Prazo de cancelamento encerrado."
    : cancellationUnavailableMessage(rules);
  const [tab, setTab] = useState("Serviços");
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState("");
  const [cancellingId, setCancellingId] = useState("");
  const [currentTime, setCurrentTime] = useState(
    () => Date.now(),
  );
  const [appointmentProfessional, setAppointmentProfessional] = useState("all");
  const { open: drawerOpen, setOpen: setDrawerOpen, close: closeDrawer, drawerRef, triggerRef } = useDashboardDrawer();
  const [
    appointmentToCancel,
    setAppointmentToCancel,
  ] = useState<ClientAppointment | null>(null);
  const [displayName, setDisplayName] = useState(
    profile?.full_name || "Cliente",
  );

  const goServices = () => setTab("Serviços");
  const clientName = displayName;
  const firstName = clientName.split(" ")[0];
  const initials = clientName.split(" ").slice(0, 2).map((name) => name[0]).join("").toUpperCase();
  const now = new Date(currentTime);
  const upcomingAppointments = appointments.filter((item) => new Date(item.start) > now && ["pending", "confirmed"].includes(item.status)).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const historyAppointments = appointments.filter((item) => new Date(item.start) <= now || ["completed", "cancelled", "no_show"].includes(item.status)).sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  const appointmentProfessionals = useMemo(() => Array.from(new Map(appointments.map((item) => [item.professionalId, { id: item.professionalId, name: item.professionalName }])).values()).sort((a, b) => a.name.localeCompare(b.name)), [appointments]);
  const filteredUpcoming = upcomingAppointments.filter((item) => appointmentProfessional === "all" || item.professionalId === appointmentProfessional);
  const filteredHistory = historyAppointments.filter((item) => appointmentProfessional === "all" || item.professionalId === appointmentProfessional);
  const nextAppointment = upcomingAppointments[0];
  const nextAppointmentCanBeCancelled =
    nextAppointment
      ? canClientCancelAppointment(
          nextAppointment.start,
          rules,
          currentTime,
        )
      : false;

  const loadAppointments = useCallback(async () => {
    const ticket = requests.begin("appointments");
    if (!ticket) return;
    setAppointmentsLoading(true); setAppointmentsError("");
    try {
      const [data, currentRules] = await Promise.all([
        getClientAppointments(), getCancellationRules().catch(() => null),
      ]);
      if (!requests.current(ticket)) return;
      setAppointments(data); setRules(currentRules);
      if (!currentRules) setAppointmentsError(cancellationMessage(null));
    } catch {
      if (requests.current(ticket)) setAppointmentsError("Não foi possível carregar seus agendamentos.");
    } finally {
      if (requests.current(ticket)) setAppointmentsLoading(false);
      requests.finish(ticket);
    }
  }, [requests]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void loadAppointments(); });
    return () => { cancelled = true; };
  }, [loadAppointments]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  async function openCancellation(item: ClientAppointment) {
    const ticket = requests.begin("cancellation", true);
    if (!ticket) return;
    setAppointmentsError("");
    setCancellingId(item.id);
    try {
      const currentRules = await revalidateCancellation(item.start, getCancellationRules);
      if (!requests.current(ticket)) return;
      setRules(currentRules);
      setCancellationFeedback("");
      setAppointmentToCancel(item);
    } catch (error) {
      if (requests.current(ticket)) setAppointmentsError(bookingErrorMessage(error, "cancel"));
    } finally {
      if (requests.current(ticket)) setCancellingId("");
      requests.finish(ticket);
    }
  }

  async function cancelAppointment(item: ClientAppointment) {
    const ticket = requests.begin("cancellation", true);
    if (!ticket) return;
    setCancellingId(item.id);
    setCancellationFeedback("");
    try {
      // A validação no navegador informa; UPDATE/RLS/triggers continuam definitivos.
      const currentRules = await revalidateCancellation(item.start, getCancellationRules);
      if (!requests.current(ticket)) return;
      setRules(currentRules);
      await cancelAndRefreshClientAppointment(item.id, {
        isCurrent: () => requests.current(ticket),
        onConfirmed: () => {
          setAppointments((current) => applyConfirmedClientCancellation(current, item.id));
          setAppointmentToCancel(null);
        },
        reload: loadAppointments,
      });
    } catch (error) {
      if (requests.current(ticket)) setCancellationFeedback(bookingErrorMessage(error, "cancel"));
    } finally {
      if (requests.current(ticket)) setCancellingId("");
      requests.finish(ticket);
    }
  }

  return (
    <div className="client-portal">
      {drawerOpen && <button type="button" className="client-drawer-backdrop" aria-label="Fechar menu" onClick={() => closeDrawer()} />}
      <aside id="client-navigation" ref={drawerRef} tabIndex={-1} className={`client-mobile-drawer ${drawerOpen ? "client-navigation-open" : ""}`}>
        <button type="button" className="client-drawer-close icon-button" aria-label="Fechar menu" title="Fechar menu" onClick={() => closeDrawer()}><X aria-hidden="true" /></button>
        <div className="client-drawer-identity"><span>{initials}</span><div><b>{clientName}</b><small>Cliente</small></div></div>
        {clientTabs.map(({ label: x, icon: TabIcon }) => <button className={tab === x ? "active" : ""} onClick={() => { setTab(x); closeDrawer(); }} key={x}><TabIcon aria-hidden="true" /> {x}</button>)}
        <button type="button" className="client-drawer-logout button-with-icon" onClick={logout}><LogOut aria-hidden="true" /> Sair da conta</button>
      </aside>
      <header>
        <Logo compact />
        <nav className="client-desktop-navigation">
          {clientTabs.map(({ label: x, icon: TabIcon }) => (
            <button
              className={tab === x ? "active" : ""}
              onClick={() => setTab(x)}
              key={x}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <TabIcon aria-hidden="true" /> {x}
              </span>
            </button>
          ))}
        </nav>
        <div className="client-account-actions">
          <ThemeToggle />
          <div className="client-profile">
            <span>{initials}</span>
            <div>
              <b>{clientName}</b>
              <small>Cliente</small>
            </div>
            <button onClick={logout}>Sair</button>
          </div>
          <button ref={triggerRef} type="button" className="client-menu-button icon-button" aria-label="Abrir menu" title="Abrir menu" aria-expanded={drawerOpen} aria-controls="client-navigation" onClick={() => setDrawerOpen(true)}><Menu aria-hidden="true" /></button>
        </div>
      </header>
      <main>
        <div className="client-welcome">
          <div>
            <span className="eyebrow">OLÁ, {firstName.toUpperCase()} ♡</span>
            <h1>{tab === "Início" ? "Que bom ter você aqui!" : tab}</h1>
            <p>
              {tab === "Serviços"
                ? "Escolha o serviço e consulte os horários disponíveis."
                : tab === "Início"
                  ? "Este é o seu cantinho de cuidado, beleza e bem-estar."
                  : "Acompanhe suas informações e atendimentos."}
            </p>
          </div>
          {tab !== "Serviços" && (
            <button className="primary" style={{ display: "flex", alignItems: "center", gap: "4px" }} onClick={goServices}>
              <Plus aria-hidden="true" /> Agendar um serviço
            </button>
          )}
        </div>
        {tab === "Serviços" && (
          <ServiceScheduling
            clientName={clientName}
            onAppointmentCreated={loadAppointments}
          />
        )}
        {tab === "Início" && (
          <>
            <ShowcaseCarousel compact />
            {appointmentsLoading ? <div className="appointments-feedback">Carregando seu próximo cuidado...</div> : nextAppointment ? (
              <section className="next-appointment">
                <div className="date-box"><b>{new Date(nextAppointment.start).getDate().toString().padStart(2, "0")}</b><span>{new Date(nextAppointment.start).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</span></div>
                <div><span className="eyebrow">PRÓXIMO AGENDAMENTO</span><h2>{nextAppointment.serviceName}</h2><p>{appointmentLongDate(nextAppointment.start)} às {appointmentTime(nextAppointment.start)} · com {nextAppointment.professionalName}</p><div><span>◷ {nextAppointment.duration} minutos</span><span>⌖ SPA Express Cambucás</span></div></div>
                <em className="confirmado">{appointmentStatusLabel[nextAppointment.status]}</em>
                <div className="appointment-buttons client-booking-actions">
                  <div className="client-booking-action-buttons">
                    <button
                      onClick={() =>
                        setTab("Meus agendamentos")
                      }
                    >
                      Detalhes
                    </button>

                    <button
                      disabled={
                        !!cancellingId ||
                        !nextAppointmentCanBeCancelled
                      }
                      title={
                        nextAppointmentCanBeCancelled
                          ? "Cancelar agendamento"
                          : cancellationUnavailableMessage(rules)
                      }
                      onClick={() =>
                        void openCancellation(nextAppointment)
                      }
                    >
                      {cancellingId ===
                      nextAppointment.id
                        ? "Cancelando..."
                        : nextAppointmentCanBeCancelled
                          ? "Cancelar"
                          : rules ? "Prazo encerrado" : "Indisponível"}
                    </button>

                  </div>
                  {!nextAppointmentCanBeCancelled && (
                    <small className="client-cancellation-notice">
                      {cancellationNotice}
                    </small>
                  )}
                </div>
              </section>
            ) : <div className="appointments-feedback empty"><b>Nenhum horário marcado</b><span>Escolha um serviço para reservar seu próximo momento.</span><button onClick={goServices}>Ver serviços</button></div>}
            {appointmentsError && <div className="appointments-feedback error">{appointmentsError}<button onClick={loadAppointments}>Tentar novamente</button></div>}
            <div className="client-grid">
              <section className="screen-card">
                <div className="panel-head">
                  <div>
                    <h2>Seus cuidados recentes</h2>
                    <p>Últimos atendimentos</p>
                  </div>
                  <button onClick={() => setTab("Histórico")}>
                    Ver histórico →
                  </button>
                </div>
                {historyAppointments.slice(0, 3).map((item) => <div className="history-row" key={item.id}><span>{appointmentDay(item.start)}</span><div><b>{item.serviceName}</b><small>com {item.professionalName}</small></div><em className={item.status}>{appointmentStatusLabel[item.status]}</em><button onClick={goServices}>Agendar novamente</button></div>)}
                {!appointmentsLoading && historyAppointments.length === 0 && <div className="appointments-inline-empty">Seus atendimentos concluídos aparecerão aqui.</div>}
              </section>
              <section className="client-faq">
                <div className="client-faq-heading">
                  <span>?</span>

                  <div>
                    <span className="eyebrow">
                      DÚVIDAS FREQUENTES
                    </span>

                    <h2>Como podemos ajudar?</h2>

                    <p>
                      Informações rápidas sobre seus
                      agendamentos.
                    </p>
                  </div>
                </div>

                <div className="client-faq-list">
                  <details>
                    <summary>
                      Como faço um novo agendamento?
                      <span aria-hidden="true">+</span>
                    </summary>

                    <p>
                      Acesse a aba Serviços, escolha o
                      atendimento e a profissional, selecione
                      uma data e confirme um dos horários
                      disponíveis.
                    </p>
                  </details>

                  <details>
                    <summary>
                      Como funciona o pagamento?
                      <span aria-hidden="true">+</span>
                    </summary>

                    <p>
                      Nenhum pagamento é solicitado pelo site.
                      O valor do serviço é pago diretamente no
                      SPA no dia do atendimento.
                    </p>
                  </details>

                  <details>
                    <summary>
                      Posso cancelar um horário?
                      <span aria-hidden="true">+</span>
                    </summary>

                    <p>
                      {cancellationMessage(rules)} Acesse Meus agendamentos
                      e utilize o botão Cancelar no horário desejado.
                    </p>
                  </details>

                  <details>
                    <summary>
                      O que é um possível encaixe?
                      <span aria-hidden="true">+</span>
                    </summary>

                    <p>
                      É um intervalo menor que a duração normal
                      do serviço. Você pode consultar a
                      profissional pelo WhatsApp, mas o envio da
                      mensagem não garante a reserva.
                    </p>
                  </details>
                </div>
              </section>
            </div>
          </>
        )}
        {tab === "Meus agendamentos" && (
          <div className="screen-card client-list">
            <h2>Próximos horários</h2>
            <ProfessionalFilter options={appointmentProfessionals} value={appointmentProfessional} onChange={setAppointmentProfessional} className="appointment-professional-filter" />
            {appointmentsLoading && <div className="appointments-inline-empty">Carregando agendamentos...</div>}
            {!appointmentsLoading &&
              filteredUpcoming.map((item) => {
                const cancellationAvailable =
                  canClientCancelAppointment(
                    item.start,
                    rules,
                    currentTime,
                  );

                return (
                  <div
                    className="client-booking"
                    key={item.id}
                  >
                    <span>
                      {appointmentDay(item.start)}
                    </span>

                    <div>
                      <h3>{item.serviceName}</h3>

                      <p>
                        às {appointmentTime(item.start)} ·
                        com {item.professionalName}
                      </p>

                      <small>
                        R${" "}
                        {item.price
                          .toFixed(2)
                          .replace(".", ",")}{" "}
                        · pagamento{" "}
                        {item.paymentStatus === "paid"
                          ? "confirmado"
                          : "no local"}
                      </small>
                    </div>

                    <em className={item.status}>
                      {appointmentStatusLabel[item.status]}
                    </em>

                    <div className="client-booking-actions">
                      <div className="client-booking-action-buttons">
                        <button onClick={goServices}>
                          Agendar outro
                        </button>

                        <button
                          disabled={
                            !!cancellingId ||
                            !cancellationAvailable
                          }
                          title={
                            cancellationAvailable
                              ? "Cancelar agendamento"
                              : cancellationUnavailableMessage(rules)
                          }
                          onClick={() =>
                            void openCancellation(item)
                          }
                        >
                          {cancellingId === item.id
                            ? "Cancelando..."
                            : cancellationAvailable
                              ? "Cancelar"
                              : rules ? "Prazo encerrado" : "Indisponível"}
                        </button>

                      </div>
                      {!cancellationAvailable && (
                        <small className="client-cancellation-notice">
                          {cancellationNotice}
                        </small>
                      )}
                    </div>
                  </div>
                );
              })}
            {!appointmentsLoading && filteredUpcoming.length === 0 && <div className="appointments-inline-empty">{appointmentProfessional === "all" ? <>Você ainda não possui horários futuros. <button onClick={goServices}>Agendar agora</button></> : "Nenhum agendamento encontrado para esta profissional."}</div>}
            {appointmentsError && <div className="appointments-feedback error">{appointmentsError}<button onClick={loadAppointments}>Tentar novamente</button></div>}
          </div>
        )}
        {tab === "Histórico" && (
          <div className="screen-card client-list">
            <h2>Histórico de atendimentos</h2>
            <ProfessionalFilter options={appointmentProfessionals} value={appointmentProfessional} onChange={setAppointmentProfessional} className="appointment-professional-filter" />
            {appointmentsLoading && <div className="appointments-inline-empty">Carregando histórico...</div>}
            {!appointmentsLoading && filteredHistory.map((item) => <div className="client-booking" key={item.id}><span>{appointmentDay(item.start)}</span><div><h3>{item.serviceName}</h3><p>{appointmentLongDate(item.start)} às {appointmentTime(item.start)} · com {item.professionalName}</p><small>R$ {item.price.toFixed(2).replace(".", ",")}</small></div><em className={item.status}>{appointmentStatusLabel[item.status]}</em><button onClick={goServices}>Agendar novamente</button></div>)}
            {!appointmentsLoading && filteredHistory.length === 0 && <div className="appointments-inline-empty">{appointmentProfessional === "all" ? "Seu histórico ainda está vazio." : "Nenhum agendamento encontrado para esta profissional."}</div>}
            {appointmentsError && <div className="appointments-feedback error">{appointmentsError}<button onClick={loadAppointments}>Tentar novamente</button></div>}
          </div>
        )}
        {tab === "Meu perfil" && (
          <ClientProfileForm
            profile={profile}
            onNameChange={setDisplayName}
          />
        )}
      </main>
      <ActionDialog
        open={appointmentToCancel !== null}
        title="Cancelar seu horário?"
        description={
          appointmentToCancel
            ? `${appointmentToCancel.serviceName} em ${appointmentLongDate(
                appointmentToCancel.start,
              )} às ${appointmentTime(
                appointmentToCancel.start,
              )}. O horário ficará disponível novamente. ${cancellationMessage(rules)}`
            : ""
        }
        confirmLabel="Cancelar agendamento"
        danger
        loading={
          appointmentToCancel
            ? cancellingId === appointmentToCancel.id
            : false
        }
        feedback={cancellationFeedback || (appointmentToCancel && !canClientCancelAppointment(appointmentToCancel.start, rules, currentTime) ? cancellationUnavailableMessage(rules) : "")}
        onCancel={() => { setAppointmentToCancel(null); setCancellationFeedback(""); }}
        onConfirm={() => {
          if (!appointmentToCancel) return;

          void cancelAppointment(appointmentToCancel);
        }}
      />
    </div>
  );
}
