"use client";
import { useRef, useState } from "react";
import { filterServices, hourlySlots, pad, serviceFilters, services, type Service, type ServiceMedia } from "../../lib/spa-data";
import { Logo, ThemeToggle } from "../shared/spa-ui";

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
function ServiceScheduling() {
  const today = new Date();
  const firstAvailable = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const [selected, setSelected] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState(firstAvailable.toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState("Todos");
  const clientCarousel = useRef<HTMLDivElement>(null);
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
        <div className="confirmation-channels"><span>✓ Confirmação registrada no aplicativo</span><span>✉ E-mail preparado pelo Resend</span><span>◍ WhatsApp Business preparado</span><small>{selected.professional} também será avisada conforme as preferências dela.</small></div>
        <button
          className="primary"
          onClick={() => {
            setConfirmed(false);
            setSelected(null);
            setTime("");
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
          }}
        >
          ← Voltar para serviços
        </button>
        <div className="schedule-layout">
          <section className="selected-service">
            <img
              src={
                selected.professional === "Dayanne"
                  ? "/nails-detail.png"
                  : "/eliane-care.png"
              }
              alt=""
            />
            <span className="eyebrow">{selected.category}</span>
            <h2>{selected.name}</h2>
            <p>
              Atendimento personalizado, realizado com cuidado e produtos
              selecionados para proporcionar conforto e excelentes resultados.
            </p>
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
                <b>
                  {selected.professional}{" "}
                  {selected.professional === "Eliane" ? "Cristina" : "Costa"}
                </b>
                <em>
                  {selected.professional === "Eliane"
                    ? "Massagista & Esteticista"
                    : "Manicure & Nail designer"}
                </em>
              </div>
            </div>
          </section>
          <section className="availability">
            <span className="eyebrow">ESCOLHA SEU HORÁRIO</span>
            <h2>Disponibilidade de {selected.professional}</h2>
            <p>Selecione uma data para ver os horários livres.</p>
            <div className="availability-month">
              <label>Data do atendimento</label>
              <input type="date" min={today.toISOString().slice(0, 10)} value={selectedDate} onChange={(event) => {setSelectedDate(event.target.value);setTime("");}} />
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
              {hourlySlots(9, selected.professional === "Eliane" ? 19 : 18, 60).map((t, i) => (
                <button
                  disabled={new Date(`${selectedDate}T${t}:00`) <= today || (new Date(`${selectedDate}T12:00:00`).getDate() + i) % 5 === 0}
                  className={time === t ? "active" : ""}
                  onClick={() => setTime(t)}
                  key={t}
                >
                  {t}
                  {new Date(`${selectedDate}T${t}:00`) <= today ? <small>horário passado</small> : (new Date(`${selectedDate}T12:00:00`).getDate() + i) % 5 === 0 && <small>ocupado</small>}
                </button>
              ))}
            </div>
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
              disabled={!time || selectedDate < today.toISOString().slice(0, 10)}
              onClick={() => setConfirmed(true)}
            >
              Confirmar agendamento →
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
          {serviceFilters.map((f) => (
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
      <div className="client-service-grid mobile-carousel" ref={clientCarousel}>
        {filterServices(catalogFilter).map((s, i) => (
          <article key={s.name}>
            <div className="client-service-image">
              <img
                src={
                  s.professional === "Dayanne"
                    ? "/nails-detail.png"
                    : i % 2
                      ? "/team-access.png"
                      : "/eliane-care.png"
                }
                alt=""
              />
              <span>{s.category}</span>
            </div>
            <div className="client-service-body">
              <h3>{s.name}</h3>
              <p>Protocolo completo pensado para o seu bem-estar.</p>
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

export function ClientDashboard({ logout, mediaItems }: { logout: () => void; mediaItems: ServiceMedia[] }) {
  const [tab, setTab] = useState("Serviços");
  const goServices = () => setTab("Serviços");
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
            <span>MA</span>
            <div>
              <b>Mariana Alves</b>
              <small>Cliente</small>
            </div>
            <button onClick={logout}>Sair</button>
          </div>
        </div>
      </header>
      <main>
        <div className="client-welcome">
          <div>
            <span className="eyebrow">OLÁ, MARIANA ♡</span>
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
        {tab === "Serviços" && <ServiceScheduling />}
        {tab === "Início" && (
          <>
            <ClientMediaCarousel items={mediaItems} onSchedule={goServices} />
            <section className="next-appointment">
              <div className="date-box">
                <b>12</b>
                <span>AGO</span>
              </div>
              <div>
                <span className="eyebrow">PRÓXIMO AGENDAMENTO</span>
                <h2>Drenagem Linfática</h2>
                <p>Quarta-feira, 12 de agosto às 14:30 · com Eliane</p>
                <div>
                  <span>◷ 50 minutos</span>
                  <span>⌖ SPA Express Cambucás</span>
                </div>
              </div>
              <em className="confirmado">Confirmado</em>
              <div className="appointment-buttons">
                <button>Reagendar</button>
                <button>Cancelar</button>
              </div>
            </section>
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
                {[
                  ["02 AGO", "Manicure em Gel", "Dayanne"],
                  ["21 JUL", "Limpeza de Pele", "Eliane"],
                  ["10 JUL", "Massagem Relaxante", "Eliane"],
                ].map((x) => (
                  <div className="history-row" key={x[0]}>
                    <span>{x[0]}</span>
                    <div>
                      <b>{x[1]}</b>
                      <small>com {x[2]}</small>
                    </div>
                    <em>Concluído</em>
                    <button onClick={goServices}>Agendar novamente</button>
                  </div>
                ))}
              </section>
              <section className="client-loyalty">
                <span>✦</span>
                <h2>Seu autocuidado merece recompensa</h2>
                <p>
                  Você já realizou <b>8 atendimentos</b> conosco.
                </p>
                <div>
                  <i style={{ width: "100%" }} />
                </div>
                <small>Faltam 2 visitas para ganhar 15% de desconto</small>
              </section>
            </div>
          </>
        )}
        {tab === "Meus agendamentos" && (
          <div className="screen-card client-list">
            <h2>Próximos horários</h2>
            {[
              ["12 AGO", "Drenagem Linfática", "14:30", "Eliane"],
              ["25 AGO", "Manicure em Gel", "10:00", "Dayanne"],
            ].map((x) => (
              <div className="client-booking" key={x[0]}>
                <span>{x[0]}</span>
                <div>
                  <h3>{x[1]}</h3>
                  <p>
                    às {x[2]} · com {x[3]}
                  </p>
                </div>
                <em className="confirmado">Confirmado</em>
                <button>Reagendar</button>
                <button>Cancelar</button>
              </div>
            ))}
          </div>
        )}
        {tab === "Histórico" && (
          <div className="screen-card client-list">
            <h2>Histórico de atendimentos</h2>
            {services.slice(0, 5).map((s, i) => (
              <div className="client-booking" key={s.name}>
                <span>0{i + 2} JUL</span>
                <div>
                  <h3>{s.name}</h3>
                  <p>
                    com {s.professional} · R$ {s.price}
                  </p>
                </div>
                <em className="concluído">Concluído</em>
                <button onClick={goServices}>Agendar novamente</button>
              </div>
            ))}
          </div>
        )}
        {tab === "Meu perfil" && (
          <div className="screen-card profile-form">
            <h2>Meus dados</h2>
            <p>Mantenha seus dados de contato atualizados.</p>
            <div className="form-grid">
              <label>
                Nome completo
                <input defaultValue="Mariana Alves" />
              </label>
              <label>
                WhatsApp
                <input defaultValue="(21) 99999-1234" />
              </label>
              <label>
                E-mail
                <input defaultValue="mariana@email.com" />
              </label>
              <label>
                Data de nascimento
                <input defaultValue="10/05/1992" />
              </label>
              <label className="wide">
                Observações importantes
                <textarea defaultValue="Prefiro atendimentos no período da tarde." />
              </label>
            </div>
            <button className="primary">Salvar alterações</button>
          </div>
        )}
      </main>
    </div>
  );
}

