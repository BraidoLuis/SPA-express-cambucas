"use client";
import { useState } from "react";
import { bookings, services, type Booking, type ServiceMedia } from "../../lib/spa-data";
import { Icon, Logo, NotificationBell, ThemeToggle } from "../shared/spa-ui";
function AdminContent({
  section,
  filter,
  setFilter,
  setAddOpen,
  mediaItems,
  setMediaItems,
}: {
  section: string;
  filter: string;
  setFilter: (v: string) => void;
  setAddOpen: (v: boolean) => void;
  mediaItems: ServiceMedia[];
  setMediaItems: React.Dispatch<React.SetStateAction<ServiceMedia[]>>;
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
                {["Todos", "Eliane", "Dayanne"].map((f) => (
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
  if (section === "Conteúdo")
    return (
      <div className="content-manager">
        <ScreenTop
          title="Vitrine de serviços"
          text="Publique imagens ou vídeos para inspirar as clientes. Cada mídia expira automaticamente após 14 dias."
        />
        <section className="content-upload-card">
          <div>
            <span>✦</span>
            <h3>Adicionar à vitrine</h3>
            <p>Imagens JPG, PNG ou WEBP e vídeos MP4 de até 20 MB.</p>
          </div>
          <label className="upload-button">
            ＋ Escolher imagem ou vídeo
            <input
              type="file"
              accept="image/*,video/mp4"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const now = new Date();
                  setMediaItems((current) => [{
                    id: `media-${Date.now()}`,
                    title: file.name.replace(/\.[^.]+$/, ""),
                    service: "Novo serviço",
                    professional: "Eliane",
                    type: file.type.startsWith("video") ? "video" : "image",
                    url: String(reader.result),
                    createdAt: now.toISOString(),
                    expiresAt: new Date(now.getTime() + 14 * 86400000).toISOString(),
                  }, ...current]);
                };
                reader.readAsDataURL(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </section>
        <div className="admin-media-grid">
          {mediaItems.map((item) => (
            <article key={item.id}>
              <div className="admin-media-preview">
                {item.type === "video" ? <video src={item.url} controls /> : <img src={item.url} alt={item.title} />}
                <span>{item.type === "video" ? "Vídeo" : "Imagem"}</span>
              </div>
              <div className="admin-media-info">
                <h3>{item.title}</h3>
                <p>{item.service} · {item.professional}</p>
                <small>Expira em 14 dias · limpeza automática programada</small>
                <button onClick={() => setMediaItems((items) => items.filter((x) => x.id !== item.id))}>Excluir agora</button>
              </div>
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
            <div className="big-avatar dayanne">DC</div>
            <span className="online">● Disponível hoje</span>
            <h3>Dayanne Costa</h3>
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
              <span>Receita recebida</span>
              <Icon>R$</Icon>
            </div>
            <b>R$ 12.460</b>
            <p className="positive">
              ↗ 11,4% <small>pagamentos confirmados no mês</small>
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
        ["D", "Dayanne Costa", "Manicure", "3 atendimentos"],
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

export function AdminDashboard({
  goPublic,
  logout,
  mediaItems,
  setMediaItems,
}: {
  goPublic: () => void;
  logout: () => void;
  mediaItems: ServiceMedia[];
  setMediaItems: React.Dispatch<React.SetStateAction<ServiceMedia[]>>;
}) {
  const [section, setSection] = useState("Visão geral");
  const [filter, setFilter] = useState("Todos");
  const [addOpen, setAddOpen] = useState(false);
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
              <span>{["⌂", "▦", "◷", "✦", "▣", "♙", "♧", "↗", "⚙"][i]}</span>
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
            <NotificationBell audience="admin" />
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
          mediaItems={mediaItems}
          setMediaItems={setMediaItems}
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
                  <option>Dayanne</option>
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


