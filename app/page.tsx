"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Service = {
  name: string;
  category: string;
  duration: number;
  price: number;
  professional: string;
  image?: string;
};
type Booking = {
  time: string;
  client: string;
  service: string;
  professional: string;
  status: "Confirmado" | "Pendente" | "Concluído";
};

const services: Service[] = [
  {
    name: "Massagem Relaxante",
    category: "Bem-estar",
    duration: 60,
    price: 120,
    professional: "Eliane",
    image: "/spa-eliane.png",
  },
  {
    name: "Drenagem Linfática",
    category: "Corporal",
    duration: 50,
    price: 110,
    professional: "Eliane",
    image: "/spa-eliane.png",
  },
  {
    name: "Limpeza de Pele",
    category: "Facial",
    duration: 70,
    price: 145,
    professional: "Eliane",
    image: "/spa-eliane.png",
  },
  {
    name: "Micropigmentação",
    category: "Estética",
    duration: 90,
    price: 280,
    professional: "Eliane",
    image: "/spa-eliane.png",
  },
  {
    name: "Manicure em Gel",
    category: "Unhas",
    duration: 60,
    price: 75,
    professional: "Natália",
    image: "/spa-nails.png",
  },
  {
    name: "Blindagem",
    category: "Unhas",
    duration: 50,
    price: 65,
    professional: "Natália",
    image: "/spa-nails.png",
  },
];

const bookings: Booking[] = [
  {
    time: "09:00",
    client: "Mariana Alves",
    service: "Drenagem Linfática",
    professional: "Eliane",
    status: "Confirmado",
  },
  {
    time: "10:30",
    client: "Carla Mendes",
    service: "Manicure em Gel",
    professional: "Natália",
    status: "Concluído",
  },
  {
    time: "13:00",
    client: "Beatriz Lima",
    service: "Limpeza de Pele",
    professional: "Eliane",
    status: "Pendente",
  },
  {
    time: "15:30",
    client: "Fernanda Souza",
    service: "Blindagem",
    professional: "Natália",
    status: "Confirmado",
  },
];

const Icon = ({ children }: { children: React.ReactNode }) => (
  <span className="icon">{children}</span>
);
const serviceFilters = ["Todos", "Estética e bem-estar", "Unhas"];
const filterServices = (filter: string) =>
  filter === "Todos"
    ? services
    : filter === "Unhas"
      ? services.filter((s) => s.category === "Unhas")
      : services.filter((s) => s.category !== "Unhas");

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo ${compact ? "compact" : ""}`}>
      <span>✦</span>
      <b>SPA EXPRESS</b>
      <small>CAMBUCÁS</small>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem("spa-theme");
    const active = saved === "dark";
    setDark(active);
    document.documentElement.classList.toggle("dark-theme", active);
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark-theme", next);
    window.localStorage.setItem("spa-theme", next ? "dark" : "light");
  }
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
    </button>
  );
}

function PublicSite({
  openBooking,
  goAdmin,
}: {
  openBooking: (service?: string) => void;
  goAdmin: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [homeFilter, setHomeFilter] = useState("Todos");
  const homeCarousel = useRef<HTMLDivElement>(null);
  const slideHome = (direction: number) =>
    homeCarousel.current?.scrollBy({
      left: direction * homeCarousel.current.clientWidth * 0.82,
      behavior: "smooth",
    });

  return (
    <div className="public-site">
      <header className="public-header">
        <a href="#inicio" aria-label="Início">
          <Logo compact />
        </a>
        <nav className={menu ? "open" : ""}>
          <a href="#inicio">Início</a>
          <a href="#sobre">Sobre nós</a>
          <a href="#servicos">Serviços</a>
          <a href="#contato">Contato</a>
          <button className="nav-admin" onClick={goAdmin}>
            Entrar
          </button>
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <button className="primary small" onClick={() => openBooking()}>
            Agendar horário
          </button>
        </div>
        <button
          className="menu"
          onClick={() => setMenu(!menu)}
          aria-label="Abrir menu"
        >
          ☰
        </button>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero-copy">
            <span className="eyebrow">CUIDADO, BELEZA & BEM-ESTAR</span>
            <h1>
              Seu momento de <em>pausa</em> começa aqui.
            </h1>
            <p>
              Tratamentos pensados para renovar sua autoestima e devolver leveza
              à sua rotina, em um espaço acolhedor e feito para você.
            </p>
            <div className="hero-actions">
              <button className="primary" onClick={() => openBooking()}>
                Agende seu horário <span>→</span>
              </button>
              <a href="#servicos">Conheça os serviços</a>
            </div>
            <div className="trust">
              <div className="avatars">
                <span>EM</span>
                <span>NA</span>
                <span>+</span>
              </div>
              <p>
                <b>+500 clientes atendidas</b>
                <small>Carinho em cada detalhe</small>
              </p>
            </div>
          </div>
          <div className="hero-visual">
            <div className="orb orb1" />
            <div className="orb orb2" />
            <div className="hero-sparkle sparkle-one">✦</div>
            <div className="hero-sparkle sparkle-two">✦</div>
            <img
              src="/team-access.png"
              alt="Eliane e Natália, profissionais do Spa Express Cambucás"
            />
            <div className="floating-card">
              <span>✦</span>
              <div>
                <b>Atendimento personalizado</b>
                <small>Você no centro de tudo</small>
              </div>
            </div>
            <button
              className="availability-callout"
              onClick={() => openBooking()}
            >
              <span className="availability-dot" />
              <div>
                <small>AGENDA ABERTA</small>
                <b>Horários disponíveis</b>
              </div>
              <strong>→</strong>
            </button>
          </div>
        </section>

        <section className="quick-benefits">
          <div>
            <Icon>♡</Icon>
            <span>
              <b>Cuidado personalizado</b>
              <small>Protocolos pensados para você</small>
            </span>
          </div>
          <div>
            <Icon>♧</Icon>
            <span>
              <b>Profissionais qualificadas</b>
              <small>Experiência e carinho</small>
            </span>
          </div>
          <div>
            <Icon>⌁</Icon>
            <span>
              <b>Ambiente acolhedor</b>
              <small>Seu momento de tranquilidade</small>
            </span>
          </div>
        </section>

        <section className="about" id="sobre">
          <div className="about-visual">
            <div className="frame">
              <img
                src="/professionals-portrait.png"
                alt="Eliane e Natália, equipe do SPA Express Cambucás"
              />
            </div>
            <div className="experience">
              <b>8+</b>
              <span>
                anos cuidando
                <br />
                de você
              </span>
            </div>
          </div>
          <div className="about-copy">
            <span className="eyebrow">SOBRE NÓS</span>
            <h2>
              Beleza que acolhe.
              <br />
              <em>Cuidado que transforma.</em>
            </h2>
            <p>
              O Spa Express Cambucás nasceu do desejo de criar um espaço onde
              cada mulher pudesse desacelerar, se cuidar e se sentir
              verdadeiramente especial.
            </p>
            <p>
              Unimos técnicas, experiência e um atendimento próximo para
              oferecer resultados que vão além da estética.
            </p>
            <div className="signature">
              Spa Express <small>com carinho, nossa equipe</small>
            </div>
          </div>
        </section>

        <section className="services-section" id="servicos">
          <div className="section-heading">
            <div>
              <span className="eyebrow">NOSSOS SERVIÇOS</span>
              <h2>
                Escolha seu momento
                <br />
                de <em>autocuidado</em>
              </h2>
            </div>
            <p>
              Procedimentos realizados com produtos de qualidade, técnicas
              atualizadas e muito carinho.
            </p>
          </div>
          <div className="services-tools">
            <div className="service-filter-buttons">
              {serviceFilters.map((f) => (
                <button
                  className={homeFilter === f ? "active" : ""}
                  onClick={() => {
                    setHomeFilter(f);
                    homeCarousel.current?.scrollTo({
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
                onClick={() => slideHome(-1)}
                aria-label="Serviços anteriores"
              >
                ←
              </button>
              <button
                onClick={() => slideHome(1)}
                aria-label="Próximos serviços"
              >
                →
              </button>
            </div>
          </div>
          <div className="service-grid mobile-carousel" ref={homeCarousel}>
            {filterServices(homeFilter).map((s, i) => (
              <article className="service-card" key={s.name}>
                <div className="service-image">
                  <img src={s.image} alt="" />
                  <span>{s.category}</span>
                </div>
                <div className="service-body">
                  <h3>{s.name}</h3>
                  <p>
                    Um protocolo completo para cuidar de você com conforto e
                    resultados.
                  </p>
                  <div>
                    <span>◷ {s.duration} min</span>
                    <b>R$ {s.price}</b>
                  </div>
                  <button onClick={() => openBooking(s.name)}>
                    Agendar este serviço <span>→</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="cta">
          <span className="eyebrow">SEU MOMENTO É AGORA</span>
          <h2>
            Pronta para se sentir
            <br />
            <em>ainda mais linda?</em>
          </h2>
          <p>
            Escolha seu serviço, encontre o melhor horário e deixe o resto com a
            gente.
          </p>
          <button className="primary light" onClick={() => openBooking()}>
            Agendar meu horário <span>→</span>
          </button>
        </section>
      </main>

      <button
        className="floating-booking-cta"
        onClick={() => openBooking()}
        aria-label="Agendar um horário"
      >
        <span>✦</span>
        <div>
          <small>RESERVE SEU MOMENTO</small>
          <b>Agendar horário</b>
        </div>
        <strong>→</strong>
      </button>

      <section className="location-section" id="localizacao">
        <div className="location-copy">
          <span className="eyebrow">VENHA NOS VISITAR</span>
          <h2>
            Seu momento de cuidado
            <br />
            tem um lugar especial.
          </h2>
          <p>
            Estamos no polo gastronômico e comercial Estação Cambucás, em frente
            à Prefeitura de Guapimirim.
          </p>
          <div className="location-address">
            <span>⌖</span>
            <div>
              <b>Estação Cambucás</b>
              <p>Avenida Dedo de Deus, 1200 · Centro, Guapimirim — RJ</p>
              <small>CEP 25940-000</small>
            </div>
          </div>
          <a
            href="https://www.google.com/maps/search/?api=1&query=Esta%C3%A7%C3%A3o+Cambuc%C3%A1s%2C+Avenida+Dedo+de+Deus%2C+1200%2C+Centro%2C+Guapimirim%2C+RJ%2C+25940-000"
            target="_blank"
            rel="noreferrer"
          >
            Abrir rota no Google Maps →
          </a>
        </div>
        <div className="map-frame">
          <iframe
            title="Localização do SPA Express Cambucás na Estação Cambucás"
            src="https://www.google.com/maps?q=Esta%C3%A7%C3%A3o%20Cambuc%C3%A1s%2C%20Avenida%20Dedo%20de%20Deus%2C%201200%2C%20Centro%2C%20Guapimirim%2C%20RJ%2C%2025940-000&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
      <footer id="contato">
        <div className="footer-top">
          <div>
            <Logo />
            <p>Beleza, cuidado e bem-estar em cada atendimento.</p>
            <div className="socials">
              <span>◎</span>
              <span>◉</span>
              <span>◌</span>
            </div>
          </div>
          <div>
            <h4>Navegue</h4>
            <a href="#sobre">Sobre nós</a>
            <a href="#servicos">Serviços</a>
            <a href="#localizacao">Localização</a>
            <button onClick={() => openBooking()}>Agendamento</button>
          </div>
          <div>
            <h4>Contato</h4>
            <p>☎ (21) 99999-0000</p>
            <p>✉ contato@spaexpress.com.br</p>
            <p>◷ Seg–Sáb, 9h às 19h</p>
          </div>
        </div>
        <div className="copyright">
          © 2026 Spa Express Cambucás <span>Privacidade · Termos</span>
        </div>
      </footer>
    </div>
  );
}

function BookingModal({
  close,
  initial,
}: {
  close: () => void;
  initial?: string;
}) {
  const [step, setStep] = useState(1);
  const [service, setService] = useState(initial || "");
  const [professional, setProfessional] = useState("");
  const [date, setDate] = useState("08");
  const [time, setTime] = useState("");
  const selected = services.find((s) => s.name === service);
  if (step === 4)
    return (
      <div className="modal-backdrop">
        <div className="booking-modal success">
          <button className="modal-close" onClick={close}>
            ×
          </button>
          <div className="success-icon">✓</div>
          <span className="eyebrow">AGENDAMENTO RECEBIDO</span>
          <h2>Seu momento está reservado!</h2>
          <p>
            Enviamos os detalhes para o seu WhatsApp. O pagamento será realizado
            no local.
          </p>
          <div className="summary">
            <b>{service}</b>
            <span>08 de agosto · {time}</span>
            <span>com {professional || selected?.professional}</span>
          </div>
          <button className="primary" onClick={close}>
            Concluir
          </button>
        </div>
      </div>
    );
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="booking-modal">
        <button className="modal-close" onClick={close}>
          ×
        </button>
        <div className="modal-heading">
          <span className="eyebrow">AGENDAMENTO ONLINE</span>
          <h2>Reserve seu momento</h2>
          <p>Pagamento realizado diretamente no local.</p>
        </div>
        <div className="steps">
          {[1, 2, 3].map((n) => (
            <span className={step >= n ? "active" : ""} key={n}>
              {n}
            </span>
          ))}
        </div>
        {step === 1 && (
          <div className="booking-step">
            <label>Qual serviço você deseja?</label>
            <div className="option-list">
              {services.map((s) => (
                <button
                  className={service === s.name ? "selected" : ""}
                  onClick={() => {
                    setService(s.name);
                    setProfessional(s.professional);
                  }}
                  key={s.name}
                >
                  <span>
                    <b>{s.name}</b>
                    <small>
                      {s.duration} min · {s.category}
                    </small>
                  </span>
                  <strong>R$ {s.price}</strong>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="booking-step">
            <label>Escolha o melhor horário</label>
            <div className="professional-choice">
              <button className="selected">
                {professional === "Natália" ? "N" : "E"}
                <span>
                  <b>{professional || selected?.professional}</b>
                  <small>Especialista disponível</small>
                </span>
                ✓
              </button>
            </div>
            <div className="calendar">
              <div className="calendar-head">
                <b>Agosto 2026</b>
                <span>‹　›</span>
              </div>
              <div className="days">
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                  <small key={d}>{d}</small>
                ))}
                {[3, 4, 5, 6, 7, 8].map((d) => (
                  <button
                    className={
                      date === String(d).padStart(2, "0") ? "selected" : ""
                    }
                    onClick={() => setDate(String(d).padStart(2, "0"))}
                    key={d}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="times">
              {["09:00", "10:30", "13:00", "14:30", "16:00", "17:30"].map(
                (t) => (
                  <button
                    className={time === t ? "selected" : ""}
                    onClick={() => setTime(t)}
                    key={t}
                  >
                    {t}
                  </button>
                ),
              )}
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="booking-step">
            <label>Seus dados</label>
            <div className="form-grid">
              <input placeholder="Nome completo" />
              <input placeholder="WhatsApp" />
              <input placeholder="E-mail" />
              <textarea placeholder="Observações (opcional)" />
            </div>
            <div className="appointment-resume">
              <span>✦</span>
              <div>
                <b>{service}</b>
                <small>
                  Dia {date}/08 às {time} · {professional}
                </small>
              </div>
              <strong>R$ {selected?.price}</strong>
            </div>
            <p className="payment-note">
              O pagamento será feito no Spa após o atendimento.
            </p>
          </div>
        )}
        <div className="modal-actions">
          {step > 1 && (
            <button className="back" onClick={() => setStep(step - 1)}>
              Voltar
            </button>
          )}
          <button
            className="primary"
            disabled={(step === 1 && !service) || (step === 2 && !time)}
            onClick={() => setStep(step + 1)}
          >
            {step === 3 ? "Confirmar agendamento" : "Continuar"} →
          </button>
        </div>
      </div>
    </div>
  );
}

type TeamAccount = "admin" | "Eliane" | "Natália";
function LoginScreen({
  role,
  close,
  onLogin,
  onTeamLogin,
}: {
  role: "admin" | "client";
  close: () => void;
  onLogin?: (role: "client") => void;
  onTeamLogin?: (account: TeamAccount) => void;
}) {
  const [show, setShow] = useState(false);
  const admin = role === "admin";
  const [account, setAccount] = useState<TeamAccount>("admin");
  const [creating, setCreating] = useState(false);
  const teamEmail =
    account === "admin"
      ? "admin@spaexpress.com.br"
      : account === "Eliane"
        ? "eliane@spaexpress.com.br"
        : "natalia@spaexpress.com.br";
  return (
    <div className={`login-screen ${admin ? "admin-access" : "client-access"}`}>
      <div className="login-theme-control">
        <ThemeToggle />
      </div>
      {!admin && creating && (
        <div className="signup-overlay">
          <div className="signup-visual">
            <img
              src="/team-access.png"
              alt="Profissionais do SPA Express Cambucás"
            />
            <div className="signup-visual-shade" />
            <Logo />
            <div className="signup-visual-copy">
              <span className="eyebrow">SEU ESPAÇO DE AUTOCUIDADO</span>
              <h1>
                Um novo momento
                <br />
                <em>começa por você.</em>
              </h1>
              <p>
                Crie sua conta para escolher serviços, conferir horários e
                acompanhar seus agendamentos.
              </p>
            </div>
          </div>
          <div className="signup-panel">
            <div className="signup-card">
              <button
                className="signup-back"
                onClick={() => setCreating(false)}
              >
                ← Voltar ao login
              </button>
              <span className="access-badge">♡ NOVA CLIENTE</span>
              <h2>Crie sua conta</h2>
              <p>
                Preencha seus dados para reservar seu próximo momento de
                cuidado.
              </p>
              <div className="signup-grid">
                <label>
                  Nome completo
                  <div className="login-input">
                    <span>♡</span>
                    <input placeholder="Como podemos chamar você?" />
                  </div>
                </label>
                <label>
                  WhatsApp
                  <div className="login-input">
                    <span>☏</span>
                    <input placeholder="(21) 99999-9999" />
                  </div>
                </label>
                <label className="wide">
                  E-mail
                  <div className="login-input">
                    <span>✉</span>
                    <input type="email" placeholder="seu@email.com" />
                  </div>
                </label>
                <label>
                  Senha
                  <div className="login-input">
                    <span>⌑</span>
                    <input
                      type={show ? "text" : "password"}
                      placeholder="Mínimo de 8 caracteres"
                    />
                  </div>
                </label>
                <label>
                  Confirmar senha
                  <div className="login-input">
                    <span>⌑</span>
                    <input
                      type={show ? "text" : "password"}
                      placeholder="Repita sua senha"
                    />
                    <button onClick={() => setShow(!show)}>
                      {show ? "Ocultar" : "Exibir"}
                    </button>
                  </div>
                </label>
              </div>
              <button
                className="primary login-submit"
                onClick={() => onLogin?.("client")}
              >
                Criar conta e continuar →
              </button>
              <p className="signup-terms">
                Ao continuar, você concorda com o uso dos seus dados apenas
                para atendimento e agendamento.
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="login-brand">
        <img
          className="login-photo"
          src={admin ? "/team-access.png" : "/client-access.png"}
          alt={
            admin
              ? "Equipe do SPA Express Cambucás"
              : "Profissional do SPA Express Cambucás"
          }
        />
        <div className="login-overlay" />
        <button onClick={close}>← Voltar ao site</button>
        <Logo />
        <div className="login-message">
          <span className="eyebrow">
            {admin ? "GESTÃO SPA EXPRESS" : "SEU MOMENTO DE CUIDADO"}
          </span>
          <h1>
            {admin ? (
              <>
                Cada profissional,
                <br />
                <em>seu próprio espaço.</em>
              </>
            ) : (
              <>
                Seu bem-estar
                <br />
                <em>começa aqui.</em>
              </>
            )}
          </h1>
          <p>
            {admin
              ? "A administradora acompanha toda a operação, enquanto cada profissional acessa somente sua agenda e seus serviços."
              : "Entre para acompanhar seus horários, rever seus cuidados favoritos e reservar seu próximo momento."}
          </p>
        </div>
        <div className="login-quote">
          <span>✦</span>
          <p>
            {admin
              ? "Organização para cuidar ainda melhor."
              : "Você merece um tempo só seu."}
          </p>
        </div>
      </div>
      <div className="login-side">
        <div className="mobile-login-hero">
          <img src={admin ? "/team-access.png" : "/client-access.png"} alt="" />
          <div className="mobile-login-shade" />
          <button onClick={close} aria-label="Voltar ao site">
            ←
          </button>
          <Logo compact />
          <div>
            <span>✦</span>
            <p>
              {admin
                ? "Seu espaço de trabalho, do seu jeito."
                : "Você merece um momento só seu."}
            </p>
          </div>
        </div>
        <div className="login-box">
          <div className="access-badge">
            {admin ? "⚙ ACESSO DA EQUIPE" : "♡ ÁREA DA CLIENTE"}
          </div>
          <span className="eyebrow">
            {admin ? "SPA EXPRESS CAMBUCÁS" : "BEM-VINDA DE VOLTA"}
          </span>
          <h2>{admin ? "Quem está acessando?" : "Entre na sua conta"}</h2>
          <p>
            {admin
              ? "Escolha um perfil para visualizar como será cada ambiente."
              : "Acompanhe seus agendamentos e cuide de você com tranquilidade."}
          </p>
          {admin && (
            <div className="team-account-picker">
              {(["admin", "Eliane", "Natália"] as TeamAccount[]).map(
                (item, i) => (
                  <button
                    className={account === item ? "active" : ""}
                    onClick={() => setAccount(item)}
                    key={item}
                  >
                    <span>{["AD", "EC", "NC"][i]}</span>
                    <div>
                      <b>{item === "admin" ? "Administradora" : item}</b>
                      <small>
                        {item === "admin"
                          ? "Acesso completo"
                          : item === "Eliane"
                            ? "Estética e massagens"
                            : "Manicure e unhas"}
                      </small>
                    </div>
                    {account === item && <strong>✓</strong>}
                  </button>
                ),
              )}
            </div>
          )}
          <label>E-mail</label>
          <div className="login-input">
            <span>✉</span>
            <input
              type="email"
              key={teamEmail}
              defaultValue={admin ? teamEmail : "cliente@email.com"}
            />
          </div>
          <label>Senha</label>
          <div className="login-input">
            <span>⌑</span>
            <input type={show ? "text" : "password"} defaultValue="12345678" />
            <button onClick={() => setShow(!show)}>
              {show ? "Ocultar" : "Exibir"}
            </button>
          </div>
          <div className="login-options">
            <label>
              <input type="checkbox" /> Manter conectado
            </label>
            <button>Esqueci minha senha</button>
          </div>
          <button
            className="primary login-submit"
            onClick={() =>
              admin ? onTeamLogin?.(account) : onLogin?.("client")
            }
          >
            {admin
              ? account === "admin"
                ? "Acessar painel administrativo"
                : `Acessar como ${account}`
              : "Entrar na minha conta"}{" "}
            →
          </button>
          {!admin && (
            <>
              <div className="login-divider">
                <span>ou</span>
              </div>
              <p className="signup">
                Primeira vez por aqui?{" "}
                <button onClick={() => setCreating(true)}>
                  Criar minha conta
                </button>
              </p>
            </>
          )}
          <div className="login-security">
            <span>⌾</span>
            <p>
              <b>Acesso individual e seguro</b>
              <small>
                {admin
                  ? "Cada conta visualiza apenas as informações permitidas ao seu perfil."
                  : "Seus dados são protegidos e usados apenas para seus atendimentos."}
              </small>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminContent({
  section,
  filter,
  setFilter,
  setAddOpen,
}: {
  section: string;
  filter: string;
  setFilter: (v: string) => void;
  setAddOpen: (v: boolean) => void;
}) {
  const filtered =
    filter === "Todos"
      ? bookings
      : bookings.filter((b) => b.professional === filter);
  if (section === "Visão geral")
    return (
      <>
        <section className="stats">
          <article>
            <div>
              <span>Agendamentos hoje</span>
              <Icon>◷</Icon>
            </div>
            <b>8</b>
            <p className="positive">
              ↗ 14% <small>vs. semana passada</small>
            </p>
          </article>
          <article>
            <div>
              <span>Atendimentos no mês</span>
              <Icon>✓</Icon>
            </div>
            <b>124</b>
            <p className="positive">
              ↗ 8% <small>vs. mês passado</small>
            </p>
          </article>
          <article>
            <div>
              <span>Taxa de ocupação</span>
              <Icon>↗</Icon>
            </div>
            <b>78%</b>
            <p className="positive">
              ↗ 5% <small>vs. mês passado</small>
            </p>
          </article>
          <article>
            <div>
              <span>Novos clientes</span>
              <Icon>♧</Icon>
            </div>
            <b>18</b>
            <p className="positive">
              ↗ 12% <small>este mês</small>
            </p>
          </article>
        </section>
        <section className="admin-grid">
          <div className="panel appointments">
            <div className="panel-head">
              <div>
                <h2>Agenda de hoje</h2>
                <p>Sexta-feira, 07 de agosto</p>
              </div>
              <div className="filters">
                {["Todos", "Eliane", "Natália"].map((f) => (
                  <button
                    className={filter === f ? "active" : ""}
                    onClick={() => setFilter(f)}
                    key={f}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <AdminTable rows={filtered} />
            <button className="see-all">Ver agenda completa →</button>
          </div>
          <div className="right-column">
            <ServiceRanking />
            <TeamCard />
          </div>
        </section>
        <QuickActions action={() => setAddOpen(true)} />
      </>
    );
  if (section === "Agenda")
    return (
      <div className="screen-card calendar-screen">
        <div className="screen-toolbar">
          <div>
            <h2>Agosto 2026</h2>
            <p>Organize horários e bloqueios da equipe.</p>
          </div>
          <div>
            <button>‹</button>
            <button>Hoje</button>
            <button>›</button>
            <button className="primary" onClick={() => setAddOpen(true)}>
              ＋ Novo horário
            </button>
          </div>
        </div>
        <div className="week-head">
          {[
            "HORÁRIO",
            "SEG 03",
            "TER 04",
            "QUA 05",
            "QUI 06",
            "SEX 07",
            "SÁB 08",
          ].map((x) => (
            <b key={x}>{x}</b>
          ))}
        </div>
        <div className="week-grid">
          {[
            "09:00",
            "10:00",
            "11:00",
            "12:00",
            "13:00",
            "14:00",
            "15:00",
            "16:00",
            "17:00",
          ].map((t, i) => (
            <div className="week-row" key={t}>
              <span>{t}</span>
              {[0, 1, 2, 3, 4, 5].map((d) => (
                <div key={d}>
                  {(i + d) % 5 === 0 && (
                    <article className={(d + i) % 2 ? "nail" : "spa"}>
                      <b>{i % 2 ? "Manicure em Gel" : "Drenagem Linfática"}</b>
                      <small>{d % 2 ? "Carla Mendes" : "Mariana Alves"}</small>
                    </article>
                  )}
                  {i === 3 && d === 4 && (
                    <article className="blocked">
                      <b>Horário bloqueado</b>
                      <small>Almoço</small>
                    </article>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
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
          <input placeholder="⌕ Buscar por cliente ou serviço" />
          <select>
            <option>Todos os status</option>
            <option>Confirmado</option>
            <option>Pendente</option>
          </select>
          <select>
            <option>Todas as profissionais</option>
          </select>
        </div>
        <AdminTable
          rows={[
            ...bookings,
            ...bookings.map((b, i) => ({
              ...b,
              time: `${16 + i}:00`,
              client: [
                "Juliana Rocha",
                "Patrícia Nunes",
                "Aline Moraes",
                "Renata Dias",
              ][i],
            })),
          ]}
        />
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
  if (section === "Profissionais")
    return (
      <div>
        <ScreenTop
          title="Sua equipe"
          text="Cadastre profissionais e defina serviços e disponibilidade."
          button="＋ Nova profissional"
          action={() => setAddOpen(true)}
        />
        <div className="professional-cards">
          <article>
            <div className="big-avatar eliane">EC</div>
            <span className="online">● Disponível hoje</span>
            <h3>Eliane Cristina</h3>
            <p>Massagista & Esteticista</p>
            <div className="mini-stats">
              <span>
                <b>5</b> hoje
              </span>
              <span>
                <b>68</b> no mês
              </span>
              <span>
                <b>4,9</b> avaliação
              </span>
            </div>
            <div className="skill-tags">
              <span>Drenagem</span>
              <span>Massagem</span>
              <span>Facial</span>
            </div>
            <button>Ver agenda e perfil →</button>
          </article>
          <article>
            <div className="big-avatar natalia">NC</div>
            <span className="online">● Disponível hoje</span>
            <h3>Natália Costa</h3>
            <p>Manicure & Nail designer</p>
            <div className="mini-stats">
              <span>
                <b>3</b> hoje
              </span>
              <span>
                <b>56</b> no mês
              </span>
              <span>
                <b>4,8</b> avaliação
              </span>
            </div>
            <div className="skill-tags">
              <span>Manicure</span>
              <span>Blindagem</span>
              <span>Gel</span>
            </div>
            <button>Ver agenda e perfil →</button>
          </article>
        </div>
      </div>
    );
  if (section === "Clientes")
    return (
      <div className="screen-card">
        <ScreenTop
          title="Clientes"
          text="Histórico e relacionamento em um só lugar."
          button="＋ Cadastrar cliente"
          action={() => setAddOpen(true)}
        />
        <div className="table-filters">
          <input placeholder="⌕ Buscar cliente" />
          <select>
            <option>Mais recentes</option>
          </select>
        </div>
        <div className="client-table">
          <div className="client-table-head">
            <b>CLIENTE</b>
            <b>CONTATO</b>
            <b>ÚLTIMO SERVIÇO</b>
            <b>VISITAS</b>
            <b>STATUS</b>
          </div>
          {[
            "Mariana Alves",
            "Carla Mendes",
            "Beatriz Lima",
            "Fernanda Souza",
            "Juliana Rocha",
          ].map((n, i) => (
            <div className="client-table-row" key={n}>
              <span className="client-avatar">
                {n
                  .split(" ")
                  .map((x) => x[0])
                  .join("")}
              </span>
              <div>
                <b>{n}</b>
                <small>Cliente desde {2024 + (i % 2)}</small>
              </div>
              <div>
                <b>
                  (21) 9999{i}-12{i}4
                </b>
                <small>{n.split(" ")[0].toLowerCase()}@email.com</small>
              </div>
              <span>
                {services[i].name}
                <small>0{i + 2}/08/2026</small>
              </span>
              <strong>{4 + i * 3}</strong>
              <em className="confirmado">Ativa</em>
              <button>•••</button>
            </div>
          ))}
        </div>
      </div>
    );
  if (section === "Relatórios")
    return (
      <div>
        <ScreenTop
          title="Relatórios e desempenho"
          text="Indicadores para tomar decisões melhores."
        />
        <section className="stats report-stats">
          <article>
            <div>
              <span>Receita estimada</span>
              <Icon>R$</Icon>
            </div>
            <b>R$ 14.820</b>
            <p className="positive">
              ↗ 11,4% <small>neste mês</small>
            </p>
          </article>
          <article>
            <div>
              <span>Ticket médio</span>
              <Icon>↗</Icon>
            </div>
            <b>R$ 119</b>
            <p className="positive">
              ↗ R$ 8 <small>vs. mês passado</small>
            </p>
          </article>
          <article>
            <div>
              <span>Cancelamentos</span>
              <Icon>×</Icon>
            </div>
            <b>4,2%</b>
            <p>
              <small>Abaixo da média</small>
            </p>
          </article>
        </section>
        <div className="report-grid">
          <div className="screen-card chart-card">
            <h2>Agendamentos por mês</h2>
            <div className="chart-bars">
              {[55, 68, 61, 82, 74, 92].map((h, i) => (
                <div key={i}>
                  <i style={{ height: `${h}%` }} />
                  <span>{["Mar", "Abr", "Mai", "Jun", "Jul", "Ago"][i]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <h2>Distribuição por categoria</h2>
            <div className="donut">
              <div>
                <b>124</b>
                <small>atendimentos</small>
              </div>
            </div>
            <div className="legend">
              <span>
                <i /> Estética corporal <b>38%</b>
              </span>
              <span>
                <i /> Unhas <b>34%</b>
              </span>
              <span>
                <i /> Facial <b>28%</b>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  return (
    <div className="settings-grid">
      <div className="screen-card settings-nav">
        <button className="active">Dados do SPA</button>
        <button>Horários de funcionamento</button>
        <button>Regras de agendamento</button>
        <button>Notificações</button>
        <button>Usuários e acessos</button>
      </div>
      <div className="screen-card settings-form">
        <h2>Dados do SPA</h2>
        <p>Informações exibidas para clientes.</p>
        <div className="form-grid">
          <label>
            Nome
            <input defaultValue="SPA Express Cambucás" />
          </label>
          <label>
            Telefone
            <input defaultValue="(21) 99999-0000" />
          </label>
          <label>
            E-mail
            <input defaultValue="contato@spaexpress.com.br" />
          </label>
          <label>
            CEP
            <input defaultValue="24700-000" />
          </label>
          <label className="wide">
            Endereço
            <input defaultValue="Cambucás, São Gonçalo — RJ" />
          </label>
          <label className="wide">
            Descrição
            <textarea defaultValue="Beleza, cuidado e bem-estar em cada atendimento." />
          </label>
        </div>
        <button className="primary">Salvar alterações</button>
      </div>
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
function AdminTable({ rows }: { rows: Booking[] }) {
  return (
    <div className="booking-list">
      {rows.map((b, i) => (
        <div className="booking-row" key={b.time + b.client + i}>
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
          <button>•••</button>
        </div>
      ))}
    </div>
  );
}
function ServiceRanking() {
  return (
    <div className="panel performance">
      <div className="panel-head">
        <div>
          <h2>Serviços mais agendados</h2>
          <p>Últimos 30 dias</p>
        </div>
        <button>•••</button>
      </div>
      {[
        ["Drenagem Linfática", 42, 85],
        ["Manicure em Gel", 35, 70],
        ["Massagem Relaxante", 28, 56],
        ["Limpeza de Pele", 24, 48],
      ].map((s, i) => (
        <div className="bar-row" key={String(s[0])}>
          <span>{i + 1}</span>
          <div>
            <b>{s[0]}</b>
            <div className="bar">
              <i style={{ width: `${s[2]}%` }} />
            </div>
          </div>
          <strong>{s[1]}</strong>
        </div>
      ))}
    </div>
  );
}
function TeamCard() {
  return (
    <div className="panel professionals">
      <div className="panel-head">
        <div>
          <h2>Equipe hoje</h2>
          <p>Disponibilidade das profissionais</p>
        </div>
      </div>
      {[
        ["E", "Eliane Cristina", "Massagista & Esteticista", "5 atendimentos"],
        ["N", "Natália Costa", "Manicure", "3 atendimentos"],
      ].map((x) => (
        <div className="pro-row" key={x[1]}>
          <span className="pro-avatar eliane">{x[0]}</span>
          <div>
            <b>{x[1]}</b>
            <small>{x[2]}</small>
          </div>
          <em>{x[3]}</em>
        </div>
      ))}
    </div>
  );
}
function QuickActions({ action }: { action: () => void }) {
  return (
    <section className="quick-actions">
      <h2>Ações rápidas</h2>
      <div>
        {[
          ["＋", "Novo agendamento", "Agendar um horário"],
          ["✦", "Adicionar serviço", "Cadastre um procedimento"],
          ["♙", "Cadastrar profissional", "Adicione à equipe"],
          ["▣", "Bloquear horário", "Indisponibilidade na agenda"],
        ].map((x) => (
          <button onClick={action} key={x[1]}>
            <Icon>{x[0]}</Icon>
            <span>
              <b>{x[1]}</b>
              <small>{x[2]}</small>
            </span>
            →
          </button>
        ))}
      </div>
    </section>
  );
}

function AdminDashboard({
  goPublic,
  logout,
}: {
  goPublic: () => void;
  logout: () => void;
}) {
  const [section, setSection] = useState("Visão geral");
  const [filter, setFilter] = useState("Todos");
  const [addOpen, setAddOpen] = useState(false);
  const menu = [
    "Visão geral",
    "Agenda",
    "Agendamentos",
    "Serviços",
    "Profissionais",
    "Clientes",
    "Relatórios",
    "Configurações",
  ];
  return (
    <div className="admin-shell">
      <aside>
        <Logo compact />
        <nav>
          {menu.map((m, i) => (
            <button
              className={section === m ? "active" : ""}
              onClick={() => setSection(m)}
              key={m}
            >
              <span>{["⌂", "▦", "◷", "✦", "♙", "♧", "↗", "⚙"][i]}</span>
              {m}
              {m === "Agendamentos" && <i>12</i>}
            </button>
          ))}
        </nav>
        <div className="support">
          <span>?</span>
          <b>Precisa de ajuda?</b>
          <small>Fale com o suporte</small>
        </div>
        <button className="view-site" onClick={goPublic}>
          ← Ver site público
        </button>
        <button className="view-site logout" onClick={logout}>
          ↪ Sair da conta
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
            <button className="notification">
              ♢<i>3</i>
            </button>
            <div className="profile">
              <span>EC</span>
              <div>
                <b>Eliane Cristina</b>
                <small>Administradora</small>
              </div>
              ⌄
            </div>
          </div>
        </header>
        <AdminContent
          section={section}
          filter={filter}
          setFilter={setFilter}
          setAddOpen={setAddOpen}
        />
        {addOpen && (
          <div className="modal-backdrop">
            <div className="simple-modal">
              <button className="modal-close" onClick={() => setAddOpen(false)}>
                ×
              </button>
              <span className="eyebrow">NOVO CADASTRO</span>
              <h2>Adicionar à agenda</h2>
              <div className="form-grid">
                <input placeholder="Nome do cliente ou serviço" />
                <input placeholder="Duração em minutos" />
                <input placeholder="Valor (R$)" />
                <select>
                  <option>Eliane</option>
                  <option>Natália</option>
                </select>
              </div>
              <button className="primary" onClick={() => setAddOpen(false)}>
                Salvar cadastro
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ProfessionalDashboard({
  professional,
  goPublic,
  logout,
}: {
  professional: "Eliane" | "Natália";
  goPublic: () => void;
  logout: () => void;
}) {
  const [section, setSection] = useState("Meu dia");
  const [blocked, setBlocked] = useState(false);
  const isEliane = professional === "Eliane";
  const fullName = isEliane ? "Eliane Cristina" : "Natália Costa";
  const initials = isEliane ? "EC" : "NC";
  const role = isEliane
    ? "Massagista & Esteticista"
    : "Manicure & Nail designer";
  const myBookings = bookings.filter((b) => b.professional === professional);
  const myServices = services.filter((s) => s.professional === professional);
  const menu = ["Meu dia", "Minha agenda", "Meus serviços", "Disponibilidade"];
  return (
    <div className="admin-shell professional-shell">
      <aside>
        <Logo compact />
        <div className="professional-aside-profile">
          <span>{initials}</span>
          <div>
            <b>{fullName}</b>
            <small>{role}</small>
          </div>
        </div>
        <nav>
          {menu.map((m, i) => (
            <button
              className={section === m ? "active" : ""}
              onClick={() => setSection(m)}
              key={m}
            >
              <span>{["⌂", "▦", "✦", "◷"][i]}</span>
              {m}
              {m === "Meu dia" && <i>{myBookings.length}</i>}
            </button>
          ))}
        </nav>
        <div className="permission-note">
          <span>⌾</span>
          <b>Acesso profissional</b>
          <small>Você visualiza somente sua agenda e seus serviços.</small>
        </div>
        <button className="view-site" onClick={goPublic}>
          ← Ver site público
        </button>
        <button className="view-site logout" onClick={logout}>
          ↪ Sair da conta
        </button>
      </aside>
      <main className="admin-main professional-main">
        <header>
          <div>
            <span>ESPAÇO DA PROFISSIONAL</span>
            <h1>{section}</h1>
            <p>Olá, {professional}. Organize seu dia com tranquilidade.</p>
          </div>
          <div className="admin-actions">
            <ThemeToggle />
            <button className="notification">
              ♢<i>2</i>
            </button>
            <div className="profile">
              <span>{initials}</span>
              <div>
                <b>{fullName}</b>
                <small>Profissional</small>
              </div>
              ⌄
            </div>
          </div>
        </header>
        {section === "Meu dia" && (
          <>
            <section className="professional-welcome">
              <div>
                <span className="eyebrow">SEXTA-FEIRA, 07 DE AGOSTO</span>
                <h2>Bom dia, {professional}! ♡</h2>
                <p>
                  Você tem {myBookings.length} atendimentos programados para
                  hoje.
                </p>
              </div>
              <button
                className="primary"
                onClick={() => setSection("Minha agenda")}
              >
                Ver agenda completa →
              </button>
            </section>
            <section className="professional-stats">
              <article>
                <span>◷</span>
                <div>
                  <small>PRÓXIMO ATENDIMENTO</small>
                  <b>
                    {myBookings[0]?.time} · {myBookings[0]?.client}
                  </b>
                  <p>{myBookings[0]?.service}</p>
                </div>
              </article>
              <article>
                <span>✓</span>
                <div>
                  <small>ATENDIMENTOS HOJE</small>
                  <b>{myBookings.length}</b>
                  <p>
                    {myBookings.filter((b) => b.status === "Confirmado").length}{" "}
                    confirmados
                  </p>
                </div>
              </article>
              <article>
                <span>✦</span>
                <div>
                  <small>SERVIÇOS ATIVOS</small>
                  <b>{myServices.length}</b>
                  <p>Disponíveis para agendamento</p>
                </div>
              </article>
            </section>
            <section className="panel professional-today">
              <div className="panel-head">
                <div>
                  <h2>Sua agenda de hoje</h2>
                  <p>Somente os seus atendimentos</p>
                </div>
                <span className="access-pill">Visão individual</span>
              </div>
              <AdminTable rows={myBookings} />
            </section>
          </>
        )}
        {section === "Minha agenda" && (
          <div className="screen-card professional-agenda">
            <div className="screen-toolbar">
              <div>
                <h2>Minha semana</h2>
                <p>Seus atendimentos e horários bloqueados.</p>
              </div>
              <div>
                <button>‹</button>
                <button>Hoje</button>
                <button>›</button>
                <button
                  className="primary"
                  onClick={() => setBlocked(!blocked)}
                >
                  ＋ Bloquear horário
                </button>
              </div>
            </div>
            <div className="personal-week">
              {["SEG 03", "TER 04", "QUA 05", "QUI 06", "SEX 07", "SÁB 08"].map(
                (day, d) => (
                  <section key={day}>
                    <b>{day}</b>
                    {["09:00", "10:30", "13:00", "14:30", "16:00"].map(
                      (time, i) => (
                        <div
                          className={(d + i) % 4 === 0 ? "booked" : "free"}
                          key={time}
                        >
                          <span>{time}</span>
                          {(d + i) % 4 === 0 ? (
                            <p>
                              <b>
                                {myServices[(d + i) % myServices.length]?.name}
                              </b>
                              <small>
                                {["Mariana", "Carla", "Beatriz"][i % 3]}
                              </small>
                            </p>
                          ) : (
                            <small>Livre</small>
                          )}
                        </div>
                      ),
                    )}
                    {blocked && d === 4 && (
                      <div className="blocked-slot">
                        <span>17:30</span>
                        <b>Bloqueado por você</b>
                      </div>
                    )}
                  </section>
                ),
              )}
            </div>
          </div>
        )}
        {section === "Meus serviços" && (
          <div>
            <div className="screen-top">
              <div>
                <h2>Serviços que você realiza</h2>
                <p>Definidos pela administradora do SPA.</p>
              </div>
            </div>
            <div className="admin-service-grid professional-services">
              {myServices.map((s, i) => (
                <article key={s.name}>
                  <div className="service-admin-icon">
                    {isEliane ? ["♨", "≈", "✧", "◇"][i] : ["✦", "♢"][i]}
                  </div>
                  <span className="active-pill">Ativo</span>
                  <h3>{s.name}</h3>
                  <p>
                    {s.category} · {s.duration} minutos
                  </p>
                  <div>
                    <b>R$ {s.price},00</b>
                    <span>Na sua agenda</span>
                  </div>
                  <footer>
                    <button>Ver horários</button>
                  </footer>
                </article>
              ))}
            </div>
            <div className="permission-banner">
              <span>i</span>
              <p>
                <b>Precisa alterar um serviço?</b>
                <small>
                  Valores, duração e novos procedimentos são gerenciados pela
                  administradora.
                </small>
              </p>
            </div>
          </div>
        )}
        {section === "Disponibilidade" && (
          <div className="screen-card availability-settings">
            <div className="screen-top">
              <div>
                <h2>Minha disponibilidade</h2>
                <p>Informe os períodos em que você poderá receber clientes.</p>
              </div>
              <button className="primary">Salvar alterações</button>
            </div>
            <div className="availability-list">
              {[
                ["Segunda-feira", "09:00", "18:00"],
                ["Terça-feira", "09:00", "18:00"],
                ["Quarta-feira", "09:00", "18:00"],
                ["Quinta-feira", "09:00", "18:00"],
                ["Sexta-feira", "09:00", "19:00"],
                ["Sábado", "09:00", "15:00"],
              ].map((d, i) => (
                <div key={d[0]}>
                  <label>
                    <input type="checkbox" defaultChecked={i !== 2} />
                    <span>{d[0]}</span>
                  </label>
                  <input defaultValue={d[1]} />
                  <em>até</em>
                  <input defaultValue={d[2]} />
                  <button>＋ Intervalo</button>
                </div>
              ))}
            </div>
            <div className="time-off-card">
              <span>☼</span>
              <div>
                <b>Folgas e ausências</b>
                <small>
                  Bloqueie férias, consultas ou compromissos pessoais.
                </small>
              </div>
              <button>＋ Adicionar período</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ServiceScheduling() {
  const [selected, setSelected] = useState<Service | null>(null);
  const [day, setDay] = useState("12");
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
          <span>▣ Quarta-feira, {day} de agosto</span>
          <span>
            ◷ {time} · {selected.duration} minutos
          </span>
          <span>⌖ SPA Express Cambucás</span>
        </div>
        <small>
          O pagamento de R$ {selected.price},00 será realizado no local.
        </small>
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
                selected.professional === "Natália"
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
              <button>‹</button>
              <b>Agosto 2026</b>
              <button>›</button>
            </div>
            <div className="availability-days">
              {[
                ["SEG", "10"],
                ["TER", "11"],
                ["QUA", "12"],
                ["QUI", "13"],
                ["SEX", "14"],
                ["SÁB", "15"],
              ].map((d) => (
                <button
                  className={day === d[1] ? "active" : ""}
                  onClick={() => {
                    setDay(d[1]);
                    setTime("");
                  }}
                  key={d[1]}
                >
                  <small>{d[0]}</small>
                  <b>{d[1]}</b>
                  <i>{d[1] === "12" ? "4 horários" : "3 horários"}</i>
                </button>
              ))}
            </div>
            <label>Horários disponíveis</label>
            <div className="available-times">
              {(selected.professional === "Eliane"
                ? ["09:00", "10:30", "13:00", "14:30", "16:00", "17:30"]
                : ["09:30", "11:00", "13:30", "15:00", "16:30", "18:00"]
              ).map((t, i) => (
                <button
                  disabled={(Number(day) + i) % 4 === 0}
                  className={time === t ? "active" : ""}
                  onClick={() => setTime(t)}
                  key={t}
                >
                  {t}
                  {(Number(day) + i) % 4 === 0 && <small>ocupado</small>}
                </button>
              ))}
            </div>
            <div className="schedule-summary">
              <div>
                <span>DATA</span>
                <b>{day}/08/2026</b>
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
              disabled={!time}
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
                  s.professional === "Natália"
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

function ClientDashboard({ logout }: { logout: () => void }) {
  const [tab, setTab] = useState("Início");
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
                  ["02 AGO", "Manicure em Gel", "Natália"],
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
              ["25 AGO", "Manicure em Gel", "10:00", "Natália"],
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

export default function Home() {
  const [view, setView] = useState<
    "public" | "login-admin" | "login-client" | "admin" | "staff" | "client"
  >("public");
  const [teamUser, setTeamUser] = useState<"Eliane" | "Natália">("Eliane");
  useEffect(() => {
    const access = new URLSearchParams(window.location.search).get("access");
    if (access === "admin") setView("login-admin");
    else if (access === "client") setView("login-client");
  }, []);
  function navigate(
    next:
      "public" | "login-admin" | "login-client" | "admin" | "staff" | "client",
  ) {
    setView(next);
    const query =
      next === "login-admin" || next === "staff" || next === "admin"
        ? "?access=admin"
        : next === "login-client" || next === "client"
          ? "?access=client"
          : "/";
    window.history.pushState({}, "", query);
  }
  function enterTeam(account: TeamAccount) {
    if (account === "admin") navigate("admin");
    else {
      setTeamUser(account);
      navigate("staff");
    }
  }
  return (
    <>
      {view === "admin" ? (
        <AdminDashboard
          goPublic={() => navigate("public")}
          logout={() => navigate("login-admin")}
        />
      ) : view === "staff" ? (
        <ProfessionalDashboard
          professional={teamUser}
          goPublic={() => navigate("public")}
          logout={() => navigate("login-admin")}
        />
      ) : view === "client" ? (
        <ClientDashboard logout={() => navigate("login-client")} />
      ) : view === "login-admin" ? (
        <LoginScreen
          role="admin"
          close={() => navigate("public")}
          onTeamLogin={enterTeam}
        />
      ) : view === "login-client" ? (
        <LoginScreen
          role="client"
          close={() => navigate("public")}
          onLogin={() => navigate("client")}
        />
      ) : (
        <PublicSite
          goAdmin={() => navigate("login-client")}
          openBooking={() => navigate("login-client")}
        />
      )}
    </>
  );
}
