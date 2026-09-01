"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ImagePlus, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { ActionDialog } from "../shared/action-dialog";
import {
  createShowcaseMedia,
  deleteShowcaseMedia,
  getShowcaseAdminData,
  setShowcaseActive,
  showcaseAlt,
  updateShowcaseMedia,
  validateShowcaseFile,
  type ShowcaseMedia,
  type ShowcaseOption,
} from "../../lib/services/showcase-media-service";

const empty = {
  title: "",
  caption: "",
  serviceId: "",
  professionalId: "",
  active: true,
};

export function AdminShowcaseSection() {
  const [items, setItems] = useState<ShowcaseMedia[]>([]);
  const [services, setServices] = useState<ShowcaseOption[]>([]);
  const [professionals, setProfessionals] = useState<ShowcaseOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShowcaseMedia | null>(null);
  const [draft, setDraft] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [deleting, setDeleting] = useState<ShowcaseMedia | null>(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await getShowcaseAdminData();
      setItems(data.media);
      setServices(data.services);
      setProfessionals(data.professionals);
    } catch {
      setError("Não foi possível carregar a vitrine.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  useEffect(() => {
    return () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function close() {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview("");
    setFile(null);
    setOpen(false);
    setEditing(null);
    setDraft(empty);
  }

  function create() {
    setEditing(null);
    setDraft(empty);
    setFile(null);
    setPreview("");
    setError("");
    setOpen(true);
  }

  function edit(item: ShowcaseMedia) {
    setEditing(item);
    setDraft({
      title: item.title,
      caption: item.caption || "",
      serviceId: item.serviceId || "",
      professionalId: item.professionalId || "",
      active: item.active,
    });
    setFile(null);
    setPreview("");
    setError("");
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (saving) return;
    if (!draft.title.trim()) return setError("Informe o título.");
    if (!editing && !file) return setError("Selecione uma imagem ou vídeo.");

    setSaving(true);
    setError("");

    try {
      const input = {
        ...draft,
        serviceId: draft.serviceId || null,
        professionalId: draft.professionalId || null,
      };

      if (editing) {
        await updateShowcaseMedia(editing, input, file);
      } else {
        await createShowcaseMedia(input, file!);
      }

      close();
      setSuccess(editing ? "Conteúdo atualizado." : "Conteúdo publicado.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;

    setSaving(true);

    try {
      await deleteShowcaseMedia(deleting);
      setDeleting(null);
      setSuccess("Conteúdo excluído.");
      await load();
    } catch {
      setError("Não foi possível excluir.");
    } finally {
      setSaving(false);
    }
  }

  const [renderedAt] = useState(() => Date.now());

  const days = (iso: string) =>
    Math.ceil((new Date(iso).getTime() - renderedAt) / 86400000);

  return (
    <div className="content-manager">
      <div className="screen-top">
        <div>
          <h2>Vitrine de serviços</h2>
          <p>
            Publique imagens e vídeos que expiram automaticamente após 14 dias.
          </p>
        </div>
        <button className="primary button-with-icon" onClick={create}>
          <Plus aria-hidden="true" />
          Adicionar conteúdo
        </button>
      </div>

      {success && (
        <div className="admin-data-message admin-data-message--success">
          {success}
        </div>
      )}

      {error && (
        <div className="admin-data-message admin-data-message--error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="admin-data-message">Carregando vitrine...</div>
      ) : items.length === 0 ? (
        <div className="admin-service-empty">
          <b>Nenhum conteúdo publicado</b>
          <p>Adicione a primeira imagem ou vídeo.</p>
        </div>
      ) : (
        <div className="admin-media-grid">
          {items.map((item) => {
            const left = days(item.expiresAt);
            const expired = left <= 0;

            return (
              <article key={item.id} className={expired ? "is-expired" : ""}>
                <div className="admin-media-preview">
                  {item.type === "video" ? (
                    <video src={item.url || ""} controls preload="metadata" />
                  ) : (
                    <img src={item.url || ""} alt={showcaseAlt(item)} />
                  )}
                  <span>{item.type === "video" ? "Vídeo" : "Imagem"}</span>
                </div>

                <div className="admin-media-info">
                  <div className="showcase-status-row">
                    <span className={`active-pill ${!item.active ? "inactive" : ""}`}>
                      {expired ? "Expirado" : item.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <h3>{item.title}</h3>
                  <p>{item.caption || "Sem legenda."}</p>

                  <small>
                    {item.serviceName || "Sem serviço"} ·{" "}
                    {item.professionalName || "Sem profissional"}
                  </small>

                  <small>
                    Criado em {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                  </small>

                  <small>
                    Expira em {new Date(item.expiresAt).toLocaleDateString("pt-BR")} ·{" "}
                    {expired ? "prazo encerrado" : `${left} dia(s) restante(s)`}
                  </small>

                  <footer>
                    <button className="button button--ghost" onClick={() => edit(item)}>
                      <Pencil aria-hidden="true" />
                      Editar
                    </button>

                    <button
                      className="button button--ghost"
                      onClick={async () => {
                        await setShowcaseActive(item.id, !item.active);
                        await load();
                      }}
                    >
                      <Power aria-hidden="true" />
                      {item.active ? "Desativar" : "Ativar"}
                    </button>

                    <button
                      className="button button--danger-ghost"
                      onClick={() => setDeleting(item)}
                    >
                      <Trash2 aria-hidden="true" />
                      Excluir
                    </button>
                  </footer>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {open && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) close();
          }}
        >
          <form className="simple-modal showcase-modal" onSubmit={submit}>
            <button
              className="modal-close icon-button"
              type="button"
              aria-label="Fechar"
              title="Fechar"
              onClick={close}
              disabled={saving}
            >
              <X aria-hidden="true" />
            </button>

            <span className="eyebrow">
              {editing ? "EDITAR CONTEÚDO" : "NOVO CONTEÚDO"}
            </span>
            <h2>{editing ? editing.title : "Adicionar à vitrine"}</h2>

            <div className="showcase-form-grid">
              <label>
                <span>Título *</span>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  disabled={saving}
                />
              </label>

              <label className="wide">
                <span>Legenda</span>
                <textarea
                  value={draft.caption}
                  onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
                  disabled={saving}
                />
              </label>

              <label>
                <span>Serviço relacionado</span>
                <select
                  value={draft.serviceId}
                  onChange={(e) => setDraft({ ...draft, serviceId: e.target.value })}
                >
                  <option value="">Nenhum</option>
                  {services.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Profissional relacionada</span>
                <select
                  value={draft.professionalId}
                  onChange={(e) =>
                    setDraft({ ...draft, professionalId: e.target.value })
                  }
                >
                  <option value="">Nenhuma</option>
                  {professionals.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="showcase-active">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                Conteúdo ativo
              </label>
            </div>

            <div className="showcase-file-editor">
              {preview ? (
                file?.type.startsWith("video") ? (
                  <video src={preview} controls />
                ) : (
                  <img src={preview} alt="Prévia" />
                )
              ) : editing?.url ? (
                editing.type === "video" ? (
                  <video src={editing.url} controls />
                ) : (
                  <img src={editing.url} alt={showcaseAlt(editing)} />
                )
              ) : (
                <div className="service-cover-fallback">
                  <ImagePlus aria-hidden="true" />
                  <small>Selecione uma mídia</small>
                </div>
              )}

              <div>
                <label className="button button--outline showcase-file-button">
                  <ImagePlus aria-hidden="true" />
                  {editing ? "Substituir mídia" : "Escolher mídia"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4"
                    onChange={(e) => {
                      const next = e.target.files?.[0];
                      if (!next) return;

                      try {
                        validateShowcaseFile(next);

                        if (preview.startsWith("blob:")) {
                          URL.revokeObjectURL(preview);
                        }

                        setFile(next);
                        setPreview(URL.createObjectURL(next));
                        setError("");
                      } catch (err) {
                        e.currentTarget.value = "";
                        setError(
                          err instanceof Error ? err.message : "Arquivo inválido."
                        );
                      }
                    }}
                  />
                </label>

                <small>{file?.name || "JPG, PNG, WEBP ou MP4, até 20 MB."}</small>

                {file && (
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => {
                      if (preview.startsWith("blob:")) {
                        URL.revokeObjectURL(preview);
                      }
                      setPreview("");
                      setFile(null);
                    }}
                  >
                    Cancelar nova seleção
                  </button>
                )}
              </div>
            </div>

            <div className="admin-service-form-actions">
              <button type="button" onClick={close} disabled={saving}>
                Cancelar
              </button>
              <button className="primary" disabled={saving}>
                {saving ? "Salvando..." : "Salvar conteúdo"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ActionDialog
        open={Boolean(deleting)}
        title="Excluir conteúdo?"
        description="O registro e o arquivo promocional serão removidos permanentemente."
        confirmLabel="Excluir"
        danger
        loading={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}