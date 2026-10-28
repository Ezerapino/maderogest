// Estaciones de producción y estado de cada entrega
import { avisar } from "./avisos.js";
import { calcDurMinAixa, diasRestantes, fmtDurAixa, getStatus } from "./formato.js";

export const ESTADO_LABELS = { pendiente: "Pendiente", en_proceso: "En proceso", terminado: "Terminado" };
export const STATUS_META = {
  urgent:  { color: "#e05555", bg: "rgba(224,85,85,0.13)", label: "URGENTE", icon: "🚨" },
  warning: { color: "#d4783a", bg: "rgba(212,120,58,0.13)", label: "PRÓXIMA", icon: "⏰" },
  ok:      { color: "#4a9a6a", bg: "rgba(74,154,106,0.12)", label: "A TIEMPO", icon: "✅" },
  done:    { color: "#6a8a9a", bg: "rgba(106,138,154,0.1)", label: "ENTREGADA", icon: "📦" },
  vencida: { color: "#c84040", bg: "rgba(200,64,64,0.18)", label: "VENCIDA", icon: "⛔" },
};

export function normalizarMuebles(muebles) {
  if (!muebles) return [];
  return muebles.map(m => typeof m === "string" ? { nombre: m, cantidad: 1 } : m);
}

// ─── AIXAOBRA UTILS ───────────────────────────────────────────────────────────
const STATION_NAMES = ['Programa','Corte','Enchapado','Agujereado','Armado y embalado','Listo para entregar'];
export function mkStations() { return STATION_NAMES.map((n,i)=>({id:i,name:n,status:'pending',start_date:null,end_date:null,note:''})); }

// Campos del formulario de una estación (Avance de Producción y ficha de obra)
export function camposEstacion(s) {
  return [
    { key:"status", label:"Estado", type:"select", options:[{v:"pending",l:"Pendiente"},{v:"active",l:"En progreso"},{v:"done",l:"Completado"},{v:"blocked",l:"Bloqueado"}], initial:s.status },
    { key:"operario", label:"Operario a cargo", type:"text", initial:s.operario||"" },
    { key:"start_date", label:"Fecha inicio", type:"date", initial:s.start_date?.split('T')[0]||"" },
    { key:"start_time", label:"Hora inicio", type:"time", initial:s.start_time||"" },
    { key:"end_date", label:"Fecha fin", type:"date", initial:s.end_date?.split('T')[0]||"" },
    { key:"end_time", label:"Hora fin", type:"time", initial:s.end_time||"" },
    { key:"duration_min", label:"Tiempo empleado (minutos) — si lo dejás vacío se calcula con las horas", type:"number", initial:s.duration_manual && s.duration_min != null ? String(s.duration_min) : "" },
    { key:"note", label:"Observación", type:"textarea", initial:s.note||"" },
  ];
}

// Aplica el cambio de una estación sobre la fila recién leída de avance_obras
export function cambioEstacion(o, nombre, idx, { status, start_date, end_date, start_time, end_time, duration_min, operario, note }, sesion) {
  const stations = o.stations || [];
  // Se busca por nombre por si otra persona agregó o borró estaciones mientras tanto
  const s = stations.find(x => x.name === nombre) || stations[idx];
  if (!s) throw new Error(`La estación "${nombre}" ya no existe.`);
  const old = s.status;
  s.status = status; s.start_date = start_date || null; s.end_date = end_date || null; s.note = note;
  s.start_time = start_time || null; s.end_time = end_time || null; s.operario = operario?.trim() || null;
  // Manual duration wins; otherwise derive it from the start/end times
  s.duration_manual = duration_min !== "" && duration_min != null;
  s.duration_min = s.duration_manual ? Math.max(0, Math.round(Number(duration_min))) : calcDurMinAixa(s.start_date, s.end_date, s.start_time, s.end_time);
  const hist = o.history || [];
  hist.unshift({ user: sesion.nombre, role: sesion.rol, action: `Estación "${s.name}": "${old}" → "${status}"${s.operario ? ' · Operario: '+s.operario : ''}${s.duration_min != null ? ' · '+fmtDurAixa(s.duration_min) : ''}${note ? ' — '+note : ''}`, time: new Date().toISOString() });
  return { stations, history: hist };
}
export function obraProgressAixa(o) { const st=o.stations||[]; return st.length ? Math.round(st.filter(s=>s.status==='done').length/st.length*100) : 0; }
export function isDelayedAixa(o) { if(!o.due_date||obraProgressAixa(o)===100) return false; const t=new Date(); t.setHours(0,0,0,0); return t>new Date(o.due_date); }
export function daysDelayedAixa(o) { if(!o.due_date)return 0; const t=new Date();t.setHours(0,0,0,0); return Math.floor((t-new Date(o.due_date))/86400000); }

// ─── WHATSAPP ─────────────────────────────────────────────────────────────────
export function enviarWhatsApp(obras, numero) {
  const activas = obras.filter(o => o.estado !== "terminado");
  const urgentes = activas.filter(o => diasRestantes(o.fecha) <= 7 && diasRestantes(o.fecha) >= 0);
  const proximas = activas.filter(o => diasRestantes(o.fecha) > 7 && diasRestantes(o.fecha) <= 21);
  const vencidas = activas.filter(o => diasRestantes(o.fecha) < 0);
  if (urgentes.length === 0 && proximas.length === 0 && vencidas.length === 0) { avisar("No hay obras con fechas próximas.", { tipo: "aviso" }); return; }
  let msg = `*OBRAS GRUPO AIXA S.A.*\nResumen de entregas\n${"—".repeat(30)}\n\n`;
  if (vencidas.length > 0) { msg += `*VENCIDAS (${vencidas.length})*\n`; vencidas.forEach(o => { msg += `- *${o.nombre}* — ${o.lugar} — Vencida hace ${Math.abs(diasRestantes(o.fecha))} días\n`; }); msg += "\n"; }
  if (urgentes.length > 0) { msg += `*URGENTES (${urgentes.length})*\n`; urgentes.forEach(o => { const d = diasRestantes(o.fecha); msg += `- *${o.nombre}* — ${o.lugar} — ${d === 0 ? "*HOY*" : `en ${d} días`}\n`; }); msg += "\n"; }
  if (proximas.length > 0) { msg += `*PRÓXIMAS (${proximas.length})*\n`; proximas.forEach(o => { msg += `- *${o.nombre}* — ${o.lugar} — en ${diasRestantes(o.fecha)} días\n`; }); }
  const num = (numero || "").replace(/\D/g, "");
  const url = num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.location.href = url;
}

// Estado de una entrega para las tarjetas (las entregas sin fecha no muestran días)
export function estadoEntrega(e) {
  if (e.estado === "terminado") return { status: "done", label: "Entregada" };
  if (!e.fecha) return { status: "ok", label: "Sin fecha" };
  const d = diasRestantes(e.fecha);
  return { status: getStatus(d, e.estado), label: d < 0 ? `Vencida hace ${-d} d` : d === 0 ? "Hoy" : `${d} día${d !== 1 ? "s" : ""}` };
}
export const SC_ENTREGA = {
  urgent: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" }, vencida: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  warning: { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" }, ok: { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" },
  done: { bg: "#F8FAFC", text: "#64748B", border: "#E2E8F0" },
};
export const PRIORIDAD_ESTADO = { vencida: 0, urgent: 1, warning: 2, ok: 3, done: 4 };

// ─── FICHA DE OBRA (todo lo de una obra en una página, y se edita desde acá) ──
export const ESTACION_COLORES = {
  done:    { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0", label: "Completada" },
  active:  { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A", label: "En progreso" },
  blocked: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA", label: "Bloqueada" },
  pending: { bg: "#F8FAFC", text: "#94A3B8", border: "#E2E8F0", label: "Pendiente" },
};
// Lo que falta cobrar: total menos adelanto cobrado, más adicionales sin cobrar
export function saldoDeCobro(c) {
  const adics = (c.adicionales || []).filter(a => !a.cobrado).reduce((s, a) => s + (Number(a.monto) || 0), 0);
  if (c.total_cobrado) return adics;
  return Math.max(0, (Number(c.monto_total) || 0) - (c.adelanto_cobrado ? Number(c.adelanto_monto) || 0 : 0)) + adics;
}
