// Resumen diario por email: obras con entrega en 10 días o menos (o vencida) a las que les faltan
// materiales, y obras con la entrega vencida. Lo dispara el cron de Vercel (ver vercel.json).
// Un admin también puede llamarlo desde la app: ?preview=1 devuelve el resumen sin mandarlo.
//
// Variables en Vercel: RESEND_API_KEY, ALERTAS_EMAILS (separados por coma),
// ALERTAS_REMITENTE (ej. "MaderoGest <alertas@grupoaixa.com>"), CRON_SECRET.
import { adminClient, getCaller, httpError, sendError } from "./_lib.js";

const DIAS_ALERTA = 10;
const APP_URL = "https://maderogest.vercel.app";

function hoyArgentina() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()); // YYYY-MM-DD
}
function diasEntre(desde, hasta) {
  const [a, b] = [desde, hasta].map(s => { const [y, m, d] = s.split("T")[0].split("-").map(Number); return Date.UTC(y, m - 1, d); });
  return Math.round((b - a) / 86400000);
}
function fmtFecha(f) { const [y, m, d] = f.split("T")[0].split("-"); return `${d}/${m}/${y}`; }
function norm(s) { return (s || "").trim().toLowerCase().replace(/\s+/g, " "); }
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
function detalle(it) {
  const cant = [it.cantidad, it.unidad].filter(Boolean).join(" ");
  if (it.estado === "parcial") return `${it.nombre}${it.cantidad_recibida ? ` (llegaron ${it.cantidad_recibida} de ${cant || "?"})` : " (llegó incompleto)"}`;
  return `${it.nombre}${cant ? ` (${cant})` : ""}`;
}
function textoDias(d) { return d < 0 ? `vencida hace ${-d} día${d === -1 ? "" : "s"}` : d === 0 ? "entrega HOY" : `faltan ${d} día${d === 1 ? "" : "s"}`; }

export async function armarResumen(db) {
  const [{ data: obras, error: e1 }, { data: listas, error: e2 }] = await Promise.all([
    db.from("obras").select("id, nombre, lugar, fecha, estado"),
    db.from("materiales").select("obra_id, obra_nombre, items"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const hoy = hoyArgentina();
  const activas = obras.filter(o => o.estado !== "terminado" && o.fecha);

  const conFaltantes = [];
  const vencidasSinFaltantes = [];
  for (const o of activas) {
    const dias = diasEntre(hoy, o.fecha);
    if (dias > DIAS_ALERTA) continue;
    const lista = listas.find(l => l.obra_id === o.id) || listas.find(l => norm(l.obra_nombre) === norm(o.nombre));
    const items = lista?.items || [];
    const faltaPedir = items.filter(i => !i.estado || i.estado === "pendiente");
    const faltaRecibir = items.filter(i => i.estado === "pedido" || i.estado === "parcial");
    if (faltaPedir.length || faltaRecibir.length) conFaltantes.push({ obra: o, dias, faltaPedir, faltaRecibir });
    else if (dias < 0) vencidasSinFaltantes.push({ obra: o, dias });
  }
  conFaltantes.sort((a, b) => a.dias - b.dias);
  vencidasSinFaltantes.sort((a, b) => a.dias - b.dias);
  return { hoy, conFaltantes, vencidasSinFaltantes };
}

function armarHtml({ hoy, conFaltantes, vencidasSinFaltantes }) {
  const bloqueObra = ({ obra, dias, faltaPedir, faltaRecibir }) => `
    <div style="border:1px solid #FECACA;border-left:4px solid #DC2626;border-radius:8px;padding:12px 14px;margin-bottom:10px;background:#FEF2F2">
      <div style="font-size:15px;font-weight:700;color:#1A2B4A">${esc(obra.nombre)}${obra.lugar && obra.lugar !== "-" ? ` <span style="font-weight:400;color:#64748B">— ${esc(obra.lugar)}</span>` : ""}</div>
      <div style="font-size:13px;font-weight:700;color:#DC2626;margin:4px 0 8px">📅 ${fmtFecha(obra.fecha)} · ${textoDias(dias)}</div>
      ${faltaPedir.length ? `<div style="font-size:13px;color:#92400E;margin-bottom:4px">🛒 <b>Falta pedir (${faltaPedir.length}):</b> ${faltaPedir.map(i => esc(detalle(i))).join(" · ")}</div>` : ""}
      ${faltaRecibir.length ? `<div style="font-size:13px;color:#1E40AF">🚚 <b>Falta recibir (${faltaRecibir.length}):</b> ${faltaRecibir.map(i => esc(detalle(i) + (i.proveedor ? ` — ${i.proveedor}` : ""))).join(" · ")}</div>` : ""}
    </div>`;
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1E293B">
    <div style="background:#1A2B4A;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.7">Obras Grupo Aixa S.A. · MaderoGest</div>
      <div style="font-size:20px;font-weight:800;margin-top:4px">Resumen diario — ${fmtFecha(hoy)}</div>
    </div>
    <div style="padding:18px 22px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 10px 10px">
      ${conFaltantes.length ? `<h3 style="font-size:15px;color:#DC2626;margin:0 0 12px">⚠ Entregas en ${DIAS_ALERTA} días o menos con materiales faltantes (${conFaltantes.length})</h3>${conFaltantes.map(bloqueObra).join("")}` : ""}
      ${vencidasSinFaltantes.length ? `<h3 style="font-size:15px;color:#B45309;margin:18px 0 8px">⏰ Entregas vencidas sin marcar como entregadas (${vencidasSinFaltantes.length})</h3>
        <ul style="font-size:13px;padding-left:18px;margin:0">${vencidasSinFaltantes.map(v => `<li><b>${esc(v.obra.nombre)}</b> — ${fmtFecha(v.obra.fecha)} (${textoDias(v.dias)})</li>`).join("")}</ul>` : ""}
      <p style="margin:22px 0 0"><a href="${APP_URL}" style="background:#0F766E;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600">Abrir MaderoGest</a></p>
    </div></div>`;
}

async function enviarEmail(asunto, html) {
  const key = (process.env.RESEND_API_KEY || "").trim();
  const destinos = (process.env.ALERTAS_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean);
  const remitente = (process.env.ALERTAS_REMITENTE || "MaderoGest <onboarding@resend.dev>").trim();
  if (!key) throw httpError(500, "Falta configurar RESEND_API_KEY en Vercel.");
  if (!destinos.length) throw httpError(500, "Falta configurar ALERTAS_EMAILS en Vercel.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: remitente, to: destinos, subject: asunto, html }),
  });
  if (!r.ok) throw httpError(502, `Resend rechazó el envío: ${await r.text()}`);
  return { destinos: destinos.length };
}

export default async function handler(req, res) {
  try {
    const secreto = (process.env.CRON_SECRET || "").trim();
    const esCron = secreto && req.headers.authorization === `Bearer ${secreto}`;
    if (!esCron) await getCaller(req, ["admin"]);

    const resumen = await armarResumen(adminClient());
    const total = resumen.conFaltantes.length + resumen.vencidasSinFaltantes.length;
    const asunto = resumen.conFaltantes.length
      ? `⚠ ${resumen.conFaltantes.length} obra${resumen.conFaltantes.length !== 1 ? "s" : ""} con entrega próxima y materiales faltantes`
      : `⏰ ${resumen.vencidasSinFaltantes.length} entrega${resumen.vencidasSinFaltantes.length !== 1 ? "s" : ""} vencida${resumen.vencidasSinFaltantes.length !== 1 ? "s" : ""}`;
    const html = armarHtml(resumen);

    if (req.query?.preview === "1") return res.status(200).json({ total, asunto, html });
    if (!total) return res.status(200).json({ enviado: false, motivo: "No hay alertas hoy." });
    const envio = await enviarEmail(asunto, html);
    res.status(200).json({ enviado: true, total, ...envio });
  } catch (e) { sendError(res, e); }
}
