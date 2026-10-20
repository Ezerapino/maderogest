// Manda por mail el informe final de una obra de Avance de Obra (el que está guardado),
// desde la casilla de alertas, a la lista fija (o a "para" con la lista fija en copia).
//   POST /api/enviar-informe-final  { obraAvanceId, para? }
import { adminClient, getCaller, httpError, readJson, sendError } from "./_lib.js";
import { emailsValidos, enviarEmail, esc, marcoMail } from "./_email.js";

const MAX_ADJUNTOS = 15 * 1024 * 1024; // lo que pasa de esto va como link

function fmtFecha(f) { if (!f) return ""; const [y, m, d] = String(f).split("T")[0].split("-"); return `${d}/${m}/${y}`; }
const esImagen = f => (f.type || "").startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(f.name || "");

function seccion(titulo, html) {
  return html ? `<h3 style="font-size:15px;color:#1A2B4A;margin:22px 0 10px;padding-bottom:6px;border-bottom:2px solid #ff6b35">${titulo}</h3>${html}` : "";
}
function campo(label, valor) {
  return valor ? `<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748B">${label}</div><div style="font-size:14px;white-space:pre-line">${esc(valor)}</div></div>` : "";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Método no permitido" }); }
    const caller = await getCaller(req, ["admin", "operario", "arquitecto"]);
    const { obraAvanceId, para } = await readJson(req);
    if (!obraAvanceId) throw httpError(400, "Falta la obra.");
    const destinatarios = emailsValidos(para);

    const db = adminClient();
    const { data: obra } = await db.from("obras_avance").select("*").eq("id", obraAvanceId).maybeSingle();
    if (!obra) throw httpError(404, "No se encontró la obra.");
    const { data: informe } = await db.from("informes_finales").select("*").eq("obra_id", obraAvanceId).maybeSingle();
    if (!informe) throw httpError(400, "Esta obra todavía no tiene un informe final guardado. Guardalo antes de enviarlo.");

    const d = informe.datos || {};
    const archivos = (informe.archivos || []).filter(f => f.url);
    const imagenes = archivos.filter(esImagen);
    const otros = archivos.filter(f => !esImagen(f));

    // Adjuntos hasta el límite; el resto queda como link
    let total = 0;
    const adjuntos = [];
    for (const f of archivos) {
      if (total + (f.size || 0) > MAX_ADJUNTOS) continue;
      total += f.size || 0;
      adjuntos.push({ filename: f.name, path: f.url });
    }

    const cuerpo = `
      <p style="font-size:14px;margin:0 0 6px">Se comparte el informe final de la obra <b>${esc(d.nombreObra || obra.nombre)}</b>.</p>
      ${seccion("Información general", campo("Obra", d.nombreObra || obra.nombre) + campo("Cliente", d.cliente) + campo("Dirección", d.direccion || obra.direccion)
        + campo("Fecha del informe", fmtFecha(d.fecha)) + campo("Etapa", d.etapa) + campo("Estudio / Arquitecto a cargo", d.estudioArquitecto))}
      ${seccion("Personal responsable", campo("Responsable (Estudio/Arquitecto)", d.responsableEstudio) + campo("Responsable (Grupo Aixa)", d.responsableEmpresa) + campo("Operarios", d.operarios))}
      ${seccion("Informe y aclaraciones", campo("Trabajo realizado", d.informe))}
      ${seccion("Pendientes a resolver", campo("Pendientes", d.faltantes))}
      ${seccion("Información a destacar", campo("Información relevante", d.informacionDestacada))}
      ${imagenes.length ? seccion(`Fotos (${imagenes.length})`, imagenes.map(f => `<div style="margin-bottom:14px"><img src="${esc(f.url)}" alt="${esc(f.name)}" style="max-width:100%;border:1px solid #E2E8F0;border-radius:6px"><div style="font-size:11px;color:#94A3B8">${esc(f.name)}</div></div>`).join("")) : ""}
      ${otros.length ? seccion(`Archivos (${otros.length})`, otros.map(f => `<div style="font-size:13px;margin-bottom:6px">📎 <a href="${esc(f.url)}">${esc(f.name)}</a></div>`).join("")) : ""}
      <p style="font-size:12px;color:#94A3B8;margin-top:18px">Enviado por ${esc(caller.nombre)} desde MaderoGest.</p>`;
    const texto = [
      `Informe final de obra: ${d.nombreObra || obra.nombre}`,
      d.cliente && `Cliente: ${d.cliente}`, (d.direccion || obra.direccion) && `Dirección: ${d.direccion || obra.direccion}`,
      d.fecha && `Fecha del informe: ${fmtFecha(d.fecha)}`, d.etapa && `Etapa: ${d.etapa}`,
      d.informe && `\nTrabajo realizado:\n${d.informe}`, d.faltantes && `\nPendientes:\n${d.faltantes}`,
      d.informacionDestacada && `\nInformación a destacar:\n${d.informacionDestacada}`,
      archivos.length && `\nArchivos:\n${archivos.map(f => `- ${f.name}: ${f.url}`).join("\n")}`,
    ].filter(Boolean).join("\n");

    const envio = await enviarEmail({
      asunto: `Informe final de obra: ${d.nombreObra || obra.nombre}`,
      html: marcoMail(`Informe final — ${esc(d.nombreObra || obra.nombre)}`, cuerpo),
      text: texto, para: destinatarios, adjuntos,
    });
    res.status(200).json({ enviado: true, adjuntos: adjuntos.length, ...envio });
  } catch (e) { sendError(res, e); }
}
