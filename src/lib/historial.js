// Historial de modificaciones: textos legibles de cada cambio
import { formatDate, pesos } from "./formato.js";
import { ESTADOS_MAT } from "./materiales.js";

// ─── HISTORIAL DE MODIFICACIONES (solo admin@fabrica.com) ────────────────────
// Lo anota la base sola (supabase/04-auditoria.sql); la base solo se lo entrega a esa cuenta.
export const EMAIL_HISTORIAL = "admin@fabrica.com";
export const TABLAS_HISTORIAL = {
  proyectos: "Obras", obras: "Entregas", avance_obras: "Producción", materiales: "Materiales", cobros: "Cobros",
  obras_avance: "Avance de obra", avance_dias: "Avance de obra (día)", informes_finales: "Informe final de obra",
  obras_aceptadas: "Obras aceptadas", agregados: "Agregados", usuarios: "Usuarios",
};
const CAMPOS_HISTORIAL = {
  nombre: "Nombre", lugar: "Dirección", direccion: "Dirección", fecha: "Fecha", fecha_inicio: "Fecha de inicio", estado: "Estado",
  muebles: "Muebles", notas: "Notas", etiqueta: "Etiqueta", archivada: "Archivada", archivada_en: "Archivada el",
  stations: "Estación", clarifications: "Aclaración", items: "Material", adicionales: "Adicional", archivos: "Archivo",
  monto_total: "Monto total", adelanto_cobrado: "Adelanto cobrado", adelanto_monto: "Monto del adelanto", adelanto_porcentaje: "% de adelanto",
  total_cobrado: "Total cobrado", total_fecha: "Fecha de cobro", plazo_pago: "Plazo de pago",
  status: "Estado", operario: "Operario", start_date: "Inicio", end_date: "Fin", start_time: "Hora de inicio", end_time: "Hora de fin",
  duration_min: "Minutos", duration_manual: "Minutos cargados a mano", note: "Observación", description: "Descripción", due_date: "Fecha de entrega", client: "Cliente",
  cantidad: "Cantidad", unidad: "Unidad", proveedor: "Proveedor", cantidad_recibida: "Cantidad recibida", orden_pedido: "Orden de pedido", numero_remito: "N° de remito",
  detalle: "Detalle", operarios: "Operarios", finalizada: "Finalizada", cliente: "Cliente", descripcion: "Descripción", monto: "Monto", cobrado: "Cobrado",
  rol: "Rol", email: "Email", title: "Título", responsible: "Responsable", station: "Estación", detail: "Detalle", datos: "Datos",
};
const CAMPOS_PLATA = new Set(["monto_total", "adelanto_monto", "monto"]);
const VALORES_HISTORIAL = { ...ESTADOS_MAT, pending: "Pendiente", active: "En progreso", done: "Completada", blocked: "Bloqueada", terminado: "Entregada" };

const nombreCampo = k => CAMPOS_HISTORIAL[k] || k.replace(/_/g, " ");
const nombreElemento = e => typeof e !== "object" || e === null ? String(e)
  : e.nombre || e.name || e.descripcion || e.title || e.path?.split("/").pop() || e.fecha || JSON.stringify(e).slice(0, 60);
function valorHistorial(campo, v) {
  if (v === null || v === undefined || v === "") return "(vacío)";
  if (v === true) return "Sí";
  if (v === false) return "No";
  if (CAMPOS_PLATA.has(campo) && !isNaN(Number(v))) return pesos(v);
  if (Array.isArray(v)) return v.length ? v.map(nombreElemento).join(", ") : "(vacío)";
  if (typeof v === "object") return nombreElemento(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDate(s);
  if (VALORES_HISTORIAL[s]) return VALORES_HISTORIAL[s];
  return s.length > 140 ? s.slice(0, 140) + "…" : s;
}

// Renglones legibles de un registro: "Monto total: $0 → $4.500.000", "Material: agregó "Gris perla""...
export function renglonesHistorial(r) {
  const c = r.cambios || {};
  if (r.accion !== "modificó") {
    return Object.entries(c)
      .filter(([k, v]) => !/(^|_)id$/.test(k) && v !== null && v !== "" && !(Array.isArray(v) && !v.length) && k !== "password")
      .slice(0, 8)
      .map(([k, v]) => Array.isArray(v) ? `${nombreCampo(k)}: ${v.length > 3 ? `${v.length} elementos` : valorHistorial(k, v)}` : `${nombreCampo(k)}: ${valorHistorial(k, v)}`);
  }
  const lineas = [];
  Object.entries(c).forEach(([k, v]) => {
    if (Array.isArray(v)) { lineas.push(`${nombreCampo(k)}: ${valorHistorial(k, v[0])} → ${valorHistorial(k, v[1])}`); return; }
    (v.agregados || []).forEach(e => lineas.push(`${nombreCampo(k)}: agregó "${nombreElemento(e)}"`));
    (v.quitados || []).forEach(e => lineas.push(`${nombreCampo(k)}: quitó "${nombreElemento(e)}"`));
    (v.cambiados || []).forEach(({ item, cambios }) => {
      const partes = Object.entries(cambios || {}).filter(([sub]) => sub !== "id")
        .map(([sub, [antes, despues]]) => sub === "valor" ? `${valorHistorial(k, antes)} → ${valorHistorial(k, despues)}` : `${nombreCampo(sub)}: ${valorHistorial(sub, antes)} → ${valorHistorial(sub, despues)}`);
      lineas.push(`${nombreCampo(k)} "${item}": ${partes.join(" · ")}`);
    });
  });
  return lineas;
}
