"use client";
import { useEffect, useState } from "react";
import { bookings, services, type Booking, type ServiceMedia } from "../../lib/spa-data";
import { Icon, Logo, NotificationBell, ThemeToggle } from "../shared/spa-ui";
import type { AuthProfile } from "../../lib/services/auth-service";
import {
  confirmAdminPayment,
  getAdminAppointments,
  getAdminOverview,
  type AdminAppointment,
  type AdminOverview,
  type AdminPaymentMethod,
} from "../../lib/services/admin-dashboard-service";

function AdminContent({
  section,
  filter,
  setFilter,
  setAddOpen,
  mediaItems,
  setMediaItems,
  overview,
  overviewLoading,
  overviewError,
  reloadOverview,
  adminAppointments,
  adminAppointmentsLoading,
  adminAppointmentsError,
  }: {
  section: string;
  filter: string;
  setFilter: (v: string) => void;
  setAddOpen: (v: boolean) => void;
  mediaItems: ServiceMedia[];
  setMediaItems: React.Dispatch<React.SetStateAction<ServiceMedia[]>>;
  overview: AdminOverview | null;
  overviewLoading: boolean;
  overviewError: string;
  reloadOverview: () => Promise<void>;
  adminAppointments: AdminAppointment[];
  adminAppointmentsLoading: boolean;
  adminAppointmentsError: string;
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
            <h3>Eliane Cristina Braido</h3>
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
            <h3>Dayanne Braido</h3>
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
              className="modal-close"
              onClick={closePayment}
              disabled={paymentSaving}
              aria-label="Fechar"
            >
              ×
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
  profile,
}: {
  goPublic: () => void;
  logout: () => void;
  mediaItems: ServiceMedia[];
  setMediaItems: React.Dispatch<React.SetStateAction<ServiceMedia[]>>;
  profile: AuthProfile | null;
}) {
  const [section, setSection] = useState("Visão geral");
  const [filter, setFilter] = useState("Todos");
  const [addOpen, setAddOpen] = useState(false);
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

  useEffect(() => {
    void reloadAdminData();

    // Os dados devem ser carregados somente na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <span>{adminInitials}</span>
              <div>
                <b>{adminName}</b>
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
          overview={overview}
          overviewLoading={overviewLoading}
          overviewError={overviewError}
          reloadOverview={reloadAdminData}
          adminAppointments={adminAppointments}
          adminAppointmentsLoading={adminAppointmentsLoading}
          adminAppointmentsError={adminAppointmentsError}
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