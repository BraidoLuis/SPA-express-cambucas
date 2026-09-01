"use client";
import { useEffect, useMemo, useState } from "react";
import { Eye, Plus, Pencil, Search } from "lucide-react";
import { ActionDialog } from "../shared/action-dialog";
import {
  createFixedCost,
  listFixedCosts,
  setFixedCostActive,
  updateFixedCost,
  type FixedCost,
  type FixedCostInput,
} from "../../lib/services/admin-fixed-costs-service";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const empty: FixedCostInput = {
  name: "",
  category: "Aluguel",
  amount: 0,
  recurrence: "monthly",
  dueDay: 1,
  annualDueMonth: null,
  startsOn: new Date().toLocaleDateString("en-CA"),
  endsOn: null,
  active: true,
  notes: null,
};

const categories = [
  "Aluguel",
  "Energia elétrica",
  "Água",
  "Internet",
  "Produtos recorrentes",
  "Manutenção",
  "Contabilidade",
  "Sistemas",
  "Outros",
];

export function AdminFixedCostsSection() {
  const [items, setItems] = useState<FixedCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [recurrence, setRecurrence] = useState("all");
  const [editing, setEditing] = useState<FixedCost | null>(null);
  const [detail, setDetail] = useState<FixedCost | null>(null);
  const [form, setForm] = useState<FixedCostInput>(empty);
  const [saving, setSaving] = useState(false);
  const [toggle, setToggle] = useState<FixedCost | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await listFixedCosts());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar os custos.");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      items.filter(
        (x) =>
          (!search ||
            `${x.name} ${x.category}`
              .toLocaleLowerCase("pt-BR")
              .includes(search.toLocaleLowerCase("pt-BR"))) &&
          (category === "all" || x.category === category) &&
          (status === "all" || x.active === (status === "active")) &&
          (recurrence === "all" || x.recurrence === recurrence)
      ),
    [items, search, category, status, recurrence]
  );

  function open(item?: FixedCost) {
    setEditing(item || null);
    setForm(
      item
        ? {
            name: item.name,
            category: item.category,
            amount: item.amount,
            recurrence: item.recurrence,
            dueDay: item.dueDay,
            annualDueMonth: item.annualDueMonth,
            startsOn: item.startsOn,
            endsOn: item.endsOn,
            active: item.active,
            notes: item.notes,
          }
        : { ...empty }
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (
      !form.name.trim() ||
      !form.category.trim() ||
      !Number.isFinite(form.amount) ||
      form.amount < 0 ||
      form.dueDay < 1 ||
      form.dueDay > 31 ||
      !form.startsOn ||
      (form.endsOn && form.endsOn < form.startsOn) ||
      (form.recurrence === "annual" &&
        (!form.annualDueMonth || form.annualDueMonth < 1 || form.annualDueMonth > 12))
    ) {
      setError("Revise os campos obrigatórios e as datas.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const saved = editing
        ? await updateFixedCost(editing.id, form)
        : await createFixedCost(form);

      setItems((v) =>
        editing ? v.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...v]
      );

      setEditing(null);
      setSuccess("Custo salvo com sucesso.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmToggle() {
    if (!toggle) return;

    setSaving(true);
    try {
      await setFixedCostActive(toggle.id, !toggle.active);
      setItems((v) =>
        v.map((x) => (x.id === toggle.id ? { ...x, active: !x.active } : x))
      );
      setSuccess(toggle.active ? "Custo desativado." : "Custo ativado.");
      setToggle(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível alterar o custo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="fixed-costs">
      <div className="screen-top">
        <div>
          <h2>Custos fixos</h2>
          <p>Despesas recorrentes usadas nos relatórios financeiros.</p>
        </div>
        <button className="primary" onClick={() => open()}>
          <Plus /> Novo custo
        </button>
      </div>

      {error && (
        <div className="admin-data-message admin-data-message--error">
          {error} <button onClick={() => void load()}>Tentar novamente</button>
        </div>
      )}

      {success && <div className="admin-data-message">{success}</div>}

      <div className="cost-filters">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            flexDirection: "row-reverse",
          }}
        >
          <Search />
          <input
            aria-label="Pesquisar custos"
            placeholder="Pesquisar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <select
          aria-label="Categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Todas as categorias</option>
          {[...new Set(items.map((x) => x.category))].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>

        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>

        <select
          aria-label="Recorrência"
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value)}
        >
          <option value="all">Todas as recorrências</option>
          <option value="monthly">Mensal</option>
          <option value="annual">Anual</option>
        </select>
      </div>

      {loading ? (
        <div className="admin-data-message">Carregando custos...</div>
      ) : !filtered.length ? (
        <div className="admin-empty-state">Nenhum custo encontrado.</div>
      ) : (
        <div className="report-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Categoria</th>
                <th>Valor</th>
                <th>Recorrência</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((x) => (
                <tr key={x.id}>
                  <td>
                    {x.name}
                    <small>{x.notes?.slice(0, 70)}</small>
                  </td>
                  <td>{x.category}</td>
                  <td>{money.format(x.amount)}</td>
                  <td>{x.recurrence === "monthly" ? "Mensal" : "Anual"}</td>
                  <td>
                    dia {x.dueDay}
                    {x.recurrence === "annual" ? ` / mês ${x.annualDueMonth}` : ""}
                  </td>
                  <td>
                    <button
                      className={`status-pill ${x.active ? "active" : ""}`}
                      onClick={() => setToggle(x)}
                    >
                      {x.active ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="cost-actions">
                    <button aria-label={`Ver ${x.name}`} onClick={() => setDetail(x)}>
                      <Eye />
                    </button>
                    <button aria-label={`Editar ${x.name}`} onClick={() => open(x)}>
                      <Pencil />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(editing || form !== empty) && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setEditing(null);
              setForm(empty);
            }
          }}
        >
          <section className="simple-modal cost-modal" role="dialog" aria-modal="true">
            <h2>{editing ? "Editar custo" : "Novo custo fixo"}</h2>
            <form onSubmit={submit} className="cost-form">
              <label>
                Nome
                <input
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>

              <label>
                Categoria
                <select
                  value={categories.includes(form.category) ? form.category : "Outros"}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {categories.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>

              {form.category === "Outros" && (
                <label>
                  Categoria personalizada
                  <input
                    required
                    maxLength={80}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </label>
              )}

              <label>
                Valor
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) =>
                    setForm({ ...form, amount: Number(e.target.value) })
                  }
                />
              </label>

              <label>
                Recorrência
                <select
                  value={form.recurrence}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      recurrence: e.target.value as FixedCostInput["recurrence"],
                    })
                  }
                >
                  <option value="monthly">Mensal</option>
                  <option value="annual">Anual</option>
                </select>
              </label>

              <label>
                Dia de vencimento
                <input
                  required
                  type="number"
                  min="1"
                  max="31"
                  value={form.dueDay}
                  onChange={(e) =>
                    setForm({ ...form, dueDay: Number(e.target.value) })
                  }
                />
              </label>

              {form.recurrence === "annual" && (
                <label>
                  Mês do vencimento
                  <input
                    required
                    type="number"
                    min="1"
                    max="12"
                    value={form.annualDueMonth || ""}
                    onChange={(e) =>
                      setForm({ ...form, annualDueMonth: Number(e.target.value) })
                    }
                  />
                </label>
              )}

              <label>
                Início
                <input
                  required
                  type="date"
                  value={form.startsOn}
                  onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
                />
              </label>

              <label>
                Término
                <input
                  type="date"
                  value={form.endsOn || ""}
                  onChange={(e) =>
                    setForm({ ...form, endsOn: e.target.value || null })
                  }
                />
              </label>

              <label className="wide">
                Observações
                <textarea
                  maxLength={500}
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>

              <footer className="wide">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setForm(empty);
                  }}
                >
                  Cancelar
                </button>
                <button className="primary" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {detail && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setDetail(null)}
        >
          <section className="simple-modal cost-modal" role="dialog" aria-modal="true">
            <h2>{detail.name}</h2>
            <dl className="cost-details">
              <dt>Categoria</dt>
              <dd>{detail.category}</dd>
              <dt>Valor</dt>
              <dd>{money.format(detail.amount)}</dd>
              <dt>Vigência</dt>
              <dd>
                {detail.startsOn} a {detail.endsOn || "sem término"}
              </dd>
              <dt>Observações</dt>
              <dd>{detail.notes || "Sem observações"}</dd>
            </dl>
            <button className="primary" onClick={() => setDetail(null)}>
              Fechar
            </button>
          </section>
        </div>
      )}

      <ActionDialog
        open={Boolean(toggle)}
        title={toggle?.active ? "Desativar custo?" : "Ativar custo?"}
        description="O histórico será preservado e os relatórios considerarão a vigência cadastrada."
        confirmLabel={toggle?.active ? "Desativar" : "Ativar"}
        danger={toggle?.active}
        loading={saving}
        onCancel={() => setToggle(null)}
        onConfirm={() => void confirmToggle()}
      />
    </section>
  );
}