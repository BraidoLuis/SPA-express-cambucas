"use client";
/* eslint-disable @next/next/no-img-element -- Supabase avatar hosts are runtime-configured. */
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Power,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { ActionDialog } from "../shared/action-dialog";
import { formatBrazilianPhone, normalizeBrazilianPhone } from "../../lib/validations/client-signup";
import {
  getAdminClientDetails,
  getAdminClientProfessionals,
  getAdminClients,
  inviteAdminClient,
  updateAdminClient,
  type AdminClient,
  type AdminClientDetails,
} from "../../lib/services/admin-client-management-service";

const PAGE_SIZE = 10;
const emptyDraft = { name: "", email: "", phone: "", active: true };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value)) : "—";
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value)
  );
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
const statusLabel: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
  paid: "Pago",
  refunded: "Estornado",
};

export function AdminClientsSection({
  onSchedule,
}: {
  onSchedule?: (client: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  }) => void;
}) {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [professionals, setProfessionals] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [professional, setProfessional] = useState("all");
  const [schedule, setSchedule] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<AdminClient | null>(null);
  const [details, setDetails] = useState<
    (AdminClientDetails & { schedule?: typeof onSchedule }) | null
  >(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<AdminClient | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<AdminClient | null>(null);

  const opener = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [people, team] = await Promise.all([
        getAdminClients(),
        getAdminClientProfessionals(),
      ]);
      setClients(people);
      setProfessionals(team);
    } catch {
      setError(
        "Não foi possível carregar os clientes. Verifique sua sessão administrativa."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetails(null);
    setDetailsLoading(true);

    getAdminClientDetails(selected)
      .then((data) =>
        setDetails({
          ...data,
          schedule: (client) => {
            setSelected(null);
            setDetails(null);
            onSchedule?.(client);
          },
        })
      )
      .catch(() => setError("Não foi possível carregar os detalhes da cliente."))
      .finally(() => setDetailsLoading(false));
  }, [onSchedule, selected]);

  useEffect(() => {
    if (!selected && !formMode) return;

    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => dialogRef.current?.focus());

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) close();
    };

    document.addEventListener("keydown", handler);

    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", handler);
    };
  });

  function close() {
    setSelected(null);
    setDetails(null);
    setFormMode(null);
    setEditTarget(null);
    requestAnimationFrame(() => opener.current?.focus());
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const digits = search.replace(/\D/g, "");

    return clients
      .filter(
        (client) =>
          (!term ||
            `${client.name} ${client.email}`.toLocaleLowerCase("pt-BR").includes(term) ||
            (!!digits && (client.phone || "").includes(digits))) &&
          (status === "all" || String(client.active) === status) &&
          (professional === "all" || client.professionalIds.includes(professional)) &&
          (schedule === "all" ||
            (schedule === "with" ? !!client.nextAppointment : !client.nextAppointment))
      )
      .sort((a, b) => {
        if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
        if (sort === "lastVisit")
          return (b.lastVisit || "").localeCompare(a.lastVisit || "");
        if (sort === "appointments") return b.totalAppointments - a.totalAppointments;
        if (sort === "paid") return b.paidTotal - a.paidTotal;
        if (sort === "alphabetical") return a.name.localeCompare(b.name, "pt-BR");
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [clients, professional, schedule, search, sort, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate(event: React.MouseEvent<HTMLButtonElement>) {
    opener.current = event.currentTarget;
    setDraft(emptyDraft);
    setFormMode("create");
    setError("");
  }

  function openEdit(client: AdminClient, element?: HTMLElement) {
    opener.current = element || opener.current;
    setEditTarget(client);
    setSelected(null);
    setDraft({
      name: client.name,
      email: client.email,
      phone: formatBrazilianPhone(client.phone || ""),
      active: client.active,
    });
    setFormMode("edit");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    const name = draft.name.trim().replace(/\s+/g, " ");
    const email = draft.email.trim().toLowerCase();
    const phone = normalizeBrazilianPhone(draft.phone);

    if (
      name.split(" ").length < 2 ||
      (formMode === "create" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) ||
      (draft.phone && phone.length !== 11)
    ) {
      setError("Informe nome e sobrenome, e-mail válido e telefone com 11 dígitos.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (formMode === "create") {
        await inviteAdminClient({ name, email, phone, active: draft.active });
      } else if (editTarget) {
        await updateAdminClient(editTarget.id, {
          name,
          phone,
          active: draft.active,
        });
      }

      close();
      setNotice(formMode === "create" ? "Convite enviado e cliente cadastrada." : "Cliente atualizada com sucesso.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar a cliente."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggle() {
    if (!confirming) return;

    setSaving(true);
    try {
      await updateAdminClient(confirming.id, {
        name: confirming.name,
        active: !confirming.active,
      });
      setNotice(
        confirming.active ? "Conta desativada sem apagar o histórico." : "Conta ativada."
      );
      setConfirming(null);
      await load();
    } catch {
      setError("Não foi possível alterar o status da cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-clients-section">
      <div className="screen-top">
        <div>
          <h2>Clientes</h2>
          <p>Histórico e relacionamento em um só lugar.</p>
        </div>
        <button className="primary button-with-icon" onClick={openCreate}>
          <Plus aria-hidden="true" /> Cadastrar cliente
        </button>
      </div>

      <div className="client-admin-filters">
        <label className="client-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Buscar clientes</span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Nome, e-mail ou telefone"
          />
        </label>

        <select
          aria-label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Todos os status</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>

        <select
          aria-label="Profissional"
          value={professional}
          onChange={(e) => {
            setProfessional(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Todas as profissionais</option>
          {professionals.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Próximo agendamento"
          value={schedule}
          onChange={(e) => {
            setSchedule(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Com ou sem próximo horário</option>
          <option value="with">Com próximo horário</option>
          <option value="without">Sem próximo horário</option>
        </select>

        <select
          aria-label="Ordenação"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          <option value="newest">Cadastro mais recente</option>
          <option value="oldest">Cadastro mais antigo</option>
          <option value="lastVisit">Última visita</option>
          <option value="appointments">Mais atendimentos</option>
          <option value="paid">Maior valor pago</option>
          <option value="alphabetical">Ordem alfabética</option>
        </select>
      </div>

      {notice && (
        <div className="admin-data-message admin-data-message--success">
          <Check aria-hidden="true" /> {notice}
        </div>
      )}

      {error && (
        <div className="admin-data-message admin-data-message--error">{error}</div>
      )}

      {loading ? (
        <div className="admin-data-message">Carregando clientes...</div>
      ) : visible.length === 0 ? (
        <div className="admin-empty-state">
          <UserRound aria-hidden="true" />
          <h3>Nenhuma cliente encontrada</h3>
          <p>Ajuste os filtros ou cadastre uma nova cliente.</p>
        </div>
      ) : (
        <>
          <div className="admin-results-count">
            {filtered.length} {filtered.length === 1 ? "cliente encontrada" : "clientes encontradas"}
          </div>

          <div className="admin-client-list">
            {visible.map((client) => (
              <article key={client.id} className={!client.active ? "inactive" : ""}>
                <div className="client-admin-identity">
                  <span className="client-avatar">
                    {client.avatarUrl ? (
                      <img src={client.avatarUrl} alt="" />
                    ) : (
                      initials(client.name)
                    )}
                  </span>
                  <div>
                    <b>{client.name}</b>
                    <small>Desde {date(client.createdAt)}</small>
                  </div>
                </div>

                <div>
                  <small>Contato</small>
                  <b>{client.email}</b>
                  <span>{client.phone ? formatBrazilianPhone(client.phone) : "Telefone não informado"}</span>
                </div>

                <div>
                  <small>Último atendimento</small>
                  <b>{client.lastService || "Nenhum"}</b>
                  <span>{date(client.lastVisit)}</span>
                </div>

                <div>
                  <small>Atendimentos</small>
                  <b>
                    {client.totalAppointments} total · {client.completedAppointments} concluídos
                  </b>
                  <span>
                    {client.nextAppointment
                      ? `Próximo: ${dateTime(client.nextAppointment)}`
                      : "Sem próximo horário"}
                  </span>
                </div>

                <div>
                  <small>Valor pago</small>
                  <b>{money.format(client.paidTotal)}</b>
                  <span className={client.active ? "active-pill-inline" : "inactive-pill-inline"}>
                    {client.active ? "Ativa" : "Inativa"}
                  </span>
                </div>

                <div className="client-admin-actions">
                  <button
                    aria-label={`Ver detalhes de ${client.name}`}
                    onClick={(e) => {
                      opener.current = e.currentTarget;
                      setSelected(client);
                    }}
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                  <button
                    aria-label={`Editar ${client.name}`}
                    onClick={(e) => openEdit(client, e.currentTarget)}
                  >
                    <Pencil aria-hidden="true" />
                  </button>
                  <button
                    aria-label={`${client.active ? "Desativar" : "Ativar"} ${client.name}`}
                    onClick={() => setConfirming(client)}
                  >
                    <Power aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>

          <nav className="admin-pagination" aria-label="Paginação de clientes">
            <button
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft aria-hidden="true" /> Anterior
            </button>
            <span>
              Página {page} de {pageCount}
            </span>
            <button
              disabled={page === pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            >
              Próxima <ChevronRight aria-hidden="true" />
            </button>
          </nav>
        </>
      )}

      {(selected || formMode) && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) close();
          }}
        >
          <div
            className="client-admin-dialog"
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-admin-dialog-title"
          >
            <button
              className="modal-close icon-button"
              onClick={close}
              aria-label="Fechar"
            >
              <X aria-hidden="true" />
            </button>

            {formMode ? (
              <form onSubmit={submit}>
                <span className="eyebrow">
                  {formMode === "create" ? "NOVA CLIENTE" : "EDITAR CLIENTE"}
                </span>
                <h2 id="client-admin-dialog-title">
                  {formMode === "create" ? "Convidar cliente" : "Dados da cliente"}
                </h2>

                <div className="client-admin-form">
                  <label>
                    Nome completo *
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                  </label>

                  {formMode === "create" && (
                    <label>
                      E-mail *
                      <input
                        type="email"
                        value={draft.email}
                        onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                      />
                    </label>
                  )}

                  <label>
                    Telefone
                    <input
                      inputMode="tel"
                      value={draft.phone}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          phone: formatBrazilianPhone(e.target.value),
                        })
                      }
                    />
                  </label>

                  <label className="client-active-check">
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                    />
                    Conta ativa
                  </label>
                </div>

                {formMode === "edit" && (
                  <p className="form-help">
                    O e-mail e a senha não são alterados por este formulário.
                  </p>
                )}

                {error && <p className="form-error">{error}</p>}

                <footer>
                  <button type="button" onClick={close}>
                    Cancelar
                  </button>
                  <button className="primary" disabled={saving}>
                    {saving ? "Salvando..." : formMode === "create" ? "Enviar convite" : "Salvar alterações"}
                  </button>
                </footer>
              </form>
            ) : (
              <ClientDetails
                details={details}
                loading={detailsLoading}
                onEdit={() => details && openEdit(details)}
              />
            )}
          </div>
        </div>
      )}

      <ActionDialog
        open={!!confirming}
        title={confirming?.active ? "Desativar cliente?" : "Ativar cliente?"}
        description={
          confirming?.active
            ? `${confirming.name} não poderá utilizar normalmente a conta. ${confirming.futureActiveAppointments} agendamento(s) futuro(s), pagamentos e histórico serão preservados.`
            : `${confirming?.name || "A cliente"} poderá voltar a utilizar normalmente a conta.`
        }
        confirmLabel={confirming?.active ? "Desativar" : "Ativar"}
        danger={confirming?.active}
        loading={saving}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void toggle()}
      />
    </div>
  );
}

function ClientDetails({
  details,
  loading,
  onEdit,
}: {
  details:
    | (AdminClientDetails & {
        schedule?: (client: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
        }) => void;
      })
    | null;
  loading: boolean;
  onEdit: () => void;
}) {
  if (loading || !details) {
    return <div className="admin-data-message">Carregando histórico da cliente...</div>;
  }

  const upcoming = details.appointments.filter(
    (item) =>
      new Date(item.startAt) > new Date() && ["pending", "confirmed"].includes(item.status)
  );

  const history = details.appointments.filter(
    (item) =>
      new Date(item.startAt) <= new Date() || !["pending", "confirmed"].includes(item.status)
  );

  return (
    <div>
      <span className="eyebrow">CLIENTE</span>
      <h2 id="client-admin-dialog-title">{details.name}</h2>
      <p>
        {details.email} · {details.phone ? formatBrazilianPhone(details.phone) : "Sem telefone"}
      </p>

      <div className="client-detail-actions">
        <button className="button button--outline button-with-icon" onClick={onEdit}>
          <Pencil aria-hidden="true" /> Editar
        </button>
        <button
          className="button button--outline button-with-icon"
          onClick={() => {
            details.schedule?.({
              id: details.id,
              name: details.name,
              email: details.email,
              phone: details.phone,
            });
          }}
        >
          <CalendarPlus aria-hidden="true" /> Agendar serviço
        </button>
      </div>

      <div className="client-detail-summary">
        <span>
          <b>{details.completedAppointments}</b> concluídos
        </span>
        <span>
          <b>{details.noShows}</b> não comparecimentos
        </span>
        <span>
          <b>{money.format(details.paidTotal)}</b> efetivamente pago
        </span>
      </div>

      {details.clientNotes && (
        <section className="client-detail-notes">
          <h3>Observações</h3>
          <p>{details.clientNotes}</p>
        </section>
      )}

      <section>
        <h3>Próximos agendamentos</h3>
        {upcoming.length ? (
          <AppointmentList items={upcoming} />
        ) : (
          <p className="client-detail-empty">Nenhum próximo agendamento.</p>
        )}
      </section>

      <section>
        <h3>Histórico</h3>
        {history.length ? (
          <AppointmentList items={history} />
        ) : (
          <p className="client-detail-empty">Nenhum atendimento no histórico.</p>
        )}
      </section>

      <section className="client-detail-preferences">
        <h3>Preferências de notificação</h3>
        <p>
          {details.preferences
            ? `Aplicativo: ${details.preferences.inApp ? "sim" : "não"} · E-mail: ${
                details.preferences.email ? "sim" : "não"
              } · WhatsApp: ${details.preferences.whatsapp ? "sim" : "não"}`
            : "Não disponíveis."}
        </p>
      </section>
    </div>
  );
}

function AppointmentList({
  items,
}: {
  items: AdminClientDetails["appointments"];
}) {
  return (
    <div className="client-appointment-list">
      {items.map((item) => (
        <article key={item.id}>
          <div>
            <b>{item.serviceName}</b>
            <span>{item.professionalName}</span>
          </div>
          <div>
            <b>{dateTime(item.startAt)}</b>
            <span>
              {Math.round(
                (new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 60000
              )}{" "}
              minutos
            </span>
          </div>
          <div>
            <b>{statusLabel[item.status] || item.status}</b>
            <span>
              Pagamento: {statusLabel[item.paymentStatus] || item.paymentStatus}
              {item.paymentMethod ? ` · ${item.paymentMethod}` : ""}
            </span>
          </div>
          <div>
            <b>{money.format(item.paidAmount)}</b>
            <span>{item.cancellationReason || item.notes || "Sem observações"}</span>
          </div>
        </article>
      ))}
    </div>
  );
}