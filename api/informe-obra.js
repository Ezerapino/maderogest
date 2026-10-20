// Informe general de una obra hecho con Claude, a partir de todo lo cargado en MaderoGest:
// entregas, obra aceptada, avance de producción (estaciones), avance de obra, materiales,
// agregados y (solo admin/finanzas) cobros y adicionales.
//   POST /api/informe-obra  { proyectoId, accion: "generar" }             -> { informe, html }
//   POST /api/informe-obra  { proyectoId, accion: "enviar", informe, para? } -> manda el mail
import Anthropic from "@anthropic-ai/sdk";
import { adminClient, getCaller, httpError, readJson, sendError } from "./_lib.js";
import { emailsValidos, enviarEmail, esc, marcoMail } from "./_email.js";

const TEXTO = { type: "string" };
const LISTA = { type: "array", items: TEXTO };
const fila = props => ({ type: "array", items: { type: "object", properties: Object.fromEntries(props.map(p => [p, TEXTO])), required: props, additionalProperties: false } });
const SCHEMA = {
  type: "object",
  properties: {
    estado_titulo: TEXTO,
    semaforo: { type: "string", enum: ["verde", "amarillo", "rojo", "gris"] },
    resumen: TEXTO,
    fechas_clave: fila(["concepto", "fecha", "comentario"]),
    entregas: fila(["nombre", "fecha", "estado", "comentario"]),
    produccion: fila(["entrega", "estacion", "estado", "operario", "tiempo", "comentario"]),
    demoras: LISTA,
    faltantes: LISTA,
    adicionales: LISTA,
    cobros: TEXTO,
    proximos_pasos: LISTA,
  },
  required: ["estado_titulo", "semaforo", "resumen", "fechas_clave", "entregas", "produccion", "demoras", "faltantes", "adicionales", "cobros", "proximos_pasos"],
  additionalProperties: false,
};

const INSTRUCCIONES = `Sos el asistente de gestión de Obras Grupo Aixa S.A., una empresa de carpintería y amoblamiento comercial (bancos, oficinas, locales).
Te paso en JSON todo lo que hay cargado en el sistema sobre una obra y tenés que escribir un informe general de su estado para la dirección de la empresa.

Cómo está organizado el sistema:
- Una obra tiene una o varias entregas (cada una con fecha de inicio/pedido, fecha de entrega, estado y muebles).
- "obra_aceptada": el presupuesto aceptado; fecha_aceptacion es la fecha de adjudicación.
- "produccion": avance en el taller por estaciones (Programa, Corte, Enchapado, Agujereado, Armado y embalado, Listo para entregar), con estado (pending, active, done, blocked), fechas, horas, minutos (duration_min), operario y notas; "aclaraciones" son contratiempos o dudas registradas; "historial" son los cambios.
- "avance_obra": instalación en el lugar, con registro por día (operarios y detalle) e informe final (pendientes a resolver).
- "materiales": cada ítem con estado: stock (en stock), pendiente (falta pedir), pedido (falta recibir), parcial (llegó incompleto), recibido.
- "agregados": ítems sumados a una entrega después de cargada. "cobros.adicionales": trabajos adicionales cobrables.

Reglas:
- Usá solo los datos que te paso. No inventes fechas, nombres, cantidades ni montos. Si algo no está cargado, decilo ("Sin datos cargados").
- "hoy" es la fecha actual: calculá días que faltan o de atraso respecto de hoy.
- Demoras y contratiempos: entregas vencidas sin marcar como entregadas, estaciones bloqueadas o que tardaron mucho, aclaraciones, notas, retrasos entre fechas planificadas y reales.
- Faltantes: materiales sin pedir, sin recibir o incompletos (nombralos), pendientes del informe final y cualquier faltante mencionado en notas.
- Adicionales: agregados de las entregas y adicionales de cobros (con monto y si está cobrado, cuando haya).
- "produccion": una fila por estación con datos útiles (si no hay producción cargada, dejá la lista vacía). "tiempo": duración legible (ej. "2 h 30 min" o "3 días"), o "".
- "semaforo": verde = en tiempo y sin faltantes; amarillo = riesgo (entrega cercana con faltantes, estaciones atrasadas); rojo = vencida o bloqueada; gris = sin datos suficientes o todo entregado y cerrado.
- "cobros": resumen del estado de cobro; si no te paso cobros, escribí "".
- Fechas en formato dd/mm/aaaa. Español rioplatense, claro y concreto, sin relleno.`;

function hoyArgentina() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()); }
const recortar = (s, n = 800) => (s && s.length > n ? s.slice(0, n) + "…" : s);
const sinVacios = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)));

export async function datosDeLaObra(db, proyectoId, verCobros) {
  const { data: proyecto } = await db.from("proyectos").select("*").eq("id", proyectoId).maybeSingle();
  if (!proyecto) throw httpError(404, "No se encontró la obra.");
  const { data: entregas } = await db.from("obras").select("*").eq("proyecto_id", proyectoId).eq("archivada", false).order("fecha", { ascending: true });
  const ids = (entregas || []).map(e => e.id);
  const enIds = q => (ids.length ? q.in("obra_id", ids) : q.eq("obra_id", "__ninguna__"));
  const [aceptadas, produccion, avanceObra, materiales, agregados, cobros] = await Promise.all([
    db.from("obras_aceptadas").select("nombre, cliente, direccion, fecha_aceptacion, fecha_entrega_aprox, descripcion").eq("proyecto_id", proyectoId),
    enIds(db.from("avance_obras").select("obra_id, start_date, due_date, description, stations, clarifications, history")),
    enIds(db.from("obras_avance").select("id, obra_id, fecha_entrega, finalizada")),
    enIds(db.from("materiales").select("obra_id, items, notas")),
    enIds(db.from("agregados").select("obra_id, articulo, cantidad, unidad, fecha")),
    verCobros ? enIds(db.from("cobros").select("obra_id, monto_total, adelanto_cobrado, adelanto_monto, total_cobrado, total_fecha, plazo_pago, adicionales, notas")) : Promise.resolve({ data: null }),
  ]);
  const avIds = (avanceObra.data || []).map(a => a.id);
  const [dias, informes] = avIds.length ? await Promise.all([
    db.from("avance_dias").select("obra_id, fecha, operarios, detalle, archivos").in("obra_id", avIds).order("fecha"),
    db.from("informes_finales").select("obra_id, datos").in("obra_id", avIds),
  ]) : [{ data: [] }, { data: [] }];

  const nombreEntrega = id => (entregas || []).find(e => e.id === id)?.nombre || id;
  return {
    hoy: hoyArgentina(),
    obra: sinVacios({ nombre: proyecto.nombre, direccion: proyecto.lugar, notas: proyecto.notas, creada: proyecto.creado_en?.slice(0, 10) }),
    obra_aceptada: (aceptadas.data || []).map(sinVacios),
    entregas: (entregas || []).map(e => sinVacios({
      nombre: e.nombre, fecha_inicio_pedido: e.fecha_inicio, fecha_entrega: e.fecha, estado: e.estado, notas: e.notas,
      muebles: (e.muebles || []).map(m => (typeof m === "string" ? m : `${m.nombre}${m.cantidad > 1 ? ` x${m.cantidad}` : ""}`)),
    })),
    produccion: (produccion.data || []).map(p => sinVacios({
      entrega: nombreEntrega(p.obra_id), inicio: p.start_date, entrega_pactada: p.due_date, descripcion: p.description,
      estaciones: (p.stations || []).map(s => sinVacios({ estacion: s.name, estado: s.status, desde: s.start_date, hasta: s.end_date, hora_inicio: s.start_time, hora_fin: s.end_time, minutos: s.duration_min, operario: s.operario, nota: s.note })),
      aclaraciones: (p.clarifications || []).map(c => sinVacios({ titulo: c.title, estacion: c.station, detalle: c.detail })),
      historial: (p.history || []).slice(0, 25).map(h => `${(h.time || "").slice(0, 10)} ${h.user || ""}: ${h.action}`),
    })),
    avance_obra: (avanceObra.data || []).map(a => sinVacios({
      entrega: nombreEntrega(a.obra_id), fecha_entrega: a.fecha_entrega, finalizada: a.finalizada,
      dias: (dias.data || []).filter(d => d.obra_id === a.id).map(d => sinVacios({ fecha: d.fecha, operarios: d.operarios, detalle: recortar(d.detalle), fotos: (d.archivos || []).length })),
      informe_final: (() => { const i = (informes.data || []).find(x => x.obra_id === a.id)?.datos; return i ? sinVacios({ etapa: i.etapa, informe: recortar(i.informe, 1500), pendientes: i.faltantes, destacado: i.informacionDestacada }) : undefined; })(),
    })),
    materiales: (materiales.data || []).map(m => sinVacios({
      entrega: nombreEntrega(m.obra_id), notas: m.notas,
      items: (m.items || []).map(i => sinVacios({ material: i.nombre, cantidad: [i.cantidad, i.unidad].filter(Boolean).join(" "), estado: i.estado || "pendiente", recibido: i.cantidad_recibida, proveedor: i.proveedor })),
    })),
    agregados: (agregados.data || []).map(a => sinVacios({ entrega: nombreEntrega(a.obra_id), articulo: a.articulo, cantidad: [a.cantidad, a.unidad].filter(Boolean).join(" "), fecha: a.fecha?.slice(0, 10) })),
    ...(verCobros ? { cobros: (cobros.data || []).map(c => sinVacios({ entrega: nombreEntrega(c.obra_id), monto_total: c.monto_total, adelanto_cobrado: c.adelanto_cobrado, adelanto_monto: c.adelanto_monto, total_cobrado: c.total_cobrado, fecha_cobro_total: c.total_fecha, plazo_pago: c.plazo_pago, adicionales: c.adicionales, notas: c.notas })) } : {}),
    proyecto,
  };
}

const SEMAFORO = { verde: ["#059669", "#ECFDF5", "En tiempo"], amarillo: ["#D97706", "#FFFBEB", "Con riesgo"], rojo: ["#DC2626", "#FEF2F2", "Demorada / bloqueada"], gris: ["#64748B", "#F1F5F9", "Sin datos suficientes / cerrada"] };
const txt = v => esc(typeof v === "string" ? v : "");

// Arma el HTML del informe (para verlo en la app, imprimirlo y mandarlo por mail)
export function htmlInforme(nombreObra, inf, generado) {
  const [color, fondo, etiqueta] = SEMAFORO[inf.semaforo] || SEMAFORO.gris;
  const h3 = t => `<h3 style="font-size:15px;color:#1A2B4A;margin:22px 0 8px;padding-bottom:6px;border-bottom:2px solid #E2E8F0">${t}</h3>`;
  const lista = (items, vacio) => (Array.isArray(items) && items.length ? `<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.6">${items.map(i => `<li>${txt(i)}</li>`).join("")}</ul>` : `<p style="font-size:13px;color:#94A3B8;margin:0">${vacio}</p>`);
  const tabla = (cols, filas) => (Array.isArray(filas) && filas.length ? `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="background:#F8FAFC;text-align:left">${cols.map(([, t]) => `<th style="padding:7px 8px;font-size:11px;color:#64748B;text-transform:uppercase">${t}</th>`).join("")}</tr>
      ${filas.map(f => `<tr>${cols.map(([k]) => `<td style="padding:7px 8px;border-bottom:1px solid #E2E8F0;vertical-align:top">${txt(f[k])}</td>`).join("")}</tr>`).join("")}</table>` : `<p style="font-size:13px;color:#94A3B8;margin:0">Sin datos cargados.</p>`);
  return `
    <div style="background:${fondo};border:1px solid ${color};border-left:5px solid ${color};border-radius:8px;padding:12px 14px;margin-bottom:6px">
      <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.5px">${etiqueta}</div>
      <div style="font-size:16px;font-weight:700;color:#1A2B4A;margin-top:2px">${txt(inf.estado_titulo)}</div>
    </div>
    <p style="font-size:14px;line-height:1.6">${txt(inf.resumen)}</p>
    ${h3("📅 Fechas clave")}${tabla([["concepto", "Concepto"], ["fecha", "Fecha"], ["comentario", "Comentario"]], inf.fechas_clave)}
    ${h3("📦 Entregas")}${tabla([["nombre", "Entrega"], ["fecha", "Fecha"], ["estado", "Estado"], ["comentario", "Comentario"]], inf.entregas)}
    ${h3("🏗 Producción por estación")}${tabla([["entrega", "Entrega"], ["estacion", "Estación"], ["estado", "Estado"], ["operario", "Operario"], ["tiempo", "Tiempo"], ["comentario", "Comentario"]], inf.produccion)}
    ${h3("⏰ Demoras y contratiempos")}${lista(inf.demoras, "No se registran demoras.")}
    ${h3("🛒 Faltantes")}${lista(inf.faltantes, "No se registran faltantes.")}
    ${h3("➕ Adicionales")}${lista(inf.adicionales, "No se registran adicionales.")}
    ${inf.cobros ? `${h3("💰 Cobros")}<p style="font-size:14px;line-height:1.6;margin:0">${txt(inf.cobros)}</p>` : ""}
    ${h3("➡ Próximos pasos")}${lista(inf.proximos_pasos, "Sin próximos pasos sugeridos.")}
    <p style="font-size:11px;color:#94A3B8;margin-top:20px">Informe de ${esc(nombreObra)} generado con IA (Claude) a partir de los datos cargados en MaderoGest${generado ? ` el ${esc(generado)}` : ""}. Revisalo antes de tomar decisiones.</p>`;
}

function textoPlano(nombreObra, inf) {
  const l = (t, xs) => (Array.isArray(xs) && xs.length ? [`\n${t}:`, ...xs.map(x => `- ${typeof x === "string" ? x : Object.values(x).filter(Boolean).join(" | ")}`)] : []);
  return [`Informe de obra: ${nombreObra}`, `${inf.estado_titulo || ""}`, "", inf.resumen || "",
    ...l("Fechas clave", inf.fechas_clave), ...l("Entregas", inf.entregas), ...l("Producción", inf.produccion),
    ...l("Demoras y contratiempos", inf.demoras), ...l("Faltantes", inf.faltantes), ...l("Adicionales", inf.adicionales),
    ...(inf.cobros ? ["\nCobros:", inf.cobros] : []), ...l("Próximos pasos", inf.proximos_pasos)].join("\n");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Método no permitido" }); }
    const caller = await getCaller(req, ["admin", "operario", "finanzas"]);
    const verCobros = ["admin", "finanzas"].includes(caller.rol);
    const { proyectoId, accion, informe, para, generado } = await readJson(req);
    if (!proyectoId) throw httpError(400, "Falta la obra.");
    const db = adminClient();

    if (accion === "enviar") {
      if (!informe || typeof informe !== "object" || typeof informe.resumen !== "string") throw httpError(400, "Falta el informe. Generalo de nuevo.");
      const destinatarios = emailsValidos(para);
      const { data: proyecto } = await db.from("proyectos").select("nombre").eq("id", proyectoId).maybeSingle();
      if (!proyecto) throw httpError(404, "No se encontró la obra.");
      const envio = await enviarEmail({
        asunto: `Informe de obra: ${proyecto.nombre}`,
        html: marcoMail(`Informe de obra — ${esc(proyecto.nombre)}`, htmlInforme(proyecto.nombre, informe, generado) + `<p style="font-size:12px;color:#94A3B8">Enviado por ${esc(caller.nombre)}.</p>`),
        text: textoPlano(proyecto.nombre, informe), para: destinatarios,
      });
      return res.status(200).json({ enviado: true, ...envio });
    }

    if (!process.env.ANTHROPIC_API_KEY) throw httpError(500, "Falta configurar ANTHROPIC_API_KEY en Vercel.");
    const { proyecto, ...datos } = await datosDeLaObra(db, proyectoId, verCobros);

    const client = new Anthropic();
    const stream = client.beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: INSTRUCCIONES,
      messages: [{ role: "user", content: `Datos de la obra (JSON):\n\n${JSON.stringify(datos, null, 1)}\n\nEscribí el informe general del estado de esta obra.` }],
    });
    const respuesta = await stream.finalMessage();
    if (respuesta.stop_reason === "refusal") throw httpError(422, "Claude no pudo armar el informe de esta obra.");
    if (respuesta.stop_reason === "max_tokens") throw httpError(422, "El informe quedó demasiado largo. Probá de nuevo.");
    const texto = respuesta.content.filter(b => b.type === "text").map(b => b.text).join("");
    let resultado;
    try { resultado = JSON.parse(texto); } catch { throw httpError(502, "La respuesta de Claude no tuvo el formato esperado. Probá de nuevo."); }

    const generadoEn = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    res.status(200).json({ informe: resultado, html: htmlInforme(proyecto.nombre, resultado, generadoEn), generado: generadoEn, incluyeCobros: verCobros });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error("Anthropic API error", e.status, e.message);
      const msg = e.status === 401 ? "La clave de Anthropic es inválida." : e.status === 429 ? "Claude está saturado o se agotó el crédito. Probá en un rato." : e.status === 400 ? `Claude rechazó el pedido: ${e.message}` : "Error al consultar a Claude. Probá de nuevo.";
      return res.status(502).json({ error: msg });
    }
    sendError(res, e);
  }
}
