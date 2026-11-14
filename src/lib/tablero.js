// Tablero del taller para imprimir y pegar en la pizarra:
// una fila por entrega en curso y una columna por estación, con casilleros vacíos para tildar a mano
import { avisar } from "./avisos.js";
import { sbFetch } from "./datos.js";
import { diasRestantes, formatDate, hoyLocal } from "./formato.js";
import { mkStations } from "./produccion.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ESTACIONES_BASE = mkStations().map(s => s.name);
const lista = ids => `in.(${ids.map(id => `"${id}"`).join(",")})`;

// Nombres de las estaciones (avance_obras) y fecha de aceptación (obras_aceptadas) de cada entrega
async function datosTablero(entregas) {
  const ids = entregas.map(e => e.id), proys = [...new Set(entregas.map(e => e.proyecto_id).filter(Boolean))];
  const pedir = ruta => sbFetch(ruta).catch(err => { console.error("Tablero:", err); return []; });
  const [prod, acep] = await Promise.all([
    ids.length ? pedir(`avance_obras?select=obra_id,stations&obra_id=${lista(ids)}`) : [],
    proys.length ? pedir(`obras_aceptadas?select=proyecto_id,fecha_aceptacion&proyecto_id=${lista(proys)}`) : [],
  ]);
  return entregas.map(e => {
    const st = prod.find(p => p.obra_id === e.id)?.stations;
    const aceptacion = acep.filter(a => a.proyecto_id === e.proyecto_id && a.fecha_aceptacion).map(a => a.fecha_aceptacion).sort()[0] || null;
    return { e, estaciones: (st?.length ? st : mkStations()).map(s => s.name), aceptacion };
  });
}

function textoDias(fecha) {
  if (!fecha) return "Sin fecha de entrega";
  const d = diasRestantes(fecha);
  return d < 0 ? `Vencida hace ${-d} día${d === -1 ? "" : "s"}` : d === 0 ? "¡Se entrega HOY!" : `Faltan ${d} día${d === 1 ? "" : "s"}`;
}
const colorDias = fecha => { if (!fecha) return "#475569"; const d = diasRestantes(fecha); return d <= 7 ? "#DC2626" : "#1A2B4A"; };

export async function imprimirTableroGeneral(entregas) {
  if (!entregas.length) { avisar("No hay entregas en curso para armar el tablero.", { tipo: "aviso" }); return; }
  // La ventana se abre antes de leer los datos para que el navegador no la bloquee
  const win = window.open("", "_blank");
  if (!win) { avisar("El navegador bloqueó la ventana. Permití las ventanas emergentes para imprimir el tablero.", { tipo: "aviso" }); return; }
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Preparando…</title></head><body style="font-family:Arial;padding:40px;color:#64748B">Preparando el tablero…</body></html>`);
  const filas = (await datosTablero(entregas)).sort((a, b) => (a.e.fecha || "9999").localeCompare(b.e.fecha || "9999"));
  // Columnas: las estaciones de siempre, más las que alguna obra tenga de más
  const columnas = [...ESTACIONES_BASE];
  filas.forEach(f => f.estaciones.forEach(n => { if (!columnas.includes(n)) columnas.push(n); }));
  const cuerpo = filas.map(({ e, estaciones, aceptacion }) => `<tr>
      <td class="obra"><b>${esc(e.nombre)}</b><span>${esc(e.lugar || "")}</span><span>Aceptada: ${aceptacion ? formatDate(aceptacion) : "—"}</span></td>
      <td class="ent" style="color:${colorDias(e.fecha)}"><b>${e.fecha ? formatDate(e.fecha).slice(0, 5) : "S/F"}</b><span>${e.fecha ? formatDate(e.fecha).slice(6) + " · " : ""}${textoDias(e.fecha)}</span></td>
      ${columnas.map(n => estaciones.includes(n) ? `<td><div class="check"></div></td>` : `<td class="na">—</td>`).join("")}</tr>`).join("");
  win.document.open();
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Tablero del taller</title>
<style>*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#1A2B4A;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:landscape;margin:10mm}
.barra{position:sticky;top:0;background:#1A2B4A;color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center;font-size:13px;z-index:5}
.barra button{background:#fff;color:#1A2B4A;border:none;border-radius:6px;padding:7px 14px;font-weight:700;cursor:pointer}@media print{.barra{display:none}}
.cab{display:flex;justify-content:space-between;align-items:flex-end;padding:4mm 2mm 10px}.cab h1{margin:0;font-size:34px;font-weight:900}.cab div{font-size:13px;color:#64748B;text-align:right}
table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{page-break-inside:avoid;break-inside:avoid}
th{background:#1A2B4A;color:#fff;font-size:13px;padding:8px 4px;border:2px solid #1A2B4A}td{border:2px solid #1A2B4A;text-align:center;vertical-align:middle;padding:6px 4px;height:84px}
td.obra{text-align:left;padding:6px 10px}td.obra b{display:block;font-size:19px;line-height:1.15}td.obra span{display:block;font-size:11px;color:#64748B;margin-top:2px}
td.ent b{display:block;font-size:34px;font-weight:900;line-height:1}td.ent span{display:block;font-size:11px;font-weight:700;margin-top:3px}
.check{width:44px;height:44px;border:3px solid #1A2B4A;border-radius:8px;margin:0 auto}td.na{color:#CBD5E1;background:#F8FAFC}
.ref{margin-top:10px;font-size:11px;color:#DC2626;font-weight:700}
</style></head><body><div class="barra"><button onclick="print()">Imprimir / Guardar PDF</button><span>${filas.length} entrega${filas.length === 1 ? "" : "s"} en curso, ordenadas por fecha de entrega · horizontal · A3 recomendado</span></div>
<div class="cab"><h1>Tablero del taller</h1><div>Grupo Aixa · Impreso el ${formatDate(hoyLocal())}<br>Tildá cada estación al terminarla</div></div>
<table><colgroup><col style="width:23%"><col style="width:14%">${columnas.map(() => `<col>`).join("")}</colgroup>
<thead><tr><th>Obra</th><th>Entrega</th>${columnas.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${cuerpo}</tbody></table>
<div class="ref">Fecha en rojo: vence en 7 días o menos (al día de impresión)</div>
</body></html>`);
  win.document.close();
}
