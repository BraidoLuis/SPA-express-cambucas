"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { services as fallbackServices, type Service } from "../../lib/spa-data";
import { getClientCatalog } from "../../lib/services/catalog-service";
import { Icon, Logo, ThemeToggle } from "../shared/spa-ui";
import { ServiceCoverImage } from "../shared/service-cover-image";
import { ArrowRight, ChevronLeft, ChevronRight, MapPin, Menu } from "lucide-react";
import { ShowcaseCarousel } from "../shared/showcase-carousel";
import { ProfessionalFilter } from "../shared/professional-filter";
export function PublicSite({
  openBooking,
  goAdmin,
}: {
  openBooking: (service?: string) => void;
  goAdmin: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [homeFilter, setHomeFilter] = useState("Todos");
  const [homeProfessional, setHomeProfessional] = useState("all");
  const [aboutSlide, setAboutSlide] = useState(0);
  const homeCarousel = useRef<HTMLDivElement>(null);
  const [catalog, setCatalog] = useState<Service[]>(fallbackServices);
  useEffect(() => {
    let active = true;
    getClientCatalog().then((items) => { if (active && items.length) setCatalog(items); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>(".public-site main > section, .public-site > .location-section");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sections.forEach((section) => section.classList.add("is-visible"));
      return;
    }
    sections.forEach((section) => section.classList.add("motion-reveal"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -5%" });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  const serviceFilters = useMemo(() => ["Todos", ...new Set(catalog.map((item) => item.category))], [catalog]);
  const professionalOptions = useMemo(() => Array.from(new Map(catalog.filter((item) => item.professionalId).map((item) => [item.professionalId!, { id: item.professionalId!, name: item.professionalFullName || item.professional }])).values()).sort((a, b) => a.name.localeCompare(b.name)), [catalog]);
  const visibleServices = catalog.filter((item) => (homeFilter === "Todos" || item.category === homeFilter) && (homeProfessional === "all" || item.professionalId === homeProfessional));
  function resetHomeCarousel() { homeCarousel.current?.scrollTo({ left: 0, behavior: "smooth" }); }
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
          <Menu aria-hidden="true" />
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
              alt="Eliane e Dayanne, profissionais do Spa Express Cambucás"
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

        <section className="about about-carousel" id="sobre">
          {[
            {
              image: "/professionals-portrait.png",
              eyebrow: "SOBRE NÓS",
              title: <>Beleza que acolhe.<br /><em>Cuidado que transforma.</em></>,
              text: "O Spa Express Cambucás nasceu para ser um espaço onde cada mulher possa desacelerar, cuidar de si e se sentir verdadeiramente especial.",
              detail: "Unimos técnicas, experiência e um atendimento próximo para oferecer resultados que vão além da estética.",
              name: "Spa Express",
              role: "com carinho, nossa equipe",
            },
            {
              image: "/eliane-care.png",
              eyebrow: "CONHEÇA A ELIANE",
              title: <>Cuidado profundo.<br /><em>Leveza para o corpo.</em></>,
              text: "Eliane é massagista e esteticista, especialista em transformar cada atendimento em uma pausa real na rotina.",
              detail: "Seu olhar cuidadoso combina bem-estar, técnica e protocolos personalizados para cada cliente.",
              name: "Eliane Cristina Braido",
              role: "massagista & esteticista",
            },
            {
              image: "/nails-detail.png",
              eyebrow: "CONHEÇA A DAYANNE",
              title: <>Beleza nos detalhes.<br /><em>Unhas com personalidade.</em></>,
              text: "Dayanne é manicure e nail designer, apaixonada por acabamento impecável e por valorizar o estilo de cada cliente.",
              detail: "Do cuidado clássico às técnicas em gel, cada etapa é feita com precisão, criatividade e carinho.",
              name: "Dayanne Braido",
              role: "manicure & nail designer",
            },
          ].map((slide, index) => (
            <div className={`about-slide ${aboutSlide === index ? "active" : ""}`} key={slide.eyebrow} aria-hidden={aboutSlide !== index}>
              <div className="about-visual">
                <div className="frame"><img src={slide.image} alt={slide.name} /></div>
                {index === 0 && <div className="experience"><b>8+</b><span>anos cuidando<br />de você</span></div>}
              </div>
              <div className="about-copy">
                <span className="eyebrow">{slide.eyebrow}</span>
                <h2>{slide.title}</h2>
                <p>{slide.text}</p><p>{slide.detail}</p>
                <div className="signature">{slide.name}<small>{slide.role}</small></div>
              </div>
            </div>
          ))}
          <div className="about-controls" aria-label="Navegação sobre a equipe">
            <button className="icon-button" onClick={() => setAboutSlide((aboutSlide + 2) % 3)} aria-label="Anterior" title="Anterior"><ChevronLeft aria-hidden="true" /></button>
            <div>{[0,1,2].map((i) => <button key={i} className={aboutSlide === i ? "active" : ""} onClick={() => setAboutSlide(i)} aria-label={`Ir para item ${i + 1}`} />)}</div>
            <button className="icon-button" onClick={() => setAboutSlide((aboutSlide + 1) % 3)} aria-label="Próximo" title="Próximo"><ChevronRight aria-hidden="true" /></button>
          </div>
        </section>

        <section className="services-section" id="servicos">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SERVIÇOS CADASTRADOS NO SISTEMA</span>
              <h2>
                Escolha seu momento
                <br />
                de <em>autocuidado</em>
              </h2>
            </div>
          </div>
          <div className="services-tools">
            <div className="service-filter-group"><div className="service-filter-buttons">
              {serviceFilters.map((f) => (
                <button
                  className={homeFilter === f ? "active" : ""}
                  onClick={() => {
                    setHomeFilter(f);
                    resetHomeCarousel();
                  }}
                  key={f}
                >
                  {f}
                </button>
              ))}
            </div><ProfessionalFilter options={professionalOptions} value={homeProfessional} onChange={(value) => { setHomeProfessional(value); resetHomeCarousel(); }} /></div>
            <div className="carousel-arrows">
              <button
                onClick={() => slideHome(-1)}
                aria-label="Serviços anteriores"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                onClick={() => slideHome(1)}
                aria-label="Próximos serviços"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>
          {visibleServices.length === 0 && <div className="catalog-feedback empty"><p>Nenhum serviço encontrado para esta combinação.</p><button type="button" onClick={() => { setHomeFilter("Todos"); setHomeProfessional("all"); resetHomeCarousel(); }}>Limpar filtros</button></div>}
          <div className="service-grid mobile-carousel" ref={homeCarousel}>
            {visibleServices.map((s, index) => (
              <article className="service-card motion-card" style={{ "--stagger-index": index } as React.CSSProperties} key={`${s.id || s.name}-${s.professionalId || "fallback"}`}>
                <div className="service-image">
                  <ServiceCoverImage src={s.image} alt={s.name} />
                  <span>{s.category}</span>
                </div>
                <div className="service-body">
                  <h3>{s.name}</h3>
                  <p>
                    {s.description || "Um protocolo completo para cuidar de você com conforto e resultados."}
                  </p>
                  <div>
                    <span>◷ {s.duration} min</span>
                    <b>R$ {s.price}</b>
                  </div>
                  <button onClick={() => openBooking(s.name)}>
                    Agendar este serviço <ArrowRight aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <ShowcaseCarousel />

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
            <MapPin aria-hidden="true" />
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
