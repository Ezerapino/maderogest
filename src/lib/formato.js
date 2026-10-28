// Fechas, montos y textos

export const LOGO_AIXA = "/logo-aixa.png";

// ─── UTILS ────────────────────────────────────────────────────────────────────
export function diasRestantes(fecha) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const f = new Date(fecha + "T00:00:00");
  return Math.ceil((f - hoy) / 86400000);
}
export function getStatus(dias, estado) {
  if (estado === "terminado") return "done";
  if (dias < 0) return "vencida";
  if (dias <= 7) return "urgent";
  if (dias <= 21) return "warning";
  return "ok";
}
export function formatDate(d) { if (!d) return ""; const [y,m,dia] = d.split("-"); return `${dia}/${m}/${y}`; }
export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
export function fmtDateAixa(d) { if(!d) return '—'; const[y,m,day]=(d.split('T')[0]).split('-'); return `${day}/${m}/${y}`; }
export function fmtDateTimeAixa(iso) { return new Date(iso).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
export function calcDurMinAixa(start_date, end_date, start_time, end_time) {
  if (!start_time || !end_time) return null;
  const d1 = (start_date || '2000-01-01').split('T')[0], d2 = (end_date || d1).split('T')[0];
  let min = Math.round((new Date(`${d2}T${end_time}`) - new Date(`${d1}T${start_time}`)) / 60000);
  if (min < 0 && d1 === d2) min += 1440;
  return min >= 0 ? min : null;
}
export function fmtDurAixa(min) { if (min == null || min === '') return ''; const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`; }
export const pesos = n => `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
export const sinAcentos = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function diasHastaFecha(fecha) {
  if (!fecha) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const [y,m,d] = fecha.split("T")[0].split("-").map(Number);
  return Math.round((new Date(y, m-1, d) - hoy) / 86400000);
}
export function textoDiasEntrega(dias) { return dias < 0 ? `vencida hace ${-dias} día${dias === -1 ? "" : "s"}` : dias === 0 ? "entrega hoy" : `faltan ${dias} día${dias === 1 ? "" : "s"}`; }
