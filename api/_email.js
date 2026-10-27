// Envío de mails desde la casilla de alertas (SMTP del hosting, o Resend como alternativa).
// Siempre van a la lista fija ALERTAS_EMAILS; si se indica "para", esos van como destinatarios
// y la lista fija en copia.
//
// Variables en Vercel: ALERTAS_EMAILS (separados por coma) y una forma de envío:
//  - SMTP del hosting (preferido, Hostmar rechaza como spam lo que llega por Resend):
//    SMTP_USER (la casilla, ej. alertas@grupoaixa.com.ar), SMTP_PASSWORD,
//    opcionales SMTP_HOST (c207.ferozo.com) y SMTP_PORT (465).
//  - Resend: RESEND_API_KEY y ALERTAS_REMITENTE (ej. "MaderoGest <alertas@grupoaixa.com.ar>").
import nodemailer from "nodemailer";
import { httpError } from "./_lib.js";

export const APP_URL = "https://maderogest.vercel.app";

// Link a la ficha de una obra (mismo formato que linkFicha en la app: /obra/<id>/<nombre-legible>)
export function linkFicha(proyecto) {
  if (!proyecto?.id) return APP_URL;
  const nombre = (proyecto.nombre || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${APP_URL}/obra/${encodeURIComponent(proyecto.id)}/${nombre}`;
}

export function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }

// Direcciones escritas a mano ("a@b.com, c@d.com"): devuelve las válidas o lanza error
export function emailsValidos(texto) {
  const lista = String(texto || "").split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
  const malos = lista.filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (malos.length) throw httpError(400, `Dirección de email inválida: ${malos.join(", ")}`);
  if (lista.length > 10) throw httpError(400, "Máximo 10 destinatarios.");
  return lista;
}

// Marco común de los mails de MaderoGest
export function marcoMail(titulo, cuerpo, subtitulo = "Obras Grupo Aixa S.A. · MaderoGest") {
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:680px;margin:0 auto;color:#1E293B">
    <div style="background:#1A2B4A;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.7">${esc(subtitulo)}</div>
      <div style="font-size:20px;font-weight:800;margin-top:4px">${titulo}</div>
    </div>
    <div style="padding:18px 22px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 10px 10px">
      ${cuerpo}
      <p style="margin:22px 0 0"><a href="${APP_URL}" style="background:#0F766E;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600">Abrir MaderoGest</a></p>
    </div></div>`;
}

// adjuntos: [{ filename, path (URL pública) }]
export async function enviarEmail({ asunto, html, text, para = [], adjuntos = [] }) {
  const fijos = (process.env.ALERTAS_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!fijos.length) throw httpError(500, "Falta configurar ALERTAS_EMAILS en Vercel.");
  const to = para.length ? para : fijos;
  const cc = para.length ? fijos.filter(f => !para.some(p => p.toLowerCase() === f.toLowerCase())) : [];

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
      await transporte.sendMail({ from: `MaderoGest <${smtpUser}>`, to, cc, subject: asunto, html, text, attachments: adjuntos });
    } catch (e) {
      const auth = e.responseCode === 535 || e.code === "EAUTH";
      throw httpError(502, auth ? "El servidor de correo rechazó el usuario o la contraseña (revisá SMTP_USER y SMTP_PASSWORD en Vercel)." : `No se pudo enviar por el correo del hosting: ${e.response || e.message}`);
    }
    return { destinos: to.length + cc.length, via: "smtp" };
  }

  const key = (process.env.RESEND_API_KEY || "").trim();
  const remitente = (process.env.ALERTAS_REMITENTE || "MaderoGest <onboarding@resend.dev>").trim();
  if (!key) throw httpError(500, "Falta configurar SMTP_USER/SMTP_PASSWORD (o RESEND_API_KEY) en Vercel.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: remitente, to, ...(cc.length ? { cc } : {}), subject: asunto, html, text, ...(adjuntos.length ? { attachments: adjuntos } : {}) }),
  });
  if (!r.ok) throw httpError(502, `Resend rechazó el envío: ${await r.text()}`);
  return { destinos: to.length + cc.length, via: "resend" };
}
