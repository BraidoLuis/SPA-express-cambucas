"use client";

import { useEffect, useState } from "react";
import { AdminFixedCostsSection } from "./admin-fixed-costs-section";
import {
  getAccessUsers,
  getAdminSettings,
  getProviderStatus,
  saveAdminSettings,
  type AccessUser,
  type BookingRules,
  type ProviderStatus,
  type SpaSettings,
} from "../../lib/services/admin-settings-service";

const notificationLabels: Record<string, string> = {
  inApp: "Notificações dentro do sistema",
  clientEmail: "Enviar e-mail para clientes",
  professionalEmail: "Enviar e-mail para profissionais",
  clientWhatsapp: "Enviar WhatsApp para clientes",
  professionalWhatsapp: "Enviar WhatsApp para profissionais",
  reminder: "Enviar lembrete antes do atendimento",
  cancellation: "Notificar cancelamentos",
  newAppointment: "Notificar novos agendamentos",
  paymentConfirmed: "Notificar pagamentos confirmados",
};

const tabs = [
  "Dados do SPA",
  "Horários de funcionamento",
  "Regras de agendamento",
  "Notificações",
  "Usuários e acessos",
  "Custos fixos",
] as const;

const days = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const businessFields = [
  ["name", "Nome"],
  ["phone", "Telefone"],
  ["email", "E-mail"],
  ["postalCode", "CEP"],
  ["street", "Logradouro"],
  ["number", "Número"],
  ["complement", "Complemento"],
  ["district", "Bairro"],
  ["city", "Cidade"],
  ["state", "Estado"],
  ["mapAddress", "Endereço do mapa"],
  ["whatsappUrl", "Link do WhatsApp"],
  ["instagramUrl", "Instagram"],
  ["timezone", "Timezone"],
] as const;

export function AdminSettingsSection() {
  const [tab, setTab] = useState<(typeof tabs)[number]>(tabs[0]);
  const [settings, setSettings] = useState<SpaSettings | null>(null);
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [providers, setProviders] = useState<ProviderStatus>({
    email: false,
    whatsapp: false,
  });

  useEffect(() => {
    let active = true;

    Promise.all([
      getAdminSettings(),
      getAccessUsers(),
      getProviderStatus().catch(() => ({
        email: false,
        whatsapp: false,
      })),
    ])
      .then(([loadedSettings, loadedUsers, loadedProviders]) => {
        if (!active) return;

        setSettings(loadedSettings);
        setUsers(loadedUsers);
        setProviders(loadedProviders);
      })
      .catch((error) => {
        if (!active) return;

        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as configurações.",
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage("");

    try {
      await saveAdminSettings(settings);
      setMessage("Configurações salvas com sucesso.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateBookingInteger(
    key: keyof BookingRules,
    rawValue: string,
    minimum: number,
  ) {
    if (!settings) return;

    const normalizedValue = rawValue === "" ? null : Number(rawValue);

    if (
      normalizedValue !== null &&
      (!Number.isFinite(normalizedValue) ||
        !Number.isInteger(normalizedValue) ||
        normalizedValue < minimum)
    ) {
      setMessage(
        `Informe um número inteiro ${
          minimum === 1 ? "positivo" : "não negativo"
        }.`,
      );
      return;
    }

    setMessage("");
    setSettings({
      ...settings,
      bookingRules: {
        ...settings.bookingRules,
        [key]: normalizedValue,
      },
    });
  }

  return (
    <div className="settings-grid">
      <nav className="screen-card settings-nav" aria-label="Configurações">
        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="screen-card settings-form">
        {tab === "Custos fixos" ? (
          <AdminFixedCostsSection />
        ) : loading ? (
          <div className="admin-data-message">
            Carregando configurações...
          </div>
        ) : !settings ? (
          <div className="admin-data-message admin-data-message--error">
            {message || "Configurações indisponíveis."}
          </div>
        ) : (
          <>
            {message && (
              <div className="admin-data-message">{message}</div>
            )}

            {tab === "Dados do SPA" && (
              <>
                <h2>Dados do SPA</h2>
                <p>Informações públicas exibidas às clientes.</p>
                <div className="form-grid">
                  {businessFields.map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        value={settings.business[key] ?? ""}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            business: {
                              ...settings.business,
                              [key]: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                  <label className="wide">
                    Descrição
                    <textarea
                      maxLength={500}
                      value={settings.business.description ?? ""}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          business: {
                            ...settings.business,
                            description: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                </div>
              </>
            )}

            {tab === "Horários de funcionamento" && (
              <>
                <h2>Horários de funcionamento</h2>
                <p>
                  Informação geral; a agenda também continua respeitando
                  cada profissional.
                </p>
                <div className="business-hours">
                  {days.map((day, index) => {
                    const value = settings.businessHours[String(index)];
                    return (
                      <fieldset key={day}>
                        <legend>{day}</legend>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(value?.open)}
                            onChange={(event) =>
                              setSettings({
                                ...settings,
                                businessHours: {
                                  ...settings.businessHours,
                                  [index]: {
                                    ...value,
                                    open: event.target.checked,
                                    start: value?.start ?? "",
                                    end: value?.end ?? "",
                                  },
                                },
                              })
                            }
                          />{" "}
                          Aberto
                        </label>
                        <label>
                          Início
                          <input
                            type="time"
                            disabled={!Boolean(value?.open)}
                            value={value?.start ?? ""}
                            onChange={(event) =>
                              setSettings({
                                ...settings,
                                businessHours: {
                                  ...settings.businessHours,
                                  [index]: {
                                    ...value,
                                    open: Boolean(value?.open),
                                    start: event.target.value,
                                    end: value?.end ?? "",
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label>
                          Fim
                          <input
                            type="time"
                            disabled={!Boolean(value?.open)}
                            value={value?.end ?? ""}
                            onChange={(event) =>
                              setSettings({
                                ...settings,
                                businessHours: {
                                  ...settings.businessHours,
                                  [index]: {
                                    ...value,
                                    open: Boolean(value?.open),
                                    start: value?.start ?? "",
                                    end: event.target.value,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                      </fieldset>
                    );
                  })}
                </div>
              </>
            )}

            {tab === "Regras de agendamento" && (
              <>
                <h2>Regras de agendamento</h2>
                <div className="form-grid">
                  <label>
                    Antecedência mínima (horas)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={settings.bookingRules.minimumNoticeHours ?? ""}
                      onChange={(event) =>
                        updateBookingInteger(
                          "minimumNoticeHours",
                          event.target.value,
                          0,
                        )
                      }
                    />
                  </label>
                  <label>
                    Máximo de dias futuros
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Sem limite"
                      value={settings.bookingRules.maximumAdvanceDays ?? ""}
                      onChange={(event) =>
                        updateBookingInteger(
                          "maximumAdvanceDays",
                          event.target.value,
                          1,
                        )
                      }
                    />
                  </label>
                  <label>
                    Antecedência para cancelar (horas)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        settings.bookingRules.cancellationNoticeHours ?? ""
                      }
                      onChange={(event) =>
                        updateBookingInteger(
                          "cancellationNoticeHours",
                          event.target.value,
                          0,
                        )
                      }
                    />
                  </label>
                  <label>
                    Intervalo padrão da grade (minutos)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={settings.bookingRules.defaultGridMinutes ?? ""}
                      onChange={(event) =>
                        updateBookingInteger(
                          "defaultGridMinutes",
                          event.target.value,
                          1,
                        )
                      }
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.bookingRules.allowSameDay)}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          bookingRules: {
                            ...settings.bookingRules,
                            allowSameDay: event.target.checked,
                          },
                        })
                      }
                    />{" "}
                    Permitir no mesmo dia
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(
                        settings.bookingRules.cancellationEnabled,
                      )}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          bookingRules: {
                            ...settings.bookingRules,
                            cancellationEnabled: event.target.checked,
                          },
                        })
                      }
                    />{" "}
                    Aplicar prazo mínimo de cancelamento
                  </label>
                  <label className="wide">
                    Texto sobre pagamento
                    <textarea
                      value={settings.bookingRules.paymentText ?? ""}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          bookingRules: {
                            ...settings.bookingRules,
                            paymentText: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                </div>
              </>
            )}

            {tab === "Notificações" && (
              <>
                <h2>Notificações globais</h2>

                <p>
                  E-mail:{" "}
                  {providers.email
                    ? "Provedor conectado"
                    : "Aguardando configuração do provedor"}
                  {" · "}
                  WhatsApp:{" "}
                  {providers.whatsapp
                    ? "Provedor conectado"
                    : "Aguardando configuração do provedor"}
                </p>

                <div className="notification-options">
                  {Object.entries(settings.notifications).map(([key, value]) => {
                    if (typeof value === "boolean") {
                      const emailUnavailable =
                        key.toLowerCase().includes("email") &&
                        !providers.email;

                      const whatsappUnavailable =
                        key.toLowerCase().includes("whatsapp") &&
                        !providers.whatsapp;

                      const disabled =
                        emailUnavailable || whatsappUnavailable;

                      return (
                        <label
                          key={key}
                          className="notification-option"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <input
                            type="checkbox"
                            className="notification-checkbox"
                            checked={Boolean(value)}
                            disabled={disabled}
                            onChange={(event) =>
                              setSettings({
                                ...settings,
                                notifications: {
                                  ...settings.notifications,
                                  [key]: event.target.checked,
                                },
                              })
                            }
                          />

                          <span>
                            {notificationLabels[key] ?? key}

                            {disabled && (
                              <small className="notification-option-status">
                                Provedor não configurado
                              </small>
                            )}
                          </span>
                        </label>
                      );
                    }

                    return (
                      <label
                        key={key}
                        className="notification-reminder-hours"
                      >
                        <span>Enviar o lembrete com antecedência de</span>

                        <div className="notification-reminder-input">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={value ?? ""}
                            aria-label="Antecedência do lembrete em horas"
                            onChange={(event) => {
                              const raw = event.target.value;
                              const normalized =
                                raw === "" ? null : Number(raw);

                              if (
                                normalized === null ||
                                (
                                  Number.isFinite(normalized) &&
                                  Number.isInteger(normalized) &&
                                  normalized >= 1
                                )
                              ) {
                                setSettings({
                                  ...settings,
                                  notifications: {
                                    ...settings.notifications,
                                    [key]: normalized,
                                  },
                                });
                              }
                            }}
                          />

                          <span>horas</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            {tab === "Usuários e acessos" && (
              <>
                <h2>Usuários e acessos</h2>
                <p>
                  Visualização segura. Alterações de role e senha não estão
                  disponíveis.
                </p>
                <div className="report-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Cadastro</th>
                        <th>Último acesso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td>{user.fullName}</td>
                          <td>{user.email}</td>
                          <td>{user.role}</td>
                          <td>{user.active ? "Ativo" : "Inativo"}</td>
                          <td>
                            {new Intl.DateTimeFormat("pt-BR").format(
                              new Date(user.createdAt),
                            )}
                          </td>
                          <td>{user.lastAccess ?? "Não disponível"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab !== "Usuários e acessos" && (
              <button
                className="primary"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}