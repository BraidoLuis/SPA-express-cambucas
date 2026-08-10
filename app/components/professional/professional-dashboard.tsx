"use client";
import { useState } from "react";
import { bookings, hourlySlots, monthKey, pad, services, type Service } from "../../lib/spa-data";
import { AdminTable } from "../admin/admin-dashboard";
import { Logo, NotificationBell, ThemeToggle } from "../shared/spa-ui";
export function ProfessionalDashboard({
  professional,
  goPublic,
  logout,
}: {
  professional: "Eliane" | "Dayanne";
  goPublic: () => void;
  logout: () => void;
}) {
  const [section, setSection] = useState("Meu dia");
  const [blocked, setBlocked] = useState(false);
  const today = new Date();
  const [agendaMonth, setAgendaMonth] = useState(monthKey(today));
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [workStart, setWorkStart] = useState(9);
  const [workEnd, setWorkEnd] = useState(18);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [extraAppointments, setExtraAppointments] = useState<Array<{date:string;time:string;client:string;service:string;duration:number}>>([]);
  const isEliane = professional === "Eliane";
  const fullName = isEliane ? "Eliane Cristina" : "Dayanne Costa";
  const initials = isEliane ? "EC" : "DC";
  const role = isEliane
    ? "Massagista & Esteticista"
    : "Manicure & Nail designer";
  const myBookings = bookings.filter((b) => b.professional === professional);
  const [myServices, setMyServices] = useState<Service[]>(services.filter((s) => s.professional === professional));
  const monthDate = new Date(`${agendaMonth}-01T12:00:00`);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
  const menu = ["Meu dia", "Minha agenda", "Meus serviços", "Disponibilidade", "Notificações"];
  return (
    <div className="admin-shell professional-shell">
      <aside>
        <Logo compact />
        <div className="professional-aside-profile">
          <span>{initials}</span>
          <div>
            <b>{fullName}</b>
            <small>{role}</small>
          </div>
        </div>
        <nav>
          {menu.map((m, i) => (
            <button
              className={section === m ? "active" : ""}
              onClick={() => setSection(m)}
              key={m}
            >
              <span>{["⌂", "▦", "✦", "◷", "♢"][i]}</span>
              {m}
              {m === "Meu dia" && <i>{myBookings.length}</i>}
            </button>
          ))}
        </nav>
        <div className="permission-note">
          <span>⌾</span>
          <b>Acesso profissional</b>
          <small>Você visualiza somente sua agenda e seus serviços.</small>
        </div>
        <button className="view-site" onClick={goPublic}>
          ← Ver site público
        </button>
        <button className="view-site logout" onClick={logout}>
          ↪ Sair da conta
        </button>
      </aside>
      <main className="admin-main professional-main">
        <header>
          <div>
            <span>ESPAÇO DA PROFISSIONAL</span>
            <h1>{section}</h1>
            <p>Olá, {professional}. Organize seu dia com tranquilidade.</p>
          </div>
          <div className="admin-actions">
            <ThemeToggle />
            <NotificationBell audience="professional" />
            <div className="profile">
              <span>{initials}</span>
              <div>
                <b>{fullName}</b>
                <small>Profissional</small>
              </div>
              ⌄
            </div>
          </div>
        </header>
        {section === "Meu dia" && (
          <>
            <section className="professional-welcome">
              <div>
                <span className="eyebrow">SEXTA-FEIRA, 07 DE AGOSTO</span>
                <h2>Bom dia, {professional}! ♡</h2>
                <p>
                  Você tem {myBookings.length} atendimentos programados para
                  hoje.
                </p>
              </div>
              <button
                className="primary"
                onClick={() => setSection("Minha agenda")}
              >
                Ver agenda completa →
              </button>
            </section>
            <section className="professional-stats">
              <article>
                <span>◷</span>
                <div>
                  <small>PRÓXIMO ATENDIMENTO</small>
                  <b>
                    {myBookings[0]?.time} · {myBookings[0]?.client}
                  </b>
                  <p>{myBookings[0]?.service}</p>
                </div>
              </article>
              <article>
                <span>✓</span>
                <div>
                  <small>ATENDIMENTOS HOJE</small>
                  <b>{myBookings.length}</b>
                  <p>
                    {myBookings.filter((b) => b.status === "Confirmado").length}{" "}
                    confirmados
                  </p>
                </div>
              </article>
              <article>
                <span>✦</span>
                <div>
                  <small>SERVIÇOS ATIVOS</small>
                  <b>{myServices.length}</b>
                  <p>Disponíveis para agendamento</p>
                </div>
              </article>
            </section>
            <section className="panel professional-today">
              <div className="panel-head">
                <div>
                  <h2>Sua agenda de hoje</h2>
                  <p>Somente os seus atendimentos</p>
                </div>
                <span className="access-pill">Visão individual</span>
              </div>
              <AdminTable rows={myBookings} />
            </section>
          </>
        )}
        {section === "Minha agenda" && (
          <div className="screen-card professional-agenda">
            <div className="screen-toolbar">
              <div>
                <h2>Minha agenda completa</h2>
                <p>Consulte qualquer mês, organize bloqueios e registre encaixes.</p>
              </div>
              <div className="agenda-toolbar-actions">
                <input type="month" min={monthKey(today)} value={agendaMonth} onChange={(event) => setAgendaMonth(event.target.value)} aria-label="Mês da agenda" />
                <button
                  onClick={() => setAgendaMonth(monthKey(today))}
                >Hoje</button>
                <button
                  onClick={() => setBlocked(!blocked)}
                >
                  ＋ Bloquear horário
                </button>
                <button className="primary" onClick={() => setShowExtraForm(!showExtraForm)}>＋ Serviço extra</button>
              </div>
            </div>
            {showExtraForm && <form className="inline-extra-form" onSubmit={(event) => {event.preventDefault(); const form = new FormData(event.currentTarget); setExtraAppointments((items) => [...items, {date:String(form.get("date")),time:String(form.get("time")),client:String(form.get("client")),service:String(form.get("service")),duration:Number(form.get("duration"))}]); setShowExtraForm(false);}}>
              <div><b>Adicionar atendimento fora da grade</b><small>Ideal para encaixes, retornos e serviços realizados sem reserva prévia.</small></div>
              <input name="date" type="date" min={today.toISOString().slice(0,10)} required />
              <input name="time" type="time" required />
              <input name="client" placeholder="Nome da cliente" required />
              <select name="service">{myServices.map((service) => <option key={service.name}>{service.name}</option>)}</select>
              <input name="duration" type="number" min="15" step="15" defaultValue="60" aria-label="Duração em minutos" />
              <button className="primary">Salvar encaixe</button>
            </form>}
            <div className="month-summary"><span>Visualizando <b>{monthDate.toLocaleDateString("pt-BR", {month:"long",year:"numeric"})}</b></span><span>Grade de <b>{slotMinutes} minutos</b> · {pad(workStart)}:00 às {pad(workEnd)}:00</span></div>
            <div className="professional-month-calendar">
              {["DOM","SEG","TER","QUA","QUI","SEX","SÁB"].map((label)=><b className="month-weekday" key={label}>{label}</b>)}
              {Array.from({length:firstWeekday}).map((_,i)=><span className="empty-day" key={`empty-${i}`} />)}
              {Array.from({length:daysInMonth},(_,i)=>i+1).map((day) => {
                const date = `${agendaMonth}-${pad(day)}`;
                const extra = extraAppointments.filter((item)=>item.date===date);
                const demoService = day % 5 === 0 ? myServices[day % myServices.length] : null;
                return <article key={day} className={date < today.toISOString().slice(0,10) ? "past" : ""}><strong>{day}</strong>{demoService && <div className="calendar-booking"><b>{pad(workStart + (day % 6))}:00</b><span>{demoService.name}</span><small>{demoService.duration} min · ocupa {Math.ceil(demoService.duration / slotMinutes)} bloco(s)</small></div>}{extra.map((item)=><div className="calendar-booking extra" key={`${item.time}-${item.client}`}><b>{item.time} · encaixe</b><span>{item.service}</span><small>{item.client} · {item.duration} min</small></div>)}{blocked && day===18 && <div className="calendar-block">Bloqueado</div>}</article>;
              })}
            </div>
          </div>
        )}
        {section === "Meus serviços" && (
          <div>
            <div className="screen-top">
              <div>
                <h2>Serviços que você realiza</h2>
                <p>Cadastre seus serviços e informe a duração real de cada atendimento.</p>
              </div>
              <button className="primary" onClick={() => setShowServiceForm(!showServiceForm)}>＋ Adicionar serviço</button>
            </div>
            {showServiceForm && <form className="professional-service-form" onSubmit={(event)=>{event.preventDefault(); const form = new FormData(event.currentTarget); setMyServices((items)=>[...items,{name:String(form.get("name")),category:String(form.get("category")),duration:Number(form.get("duration")),price:Number(form.get("price")),professional,image:isEliane?"/spa-eliane.png":"/spa-nails.png"}]); setShowServiceForm(false);}}>
              <label>Nome do serviço<input name="name" required placeholder="Ex.: Spa dos pés" /></label>
              <label>Categoria<input name="category" required placeholder="Ex.: Unhas" /></label>
              <label>Duração estimada<input name="duration" type="number" min="15" step="15" defaultValue="60" required /></label>
              <label>Valor no local<input name="price" type="number" min="0" step="5" required /></label>
              <button className="primary">Salvar serviço</button>
            </form>}
            <div className="admin-service-grid professional-services">
              {myServices.map((s, i) => (
                <article key={s.name}>
                  <div className="service-admin-icon">
                    {isEliane ? ["♨", "≈", "✧", "◇"][i] : ["✦", "♢"][i]}
                  </div>
                  <span className="active-pill">Ativo</span>
                  <h3>{s.name}</h3>
                  <p>
                    {s.category} · {s.duration} minutos
                  </p>
                  <div>
                    <b>R$ {s.price},00</b>
                    <span>Na sua agenda</span>
                  </div>
                  <footer>
                    <button>Ver horários</button>
                  </footer>
                </article>
              ))}
            </div>
            <div className="permission-banner"><span>i</span><p><b>A agenda respeita a duração cadastrada</b><small>Um serviço de 90 minutos ocupa automaticamente dois blocos em uma grade de 60 minutos, evitando sobreposição.</small></p></div>
          </div>
        )}
        {section === "Disponibilidade" && (
          <div className="screen-card availability-settings">
            <div className="screen-top">
              <div>
                <h2>Minha disponibilidade</h2>
                <p>Informe os períodos em que você poderá receber clientes.</p>
              </div>
              <button className="primary">Salvar alterações</button>
            </div>
            <div className="schedule-rules-card">
              <div><label>Intervalo da grade<select value={slotMinutes} onChange={(event)=>setSlotMinutes(Number(event.target.value))}><option value="60">De hora em hora</option><option value="30">A cada 30 minutos</option><option value="15">A cada 15 minutos</option></select></label><small>Define de quanto em quanto tempo os horários começam.</small></div>
              <div><label>Início do expediente<input type="number" min="0" max="23" value={workStart} onChange={(event)=>setWorkStart(Number(event.target.value))} /></label></div>
              <div><label>Fim do expediente<input type="number" min="1" max="24" value={workEnd} onChange={(event)=>setWorkEnd(Number(event.target.value))} /></label></div>
              <div className="availability-total"><span>Disponibilidade diária</span><b>{Math.max(0,workEnd-workStart)} horas</b><small>{hourlySlots(workStart,workEnd,slotMinutes).length} possíveis inícios de atendimento</small></div>
            </div>
            <div className="availability-list">
              {[
                ["Segunda-feira", "09:00", "18:00"],
                ["Terça-feira", "09:00", "18:00"],
                ["Quarta-feira", "09:00", "18:00"],
                ["Quinta-feira", "09:00", "18:00"],
                ["Sexta-feira", "09:00", "19:00"],
                ["Sábado", "09:00", "15:00"],
              ].map((d, i) => (
                <div key={d[0]}>
                  <label>
                    <input type="checkbox" defaultChecked={i !== 2} />
                    <span>{d[0]}</span>
                  </label>
                  <input defaultValue={d[1]} />
                  <em>até</em>
                  <input defaultValue={d[2]} />
                  <button>＋ Intervalo</button>
                </div>
              ))}
            </div>
            <div className="time-off-card">
              <span>☼</span>
              <div>
                <b>Folgas e ausências</b>
                <small>
                  Bloqueie férias, consultas ou compromissos pessoais.
                </small>
              </div>
              <button>＋ Adicionar período</button>
            </div>
          </div>
        )}
        {section === "Notificações" && <div className="screen-card notification-settings">
          <div className="screen-top"><div><h2>Como você quer ser avisada?</h2><p>Escolha os canais usados quando uma cliente confirmar, reagendar ou cancelar um horário.</p></div><button className="primary">Salvar preferências</button></div>
          <div className="notification-channel-grid">
            <label><span className="channel-icon">◉</span><div><b>Notificação no sistema</b><small>Aparece no sino e permanece no seu histórico.</small></div><input type="checkbox" defaultChecked /></label>
            <label><span className="channel-icon">✉</span><div><b>E-mail pelo Resend</b><small>Receba os detalhes completos no seu e-mail profissional.</small></div><input type="checkbox" defaultChecked /></label>
            <label><span className="channel-icon">◍</span><div><b>WhatsApp Business</b><small>Receba confirmação imediata no número cadastrado.</small></div><input type="checkbox" defaultChecked /></label>
          </div>
          <h3>Eventos que geram aviso</h3>
          <div className="notification-event-list">
            {["Novo agendamento confirmado","Reagendamento realizado","Cancelamento de horário","Lembrete da agenda do dia seguinte"].map((event)=><label key={event}><span><b>{event}</b><small>Cliente e profissional recebem informações compatíveis com o evento.</small></span><input type="checkbox" defaultChecked /></label>)}
          </div>
          <div className="integration-status"><span>✓</span><div><b>Integrações preparadas</b><small>Resend, WhatsApp Business Cloud API e notificações internas serão acionados pelo backend após a reserva ser gravada no Supabase.</small></div></div>
        </div>}
      </main>
    </div>
  );
}


