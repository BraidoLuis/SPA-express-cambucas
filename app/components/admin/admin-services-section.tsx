"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  getAdminServiceManagementData,
  saveAdminService,
  setAdminServiceActive,
  type AdminManagedService,
  type AdminServiceProfessional,
} from "../../lib/services/admin-service-management-service";
import { ActionDialog } from "../shared/action-dialog";
import { ServiceCoverImage } from "../shared/service-cover-image";
import { ServiceCoverEditor } from "../shared/service-cover-editor";
import { applyServiceCoverChange, type CoverImageChange } from "../../lib/services/service-cover-image-service";
import { Pencil, Plus, X } from "lucide-react";

type LinkDraft = {
  selected: boolean;
  customValues: boolean;
  customDuration: string;
  customPrice: string;
};

type FormDraft = {
  name: string;
  category: string;
  description: string;
  duration: string;
  price: string;
  active: boolean;
  links: Record<string, LinkDraft>;
};

const emptyDraft: FormDraft = {
  name: "",
  category: "",
  description: "",
  duration: "60",
  price: "0",
  active: true,
  links: {},
};

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AdminServicesSection() {
  const [services, setServices] = useState<AdminManagedService[]>([]);
  const [professionals, setProfessionals] = useState<AdminServiceProfessional[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [professional, setProfessional] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminManagedService | null>(null);
  const [draft, setDraft] = useState<FormDraft>(emptyDraft);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState<AdminManagedService | null>(null);
  const [coverChange, setCoverChange] = useState<CoverImageChange>({ kind: "keep" });

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await getAdminServiceManagementData();
      setServices(data.services);
      setProfessionals(data.professionals);
    } catch (error) {
      setLoadError(messageFrom(error, "Não foi possível carregar os serviços."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Carregamento remoto inicial da seção.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const categories = useMemo(
    () => [...new Set(services.map((service) => service.category))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [services],
  );

  const filteredServices = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return services.filter((service) => {
      const matchesName = !normalizedSearch || service.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
      const matchesCategory = category === "Todos" || service.category === category;
      const matchesProfessional = professional === "Todos" || service.links.some(
        (link) => link.active && link.professionalId === professional,
      );
      const matchesStatus = status === "Todos" || (status === "Ativos" ? service.active : !service.active);
      return matchesName && matchesCategory && matchesProfessional && matchesStatus;
    });
  }, [services, search, category, professional, status]);

  function openCreate() {
    setEditing(null);
    setDraft({ ...emptyDraft, links: {} });
    setFormError("");
    setFeedback("");
    setCoverChange({ kind: "keep" });
    setFormOpen(true);
  }

  function openEdit(service: AdminManagedService) {
    const links: Record<string, LinkDraft> = {};
    for (const professionalItem of professionals) {
      const link = service.links.find((item) => item.professionalId === professionalItem.id);
      links[professionalItem.id] = {
        selected: link?.active ?? false,
        customValues: link?.customDuration !== null || link?.customPrice !== null,
        customDuration: link?.customDuration?.toString() ?? service.duration.toString(),
        customPrice: link?.customPrice?.toString() ?? service.price.toString(),
      };
    }
    setEditing(service);
    setDraft({
      name: service.name,
      category: service.category,
      description: service.description || "",
      duration: service.duration.toString(),
      price: service.price.toString(),
      active: service.active,
      links,
    });
    setFormError("");
    setFeedback("");
    setCoverChange({ kind: "keep" });
    setFormOpen(true);
  }

  function updateLink(professionalId: string, changes: Partial<LinkDraft>) {
    setDraft((current) => ({
      ...current,
      links: {
        ...current.links,
        [professionalId]: {
          ...(current.links[professionalId] ?? {
            selected: false,
            customValues: false,
            customDuration: current.duration,
            customPrice: current.price,
          }),
          ...changes,
        },
      },
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError("");

    const duration = Number(draft.duration);
    const price = Number(draft.price.replace(",", "."));
    const selected = professionals.filter((item) => draft.links[item.id]?.selected);

    if (!draft.name.trim()) return setFormError("Informe o nome do serviço.");
    if (!draft.category.trim()) return setFormError("Informe a categoria do serviço.");
    if (!Number.isInteger(duration) || duration <= 0) return setFormError("A duração deve ser um número inteiro positivo.");
    if (!Number.isFinite(price) || price < 0) return setFormError("O valor deve ser igual ou maior que zero.");
    if (selected.length === 0) return setFormError("Vincule pelo menos uma profissional.");

    const links = [];
    for (const item of selected) {
      const link = draft.links[item.id];
      let customDuration: number | null = null;
      let customPrice: number | null = null;
      if (link.customValues) {
        customDuration = Number(link.customDuration);
        customPrice = Number(link.customPrice.replace(",", "."));
        if (!Number.isInteger(customDuration) || customDuration <= 0) {
          return setFormError(`Informe uma duração personalizada válida para ${item.name}.`);
        }
        if (!Number.isFinite(customPrice) || customPrice < 0) {
          return setFormError(`Informe um preço personalizado válido para ${item.name}.`);
        }
      }
      links.push({ professionalId: item.id, customDuration, customPrice });
    }

    setSaving(true);
    try {
      const serviceId = await saveAdminService({
        id: editing?.id,
        name: draft.name,
        category: draft.category,
        description: draft.description,
        duration,
        price,
        active: draft.active,
        links,
      });
      await applyServiceCoverChange(
        serviceId,
        editing?.imageUrl ?? null,
        coverChange,
      );
      setFormOpen(false);
      setFeedback(editing ? "Serviço atualizado com sucesso." : "Serviço criado com sucesso.");
      await loadData();
    } catch (error) {
      setFormError(messageFrom(error, "Não foi possível salvar o serviço."));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus() {
    if (!statusTarget || saving) return;
    setSaving(true);
    setFeedback("");
    try {
      await setAdminServiceActive(statusTarget.id, !statusTarget.active);
      setFeedback(statusTarget.active ? "Serviço desativado com sucesso." : "Serviço ativado com sucesso.");
      setStatusTarget(null);
      await loadData();
    } catch (error) {
      setLoadError(messageFrom(error, "Não foi possível alterar o status do serviço."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-services-section">
      <div className="screen-top">
        <div>
          <h2>Serviços cadastrados</h2>
          <p>Gerencie procedimentos, duração, valores e profissionais vinculadas.</p>
        </div>
        <button className="primary button-with-icon" type="button" onClick={openCreate}><Plus aria-hidden="true" /> Adicionar serviço</button>
      </div>

      <div className="admin-service-filters">
        <label className="admin-service-search">
          <span>Buscar por nome</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digite o nome do serviço" />
        </label>
        <label><span>Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>Todos</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Profissional</span><select value={professional} onChange={(event) => setProfessional(event.target.value)}><option value="Todos">Todas</option>{professionals.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option><option>Ativos</option><option>Inativos</option></select></label>
      </div>

      {feedback && <div className="admin-data-message admin-data-message--success">{feedback}</div>}
      {loadError && <div className="admin-data-message admin-data-message--error">{loadError} <button type="button" onClick={() => void loadData()}>Tentar novamente</button></div>}

      {loading ? (
        <div className="admin-data-message">Carregando serviços...</div>
      ) : filteredServices.length === 0 ? (
        <div className="admin-service-empty"><b>Nenhum serviço encontrado</b><p>Ajuste os filtros ou cadastre um novo serviço.</p></div>
      ) : (
        <>
          <p className="admin-results-count">{filteredServices.length} {filteredServices.length === 1 ? "serviço encontrado" : "serviços encontrados"}</p>
          <div className="admin-service-grid admin-managed-services">
            {filteredServices.map((service) => {
              const activeLinks = service.links.filter((link) => link.active);
              return (
                <article key={service.id} className={!service.active ? "is-inactive" : ""}>
                  <div className="admin-service-cover"><ServiceCoverImage src={service.imageUrl} alt={service.name} /></div>
                  <div className="admin-service-card-heading"><span className="service-admin-icon" aria-hidden="true">✦</span><span className={`active-pill ${service.active ? "" : "inactive"}`}>{service.active ? "Ativo" : "Inativo"}</span></div>
                  <h3>{service.name}</h3>
                  <p className="admin-service-category">{service.category} · {service.duration} minutos</p>
                  <p className="admin-service-description">{service.description || "Sem descrição cadastrada."}</p>
                  <div className="admin-service-price"><b>{currency(service.price)}</b><span>valor base</span></div>
                  <div className="admin-service-professionals">
                    <b>Profissionais vinculadas</b>
                    {activeLinks.length ? activeLinks.map((link) => (
                      <span key={link.professionalId}>{link.professionalName}{(link.customDuration !== null || link.customPrice !== null) && <small>{link.customDuration ?? service.duration} min · {currency(link.customPrice ?? service.price)}</small>}</span>
                    )) : <span>Nenhum vínculo ativo</span>}
                  </div>
                  <footer><button className="button-with-icon" type="button" onClick={() => openEdit(service)}><Pencil aria-hidden="true" /> Editar</button><button type="button" className={service.active ? "danger-text" : ""} onClick={() => setStatusTarget(service)}>{service.active ? "Desativar" : "Ativar"}</button></footer>
                </article>
              );
            })}
          </div>
        </>
      )}

      {formOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
          <form className="simple-modal admin-service-modal" onSubmit={submit}>
            <button className="modal-close icon-button" type="button" disabled={saving} onClick={() => setFormOpen(false)} aria-label="Fechar" title="Fechar"><X aria-hidden="true" /></button>
            <span className="eyebrow">{editing ? "EDITAR SERVIÇO" : "NOVO SERVIÇO"}</span>
            <h2>{editing ? editing.name : "Adicionar serviço"}</h2>
            <div className="admin-service-form-grid">
              <label><span>Nome *</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} disabled={saving} /></label>
              <label><span>Categoria *</span><input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} list="admin-service-categories" disabled={saving} /><datalist id="admin-service-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist></label>
              <label className="wide"><span>Descrição</span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} disabled={saving} /></label>
              <label><span>Duração base (minutos) *</span><input type="number" min="1" step="1" value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: event.target.value })} disabled={saving} /></label>
              <label><span>Preço base (R$) *</span><input type="number" min="0" step="0.01" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} disabled={saving} /></label>
            </div>
            <ServiceCoverEditor key={editing?.id || "new-service"} currentUrl={editing?.imageUrl} serviceName={draft.name || "serviço"} disabled={saving} onChange={setCoverChange} onError={setFormError} />
            <fieldset className="admin-service-links"><legend>Profissionais vinculadas *</legend>{professionals.map((item) => { const link = draft.links[item.id] || { selected: false, customValues: false, customDuration: draft.duration, customPrice: draft.price }; return <div className="admin-service-link" key={item.id}><label className="admin-service-check"><input type="checkbox" checked={link.selected} onChange={(event) => updateLink(item.id, { selected: event.target.checked })} disabled={saving || !item.active} /><span>{item.name}{!item.active ? " (inativa)" : ""}</span></label>{link.selected && <><label className="admin-service-check custom"><input type="checkbox" checked={link.customValues} onChange={(event) => updateLink(item.id, { customValues: event.target.checked })} disabled={saving} /><span>Usar preço ou duração personalizados</span></label>{link.customValues && <div className="admin-service-custom-values"><label><span>Duração</span><input type="number" min="1" step="1" value={link.customDuration} onChange={(event) => updateLink(item.id, { customDuration: event.target.value })} disabled={saving} /></label><label><span>Preço</span><input type="number" min="0" step="0.01" value={link.customPrice} onChange={(event) => updateLink(item.id, { customPrice: event.target.value })} disabled={saving} /></label></div>}</>}</div>; })}</fieldset>
            {professionals.length === 0 && <p className="form-error">Nenhuma profissional foi encontrada no Supabase.</p>}
            {formError && <p className="form-error">{formError}</p>}
            <div className="admin-service-form-actions"><button type="button" disabled={saving} onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary" type="submit" disabled={saving || professionals.length === 0}>{saving ? "Salvando..." : "Salvar serviço"}</button></div>
          </form>
        </div>
      )}

      <ActionDialog open={Boolean(statusTarget)} title={statusTarget?.active ? "Desativar serviço?" : "Ativar serviço?"} description={statusTarget?.active ? "O serviço deixará de aparecer no catálogo e de oferecer novos horários, mas o histórico será preservado." : "O serviço voltará a ficar disponível nos vínculos profissionais ativos."} confirmLabel={statusTarget?.active ? "Desativar" : "Ativar"} danger={Boolean(statusTarget?.active)} loading={saving} onCancel={() => setStatusTarget(null)} onConfirm={() => void changeStatus()} />
    </div>
  );
}
