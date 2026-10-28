// Materiales: estados, resúmenes y alertas
import { diasHastaFecha } from "./formato.js";

export const MATERIAL_ESTADOS = [
  { id: "pendiente", label: "Falta pedir",   color: "#DC2626" },
  { id: "pedido",    label: "Pedido",        color: "#D97706" },
  { id: "parcial",   label: "Llegó parcial", color: "#D97706" },
  { id: "recibido",  label: "Recibido",      color: "#059669" },
  { id: "stock",     label: "En stock",      color: "#2563EB" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL — UNIFIED
// ═══════════════════════════════════════════════════════════════════════════════
// MATERIALES MODULE
// ═══════════════════════════════════════════════════════════════════════════════
export const TIPOS_MATERIAL = ["MDF","Melamina","Madera maciza","Terciado / Multilaminado","Vidrio","Espejo","Herraje","Bisagra","Corredera","Manija / Tirador","Tapacanto","Moldura / Perfil","Chapa","Pintura / Laca","Tela / Cuero","Otro"];
export const UNIDADES = ["Unidades","m²","ml","Planchas","Tablas","Tiras","Cajas","Pares","Sets","kg","Litros","Metros"];
export const TERMINACIONES = ["Mate","Brillante","Texturado","Natural","Pintado","Barnizado","Laqueado","Cromo","Negro mate","Blanco mate","Otro"];
// "stock" = ya lo tenemos, no hay que pedirlo. El resto son estados de un material a pedir.
export const ESTADOS_MAT = { stock:"En stock", pendiente:"Falta pedir", pedido:"Pedido – falta recibir", parcial:"Llegó incompleto", recibido:"Recibido" };
export const ESTADOS_MAT_PEDIR = ["pendiente","pedido","parcial","recibido"];
export const ESTADO_MAT_COLORS = { stock:{bg:"#F5F3FF",text:"#7C3AED",border:"#DDD6FE"}, pendiente:{bg:"#FFF7ED",text:"#D97706",border:"#FDE68A"}, pedido:{bg:"#EFF6FF",text:"#2563EB",border:"#BFDBFE"}, parcial:{bg:"#FEF2F2",text:"#DC2626",border:"#FECACA"}, recibido:{bg:"#ECFDF5",text:"#059669",border:"#A7F3D0"} };
export const DIAS_ALERTA_MAT = 10;
export const CAMPOS_BUSQUEDA_MAT = ["nombre","tipo","color","terminacion","marca","proveedor","orden_pedido","numero_remito","notas"];

export function resumenMateriales(items = []) {
  const faltaPedir = items.filter(i => !i.estado || i.estado === "pendiente");
  const faltaRecibir = items.filter(i => i.estado === "pedido" || i.estado === "parcial");
  return { faltaPedir, faltaRecibir, stock: items.filter(i => i.estado === "stock").length, recibidos: items.filter(i => i.estado === "recibido").length, completo: items.length > 0 && faltaPedir.length === 0 && faltaRecibir.length === 0 };
}
export function normNombreObra(s) { return (s || "").trim().toLowerCase().replace(/\s+/g, " "); }
// Obra de Entregas asociada a una lista de materiales: por id, o por nombre si se creó por separado
export function entregaDeLista(lista, obras = []) {
  return obras.find(o => o.id === lista.obra_id) || obras.find(o => normNombreObra(o.nombre) === normNombreObra(lista.obra_nombre)) || null;
}
// Obras con entrega en ≤ DIAS_ALERTA_MAT días (o vencida) a las que les falta algún material
export function alertasMateriales(listas = [], obras = []) {
  return listas.map(l => {
    const entrega = entregaDeLista(l, obras);
    if (!entrega || entrega.estado === "terminado" || !entrega.fecha) return null;
    const dias = diasHastaFecha(entrega.fecha);
    const r = resumenMateriales(l.items || []);
    if (dias > DIAS_ALERTA_MAT || r.faltaPedir.length + r.faltaRecibir.length === 0) return null;
    return { lista: l, entrega, dias, ...r };
  }).filter(Boolean).sort((a, b) => a.dias - b.dias);
}
export function detalleFaltante(it) {
  const cant = [it.cantidad, it.unidad].filter(Boolean).join(" ");
  if (it.estado === "parcial") return `${it.nombre}${it.cantidad_recibida ? ` (llegaron ${it.cantidad_recibida} de ${cant || "?"})` : " (llegó incompleto)"}`;
  return `${it.nombre}${cant ? ` (${cant})` : ""}`;
}

// ─── CARGA DE MATERIALES CON CLAUDE ──────────────────────────────────────────
export const EXT_IMPORTABLES = ["pdf","xlsx","xls","xlsm","ods","csv","jpg","jpeg","png","webp"];
export function extArchivo(nombre) { return (nombre || "").split(".").pop().toLowerCase(); }
