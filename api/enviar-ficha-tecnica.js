// Manda por mail una ficha técnica de mobiliario FIRMADA (Avance de Obra), con el PDF firmado adjunto,
// desde la casilla de alertas (la misma de las alertas de entregas y materiales), a la lista fija
// (o a "para" con la lista fija en copia).
//   POST /api/enviar-ficha-tecnica  { fichaId, para? }
import { adminClient, getCaller, httpError, readJson, sendError } from "./_lib.js";
import { emailsValidos, enviarEmail, esc, marcoMail } from "./_email.js";

const fmtFechaHora = iso => new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " h";
const numero = f => `${String(f.numero).padStart(4, "0")}${f.revision > 1 ? ` · Rev. ${f.revision}` : ""}`;

function fila(label, valor) {
  return valor ? `<tr><td style="padding:6px 10px 6px 0;font-size:12px;color:#64748B;font-weight:700;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:6px 0;font-size:14px">${esc(valor)}</td></tr>` : "";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Método no permitido" }); }
    const caller = await getCaller(req, ["admin", "arquitecto"]);
    const { fichaId, para } = await readJson(req);
    if (!fichaId) throw httpError(400, "Falta la ficha.");
    const destinatarios = emailsValidos(para);

    const db = adminClient();
    const { data: ficha } = await db.from("fichas_tecnicas").select("*").eq("id", fichaId).maybeSingle();
    if (!ficha) throw httpError(404, "No se encontró la ficha.");
    if (!ficha.firmado_en || !ficha.pdf?.url) throw httpError(400, "La ficha todavía no está firmada.");
    const { data: obra } = await db.from("obras_avance").select("nombre,direccion").eq("id", ficha.obra_id).maybeSingle();

    const d = ficha.datos || {}, firma = ficha.firma || {};
    const nombreObra = obra?.nombre || "Obra";
    const ambiente = d.ambiente || (ficha.alcance === "obra" ? "Toda la obra" : "");
    const materiales = (d.materiales || []).filter(m => m.marca || m.color || m.espesor)
      .map(m => `<tr><td style="padding:5px 10px 5px 0;font-size:13px;font-weight:600">${esc(m.componente)}</td><td style="padding:5px 0;font-size:13px">${esc([m.marca, m.color, m.espesor].filter(Boolean).join(" · "))}</td></tr>`).join("");

    const cuerpo = `
      <p style="font-size:14px;margin:0 0 6px">Se comparte la ficha técnica de mobiliario N° <b>${esc(numero(ficha))}</b> de la obra <b>${esc(nombreObra)}</b>${ambiente ? ` (${esc(ambiente)})` : ""}.</p>
      <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:12px 14px;margin:12px 0;font-size:14px;color:#065F46;line-height:1.5">
        <b>Diseño y materiales aprobados</b> por ${esc(firma.nombre)}${firma.cargo ? ` (${esc(firma.cargo)})` : ""} el ${fmtFechaHora(ficha.firmado_en)}.<br>
        Va adjunta la ficha firmada en PDF. <a href="${esc(ficha.pdf.url)}" style="color:#047857">Ver el PDF</a></div>
      <table style="border-collapse:collapse;margin-top:8px">
        ${fila("Cliente", d.cliente)}${fila("Ambiente", ambiente)}${fila("Tipo de mueble", d.tipoMueble)}${fila("Dirección de obra", d.direccionObra || obra?.direccion)}${fila("Responsable", d.responsable)}
      </table>
      ${materiales ? `<h3 style="font-size:15px;color:#1A2B4A;margin:20px 0 8px;padding-bottom:6px;border-bottom:2px solid #ff6b35">Materiales</h3><table style="border-collapse:collapse">${materiales}</table>` : ""}
      <p style="font-size:12px;color:#94A3B8;margin-top:18px">Enviado por ${esc(caller.nombre)} desde MaderoGest.</p>`;
    const texto = [
      `Ficha técnica de mobiliario N° ${numero(ficha)} — ${nombreObra}${ambiente ? ` (${ambiente})` : ""}`,
      `Aprobada por ${firma.nombre}${firma.cargo ? ` (${firma.cargo})` : ""} el ${fmtFechaHora(ficha.firmado_en)}.`,
      `PDF firmado: ${ficha.pdf.url}`,
    ].join("\n");

    const envio = await enviarEmail({
      asunto: `Ficha técnica firmada N° ${numero(ficha)}: ${nombreObra}${ambiente && ambiente !== "Toda la obra" ? ` · ${ambiente}` : ""}`,
      html: marcoMail(`Ficha técnica — ${esc(nombreObra)}`, cuerpo),
      text: texto, para: destinatarios,
      adjuntos: [{ filename: ficha.pdf.name || `Ficha tecnica ${ficha.numero}.pdf`, path: ficha.pdf.url, contentType: "application/pdf" }],
    });
    res.status(200).json({ enviado: true, ...envio });
  } catch (e) { sendError(res, e); }
}
