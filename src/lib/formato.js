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
// Fecha de hoy (hora local) como AAAA-MM-DD, para campos de fecha
export function hoyLocal() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}

// ─── NOMBRES PARECIDOS (para no crear dos veces la misma obra con otra letra) ──
const normNombre = s => sinAcentos(s || "").replace(/[^a-z0-9ñ]+/g, " ").trim();
function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    for (let j = 1; j <= b.length; j++) fila[j] = Math.min(prev[j] + 1, fila[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = fila;
  }
  return prev[b.length];
}
// Mismo nombre salvo mayúsculas, acentos o signos, o con 1-2 letras distintas ("Spensieri" / "Spencieri")
export function nombresParecidos(a, b) {
  const x = normNombre(a), y = normNombre(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // Números distintos (sucursal 217 / 218, piso 26 / 27) son obras distintas
  if ((x.match(/\d+/g) || []).join(",") !== (y.match(/\d+/g) || []).join(",")) return false;
  const largo = Math.min(x.length, y.length);
  const tolerancia = largo >= 12 ? 2 : largo >= 6 ? 1 : 0;
  return tolerancia > 0 && distancia(x, y) <= tolerancia;
}
// De una lista de { nombre }, los que se parecen a "nombre" (sin contar uno exactamente igual a "excepto")
export function buscarParecidos(nombre, lista, excepto) {
  return lista.filter(x => x.nombre && x.nombre !== excepto && nombresParecidos(nombre, x.nombre));
}
