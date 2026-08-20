"use client";
import { useCallback, useEffect, useRef, useState, } from "react";
import Image from "next/image";
import { Bell, Check, DollarSign, Moon, Sun, X } from "lucide-react";
import {
  getMyInAppNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type InAppNotification,
} from "../../lib/services/notification-service";

export const Icon = ({ children }: { children: React.ReactNode }) => (
  <span className="icon">{children}</span>
);
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo ${compact ? "compact" : ""}`}>
      <Image
        src="/logo-spa.png"
        alt="SPA Express Cambucás"
        width={180}
        height={72}
        className="logo-image"
        priority
      />
    </div>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setDark(window.localStorage.getItem("spa-theme") === "dark"));
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark-theme", dark);
  }, [dark]);
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
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}

function notificationTimeAgo(date: string) {
  const createdAt = new Date(date).getTime();
  const difference = Math.max(0, Date.now() - createdAt);

  const minutes = Math.floor(difference / 60_000);

  if (minutes < 1) {
    return "Agora";
  }

  if (minutes < 60) {
    return `${minutes} min atrás`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h atrás`;
  }

  const days = Math.floor(hours / 24);

  if (days === 1) {
    return "Ontem";
  }

  if (days < 7) {
    return `${days} dias atrás`;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(date));
}

export function NotificationBell({
  audience = "admin",
}: {
  audience?: "admin" | "professional";
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const centerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const notifications = await getMyInAppNotifications();
      setItems(notifications);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar as notificações.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();

    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 30_000);

    function refreshOnFocus() {
      void loadNotifications();
    }

    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (
        centerRef.current &&
        !centerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function readNotification(notificationId: string) {
    const currentItem = items.find(
      (item) => item.id === notificationId,
    );

    if (!currentItem || currentItem.readAt) {
      return;
    }

    const readAt = new Date().toISOString();

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === notificationId
          ? {
              ...item,
              readAt,
            }
          : item,
      ),
    );

    try {
      await markNotificationAsRead(notificationId);
    } catch (readError) {
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                readAt: null,
              }
            : item,
        ),
      );

      setError(
        readError instanceof Error
          ? readError.message
          : "Não foi possível atualizar a notificação.",
      );
    }
  }

  async function readAllNotifications() {
    const previousItems = items;
    const readAt = new Date().toISOString();

    setUpdating(true);
    setError("");

    setItems((currentItems) =>
      currentItems.map((item) => ({
        ...item,
        readAt: item.readAt || readAt,
      })),
    );

    try {
      await markAllNotificationsAsRead();
    } catch (readError) {
      setItems(previousItems);

      setError(
        readError instanceof Error
          ? readError.message
          : "Não foi possível atualizar as notificações.",
      );
    } finally {
      setUpdating(false);
    }
  }

  const unreadCount = items.filter(
    (item) => !item.readAt,
  ).length;

  return (
    <div className="notification-center" ref={centerRef}>
      <button
        type="button"
        className="notification icon-button"
        onClick={() => {
          setOpen((currentOpen) => !currentOpen);

          if (!open) {
            void loadNotifications();
          }
        }}
        aria-label={
          unreadCount > 0
            ? `Abrir notificações. ${unreadCount} não lidas.`
            : "Abrir notificações"
        }
        aria-expanded={open}
        title="Notificações"
      >
        <Bell aria-hidden="true" />

        {unreadCount > 0 && (
          <i>{unreadCount > 99 ? "99+" : unreadCount}</i>
        )}
      </button>

      {open && (
        <div className="notification-popover">
          <header>
            <div>
              <span>ATUALIZAÇÕES</span>
              <h3>Notificações</h3>
            </div>

            <div className="notification-header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notification-read-all"
                  onClick={() => void readAllNotifications()}
                  disabled={updating}
                >
                  {updating ? "Atualizando..." : "Marcar como lidas"}
                </button>
              )}

              <button
                type="button"
                className="notification-close icon-button"
                onClick={() => setOpen(false)}
                aria-label="Fechar notificações"
                title="Fechar"
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="notification-feed">
            {loading && (
              <div className="notification-state">
                Carregando notificações...
              </div>
            )}

            {!loading && error && items.length === 0 && (
              <div className="notification-state notification-state--error">
                <p>{error}</p>

                <button
                  type="button"
                  onClick={() => void loadNotifications()}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!loading && !error && items.length === 0 && (
              <div className="notification-state">
                <Bell aria-hidden="true" />
                <p>Nenhuma notificação por enquanto.</p>
              </div>
            )}

            {items.map((item) => {
              const paymentNotification =
                item.notificationType ===
                "admin_payment_confirmed";

              return (
                <article
                  className={item.readAt ? "read" : ""}
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    void readNotification(item.id)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();
                      void readNotification(item.id);
                    }
                  }}
                >
                  <span>
                    {paymentNotification ? (
                      <DollarSign aria-hidden="true" />
                    ) : (
                      <Check aria-hidden="true" />
                    )}
                  </span>

                  <div>
                    <b>{item.title}</b>
                    <p>{item.body}</p>
                    <small>
                      {notificationTimeAgo(item.createdAt)}
                    </small>
                  </div>
                </article>
              );
            })}
          </div>

          <footer>
            {audience === "admin"
              ? "Atualizações administrativas do SPA."
              : "Atualizações da sua agenda profissional."}
          </footer>
        </div>
      )}
    </div>
  );
}