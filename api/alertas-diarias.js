// Avisos por email (los disparan los cron de Vercel, ver vercel.json):
//  - tipo=entregas: lunes y jueves, obras con entrega en los próximos 10 días y vencidas sin marcar.
//  - tipo=materiales: todos los días, obras con entrega en 10 días o menos con materiales sin pedir o sin recibir.
// Un admin también puede llamarlo desde la app: ?preview=1 devuelve el resumen sin mandarlo.
//
// Variables en Vercel: ALERTAS_EMAILS (separados por coma), CRON_SECRET y una forma de envío:
//  - SMTP del hosting (preferido, Hostmar rechaza como spam lo que llega por Resend):
//    SMTP_USER (la casilla, ej. alertas@grupoaixa.com.ar), SMTP_PASSWORD,
//    opcionales SMTP_HOST (c207.ferozo.com) y SMTP_PORT (465).
//  - Resend: RESEND_API_KEY y ALERTAS_REMITENTE (ej. "MaderoGest <alertas@grupoaixa.com.ar>").
import nodemailer from "nodemailer";
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
  const [{ data: todas, error: e1 }, { data: todasLasListas, error: e2 }] = await Promise.all([
    db.from("obras").select("id, nombre, lugar, fecha, estado, archivada"),
    db.from("materiales").select("obra_id, obra_nombre, items"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  // Lo archivado no se avisa
  const archivadas = new Set(todas.filter(o => o.archivada).map(o => o.id));
  const obras = todas.filter(o => !o.archivada);
  const listas = todasLasListas.filter(l => !archivadas.has(l.obra_id));
  const hoy = hoyArgentina();

  // Obras sin entregar con fecha dentro de los próximos DIAS_ALERTA días o ya vencida
  const enVentana = [];
  for (const o of obras) {
    if (o.estado === "terminado" || !o.fecha) continue;
    const dias = diasEntre(hoy, o.fecha);
    if (dias > DIAS_ALERTA) continue;
    const lista = listas.find(l => l.obra_id === o.id) || listas.find(l => norm(l.obra_nombre) === norm(o.nombre));
    const items = lista?.items || [];
    const faltaPedir = items.filter(i => !i.estado || i.estado === "pendiente");
    const faltaRecibir = items.filter(i => i.estado === "pedido" || i.estado === "parcial");
    enVentana.push({ obra: o, dias, items, tieneLista: !!lista, faltaPedir, faltaRecibir });
  }
  enVentana.sort((a, b) => a.dias - b.dias);
  return {
    hoy,
    proximas: enVentana.filter(x => x.dias >= 0),
    vencidas: enVentana.filter(x => x.dias < 0),
    conFaltantes: enVentana.filter(x => x.faltaPedir.length || x.faltaRecibir.length),
  };
}

// ─── Armado de los mails ─────────────────────────────────────────────────────
function lugar(obra) { return obra.lugar && obra.lugar !== "-" ? obra.lugar : ""; }
function estadoMateriales({ items, tieneLista, faltaPedir, faltaRecibir }) {
  if (!tieneLista || !items.length) return "sin materiales cargados";
  if (!faltaPedir.length && !faltaRecibir.length) return "materiales completos";
  return [faltaPedir.length && `falta pedir ${faltaPedir.length}`, faltaRecibir.length && `falta recibir ${faltaRecibir.length}`].filter(Boolean).join(", ");
}

function marco(titulo, cuerpo) {
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1E293B">
    <div style="background:#1A2B4A;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.7">Obras Grupo Aixa S.A. · MaderoGest</div>
      <div style="font-size:20px;font-weight:800;margin-top:4px">${titulo}</div>
    </div>
    <div style="padding:18px 22px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 10px 10px">
      ${cuerpo}
      <p style="margin:22px 0 0"><a href="${APP_URL}" style="background:#0F766E;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600">Abrir MaderoGest</a></p>
    </div></div>`;
}

// Lunes y jueves: entregas de los próximos días (y vencidas sin marcar)
function mailEntregas({ hoy, proximas, vencidas }) {
  const fila = x => {
    const est = estadoMateriales(x);
    const colorEst = est === "materiales completos" ? "#059669" : est === "sin materiales cargados" ? "#94A3B8" : "#DC2626";
    return `<tr>
      <td style="padding:9px 10px;border-bottom:1px solid #E2E8F0;font-size:13px"><b>${esc(x.obra.nombre)}</b>${lugar(x.obra) ? `<div style="color:#64748B;font-size:12px">${esc(lugar(x.obra))}</div>` : ""}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #E2E8F0;font-size:13px;white-space:nowrap">${fmtFecha(x.obra.fecha)}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #E2E8F0;font-size:13px;white-space:nowrap;font-weight:700;color:${x.dias <= 3 ? "#DC2626" : "#B45309"}">${textoDias(x.dias)}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #E2E8F0;font-size:12px;color:${colorEst}">${est}</td>
    </tr>`;
  };
  const tabla = filas => `<table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      <tr style="background:#F8FAFC;text-align:left;font-size:11px;color:#64748B;text-transform:uppercase">
        <th style="padding:8px 10px">Obra</th><th style="padding:8px 10px">Entrega</th><th style="padding:8px 10px">Plazo</th><th style="padding:8px 10px">Materiales</th>
      </tr>${filas.map(fila).join("")}</table>`;
  const cuerpo = `
    ${proximas.length ? `<h3 style="font-size:15px;color:#1A2B4A;margin:0 0 10px">📅 Entregas de los próximos ${DIAS_ALERTA} días (${proximas.length})</h3>${tabla(proximas)}` : `<p style="font-size:13px;color:#64748B">No hay entregas en los próximos ${DIAS_ALERTA} días.</p>`}
    ${vencidas.length ? `<h3 style="font-size:15px;color:#DC2626;margin:20px 0 10px">⏰ Vencidas sin marcar como entregadas (${vencidas.length})</h3>${tabla(vencidas)}` : ""}`;
  const texto = [
    `Obras Grupo Aixa S.A. - MaderoGest`, `Entregas próximas - ${fmtFecha(hoy)}`, "",
    ...(proximas.length
      ? [`ENTREGAS DE LOS PROXIMOS ${DIAS_ALERTA} DIAS (${proximas.length})`, ...proximas.map(x => `- ${x.obra.nombre}${lugar(x.obra) ? ` (${lugar(x.obra)})` : ""}: ${fmtFecha(x.obra.fecha)}, ${textoDias(x.dias)} - ${estadoMateriales(x)}`), ""]
      : [`No hay entregas en los próximos ${DIAS_ALERTA} días.`, ""]),
    ...(vencidas.length ? [`VENCIDAS SIN MARCAR COMO ENTREGADAS (${vencidas.length})`, ...vencidas.map(x => `- ${x.obra.nombre}: ${fmtFecha(x.obra.fecha)}, ${textoDias(x.dias)}`), ""] : []),
    `Abrir MaderoGest: ${APP_URL}`,
  ].join("\n");
  const n = proximas.length;
  return {
    total: proximas.length + vencidas.length,
    asunto: `MaderoGest: ${n} entrega${n !== 1 ? "s" : ""} en los próximos ${DIAS_ALERTA} días${vencidas.length ? ` y ${vencidas.length} vencida${vencidas.length !== 1 ? "s" : ""}` : ""}`,
    html: marco(`Entregas próximas — ${fmtFecha(hoy)}`, cuerpo),
    texto,
  };
}

// Diario: obras próximas a entregar con materiales sin pedir o sin recibir
function mailMateriales({ hoy, conFaltantes }) {
  const bloque = ({ obra, dias, faltaPedir, faltaRecibir }) => `
    <div style="border:1px solid #FECACA;border-left:4px solid #DC2626;border-radius:8px;padding:12px 14px;margin-bottom:10px;background:#FEF2F2">
      <div style="font-size:15px;font-weight:700;color:#1A2B4A">${esc(obra.nombre)}${lugar(obra) ? ` <span style="font-weight:400;color:#64748B">— ${esc(lugar(obra))}</span>` : ""}</div>
      <div style="font-size:13px;font-weight:700;color:#DC2626;margin:4px 0 8px">📅 ${fmtFecha(obra.fecha)} · ${textoDias(dias)}</div>
      ${faltaPedir.length ? `<div style="font-size:13px;color:#92400E;margin-bottom:4px">🛒 <b>Falta pedir (${faltaPedir.length}):</b> ${faltaPedir.map(i => esc(detalle(i))).join(" · ")}</div>` : ""}
      ${faltaRecibir.length ? `<div style="font-size:13px;color:#1E40AF">🚚 <b>Falta recibir (${faltaRecibir.length}):</b> ${faltaRecibir.map(i => esc(detalle(i) + (i.proveedor ? ` — ${i.proveedor}` : ""))).join(" · ")}</div>` : ""}
    </div>`;
  const cuerpo = `<h3 style="font-size:15px;color:#DC2626;margin:0 0 12px">⚠ Obras con entrega en ${DIAS_ALERTA} días o menos y materiales faltantes (${conFaltantes.length})</h3>${conFaltantes.map(bloque).join("")}`;
  const texto = [
    `Obras Grupo Aixa S.A. - MaderoGest`, `Materiales faltantes - ${fmtFecha(hoy)}`, "",
    ...conFaltantes.flatMap(({ obra, dias, faltaPedir, faltaRecibir }) => [
      `- ${obra.nombre}${lugar(obra) ? ` (${lugar(obra)})` : ""}: entrega ${fmtFecha(obra.fecha)}, ${textoDias(dias)}`,
      ...(faltaPedir.length ? [`  Falta pedir: ${faltaPedir.map(detalle).join("; ")}`] : []),
      ...(faltaRecibir.length ? [`  Falta recibir: ${faltaRecibir.map(i => detalle(i) + (i.proveedor ? ` - ${i.proveedor}` : "")).join("; ")}`] : []),
      "",
    ]),
    `Abrir MaderoGest: ${APP_URL}`,
  ].join("\n");
  const n = conFaltantes.length;
  return {
    total: n,
    asunto: `MaderoGest: ${n} obra${n !== 1 ? "s" : ""} con entrega próxima y materiales faltantes`,
    html: marco(`Materiales faltantes — ${fmtFecha(hoy)}`, cuerpo),
    texto,
  };
}

async function enviarEmail(asunto, html, text) {
  const destinos = (process.env.ALERTAS_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!destinos.length) throw httpError(500, "Falta configurar ALERTAS_EMAILS en Vercel.");

  const smtpUser = (process.env.SMTP_USER || "").trim();
  if (smtpUser) {
    const transporte = nodemailer.createTransport({
      host: (process.env.SMTP_HOST || "c207.ferozo.com").trim(),
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: smtpUser, pass: process.env.SMTP_PASSWORD || "" },
    });
    try {
      // El remitente tiene que ser la misma casilla con la que se autentica
      await transporte.sendMail({ from: `MaderoGest <${smtpUser}>`, to: destinos, subject: asunto, html, text });
    } catch (e) {
      const auth = e.responseCode === 535 || e.code === "EAUTH";
      throw httpError(502, auth ? "El servidor de correo rechazó el usuario o la contraseña (revisá SMTP_USER y SMTP_PASSWORD en Vercel)." : `No se pudo enviar por el correo del hosting: ${e.response || e.message}`);
    }
    return { destinos: destinos.length, via: "smtp" };
  }

  const key = (process.env.RESEND_API_KEY || "").trim();
  const remitente = (process.env.ALERTAS_REMITENTE || "MaderoGest <onboarding@resend.dev>").trim();
  if (!key) throw httpError(500, "Falta configurar SMTP_USER/SMTP_PASSWORD (o RESEND_API_KEY) en Vercel.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: remitente, to: destinos, subject: asunto, html, text }),
  });
  if (!r.ok) throw httpError(502, `Resend rechazó el envío: ${await r.text()}`);
  return { destinos: destinos.length, via: "resend" };
}

// ?tipo=entregas (cron lunes y jueves) | ?tipo=materiales (cron diario, por defecto)
export default async function handler(req, res) {
  try {
    const secreto = (process.env.CRON_SECRET || "").trim();
    const esCron = secreto && req.headers.authorization === `Bearer ${secreto}`;
    if (!esCron) await getCaller(req, ["admin"]);

    const tipo = req.query?.tipo === "entregas" ? "entregas" : "materiales";
    const resumen = await armarResumen(adminClient());
    const mail = tipo === "entregas" ? mailEntregas(resumen) : mailMateriales(resumen);

    if (req.query?.preview === "1") return res.status(200).json({ tipo, total: mail.total, asunto: mail.asunto, html: mail.html });
    if (!mail.total) return res.status(200).json({ tipo, enviado: false, motivo: tipo === "entregas" ? `No hay entregas en los próximos ${DIAS_ALERTA} días.` : "Ninguna obra próxima a entregar tiene materiales faltantes." });
    const envio = await enviarEmail(mail.asunto, mail.html, mail.texto);
    res.status(200).json({ tipo, enviado: true, total: mail.total, ...envio });
  } catch (e) { sendError(res, e); }
}
