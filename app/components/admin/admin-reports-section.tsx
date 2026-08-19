"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { getAdminReport, getAdminReportOptions, type AdminReport, type ReportFilters, type ReportPeriod } from "../../lib/services/admin-reports-service";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const emptyFilters: ReportFilters = { professionalId: "all", serviceId: "all", category: "all", appointmentStatus: "all", paymentStatus: "all" };
type PeriodName = "currentMonth" | "previousMonth" | "30days" | "90days" | "currentYear" | "custom";
type Metric = "revenue" | "costs" | "result";
const inputDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function getPeriod(name: PeriodName, customStart: string, customEnd: string): ReportPeriod | null {
  const now = new Date(), start = new Date(now), end = new Date(now);
  end.setHours(24, 0, 0, 0);
  if (name === "currentMonth") { start.setDate(1); start.setHours(0, 0, 0, 0); }
  else if (name === "previousMonth") { start.setMonth(start.getMonth() - 1, 1); start.setHours(0, 0, 0, 0); end.setDate(1); end.setHours(0, 0, 0, 0); }
  else if (name === "30days" || name === "90days") { start.setDate(start.getDate() - (name === "30days" ? 29 : 89)); start.setHours(0, 0, 0, 0); }
  else if (name === "currentYear") { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
  else {
    if (!customStart || !customEnd || customStart > customEnd) return null;
    start.setTime(new Date(`${customStart}T00:00:00-03:00`).getTime());
    end.setTime(new Date(`${customEnd}T24:00:00-03:00`).getTime());
    if ((end.getTime() - start.getTime()) / 86400000 > 366) return null;
  }
  const duration = end.getTime() - start.getTime();
  return { start: start.toISOString(), end: end.toISOString(), previousStart: new Date(start.getTime() - duration).toISOString(), previousEnd: start.toISOString() };
}

function csvCell(value: string | number) { let text = String(value); if (/^[=+\-@]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; }
function downloadCsv(name: string, rows: Array<Array<string | number>>) {
  const url = URL.createObjectURL(new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

export function AdminReportsSection() {
  const now = new Date();
  const [periodName, setPeriodName] = useState<PeriodName>("currentMonth");
  const [customStart, setCustomStart] = useState(inputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(inputDate(now));
  const [filters, setFilters] = useState(emptyFilters);
  const [options, setOptions] = useState<{ professionals: Array<{id:string;name:string}>; services: Array<{id:string;name:string}>; categories:string[] }>({ professionals: [], services: [], categories: [] });
  const [report, setReport] = useState<AdminReport | null>(null);
  const [metric, setMetric] = useState<Metric>("revenue");
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const period = useMemo(() => getPeriod(periodName, customStart, customEnd), [periodName, customStart, customEnd]);
  const load = useCallback(async () => {
    if (!period) { setError("Informe um período válido de até 366 dias."); setLoading(false); return; }
    setLoading(true); setError("");
    try { setReport(await getAdminReport(period, filters)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar o relatório."); }
    finally { setLoading(false); }
  }, [filters, period]);
  useEffect(() => { getAdminReportOptions().then(setOptions).catch(() => setError("Não foi possível carregar os filtros.")); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 120); return () => window.clearTimeout(timer); }, [load]);

  function exportCsv() {
    if (!report || !period) return;
    const suffix = `${period.start.slice(0,10)}-${new Date(new Date(period.end).getTime()-1).toISOString().slice(0,10)}`;
    downloadCsv(`atendimentos-${suffix}.csv`, [["Data","Cliente","Profissional","Serviço","Categoria","Pagamento","Valor"], ...report.rows.map((row) => [row.date,row.clientName,row.professionalName,row.serviceName,row.category,row.paymentStatus,row.amount.toFixed(2)])]);
    downloadCsv(`financeiro-${suffix}.csv`, [["Competência","Tipo","Nome/Categoria","Recorrência","Valor"], [period.start.slice(0,10),"Resumo","Receita recebida","",report.summary.revenue.toFixed(2)], [period.start.slice(0,10),"Resumo","Custos fixos","",report.summary.fixedCosts.toFixed(2)], [period.start.slice(0,10),"Resumo","Resultado operacional estimado","",report.summary.operationalResult.toFixed(2)], ...report.costOccurrences.map((item) => [item.date,"Custo",`${item.name} / ${item.category}`,item.recurrence,item.amount.toFixed(2)])]);
  }

  return <div className="admin-reports-section">
    <div className="reports-heading"><div><h2>Relatórios e desempenho</h2><p>Receita, custos e resultado operacional estimado.</p></div><button className="button button--outline button-with-icon" disabled={!report || loading} onClick={exportCsv}><Download /> Exportar CSVs</button></div>
    <section className="report-controls" aria-label="Filtros do relatório">
      <label>Período<select value={periodName} onChange={(event) => setPeriodName(event.target.value as PeriodName)}><option value="currentMonth">Mês atual</option><option value="previousMonth">Mês anterior</option><option value="30days">Últimos 30 dias</option><option value="90days">Últimos 90 dias</option><option value="currentYear">Ano atual</option><option value="custom">Personalizado</option></select></label>
      {periodName === "custom" && <label>Início<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>}
      {periodName === "custom" && <label>Fim<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>}
      <Option label="Profissional" value={filters.professionalId} options={options.professionals} onChange={(value) => setFilters({...filters, professionalId:value})} />
      <Option label="Serviço" value={filters.serviceId} options={options.services} onChange={(value) => setFilters({...filters, serviceId:value})} />
      <Option label="Categoria" value={filters.category} options={options.categories.map((name) => ({id:name,name}))} onChange={(value) => setFilters({...filters, category:value})} />
      <label>Pagamento<select value={filters.paymentStatus} onChange={(event) => setFilters({...filters,paymentStatus:event.target.value})}><option value="all">Todos</option><option value="paid">Pago</option><option value="pending">Pendente</option></select></label>
      <button className="button button--outline" onClick={() => setFilters(emptyFilters)}>Limpar filtros</button>
    </section>
    {loading ? <div className="admin-data-message">Calculando relatório...</div> : error ? <div className="admin-data-message admin-data-message--error">{error}<button onClick={() => void load()}><RefreshCw /> Tentar novamente</button></div> : report && <ReportView report={report} metric={metric} onMetric={setMetric} />}
  </div>;
}

function Option({label,value,options,onChange}:{label:string;value:string;options:Array<{id:string;name:string}>;onChange:(value:string)=>void}) { return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}><option value="all">Todos</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>; }
function ReportView({report,metric,onMetric}:{report:AdminReport;metric:Metric;onMetric:(value:Metric)=>void}) {
  const summary=report.summary, max=Math.max(1,...report.timeline.map((item)=>Math.abs(item[metric])));
  return <><section className="report-kpis"><Kpi label="Receita recebida" value={money.format(summary.revenue)} detail={`${summary.paidCount} pagamento(s)`}/><Kpi label="Receita pendente" value={money.format(summary.pendingRevenue)} detail="Ainda não recebida"/><Kpi label="Custos fixos" value={money.format(summary.fixedCosts)} detail={summary.costCommitment===null?"Sem receita no período":`${summary.costCommitment.toFixed(1)}% comprometida`}/><Kpi label="Resultado operacional estimado" value={money.format(summary.operationalResult)} detail={summary.operationalMargin===null?"Sem receita no período":`Margem de ${summary.operationalMargin.toFixed(1)}%`}/></section>
    <p className="report-caption financial-note">Estimativa de receita recebida menos custos fixos. Não inclui impostos, custos variáveis ou outras despesas.</p>
    <section className="report-panel"><div className="report-panel-head"><div><h3>Evolução temporal</h3><p>Ocorrências na data de competência.</p></div><select value={metric} onChange={(event)=>onMetric(event.target.value as Metric)}><option value="revenue">Receita</option><option value="costs">Custos</option><option value="result">Resultado</option></select></div><div className="report-chart">{report.timeline.map((item)=><div key={item.label}><span>{money.format(item[metric])}</span><i className={item[metric]<0?"negative":""} style={{height:`${Math.max(4,Math.abs(item[metric])/max*100)}%`}}/><small>{item.label}</small></div>)}</div></section>
    <div className="report-two-columns"><section className="report-panel"><h3>Distribuição dos custos</h3>{report.costCategories.length?<div className="report-category-list">{report.costCategories.map((item)=><div key={item.name}><span><b>{item.name}</b><small>{money.format(item.amount)}</small></span><progress max="100" value={item.percentage}/><b>{item.percentage.toFixed(1)}%</b></div>)}</div>:<p className="report-empty">Nenhum custo no período.</p>}</section><section className="report-panel"><h3>Ocorrências de custos</h3><ReportTable heads={["Competência","Custo","Categoria","Valor"]} rows={report.costOccurrences.map((item)=>[item.date,item.name,item.category,money.format(item.amount)])}/></section></div>
    <section className="report-panel"><h3>Serviços</h3><ReportTable heads={["Serviço","Concluídos","Receita"]} rows={report.services.map((item)=>[item.name,item.completed,money.format(item.revenue)])}/></section></>;
}
function Kpi({label,value,detail}:{label:string;value:string;detail:string}) { return <article><span>{label}</span><b>{value}</b><small>{detail}</small></article>; }
function ReportTable({heads,rows}:{heads:string[];rows:React.ReactNode[][]}) { if(!rows.length)return <p className="report-empty">Sem dados para este recorte.</p>;return <div className="report-table-wrap"><table><thead><tr>{heads.map((head)=><th key={head}>{head}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}>{row.map((cell,cellIndex)=><td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>; }
