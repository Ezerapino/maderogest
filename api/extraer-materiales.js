// Lee un presupuesto / plano / listado (PDF, Excel, CSV o imagen) guardado en Supabase Storage
// y devuelve la lista de materiales usando Claude. No guarda nada: la app muestra la lista
// para revisarla antes de agregarla a la obra.
//   POST /api/extraer-materiales  { path, nombre? }   (path dentro del bucket de archivos)
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import { adminClient, getCaller, httpError, readJson, sendError } from "./_lib.js";

const BUCKET = "avance-obra-fotos";
const MAX_BYTES = 30 * 1024 * 1024;
const MAX_TEXTO = 400_000; // caracteres de planilla que se mandan como máximo

const CAMPO = { type: "string" };
const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nombre: CAMPO, tipo: CAMPO, cantidad: CAMPO, unidad: CAMPO,
          largo: CAMPO, ancho: CAMPO, espesor: CAMPO,
          color: CAMPO, terminacion: CAMPO, marca: CAMPO, notas: CAMPO,
        },
        required: ["nombre", "tipo", "cantidad", "unidad", "largo", "ancho", "espesor", "color", "terminacion", "marca", "notas"],
        additionalProperties: false,
      },
    },
    observaciones: CAMPO,
  },
  required: ["items", "observaciones"],
  additionalProperties: false,
};

const INSTRUCCIONES = `Sos un asistente de una empresa de carpintería y amoblamiento (Obras Grupo Aixa S.A.).
Te paso un documento de una obra (presupuesto, plano, cómputo o listado). Extraé la lista de materiales e insumos que hacen falta para fabricarla e instalarla: placas (melamina, MDF, terciado, madera maciza), tapacantos, herrajes, bisagras, correderas, manijas, vidrios, espejos, perfiles, pinturas, etc.

Reglas:
- Usá solo lo que dice el documento. No inventes cantidades, medidas, marcas ni colores: si un dato no está, dejá el campo como "".
- Si el documento describe muebles (por ejemplo "bajo mesada en melamina blanca 18 mm con 4 bisagras"), listá los materiales que menciona, no el mueble.
- Si el mismo material aparece varias veces, unificalo en un renglón y sumá las cantidades cuando sea claro.
- "nombre": descripción corta y clara del material, como la escribiría un carpintero (ej. "Melamina blanca 18 mm").
- "tipo": uno de MDF, Melamina, Madera maciza, Terciado / Multilaminado, Vidrio, Espejo, Herraje, Bisagra, Corredera, Manija / Tirador, Tapacanto, Moldura / Perfil, Chapa, Pintura / Laca, Tela / Cuero, u Otro.
- "cantidad": solo el número (ej. "12", "2.5"). "unidad": como figura (Planchas, Unidades, ml, m², Tiras, Cajas, Pares, etc.).
- "largo", "ancho", "espesor": en mm si se puede, solo el número.
- "notas": aclaraciones útiles (a qué mueble o sector corresponde, dudas).
- "observaciones": un resumen corto de lo que no pudiste leer o de lo que conviene revisar. Si no hay nada, "".
Respondé en español.`;

function extension(path) { return (path.split(".").pop() || "").toLowerCase(); }

async function contenidoDelArchivo(buffer, ext, nombre) {
  if (ext === "pdf") {
    return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") }, title: nombre }];
  }
  const imagenes = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
  if (imagenes[ext]) {
    return [{ type: "image", source: { type: "base64", media_type: imagenes[ext], data: buffer.toString("base64") } }];
  }
  if (["xlsx", "xls", "xlsm", "ods", "csv"].includes(ext)) {
    const libro = XLSX.read(buffer, { type: "buffer" });
    let texto = libro.SheetNames.map(h => `### Hoja: ${h}\n${XLSX.utils.sheet_to_csv(libro.Sheets[h], { blankrows: false })}`).join("\n\n");
    if (!texto.trim()) throw httpError(400, "La planilla está vacía.");
    if (texto.length > MAX_TEXTO) texto = texto.slice(0, MAX_TEXTO) + "\n[... planilla recortada por tamaño]";
    return [{ type: "text", text: `Planilla "${nombre}" (convertida a CSV):\n\n${texto}` }];
  }
  throw httpError(400, "Formato no soportado. Usá PDF, Excel (xlsx/xls), CSV o una imagen (JPG/PNG).");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Método no permitido" }); }
    await getCaller(req, ["admin", "operario"]);
    if (!process.env.ANTHROPIC_API_KEY) throw httpError(500, "Falta configurar ANTHROPIC_API_KEY en Vercel.");

    const { path, nombre } = await readJson(req);
    if (!path || typeof path !== "string" || path.includes("..")) throw httpError(400, "Archivo inválido.");

    const { data: blob, error } = await adminClient().storage.from(BUCKET).download(path);
    if (error || !blob) throw httpError(404, "No se encontró el archivo.");
    const buffer = Buffer.from(await blob.arrayBuffer());
    if (buffer.length > MAX_BYTES) throw httpError(400, "El archivo es demasiado grande (máximo 30 MB).");

    const contenido = await contenidoDelArchivo(buffer, extension(path), nombre || path.split("/").pop());

    const client = new Anthropic();
    const stream = client.beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: INSTRUCCIONES,
      messages: [{ role: "user", content: [...contenido, { type: "text", text: "Extraé la lista de materiales de este documento." }] }],
    });
    const respuesta = await stream.finalMessage();

    if (respuesta.stop_reason === "refusal") throw httpError(422, "Claude no pudo procesar este documento.");
    if (respuesta.stop_reason === "max_tokens") throw httpError(422, "El documento tiene demasiados materiales para procesarlo de una vez. Probá dividiéndolo.");
    const texto = respuesta.content.filter(b => b.type === "text").map(b => b.text).join("");
    let resultado;
    try { resultado = JSON.parse(texto); } catch { throw httpError(502, "La respuesta de Claude no tuvo el formato esperado. Probá de nuevo."); }
    if (!Array.isArray(resultado?.items)) throw httpError(502, "La respuesta de Claude no tuvo el formato esperado. Probá de nuevo.");

    res.status(200).json({ items: resultado.items, observaciones: resultado.observaciones || "", modelo: respuesta.model });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error("Anthropic API error", e.status, e.message);
      const msg = e.status === 401 ? "La clave de Anthropic es inválida." : e.status === 429 ? "Claude está saturado o se agotó el crédito. Probá en un rato." : e.status === 400 ? `Claude rechazó el pedido: ${e.message}` : "Error al consultar a Claude. Probá de nuevo.";
      return res.status(502).json({ error: msg });
    }
    sendError(res, e);
  }
}
