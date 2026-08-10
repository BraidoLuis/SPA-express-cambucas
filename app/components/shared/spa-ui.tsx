"use client";
import { useEffect, useState } from "react";

export const Icon = ({ children }: { children: React.ReactNode }) => (
  <span className="icon">{children}</span>
);
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo ${compact ? "compact" : ""}`}>
      <span>✦</span>
      <b>SPA EXPRESS</b>
      <small>CAMBUCÁS</small>
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
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
    </button>
  );
}

export function NotificationBell({ audience = "admin" }: { audience?: "admin" | "professional" }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(false);
  const items = audience === "admin"
    ? [
        ["Novo agendamento confirmado", "Mariana marcou Drenagem Linfática com Eliane para amanhã às 14:00."],
        ["Pagamento registrado", "Carla pagou R$ 75,00 pelo atendimento com Dayanne."],
        ["Agenda atualizada", "Dayanne adicionou o serviço Spa dos pés com duração de 60 minutos."],
      ]
    : [
        ["Novo horário na sua agenda", "Mariana marcou um atendimento para amanhã às 14:00."],
        ["Novo horário na sua agenda", "Fernanda marcou Blindagem para sexta-feira às 16:00."],
      ];
  return <div className="notification-center">
    <button className="notification" onClick={() => setOpen(!open)} aria-label="Abrir notificações">♢{!read && <i>{items.length}</i>}</button>
    {open && <div className="notification-popover">
      <header><div><span>ATUALIZAÇÕES</span><h3>Notificações</h3></div><button onClick={() => setRead(true)}>Marcar como lidas</button></header>
      <div className="notification-feed">{items.map((item,index)=><article className={read ? "read" : ""} key={item[0]+index}><span>{index===1?"R$":"✓"}</span><div><b>{item[0]}</b><p>{item[1]}</p><small>{index===0?"Agora":`${index+1}h atrás`}</small></div></article>)}</div>
      <footer>As notificações também ficam armazenadas no Supabase.</footer>
    </div>}
  </div>;
}
