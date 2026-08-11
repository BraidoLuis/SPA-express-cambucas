"use client";
import { useEffect, useRef, useState } from "react";
import { pad, type Service, type ServiceMedia } from "../../lib/spa-data";
import { Logo, ThemeToggle } from "../shared/spa-ui";
import type { AuthProfile } from "../../lib/services/auth-service";
import { getClientCatalog } from "../../lib/services/catalog-service";
import { getAvailableSlots, type AvailableSlot } from "../../lib/services/availability-service";
import { cancelClientAppointment, createClientAppointment, getClientAppointments, type ClientAppointment } from "../../lib/services/appointment-service";
import { ClientProfileForm } from "./client-profile-form";
import { ActionDialog } from "../shared/action-dialog";

function glideCarousel(element: HTMLDivElement | null, distance: number) {
  if (!element) return;
  const start = element.scrollLeft;
  const target = start + distance;
  const duration = 850;
  const startedAt = performance.now();
  const easeInOutCubic = (progress: number) =>
    progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

  const animate = (now: number) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    element.scrollLeft = start + (target - start) * easeInOutCubic(progress);
    if (progress < 1) requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}
function ServiceScheduling({ onAppointmentCreated }: { onAppointmentCreated: () => void | Promise<void> }) {
  const today = new Date();
  const firstAvailable = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const [selected, setSelected] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState(firstAvailable.toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [appointmentId, setAppointmentId] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [catalogFilter, setCatalogFilter] = useState("Todos");
  const [catalog, setCatalog] = useState<Service[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [availabilityReload, setAvailabilityReload] = useState(0);
  const clientCarousel = useRef<HTMLDivElement>(null);
  const filters = ["Todos", ...Array.from(new Set(catalog.map((service) => service.category)))];
  const visibleServices = catalogFilter === "Todos" ? catalog : catalog.filter((service) => service.category === catalogFilter);
  async function loadCatalog() {
    setCatalogLoading(true); setCatalogError("");
    try { setCatalog(await getClientCatalog()); }
    catch { setCatalogError("Não foi possível carregar os serviços agora."); }
    finally { setCatalogLoading(false); }
  }
  useEffect(() => { void loadCatalog(); }, []);
  useEffect(() => {
    if (!selected?.id || !selected.professionalId) return;
    let cancelled = false;
    setSlotsLoading(true); setSlotsError(""); setAvailableSlots([]); setTime(""); setSelectedSlot(null); setBookingError("");
    getAvailableSlots(selected.professionalId, selected.id, selectedDate)
      .then((slots) => { if (!cancelled) setAvailableSlots(slots); })
      .catch(() => { if (!cancelled) setSlotsError("Não foi possível consultar a agenda agora."); })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [selected, selectedDate, availabilityReload]);
  async function confirmAppointment() {
    if (!selected?.id || !selected.professionalId || !selectedSlot) return;
    setBookingSubmitting(true); setBookingError("");
    try {
      const id = await createClientAppointment({ professionalId: selected.professionalId, serviceId: selected.id, slotStart: selectedSlot.start });
      setAppointmentId(id); setConfirmed(true); await onAppointmentCreated();
    } catch (error) {
        const message =
          error instanceof Error ? error.message : "";

        const expectedError = [
          "não está mais disponível",
          "acabou de ser reservado",
          "já possui um horário ativo",
          "limite de 3 agendamentos futuros",
        ].some((text) => message.includes(text));

        setBookingError(
          expectedError
            ? message
            : "Não foi possível confirmar o agendamento. Tente novamente.",
        );

        setAvailabilityReload((value) => value + 1);
      } finally { setBookingSubmitting(false); }
  }
  const slideClient = (direction: number) =>
    clientCarousel.current?.scrollBy({
      left: direction * clientCarousel.current.clientWidth * 0.82,
      behavior: "smooth",
    });
  if (confirmed && selected)
    return (
      <section className="schedule-success">
        <div>✓</div>
        <span className="eyebrow">AGENDAMENTO CONFIRMADO</span>
        <h2>Seu momento está reservado!</h2>
        <p>
          {selected.name} com {selected.professional}
        </p>
        <div className="confirmed-details">
          <span>▣ {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR", {weekday:"long",day:"2-digit",month:"long",year:"numeric"})}</span>
          <span>
            ◷ {time} · {selected.duration} minutos
          </span>
          <span>⌖ SPA Express Cambucás</span>
        </div>
        <small>
          O pagamento de R$ {selected.price},00 será realizado no local.
        </small>
        <small className="appointment-reference">Código do agendamento: {appointmentId.slice(0, 8).toUpperCase()}</small>
        <div className="confirmation-channels"><span>✓ Confirmação registrada no aplicativo</span><span>✉ E-mail preparado pelo Resend</span><span>◍ WhatsApp Business preparado</span><small>{selected.professional} também será avisada conforme as preferências dela.</small></div>
        <button
          className="primary"
          onClick={() => {
            setConfirmed(false);
            setSelected(null);
            setTime("");
            setSelectedSlot(null);
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
          onClick={() => {
            setSelected(null);
            setTime("");
            setSelectedSlot(null);
            setBookingError("");
          }}
        >
          ← Voltar para serviços
        </button>
        <div className="schedule-layout">
          <section className="selected-service">
            <img src={selected.image || (selected.professional === "Dayanne" ? "/nails-detail.png" : "/eliane-care.png")} alt={selected.name} />
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
                <em>{selected.specialty || (selected.professional === "Eliane" ? "Massagista & Esteticista" : "Manicure & Nail designer")}</em>
              </div>
            </div>
          </section>
          <section className="availability">
            <span className="eyebrow">ESCOLHA SEU HORÁRIO</span>
            <h2>Disponibilidade de {selected.professional}</h2>
            <p>Selecione uma data para ver os horários livres.</p>
            <div className="availability-month">
              <label>Data do atendimento</label>
              <input type="date" min={today.toISOString().slice(0, 10)} value={selectedDate} onChange={(event) => {setSelectedDate(event.target.value);setTime("");setSelectedSlot(null);setBookingError("");}} />
            </div>
            <div className="availability-days">
              {Array.from({length:6},(_,index)=>{const date=new Date(`${selectedDate}T12:00:00`);date.setDate(date.getDate()+index);return date;}).map((date) => {
                const value=date.toISOString().slice(0,10);
                return (
                <button
                  className={selectedDate === value ? "active" : ""}
                  onClick={() => {
                    setSelectedDate(value);
                    setTime("");
                    setSelectedSlot(null);
                    setBookingError("");
                  }}
                  key={value}
                >
                  <small>{date.toLocaleDateString("pt-BR",{weekday:"short"}).replace(".","").toUpperCase()}</small>
                  <b>{pad(date.getDate())}</b>
                  <i>horários livres</i>
                </button>
              )})}
            </div>
            <label>Horários disponíveis</label>
            <div className="available-times">
              {availableSlots.map((slot) => (
                <button
                  className={time === slot.label ? "active" : ""}
                  onClick={() => { setTime(slot.label); setSelectedSlot(slot); setBookingError(""); }}
                  key={slot.start}
                >
                  {slot.label}
                </button>
              ))}
            </div>
            {slotsLoading && <div className="slots-feedback"><span>✦</span> Consultando agenda...</div>}
            {slotsError && <div className="slots-feedback error"><span>{slotsError}</span><button onClick={() => setAvailabilityReload((value) => value + 1)}>Tentar novamente</button></div>}
            {!slotsLoading && !slotsError && availableSlots.length === 0 && <div className="slots-feedback">Não há horários livres nesta data. Escolha outro dia.</div>}
            {bookingError && <div className="booking-error">{bookingError}</div>}
            <div className="duration-allocation"><span>◷</span><div><b>{selected.duration} minutos reservados</b><small>Este serviço ocupará automaticamente {Math.ceil(selected.duration / 60)} bloco(s) consecutivo(s) na agenda de {selected.professional}.</small></div></div>
            <div className="schedule-summary">
              <div>
                <span>DATA</span>
                <b>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR")}</b>
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
              disabled={!selectedSlot || bookingSubmitting || selectedDate < today.toISOString().slice(0, 10)}
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
        <div className="catalog-filters">
          {filters.map((f) => (
            <button
              className={catalogFilter === f ? "active" : ""}
              onClick={() => {
                setCatalogFilter(f);
                clientCarousel.current?.scrollTo({
                  left: 0,
                  behavior: "smooth",
                });
              }}
              key={f}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="carousel-arrows">
          <button
            onClick={() => slideClient(-1)}
            aria-label="Serviços anteriores"
          >
            ←
          </button>
          <button onClick={() => slideClient(1)} aria-label="Próximos serviços">
            →
          </button>
        </div>
      </div>
      {catalogLoading && <div className="catalog-feedback"><span>✦</span><p>Carregando os serviços...</p></div>}
      {catalogError && <div className="catalog-feedback error"><p>{catalogError}</p><button onClick={loadCatalog}>Tentar novamente</button></div>}
      {!catalogLoading && !catalogError && catalog.length === 0 && <div className="catalog-feedback"><p>Nenhum serviço disponível no momento.</p></div>}
      <div className="client-service-grid mobile-carousel" ref={clientCarousel}>
        {visibleServices.map((s) => (
          <article key={`${s.id}-${s.professionalId}`}>
            <div className="client-service-image">
              <img src={s.image || (s.professional === "Dayanne" ? "/nails-detail.png" : "/eliane-care.png")} alt={s.name} />
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
              <button onClick={() => setSelected(s)}>
                Ver horários disponíveis →
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ClientMediaCarousel({ items, onSchedule }: { items: ServiceMedia[]; onSchedule: () => void }) {
  const carousel = useRef<HTMLDivElement>(null);
  return (
    <section className="client-media-showcase">
      <div className="client-media-heading">
        <div><span className="eyebrow">INSPIRAÇÕES DO SPA</span><h2>Veja nossos cuidados de perto</h2><p>Novidades publicadas pelas profissionais para você escolher seu próximo momento.</p></div>
        <div className="carousel-arrows"><button aria-label="Ver serviço anterior" onClick={() => glideCarousel(carousel.current, -378)}>←</button><button aria-label="Ver próximo serviço" onClick={() => glideCarousel(carousel.current, 378)}>→</button></div>
      </div>
      <div className="client-media-carousel" ref={carousel}>
        {items.map((item) => (
          <article key={item.id}>
            <div className="client-media-asset">
              {item.type === "video" ? <video src={item.url} controls playsInline /> : <img src={item.url} alt={item.title} />}
              <span>{item.professional}</span>
            </div>
            <div><small>{item.service}</small><h3>{item.title}</h3><button onClick={onSchedule}>Ver horários disponíveis →</button></div>
          </article>
        ))}
      </div>
    </section>
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

export function ClientDashboard({ logout, mediaItems, profile }: { logout: () => void; mediaItems: ServiceMedia[]; profile: AuthProfile | null }) {
  const [tab, setTab] = useState("Serviços");
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState("");
  const [cancellingId, setCancellingId] = useState("");
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
  const now = new Date();
  const upcomingAppointments = appointments.filter((item) => new Date(item.start) > now && ["pending", "confirmed"].includes(item.status)).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const historyAppointments = appointments.filter((item) => new Date(item.start) <= now || ["completed", "cancelled", "no_show"].includes(item.status)).sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  const nextAppointment = upcomingAppointments[0];

  async function loadAppointments() {
    setAppointmentsLoading(true); setAppointmentsError("");
    try { setAppointments(await getClientAppointments()); }
    catch { setAppointmentsError("Não foi possível carregar seus agendamentos."); }
    finally { setAppointmentsLoading(false); }
  }

  useEffect(() => { void loadAppointments(); }, []);

  async function cancelAppointment(item: ClientAppointment) {
    setCancellingId(item.id);
    setAppointmentsError("");

    try {
      await cancelClientAppointment(item.id);
      await loadAppointments();
    } catch {
      setAppointmentsError(
        "Não foi possível cancelar o agendamento.",
      );
    } finally {
      setCancellingId("");
    }
  }
  return (
    <div className="client-portal">
      <header>
        <Logo compact />
        <nav>
          {[
            "Início",
            "Serviços",
            "Meus agendamentos",
            "Histórico",
            "Meu perfil",
          ].map((x) => (
            <button
              className={tab === x ? "active" : ""}
              onClick={() => setTab(x)}
              key={x}
            >
              {x}
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
            <button className="primary" onClick={goServices}>
              ＋ Agendar um serviço
            </button>
          )}
        </div>
        {tab === "Serviços" && <ServiceScheduling onAppointmentCreated={loadAppointments} />}
        {tab === "Início" && (
          <>
            <ClientMediaCarousel items={mediaItems} onSchedule={goServices} />
            {appointmentsLoading ? <div className="appointments-feedback">Carregando seu próximo cuidado...</div> : nextAppointment ? (
              <section className="next-appointment">
                <div className="date-box"><b>{new Date(nextAppointment.start).getDate().toString().padStart(2, "0")}</b><span>{new Date(nextAppointment.start).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</span></div>
                <div><span className="eyebrow">PRÓXIMO AGENDAMENTO</span><h2>{nextAppointment.serviceName}</h2><p>{appointmentLongDate(nextAppointment.start)} às {appointmentTime(nextAppointment.start)} · com {nextAppointment.professionalName}</p><div><span>◷ {nextAppointment.duration} minutos</span><span>⌖ SPA Express Cambucás</span></div></div>
                <em className="confirmado">{appointmentStatusLabel[nextAppointment.status]}</em>
                <div className="appointment-buttons"><button onClick={() => setTab("Meus agendamentos")}>Detalhes</button><button disabled={cancellingId === nextAppointment.id} onClick={() => cancelAppointment(nextAppointment)}>{cancellingId === nextAppointment.id ? "Cancelando..." : "Cancelar"}</button></div>
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
              <section className="client-loyalty">
                <span>✦</span>
                <h2>Seu autocuidado merece recompensa</h2>
                <p>
                  Você já realizou <b>{appointments.filter((item) => item.status === "completed").length} atendimentos</b> conosco.
                </p>
                <div>
                  <i style={{ width: `${Math.min(appointments.filter((item) => item.status === "completed").length * 10, 100)}%` }} />
                </div>
                <small>Seu histórico de autocuidado é atualizado automaticamente.</small>
              </section>
            </div>
          </>
        )}
        {tab === "Meus agendamentos" && (
          <div className="screen-card client-list">
            <h2>Próximos horários</h2>
            {appointmentsLoading && <div className="appointments-inline-empty">Carregando agendamentos...</div>}
            {!appointmentsLoading && upcomingAppointments.map((item) => <div className="client-booking" key={item.id}><span>{appointmentDay(item.start)}</span><div><h3>{item.serviceName}</h3><p>às {appointmentTime(item.start)} · com {item.professionalName}</p><small>R$ {item.price.toFixed(2).replace(".", ",")} · pagamento {item.paymentStatus === "paid" ? "confirmado" : "no local"}</small></div><em className={item.status}>{appointmentStatusLabel[item.status]}</em><button onClick={goServices}>Agendar outro</button><button disabled={cancellingId === item.id} onClick={() => setAppointmentToCancel(item)}>{cancellingId === item.id ? "Cancelando..." : "Cancelar"}</button></div>)}
            {!appointmentsLoading && upcomingAppointments.length === 0 && <div className="appointments-inline-empty">Você ainda não possui horários futuros. <button onClick={goServices}>Agendar agora</button></div>}
            {appointmentsError && <div className="appointments-feedback error">{appointmentsError}<button onClick={loadAppointments}>Tentar novamente</button></div>}
          </div>
        )}
        {tab === "Histórico" && (
          <div className="screen-card client-list">
            <h2>Histórico de atendimentos</h2>
            {appointmentsLoading && <div className="appointments-inline-empty">Carregando histórico...</div>}
            {!appointmentsLoading && historyAppointments.map((item) => <div className="client-booking" key={item.id}><span>{appointmentDay(item.start)}</span><div><h3>{item.serviceName}</h3><p>{appointmentLongDate(item.start)} às {appointmentTime(item.start)} · com {item.professionalName}</p><small>R$ {item.price.toFixed(2).replace(".", ",")}</small></div><em className={item.status}>{appointmentStatusLabel[item.status]}</em><button onClick={goServices}>Agendar novamente</button></div>)}
            {!appointmentsLoading && historyAppointments.length === 0 && <div className="appointments-inline-empty">Seu histórico ainda está vazio.</div>}
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
              )}. O horário ficará disponível novamente.`
            : ""
        }
        confirmLabel="Cancelar agendamento"
        danger
        loading={
          appointmentToCancel
            ? cancellingId === appointmentToCancel.id
            : false
        }
        onCancel={() => setAppointmentToCancel(null)}
        onConfirm={() => {
          if (!appointmentToCancel) return;

          const appointment = appointmentToCancel;
          setAppointmentToCancel(null);

          void cancelAppointment(appointment);
        }}
      />
    </div>
  );
}
