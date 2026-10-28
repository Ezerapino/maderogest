import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── LOGO ─────────────────────────────────────────────────────────────────────
const LOGO_AIXA = "/logo-aixa.png";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
// MaderoGest Supabase (Entregas)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "";

// Supabase Auth: la sesión (token) se guarda y se renueva sola. Todas las consultas
// viajan con el token del usuario logueado; sin sesión la base no devuelve nada.
const supabase = createClient(SUPABASE_URL.trim(), SUPABASE_KEY.trim());
let accessToken = null;
supabase.auth.onAuthStateChange((_evento, session) => { accessToken = session?.access_token || null; });
function authHeader() { return `Bearer ${accessToken || SUPABASE_KEY}`; }

// Llamadas a las funciones del servidor (/api/*) con la sesión del usuario
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "Authorization": authHeader(), ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// Single DB — all avance_obras data now lives in MaderoGest's Supabase
// You need to create the table "avance_obras" in your Supabase with:
// id (uuid, default gen_random_uuid()), name (text), client (text), start_date (date),
// due_date (date), description (text), stations (jsonb), history (jsonb),
// clarifications (jsonb), created_at (timestamptz, default now())

// You need to create the table "cobros" in your Supabase with:
// id (uuid, default gen_random_uuid()), obra_id (text not null), obra_nombre (text),
// obra_lugar (text), monto_total (numeric default 0), adelanto_cobrado (boolean default false),
// adelanto_monto (numeric default 0), adelanto_porcentaje (numeric default 0),
// total_cobrado (boolean default false), total_fecha (date), plazo_pago (text),
// adicionales (jsonb default '[]'::jsonb), notas (text),
// created_at (timestamptz default now()), updated_at (timestamptz default now())

// ─── SUPABASE FETCH (MaderoGest) ──────────────────────────────────────────────
async function sbFetch(path, options = {}) {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${SUPABASE_URL}/rest/v1/${path}${separator}apikey=${SUPABASE_KEY}`;
  const isWrite = options.method && options.method !== "GET";
  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": authHeader(),
      ...(isWrite ? { "Content-Type": "application/json" } : {}),
      "Prefer": "return=representation",
      ...options.headers,
    },
    ...(options.body ? { body: options.body } : {}),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(err); }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// ─── AVANCE API (same Supabase, table: avance_obras) ──────────────────────────
async function getAixaObras() { return sbFetch("avance_obras?select=*&order=created_at.desc"); }
async function insertAixaObra(obra) { return sbFetch("avance_obras", { method: "POST", body: JSON.stringify(obra) }); }
async function deleteAixaObraApi(id) { return sbFetch(`avance_obras?id=eq.${id}`, { method: "DELETE" }); }

// Trae la fila tal como está ahora en la base, le aplica el cambio y la guarda. Las listas
// (estaciones, historial, ítems, adicionales) se arman así sobre lo último guardado y no
// sobre lo que la pantalla cargó al abrirse, para no pisar lo que guardó otra persona.
async function modificarFila(tabla, id, cambio) {
  const [actual] = await sbFetch(`${tabla}?id=eq.${id}&select=*`);
  if (!actual) throw new Error("El registro ya no existe. Recargá la página.");
  const datos = cambio(JSON.parse(JSON.stringify(actual)));
  if (!datos) return actual;
  const [guardada] = await sbFetch(`${tabla}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(datos) });
  return guardada;
}
// Users for avance also come from the same "usuarios" table
async function getAixaUsers() { return getUsuarios(); }

// ═══════════════════════════════════════════════════════════════════════════════
// ENTREGAS MODULE (MaderoGest)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── OBRAS API ────────────────────────────────────────────────────────────────
async function getObras() { return sbFetch("obras?order=fecha.asc", { method: "GET" }); }
async function upsertObra(obra) {
  return sbFetch("obras", { method: "POST", headers: { "Prefer": "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(obra) });
}
async function deleteObra(id) { return sbFetch(`obras?id=eq.${id}`, { method: "DELETE" }); }
async function patchEntregas(filtro, data) { return sbFetch(`obras?${filtro}`, { method: "PATCH", body: JSON.stringify(data) }); }

// ─── OBRAS (tabla proyectos): agrupan una o varias entregas (tabla obras) ─────
async function getProyectos() { return sbFetch("proyectos?select=*&order=creado_en.desc"); }
async function upsertProyecto(p) {
  return sbFetch("proyectos", { method: "POST", headers: { "Prefer": "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(p) });
}
async function patchProyecto(id, data) { return sbFetch(`proyectos?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }); }
async function deleteProyecto(id) { return sbFetch(`proyectos?id=eq.${id}`, { method: "DELETE" }); }

function nombreEntrega(proyecto, etiqueta) { return etiqueta?.trim() ? `${proyecto.nombre} - ${etiqueta.trim()}` : proyecto.nombre; }

// Qué entregas están activas y cuáles archivadas: lo que pertenece a una entrega archivada
// no se muestra en ninguna pestaña; lo que no tiene entrega se muestra como "sin vincular".
function vinculoEntregas(entregas = []) {
  return {
    activas: entregas.filter(e => !e.archivada),
    archivadas: new Set(entregas.filter(e => e.archivada).map(e => e.id)),
    existentes: new Set(entregas.map(e => e.id)),
  };
}

// Registros que acompañan a cada entrega nueva en Cobros, Materiales y Avance de Producción
async function crearRegistrosEntrega(e) {
  try { await insertCobro({ obra_id: e.id, obra_nombre: e.nombre, obra_lugar: e.lugar, monto_total: 0, adelanto_cobrado: false, adelanto_monto: 0, adelanto_porcentaje: 0, total_cobrado: false, total_fecha: null, plazo_pago: "", adicionales: [] }); }
  catch (err) { console.error("Error creando el cobro de la entrega:", err); }
  try { await insertMaterial({ obra_id: e.id, obra_nombre: e.nombre, obra_lugar: e.lugar, items: [], notas: "" }); }
  catch (err) { console.error("Error creando la lista de materiales de la entrega:", err); }
  try { await insertAixaObra({ obra_id: e.id, name: e.nombre, client: e.lugar, start_date: null, due_date: e.fecha || null, description: e.notas || "", stations: mkStations(), history: [], clarifications: [] }); }
  catch (err) { console.error("Error creando la entrega en Avance de Producción:", err); avisar("La entrega se guardó, pero no se pudo crear en Avance de Producción.", { tipo: "error" }); }
}

// Copia nombre, dirección y fecha de la entrega a las otras pestañas
async function sincronizarEntrega(e) {
  const patch = (tabla, datos) => sbFetch(`${tabla}?obra_id=eq.${e.id}`, { method: "PATCH", body: JSON.stringify(datos) });
  const r = await Promise.allSettled([
    patch("cobros", { obra_nombre: e.nombre, obra_lugar: e.lugar }),
    patch("materiales", { obra_nombre: e.nombre, obra_lugar: e.lugar }),
    patch("avance_obras", { name: e.nombre, client: e.lugar, due_date: e.fecha || null }),
    patch("obras_avance", { nombre: e.nombre, direccion: e.lugar, fecha_entrega: e.fecha || null }),
  ]);
  r.filter(x => x.status === "rejected").forEach(x => console.error("Error sincronizando la entrega:", x.reason));
}

// Crea una obra con su primera entrega (y los registros de las otras pestañas)
async function crearObraConEntrega({ nombre, lugar, entrega, sesion }) {
  const ahora = new Date().toISOString();
  const proyecto = { id: uid(), nombre: nombre.trim(), lugar: (lugar || "").trim(), creado_por: sesion.id, creado_en: ahora, archivada: false };
  await upsertProyecto(proyecto);
  const etiqueta = entrega.etiqueta?.trim() || null;
  const e = {
    id: uid(), proyecto_id: proyecto.id, etiqueta, nombre: nombreEntrega(proyecto, etiqueta), lugar: proyecto.lugar,
    fecha: entrega.fecha || null, fecha_inicio: entrega.fecha_inicio || null, estado: entrega.estado || "pendiente",
    muebles: entrega.muebles || [], notas: entrega.notas || "", archivada: false,
    creado_por: sesion.id, creado_en: ahora, editado_por: null, editado_en: null,
  };
  await upsertObra(e);
  await agregarHistorial({ obra_id: e.id, obra_nombre: e.nombre, usuario_id: sesion.id, usuario_nombre: sesion.nombre, accion: "creó", detalle: "Obra creada" });
  await crearRegistrosEntrega(e);
  return { proyecto, entrega: e };
}

// Borra todos los archivos de una carpeta del bucket
async function borrarCarpetaStorage(prefijo) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${AVANCE_BUCKET}`, {
    method: "POST", headers: { Authorization: authHeader(), apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: prefijo, limit: 1000 }),
  });
  if (!r.ok) return;
  const archivos = (await r.json()).filter(f => f.id).map(f => `${prefijo}/${f.name}`);
  if (!archivos.length) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/${AVANCE_BUCKET}`, {
    method: "DELETE", headers: { Authorization: authHeader(), apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: archivos }),
  });
}
async function borrarArchivos(lista) {
  for (const f of (lista || [])) { if (f.path) { try { await deleteFileAvance(f.path); } catch { /* si el archivo ya no existe se sigue igual */ } } }
}

// Eliminación definitiva de una entrega y de todo lo suyo en las otras pestañas (fotos y archivos incluidos)
async function eliminarEntregaDefinitiva(id) {
  for (const a of (await sbFetch(`obras_avance?obra_id=eq.${id}&select=id`)) || []) {
    for (const d of (await getDiasAvance(a.id)) || []) await borrarArchivos(d.archivos);
    await sbFetch(`avance_dias?obra_id=eq.${a.id}`, { method: "DELETE" });
    for (const inf of (await sbFetch(`informes_finales?obra_id=eq.${a.id}`)) || []) await borrarArchivos(inf.archivos);
    await sbFetch(`informes_finales?obra_id=eq.${a.id}`, { method: "DELETE" });
    await deleteObraAvanceById(a.id);
  }
  for (const m of (await sbFetch(`materiales?obra_id=eq.${id}&select=id`)) || []) await borrarCarpetaStorage(`materiales-import/${m.id}`);
  await sbFetch(`materiales?obra_id=eq.${id}`, { method: "DELETE" });
  await sbFetch(`cobros?obra_id=eq.${id}`, { method: "DELETE" });
  await sbFetch(`avance_obras?obra_id=eq.${id}`, { method: "DELETE" });
  await sbFetch(`agregados?obra_id=eq.${id}`, { method: "DELETE" });
  await deleteObra(id);
}

// Eliminación definitiva de una obra: sus entregas, sus obras aceptadas vinculadas y la obra
async function eliminarObraDefinitiva(proyectoId, entregaIds) {
  for (const id of entregaIds) await eliminarEntregaDefinitiva(id);
  for (const a of (await sbFetch(`obras_aceptadas?proyecto_id=eq.${proyectoId}`)) || []) {
    await borrarArchivos(a.archivos);
    await deleteObraAceptadaById(a.id);
  }
  await deleteProyecto(proyectoId);
}

async function getUsuarios() { return sbFetch("usuarios?select=id,nombre,email,rol&order=nombre.asc", { method: "GET" }); }
// Altas y bajas pasan por el servidor: crean/borran también el usuario de Supabase Auth
async function crearUsuario(usuario) { return apiFetch("/api/usuarios", { method: "POST", body: JSON.stringify(usuario) }); }
async function deleteUsuario(id) { return apiFetch(`/api/usuarios?id=${encodeURIComponent(id)}`, { method: "DELETE" }); }

async function agregarHistorial(entrada) { return sbFetch("historial", { method: "POST", body: JSON.stringify(entrada) }); }

async function getAgregados(obraId) { return sbFetch(`agregados?obra_id=eq.${obraId}&order=fecha.desc`, { method: "GET" }); }
async function insertAgregado(agregado) {
  return sbFetch("agregados", { method: "POST", headers: { "Prefer": "return=representation" }, body: JSON.stringify(agregado) });
}

// ─── COBROS API ───────────────────────────────────────────────────────────────
async function getCobros() { return sbFetch("cobros?select=*&order=created_at.desc"); }
async function insertCobro(cobro) { return sbFetch("cobros", { method: "POST", body: JSON.stringify(cobro) }); }
async function deleteCobro(id) { return sbFetch(`cobros?id=eq.${id}`, { method: "DELETE" }); }

// ─── MATERIALES API ───────────────────────────────────────────────────────────
// You need to create the table "materiales" in your Supabase with:
// id (uuid, default gen_random_uuid()), obra_id (text not null), obra_nombre (text),
// obra_lugar (text), items (jsonb default '[]'::jsonb), notas (text),
// created_at (timestamptz default now()), updated_at (timestamptz default now())
async function getMateriales() { return sbFetch("materiales?select=*&order=created_at.desc"); }
async function insertMaterial(m) { return sbFetch("materiales", { method: "POST", body: JSON.stringify(m) }); }
async function deleteMaterialById(id) { return sbFetch(`materiales?id=eq.${id}`, { method: "DELETE" }); }

// ─── AVANCE DE OBRA API (tabla: obras_avance + avance_dias) ───────────────────
const AVANCE_BUCKET = "avance-obra-fotos";
async function getObrasAvance() { return sbFetch("obras_avance?select=*&order=created_at.desc"); }
async function insertObraAvance(obra) { return sbFetch("obras_avance", { method: "POST", body: JSON.stringify(obra) }); }
async function updateObraAvance(id, data) { return sbFetch(`obras_avance?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }); }
async function deleteObraAvanceById(id) { return sbFetch(`obras_avance?id=eq.${id}`, { method: "DELETE" }); }
async function getDiasAvance(obraId) { return sbFetch(`avance_dias?obra_id=eq.${obraId}&order=fecha.asc,created_at.asc`); }
async function insertDiaAvance(dia) { return sbFetch("avance_dias", { method: "POST", body: JSON.stringify(dia) }); }
async function updateDiaAvance(id, data) { return sbFetch(`avance_dias?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }); }
async function deleteDiaAvanceById(id) { return sbFetch(`avance_dias?id=eq.${id}`, { method: "DELETE" }); }

// ─── INFORMES FINALES API ─────────────────────────────────────────────────────
async function getInformesFinalesObraIds() {
  const r = await sbFetch("informes_finales?select=obra_id");
  return (r || []).map(x => x.obra_id);
}
async function getInformeFinal(obraId) {
  const r = await sbFetch(`informes_finales?obra_id=eq.${obraId}&limit=1`);
  return r?.[0] || null;
}
async function upsertInformeFinal(obraId, datos, archivos, existingId) {
  if (existingId) {
    return sbFetch(`informes_finales?id=eq.${existingId}`, {
      method: "PATCH",
      body: JSON.stringify({ datos, archivos, updated_at: new Date().toISOString() })
    });
  }
  return sbFetch("informes_finales", {
    method: "POST",
    body: JSON.stringify({ obra_id: obraId, datos, archivos })
  });
}

// ─── OBRAS ACEPTADAS API (tabla: obras_aceptadas) ─────────────────────────────
// You need to create the table "obras_aceptadas" in your Supabase with:
// id (uuid, default gen_random_uuid()), nombre (text not null), direccion (text),
// cliente (text), fecha_aceptacion (date), fecha_entrega_aprox (date), descripcion (text),
// archivos (jsonb default '[]'::jsonb), creado_por (text), creado_por_nombre (text),
// created_at (timestamptz default now()), updated_at (timestamptz default now())
async function getObrasAceptadas() { return sbFetch("obras_aceptadas?select=*&order=fecha_aceptacion.desc.nullslast,created_at.desc"); }
async function insertObraAceptada(obra) { return sbFetch("obras_aceptadas", { method: "POST", body: JSON.stringify(obra) }); }
async function updateObraAceptada(id, data) { return sbFetch(`obras_aceptadas?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }); }
async function deleteObraAceptadaById(id) { return sbFetch(`obras_aceptadas?id=eq.${id}`, { method: "DELETE" }); }
async function uploadFileObraAceptada(original, obraId) {
  const file = await comprimirImagen(original);
  const ext = file.name.split(".").pop().toLowerCase();
  const path = `aceptadas/${obraId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${AVANCE_BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), apikey: SUPABASE_KEY, "Content-Type": file.type, "x-upsert": "true" },
    body: file,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(t); }
  return { url: `${SUPABASE_URL}/storage/v1/object/public/${AVANCE_BUCKET}/${path}`, path, name: file.name, type: file.type, size: file.size };
}

// Las fotos del celular (3-8 MB) se achican antes de subirlas: lado mayor 2560 px, JPG calidad 0.82.
// Si algo falla o no achica, se sube el archivo original.
const LADO_MAX_FOTO = 2560;
async function comprimirImagen(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400 * 1024) return file;
  try {
    const img = await createImageBitmap(file, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAX_FOTO / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // las partes transparentes de un PNG quedan blancas, no negras
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch (e) {
    console.warn("No se pudo comprimir la foto, se sube como está:", e);
    return file;
  }
}

async function uploadFileAvance(original, obraId) {
  const file = await comprimirImagen(original);
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${obraId}/${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${AVANCE_BUCKET}/${path}`, {
    method: 'POST',
    headers: { 'Authorization': authHeader(), 'apikey': SUPABASE_KEY, 'Content-Type': file.type, 'x-upsert': 'true' },
    body: file
  });
  if (!res.ok) { const t = await res.text(); throw new Error(t); }
  return { url: `${SUPABASE_URL}/storage/v1/object/public/${AVANCE_BUCKET}/${path}`, path, name: file.name };
}

async function deleteFileAvance(filePath) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${AVANCE_BUCKET}/${filePath}`, {
    method: 'DELETE',
    headers: { 'Authorization': authHeader(), 'apikey': SUPABASE_KEY }
  });
}

async function imgToBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function b64ToBlob(b64, type) {
  const byteStr = atob(b64.split(",")[1]);
  const arr = new Uint8Array(byteStr.length);
  for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
  return new Blob([arr], { type });
}

async function uploadFileInforme(original, obraId) {
  const file = await comprimirImagen(original);
  const ext = file.name.split(".").pop().toLowerCase();
  const path = `informes/${obraId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${AVANCE_BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), apikey: SUPABASE_KEY, "Content-Type": file.type, "x-upsert": "true" },
    body: file,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(t); }
  return { url: `${SUPABASE_URL}/storage/v1/object/public/${AVANCE_BUCKET}/${path}`, path, name: file.name, type: file.type, size: file.size };
}

// Old separate API functions removed — now using unified functions above

// ─── SESSION ──────────────────────────────────────────────────────────────────
// Perfil del usuario logueado (tabla usuarios), a partir de la sesión de Supabase Auth
async function perfilDeSesion(session) {
  if (!session) return null;
  accessToken = session.access_token;
  const u = session.user;
  const filas = await sbFetch(`usuarios?select=id,nombre,email,rol&auth_id=eq.${u.id}`);
  const p = filas?.[0];
  if (p) return p;
  // Respaldo por si la fila todavía no tiene auth_id
  return { id: u.app_metadata?.usuario_id || u.id, nombre: u.user_metadata?.nombre || u.email, email: u.email, rol: u.app_metadata?.rol || "operario" };
}
async function getSesion() {
  const { data } = await supabase.auth.getSession();
  return perfilDeSesion(data.session);
}
async function cerrarSesion() { await supabase.auth.signOut(); accessToken = null; localStorage.removeItem("mg_sesion"); }

// ─── UTILS ────────────────────────────────────────────────────────────────────
function diasRestantes(fecha) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const f = new Date(fecha + "T00:00:00");
  return Math.ceil((f - hoy) / 86400000);
}
function getStatus(dias, estado) {
  if (estado === "terminado") return "done";
  if (dias < 0) return "vencida";
  if (dias <= 7) return "urgent";
  if (dias <= 21) return "warning";
  return "ok";
}
function formatDate(d) { if (!d) return ""; const [y,m,dia] = d.split("-"); return `${dia}/${m}/${y}`; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// ─── AVISOS Y CONFIRMACIONES (reemplazan alert y confirm del navegador) ──────
// avisar() muestra un aviso abajo que se cierra solo; con `deshacer` suma un botón para revertir.
// confirmar() abre una ventana propia y devuelve una promesa con true/false.
let mostrarAviso = null;
let pedirConfirmacion = null;
function avisar(texto, { tipo = "info", deshacer } = {}) {
  if (mostrarAviso) mostrarAviso({ id: uid(), texto, tipo, deshacer });
  else window.alert(texto);
}
function confirmar(texto, { boton = "Eliminar", peligro = true } = {}) {
  if (!pedirConfirmacion) return Promise.resolve(window.confirm(texto));
  return new Promise(resolver => pedirConfirmacion({ texto, boton, peligro, resolver }));
}

const AVISO_COLORES = {
  ok:    { fondo: "#ECFDF5", borde: "#A7F3D0", texto: "#065F46", icono: "✓" },
  error: { fondo: "#FEF2F2", borde: "#FECACA", texto: "#991B1B", icono: "!" },
  aviso: { fondo: "#FFFBEB", borde: "#FDE68A", texto: "#92400E", icono: "!" },
  info:  { fondo: "#EFF6FF", borde: "#BFDBFE", texto: "#1E3A8A", icono: "i" },
};

function Avisos() {
  const [avisos, setAvisos] = useState([]);
  const [pregunta, setPregunta] = useState(null);

  useEffect(() => {
    mostrarAviso = a => {
      setAvisos(prev => [...prev.slice(-3), a]);
      // Los errores y los que se pueden deshacer quedan más tiempo a la vista
      const ms = a.deshacer ? 8000 : a.tipo === "error" ? 7000 : 4000;
      setTimeout(() => setAvisos(prev => prev.filter(x => x.id !== a.id)), ms);
    };
    pedirConfirmacion = setPregunta;
    return () => { mostrarAviso = null; pedirConfirmacion = null; };
  }, []);

  function cerrar(id) { setAvisos(prev => prev.filter(x => x.id !== id)); }
  function responder(si) { pregunta?.resolver(si); setPregunta(null); }

  // Escape cancela; Enter activa el botón que tiene el foco (de entrada, el de confirmar)
  useEffect(() => {
    if (!pregunta) return;
    const tecla = e => { if (e.key === "Escape") { pregunta.resolver(false); setPregunta(null); } };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [pregunta]);

  const fuente = "'Inter', sans-serif";
  return (
    <>
      <div className="avisos-pila" style={{ position:"fixed", bottom:16, left:16, right:16, zIndex:2000, display:"flex", flexDirection:"column", alignItems:"center", gap:8, pointerEvents:"none" }}>
        {avisos.map(a => {
          const c = AVISO_COLORES[a.tipo] || AVISO_COLORES.info;
          return (
            <div key={a.id} role={a.tipo === "error" ? "alert" : "status"} style={{ pointerEvents:"auto", width:"100%", maxWidth:440, display:"flex", alignItems:"center", gap:10, padding:"11px 12px 11px 14px", background:c.fondo, border:`1px solid ${c.borde}`, borderRadius:10, boxShadow:"0 6px 20px rgba(15,23,42,0.12)", fontFamily:fuente, color:c.texto, fontSize:13, lineHeight:1.4 }}>
              <span style={{ flexShrink:0, width:20, height:20, borderRadius:"50%", background:c.texto, color:c.fondo, fontSize:12, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{c.icono}</span>
              <span style={{ flex:1, whiteSpace:"pre-line" }}>{a.texto}</span>
              {a.deshacer && (
                <button onClick={() => { cerrar(a.id); a.deshacer(); }} style={{ flexShrink:0, padding:"5px 10px", background:"transparent", border:`1px solid ${c.texto}`, borderRadius:6, color:c.texto, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:fuente }}>Deshacer</button>
              )}
              <button onClick={() => cerrar(a.id)} aria-label="Cerrar aviso" style={{ flexShrink:0, background:"none", border:"none", color:c.texto, fontSize:18, lineHeight:1, cursor:"pointer", padding:"0 2px", opacity:0.6 }}>×</button>
            </div>
          );
        })}
      </div>

      {pregunta && (
        <div onClick={() => responder(false)} style={{ position:"fixed", inset:0, zIndex:2100, background:"rgba(15,23,42,0.45)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width:"100%", maxWidth:420, background:"#fff", borderRadius:14, padding:22, boxShadow:"0 20px 50px rgba(15,23,42,0.25)", fontFamily:fuente, color:"#1A2B4A" }}>
            <div style={{ fontSize:14, lineHeight:1.55, whiteSpace:"pre-line" }}>{pregunta.texto}</div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:20 }}>
              <button onClick={() => responder(false)} style={{ padding:"9px 16px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:fuente }}>Cancelar</button>
              <button autoFocus onClick={() => responder(true)} style={{ padding:"9px 16px", background:pregunta.peligro ? "#DC2626" : "#1A2B4A", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:fuente }}>{pregunta.boton}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const ESTADO_LABELS = { pendiente: "Pendiente", en_proceso: "En proceso", terminado: "Terminado" };
const STATUS_META = {
  urgent:  { color: "#e05555", bg: "rgba(224,85,85,0.13)", label: "URGENTE", icon: "🚨" },
  warning: { color: "#d4783a", bg: "rgba(212,120,58,0.13)", label: "PRÓXIMA", icon: "⏰" },
  ok:      { color: "#4a9a6a", bg: "rgba(74,154,106,0.12)", label: "A TIEMPO", icon: "✅" },
  done:    { color: "#6a8a9a", bg: "rgba(106,138,154,0.1)", label: "ENTREGADA", icon: "📦" },
  vencida: { color: "#c84040", bg: "rgba(200,64,64,0.18)", label: "VENCIDA", icon: "⛔" },
};

// Visor de fotos en grande: flechas (o teclado / deslizar en el celular) para pasar, Esc o clic afuera para cerrar
function VisorFotos({ fotos, inicio = 0, onCerrar }) {
  const [i, setI] = useState(inicio);
  const toqueX = useRef(null);
  const total = fotos.length;
  const pasar = useCallback(d => setI(n => (n + d + total) % total), [total]);
  useEffect(() => {
    const tecla = e => {
      if (e.key === "Escape") onCerrar();
      else if (e.key === "ArrowRight") pasar(1);
      else if (e.key === "ArrowLeft") pasar(-1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [pasar, onCerrar]);
  const f = fotos[i];
  if (!f) return null;
  const src = f.url || f.b64;
  const flecha = lado => ({ position:"absolute", top:"50%", [lado]:12, transform:"translateY(-50%)", width:48, height:48, borderRadius:"50%", border:"none", background:"rgba(255,255,255,0.15)", color:"#fff", fontSize:26, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 });
  return (
    <div onClick={e => e.target === e.currentTarget && onCerrar()}
      onTouchStart={e => { toqueX.current = e.touches[0].clientX; }}
      onTouchEnd={e => { if (toqueX.current == null) return; const dx = e.changedTouches[0].clientX - toqueX.current; toqueX.current = null; if (Math.abs(dx) > 50) pasar(dx < 0 ? 1 : -1); }}
      style={{ position:"fixed", inset:0, zIndex:1500, background:"rgba(2,6,23,0.92)", display:"flex", alignItems:"center", justifyContent:"center", padding:"56px 16px 64px" }}>
      <img src={src} alt={f.name} style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain", borderRadius:4, boxShadow:"0 10px 40px rgba(0,0,0,0.5)" }} />
      <div style={{ position:"absolute", top:0, left:0, right:0, padding:"12px 16px", display:"flex", alignItems:"center", gap:12, color:"#E2E8F0", fontSize:13 }}>
        <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
        {f.url && <a href={f.url} target="_blank" rel="noreferrer" style={{ color:"#fff", fontSize:12, fontWeight:600, textDecoration:"none", padding:"6px 12px", borderRadius:8, background:"rgba(255,255,255,0.15)", whiteSpace:"nowrap" }}>Abrir original ↗</a>}
        <button onClick={onCerrar} title="Cerrar (Esc)" style={{ width:34, height:34, borderRadius:8, border:"none", background:"rgba(255,255,255,0.15)", color:"#fff", fontSize:16, cursor:"pointer" }}>✕</button>
      </div>
      {total > 1 && <>
        <button onClick={() => pasar(-1)} title="Anterior" style={flecha("left")}>‹</button>
        <button onClick={() => pasar(1)} title="Siguiente" style={flecha("right")}>›</button>
        <div style={{ position:"absolute", bottom:20, left:0, right:0, textAlign:"center", color:"#CBD5E1", fontSize:13 }}>{i + 1} de {total}</div>
      </>}
    </div>
  );
}

function normalizarMuebles(muebles) {
  if (!muebles) return [];
  return muebles.map(m => typeof m === "string" ? { nombre: m, cantidad: 1 } : m);
}

// ─── AIXAOBRA UTILS ───────────────────────────────────────────────────────────
const STATION_NAMES = ['Programa','Corte','Enchapado','Agujereado','Armado y embalado','Listo para entregar'];
function mkStations() { return STATION_NAMES.map((n,i)=>({id:i,name:n,status:'pending',start_date:null,end_date:null,note:''})); }

// Campos del formulario de una estación (Avance de Producción y ficha de obra)
function camposEstacion(s) {
  return [
    { key:"status", label:"Estado", type:"select", options:[{v:"pending",l:"Pendiente"},{v:"active",l:"En progreso"},{v:"done",l:"Completado"},{v:"blocked",l:"Bloqueado"}], initial:s.status },
    { key:"operario", label:"Operario a cargo", type:"text", initial:s.operario||"" },
    { key:"start_date", label:"Fecha inicio", type:"date", initial:s.start_date?.split('T')[0]||"" },
    { key:"start_time", label:"Hora inicio", type:"time", initial:s.start_time||"" },
    { key:"end_date", label:"Fecha fin", type:"date", initial:s.end_date?.split('T')[0]||"" },
    { key:"end_time", label:"Hora fin", type:"time", initial:s.end_time||"" },
    { key:"duration_min", label:"Tiempo empleado (minutos) — si lo dejás vacío se calcula con las horas", type:"number", initial:s.duration_manual && s.duration_min != null ? String(s.duration_min) : "" },
    { key:"note", label:"Observación", type:"textarea", initial:s.note||"" },
  ];
}

// Aplica el cambio de una estación sobre la fila recién leída de avance_obras
function cambioEstacion(o, nombre, idx, { status, start_date, end_date, start_time, end_time, duration_min, operario, note }, sesion) {
  const stations = o.stations || [];
  // Se busca por nombre por si otra persona agregó o borró estaciones mientras tanto
  const s = stations.find(x => x.name === nombre) || stations[idx];
  if (!s) throw new Error(`La estación "${nombre}" ya no existe.`);
  const old = s.status;
  s.status = status; s.start_date = start_date || null; s.end_date = end_date || null; s.note = note;
  s.start_time = start_time || null; s.end_time = end_time || null; s.operario = operario?.trim() || null;
  // Manual duration wins; otherwise derive it from the start/end times
  s.duration_manual = duration_min !== "" && duration_min != null;
  s.duration_min = s.duration_manual ? Math.max(0, Math.round(Number(duration_min))) : calcDurMinAixa(s.start_date, s.end_date, s.start_time, s.end_time);
  const hist = o.history || [];
  hist.unshift({ user: sesion.nombre, role: sesion.rol, action: `Estación "${s.name}": "${old}" → "${status}"${s.operario ? ' · Operario: '+s.operario : ''}${s.duration_min != null ? ' · '+fmtDurAixa(s.duration_min) : ''}${note ? ' — '+note : ''}`, time: new Date().toISOString() });
  return { stations, history: hist };
}

// Si con este cambio quedaron todas las estaciones completas, ofrece el informe de cierre
function ofrecerInformeCierre(guardada) {
  if (!guardada?.stations?.length || !guardada.stations.every(s => s.status === 'done')) return;
  setTimeout(async () => {
    if (await confirmar("🎉 ¡Todas las estaciones completadas!\n¿Deseas generar el informe de cierre de obra?", { boton: "Generar informe", peligro: false })) {
      generarInformeCierre(guardada);
    }
  }, 400);
}
function fmtDateAixa(d) { if(!d) return '—'; const[y,m,day]=(d.split('T')[0]).split('-'); return `${day}/${m}/${y}`; }
function fmtDateTimeAixa(iso) { return new Date(iso).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function obraProgressAixa(o) { const st=o.stations||[]; return st.length ? Math.round(st.filter(s=>s.status==='done').length/st.length*100) : 0; }
function isDelayedAixa(o) { if(!o.due_date||obraProgressAixa(o)===100) return false; const t=new Date(); t.setHours(0,0,0,0); return t>new Date(o.due_date); }
function calcDurMinAixa(start_date, end_date, start_time, end_time) {
  if (!start_time || !end_time) return null;
  const d1 = (start_date || '2000-01-01').split('T')[0], d2 = (end_date || d1).split('T')[0];
  let min = Math.round((new Date(`${d2}T${end_time}`) - new Date(`${d1}T${start_time}`)) / 60000);
  if (min < 0 && d1 === d2) min += 1440;
  return min >= 0 ? min : null;
}
function fmtDurAixa(min) { if (min == null || min === '') return ''; const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`; }
function daysDelayedAixa(o) { if(!o.due_date)return 0; const t=new Date();t.setHours(0,0,0,0); return Math.floor((t-new Date(o.due_date))/86400000); }

// ─── PDF GENERATOR ────────────────────────────────────────────────────────────
async function generarPDF(obra) {
  const dias = obra.fecha ? diasRestantes(obra.fecha) : null;
  const status = obra.fecha ? getStatus(dias, obra.estado) : (obra.estado === "terminado" ? "done" : "ok");
  const sm = STATUS_META[status];
  let agregadosList = [];
  try { agregadosList = await getAgregados(obra.id); } catch (e) { console.error("No se pudieron leer los agregados:", e); }
  const mueblesList = normalizarMuebles(obra.muebles || []);
  const totalUnidades = mueblesList.reduce((a, m) => a + (m.cantidad||1), 0);
  const diasLabel = obra.estado === "terminado" ? "Entregada" : dias == null ? "Sin fecha de entrega" : dias < 0 ? `Vencida hace ${Math.abs(dias)} días` : dias === 0 ? "¡Entrega HOY!" : `${dias} días para entrega`;
  const mueblesHTML = mueblesList.map((m) => `<div style="display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid #f1f5f9"><div style="flex:1;font-size:14px;color:#1e293b">${m.nombre}</div><div style="width:90px;font-size:14px;font-weight:bold;color:#1e40af;text-align:center">${m.cantidad > 1 ? m.cantidad : "1"}</div><div style="width:24px;height:24px;border:1.5px solid #1e40af;border-radius:4px;margin-left:12px"></div></div>`).join("");
  const agregadosHTML = agregadosList.length === 0 ? '<p style="color:#94a3b8;font-size:13px">Sin agregados.</p>' :
    agregadosList.map(a => `<div style="display:flex;align-items:center;padding:9px 12px;border-bottom:1px solid #f1f5f9"><div style="flex:1;font-size:14px;color:#1e293b">${a.articulo}</div><div style="width:90px;font-size:14px;font-weight:bold;color:#1e40af;text-align:center">${a.cantidad}${a.unidad ? ` ${a.unidad}` : ""}</div></div>`).join("");

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Orden de Entrega – ${obra.nombre}</title>
<style>body{font-family:Georgia,serif;color:#1e293b;margin:0;padding:0}.portada{background:#1e293b;color:#e8dcc8;padding:48px 48px 36px}.logo{font-size:28px;font-weight:bold;letter-spacing:2px;color:#fff}.obra-titulo{font-size:26px;margin:20px 0 6px;font-style:italic;color:#e8dcc8}.obra-subtitulo{font-size:13px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase}.cuerpo{padding:36px 48px}.status-badge{display:inline-block;padding:5px 16px;border-radius:20px;font-size:12px;font-weight:bold;letter-spacing:1px;background:${sm.bg};color:${sm.color};border:1px solid ${sm.color};margin-bottom:24px}.grid-datos{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:32px;border-bottom:1px solid #e2e8f0;padding-bottom:28px}.dato-item .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:4px}.dato-item .valor{font-size:15px;font-weight:bold;color:#1e293b}.seccion-titulo{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:16px;margin-top:28px}.firma-box{margin-top:48px;display:flex;justify-content:space-between}.firma{text-align:center}.firma-linea{width:160px;border-bottom:1px solid #1e293b;margin-bottom:6px;height:36px}.firma-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8}.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}</style></head>
<body><div class="portada"><div class="logo">Obras Grupo Aixa S.A.</div><div class="obra-titulo">${obra.nombre}</div><div class="obra-subtitulo">Orden de entrega · Obras Grupo Aixa S.A.</div></div>
<div class="cuerpo"><div class="status-badge">${sm.icon} ${sm.label} — ${diasLabel}</div>
<div class="grid-datos"><div class="dato-item"><div class="label">📍 Lugar</div><div class="valor">${obra.lugar}</div></div><div class="dato-item"><div class="label">📅 Fecha</div><div class="valor">${obra.fecha ? formatDate(obra.fecha) : "Sin fecha"}</div></div><div class="dato-item"><div class="label">⚙️ Estado</div><div class="valor">${ESTADO_LABELS[obra.estado]}</div></div></div>
<div class="seccion-titulo">🪵 Muebles — ${mueblesList.length} tipos · ${totalUnidades} unidades</div>${mueblesHTML}
<div class="seccion-titulo">📦 Agregados — ${agregadosList.length} ítems</div>${agregadosHTML}
${obra.notas ? `<div style="background:#f8fafc;border-left:3px solid #1e40af;padding:14px 18px;border-radius:0 8px 8px 0;margin-top:28px;font-size:13px;line-height:1.7">📝 <strong>Notas:</strong> ${obra.notas}</div>` : ""}
<div class="firma-box"><div class="firma"><div class="firma-linea"></div><div class="firma-label">Responsable de entrega</div></div><div class="firma"><div class="firma-linea"></div><div class="firma-label">Firma del cliente</div></div></div>
<div class="footer"><span>Obras Grupo Aixa S.A.</span><span>Generado: ${new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})}</span></div></div></body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 600); }
}

// ─── WHATSAPP ─────────────────────────────────────────────────────────────────
function enviarWhatsApp(obras, numero) {
  const activas = obras.filter(o => o.estado !== "terminado");
  const urgentes = activas.filter(o => diasRestantes(o.fecha) <= 7 && diasRestantes(o.fecha) >= 0);
  const proximas = activas.filter(o => diasRestantes(o.fecha) > 7 && diasRestantes(o.fecha) <= 21);
  const vencidas = activas.filter(o => diasRestantes(o.fecha) < 0);
  if (urgentes.length === 0 && proximas.length === 0 && vencidas.length === 0) { avisar("No hay obras con fechas próximas.", { tipo: "aviso" }); return; }
  let msg = `*OBRAS GRUPO AIXA S.A.*\nResumen de entregas\n${"—".repeat(30)}\n\n`;
  if (vencidas.length > 0) { msg += `*VENCIDAS (${vencidas.length})*\n`; vencidas.forEach(o => { msg += `- *${o.nombre}* — ${o.lugar} — Vencida hace ${Math.abs(diasRestantes(o.fecha))} días\n`; }); msg += "\n"; }
  if (urgentes.length > 0) { msg += `*URGENTES (${urgentes.length})*\n`; urgentes.forEach(o => { const d = diasRestantes(o.fecha); msg += `- *${o.nombre}* — ${o.lugar} — ${d === 0 ? "*HOY*" : `en ${d} días`}\n`; }); msg += "\n"; }
  if (proximas.length > 0) { msg += `*PRÓXIMAS (${proximas.length})*\n`; proximas.forEach(o => { msg += `- *${o.nombre}* — ${o.lugar} — en ${diasRestantes(o.fecha)} días\n`; }); }
  const num = (numero || "").replace(/\D/g, "");
  const url = num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.location.href = url;
}


// ─── PDF: INFORME DE CIERRE DE OBRA ───────────────────────────────────────────
function generarInformeCierre(obra) {
  const st = obra.stations || [];
  const pct = obraProgressAixa(obra);
  const totalDias = obra.start_date && obra.due_date ? Math.max(0, Math.floor((new Date(obra.due_date) - new Date(obra.start_date)) / 86400000)) : 0;
  const completedDate = (() => {
    const done = st.filter(s => s.end_date).map(s => new Date(s.end_date));
    return done.length ? new Date(Math.max(...done)) : new Date();
  })();
  const realDias = obra.start_date ? Math.max(0, Math.floor((completedDate - new Date(obra.start_date)) / 86400000)) : 0;
  const diffDias = realDias - totalDias;
  const cumplimiento = diffDias <= 0;
  const stDur = st.map(s => {
    let days = 0;
    if (s.start_date && s.end_date) days = Math.max(0, Math.floor((new Date(s.end_date) - new Date(s.start_date)) / 86400000));
    else if (s.start_date) days = Math.max(0, Math.floor((new Date() - new Date(s.start_date)) / 86400000));
    return { ...s, days };
  });
  const maxSt = stDur.reduce((a, b) => b.days > a.days ? b : a, stDur[0]);
  const avgD = stDur.length ? (stDur.reduce((a, s) => a + s.days, 0) / stDur.length).toFixed(1) : 0;
  const blocked = st.filter(s => s.status === 'blocked');
  const clarifs = obra.clarifications || [];
  const maxDays = Math.max(...stDur.map(s => s.days), 1);
  const barsHTML = stDur.map(s => {
    const w = Math.max(3, (s.days / maxDays) * 100);
    const color = s === maxSt ? '#DC2626' : s.status === 'done' ? '#059669' : s.status === 'blocked' ? '#DC2626' : '#D97706';
    return `<div style="display:flex;align-items:center;margin-bottom:8px"><div style="width:180px;font-size:12px;color:#475569;font-weight:600;flex-shrink:0">${s.name}</div><div style="flex:1;background:#f1f5f9;border-radius:4px;height:22px"><div style="height:22px;border-radius:4px;background:${color};width:${w}%;display:flex;align-items:center;justify-content:flex-end;padding-right:8px"><span style="font-size:11px;color:#fff;font-weight:700">${s.days}d</span></div></div></div>`;
  }).join('');
  const timelineHTML = stDur.map((s, i) => {
    const sl = {done:'Completado',active:'En progreso',blocked:'Bloqueado',pending:'Pendiente'}[s.status];
    const sc = {done:'#059669',active:'#D97706',blocked:'#DC2626',pending:'#94A3B8'}[s.status];
    return `<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9"><div style="width:28px;height:28px;border-radius:50%;background:${sc};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;flex-shrink:0">${i+1}</div><div style="flex:1"><div style="font-weight:600;font-size:13px;color:#1e293b">${s.name}</div><div style="font-size:11px;color:#64748b">${sl} · ${s.days} días${s.start_date ? ` · ${fmtDateAixa(s.start_date)}` : ''}${s.end_date ? ` → ${fmtDateAixa(s.end_date)}` : ''}</div>${s.operario || s.start_time || s.end_time || s.duration_min != null ? `<div style="font-size:11px;color:#475569">${s.operario ? `Operario: ${s.operario}` : ''}${s.operario && (s.start_time || s.end_time || s.duration_min != null) ? ' · ' : ''}${s.start_time || s.end_time ? `${s.start_time || '—'} → ${s.end_time || '—'}` : ''}${s.duration_min != null ? ` (${fmtDurAixa(s.duration_min)})` : ''}</div>` : ''}${s.note ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px;font-style:italic">"${s.note}"</div>` : ''}</div></div>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe de Cierre – ${obra.name}</title>
<style>@page{margin:20mm 15mm}body{font-family:'Segoe UI',system-ui,sans-serif;color:#1e293b;margin:0;font-size:13px;line-height:1.5}
.cover{background:linear-gradient(135deg,#1A2B4A 0%,#2563EB 100%);color:#fff;padding:48px}.cover h1{font-size:28px;margin:0 0 6px;font-weight:800}.cover .sub{font-size:14px;opacity:.8;margin-bottom:24px}
.cover-grid{display:flex;gap:24px;flex-wrap:wrap}.cover-item{background:rgba(255,255,255,.12);border-radius:10px;padding:14px 20px;min-width:140px}.cover-item .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:.7;margin-bottom:4px}.cover-item .val{font-size:18px;font-weight:700}
.body{padding:32px 48px}.sec{margin-bottom:32px}.sec-t{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:16px;font-weight:700}
.verdict{padding:20px;border-radius:12px;margin-bottom:32px;font-size:15px;font-weight:700;display:flex;align-items:center;gap:12px}
.v-ok{background:#ecfdf5;border:2px solid #a7f3d0;color:#059669}.v-bad{background:#fef2f2;border:2px solid #fecaca;color:#dc2626}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:32px}.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center}.kpi .num{font-size:28px;font-weight:800;line-height:1}.kpi .txt{font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:.5px}
.rec{background:#fffbeb;border-left:4px solid #d97706;padding:14px 18px;border-radius:0 10px 10px 0;margin-bottom:10px;font-size:13px}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}</style></head><body>
<div class="cover">
  <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:.6;margin-bottom:16px">Obras Grupo Aixa S.A.</div>
  <h1>Informe de Cierre de Obra</h1>
  <div class="sub">${obra.name}${obra.client ? ` — ${obra.client}` : ''}</div>
  <div class="cover-grid">
    <div class="cover-item"><div class="lbl">Inicio</div><div class="val">${fmtDateAixa(obra.start_date)}</div></div>
    <div class="cover-item"><div class="lbl">Entrega pactada</div><div class="val">${fmtDateAixa(obra.due_date)}</div></div>
    <div class="cover-item"><div class="lbl">Completada</div><div class="val">${completedDate.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'})}</div></div>
    <div class="cover-item"><div class="lbl">Progreso</div><div class="val">${pct}%</div></div>
  </div>
</div>
<div class="body">
  <div class="verdict ${cumplimiento ? 'v-ok' : 'v-bad'}">${cumplimiento ? '✅ OBRA COMPLETADA DENTRO DEL PLAZO' : `⚠️ OBRA COMPLETADA CON ${Math.abs(diffDias)} DÍA${Math.abs(diffDias)!==1?'S':''} DE RETRASO`}</div>
  <div class="kpi-grid">
    <div class="kpi"><div class="num" style="color:#2563EB">${totalDias}</div><div class="txt">Días planificados</div></div>
    <div class="kpi"><div class="num" style="color:${cumplimiento?'#059669':'#DC2626'}">${realDias}</div><div class="txt">Días reales</div></div>
    <div class="kpi"><div class="num" style="color:#D97706">${avgD}</div><div class="txt">Promedio x etapa</div></div>
    <div class="kpi"><div class="num" style="color:#DC2626">${blocked.length}</div><div class="txt">Bloqueos</div></div>
  </div>
  <div class="sec"><div class="sec-t">📊 Duración por estación (días)</div>${barsHTML}</div>
  <div class="sec"><div class="sec-t">🔴 Cuello de botella principal</div>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px">
      <div style="font-size:16px;font-weight:700;color:#dc2626;margin-bottom:4px">${maxSt.name}</div>
      <div style="font-size:13px;color:#64748b">${maxSt.days} días — <strong style="color:#dc2626">${((maxSt.days / Math.max(realDias,1)) * 100).toFixed(0)}%</strong> del tiempo total</div>
      ${maxSt.note ? `<div style="margin-top:6px;font-size:12px;color:#94a3b8;font-style:italic">"${maxSt.note}"</div>` : ''}</div></div>
  <div class="sec"><div class="sec-t">📋 Línea de tiempo</div>${timelineHTML}</div>
  ${clarifs.length > 0 ? `<div class="sec"><div class="sec-t">💬 Aclaraciones (${clarifs.length})</div>${clarifs.map(c => `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #d97706;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:8px"><div style="font-weight:600;font-size:13px">${c.title}</div>${c.station?`<div style="font-size:11px;color:#2563eb">📍 ${c.station}</div>`:''}${c.detail?`<div style="font-size:12px;color:#64748b;margin-top:4px">${c.detail}</div>`:''}</div>`).join('')}</div>` : ''}
  <div class="sec"><div class="sec-t">💡 Recomendaciones</div>
    ${maxSt.days > avgD * 1.5 ? `<div class="rec">⚠️ <strong>${maxSt.name}</strong> excedió significativamente el promedio (${maxSt.days}d vs ${avgD}d). Reforzar personal o revisar procesos.</div>` : ''}
    ${blocked.length > 0 ? `<div class="rec">🔴 Se registraron <strong>${blocked.length} bloqueo(s)</strong>: ${blocked.map(b=>b.name).join(', ')}. Revisar causas.</div>` : ''}
    ${!cumplimiento ? `<div class="rec">📅 Entrega con <strong>${Math.abs(diffDias)} día(s) de retraso</strong>. Evaluar si el plazo fue realista.</div>` : ''}
    ${clarifs.length > 2 ? `<div class="rec">💬 <strong>${clarifs.length} aclaraciones</strong> registradas. Posible falta de claridad en el alcance inicial.</div>` : ''}
    ${cumplimiento && blocked.length === 0 ? `<div class="rec" style="background:#ecfdf5;border-left-color:#059669">✅ Completada a tiempo y sin bloqueos. Excelente gestión.</div>` : ''}
  </div>
  <div class="footer"><span>Obras Grupo Aixa S.A. — Informe automático</span><span>${new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})}</span></div>
</div></body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 600); }
}


async function generarPDFDiaAvance(obra, dia) {
  const ahora = new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"});
  const archivos = dia.archivos || [];
  const fotos = archivos.filter(f => /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(f.name));
  const otrosArchivos = archivos.filter(f => !/\.(jpg|jpeg|png|gif|webp|heic)$/i.test(f.name));

  const b64Fotos = await Promise.all(fotos.map(async f => {
    const b64 = await imgToBase64(f.url);
    return b64 ? { ...f, b64 } : null;
  }));
  const fotosEmb = b64Fotos.filter(Boolean);

  const fotosHTML = fotosEmb.length === 0
    ? '<p style="color:#94a3b8;font-size:13px;text-align:center">Sin fotos para este día.</p>'
    : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;align-items:start">${fotosEmb.map(f=>`<div style="border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;page-break-inside:avoid;break-inside:avoid"><div style="background:#f1f5f9;display:flex;align-items:center;justify-content:center"><img src="${f.b64}" style="display:block;max-width:100%;max-height:115mm;height:auto"/></div><div style="padding:5px 8px;background:#f8fafc;font-size:10px;color:#64748b">${f.name}</div></div>`).join('')}</div>`;

  const otrosHTML = otrosArchivos.length > 0
    ? `<div style="margin-top:14px">${otrosArchivos.map(f=>`<div style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;color:#475569;margin-bottom:4px">📎 ${f.name}</div>`).join('')}</div>` : '';

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Avance de Obra – ${dia.fecha ? formatDate(dia.fecha) : ''}</title>
<style>@page{margin:18mm 15mm}body{font-family:'Segoe UI',system-ui,sans-serif;color:#1e293b;margin:0}
.cover{background:linear-gradient(135deg,#1A2B4A 0%,#2563EB 100%);color:#fff;padding:36px 48px}
.cover h1{font-size:24px;margin:0 0 4px;font-weight:800}.cover .sub{font-size:13px;opacity:.75;margin-bottom:20px}
.cover-grid{display:flex;gap:16px;flex-wrap:wrap}.citem{background:rgba(255,255,255,.13);border-radius:8px;padding:10px 16px}
.citem .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:.7;margin-bottom:2px}.citem .val{font-size:16px;font-weight:700}
.body{padding:28px 40px}.sec-t{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:14px;font-weight:700}
.campo{margin-bottom:18px}.campo .lbl{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}.campo .val{font-size:14px;color:#1e293b;line-height:1.6;white-space:pre-line}
.footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}
</style></head><body>
<div class="cover">
  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.6;margin-bottom:12px">Obras Grupo Aixa S.A.</div>
  <h1>Avance de Obra</h1>
  <div class="sub">${obra.nombre}${obra.direccion ? ` — ${obra.direccion}` : ''}</div>
  <div class="cover-grid">
    ${obra.fecha_entrega ? `<div class="citem"><div class="lbl">Entrega pactada</div><div class="val">${formatDate(obra.fecha_entrega)}</div></div>` : ''}
    <div class="citem"><div class="lbl">Fecha del día</div><div class="val">${dia.fecha ? formatDate(dia.fecha) : '—'}</div></div>
    ${obra.finalizada ? '<div class="citem"><div class="lbl">Estado</div><div class="val">✅ Finalizada</div></div>' : ''}
  </div>
</div>
<div class="body">
  <div style="margin-bottom:24px">
    <div class="sec-t">📋 Detalle del día</div>
    <div class="campo"><div class="lbl">Fecha</div><div class="val">${dia.fecha ? formatDate(dia.fecha) : '—'}</div></div>
    <div class="campo"><div class="lbl">Operarios</div><div class="val">${dia.operarios || '—'}</div></div>
    <div class="campo"><div class="lbl">Detalle de trabajo</div><div class="val">${dia.detalle || '—'}</div></div>
  </div>
  <div style="margin-bottom:24px">
    <div class="sec-t">📷 Fotos (${fotosEmb.length})</div>
    ${fotosHTML}${otrosHTML}
  </div>
  <div class="footer"><span>Obras Grupo Aixa S.A. — Avance de Obra</span><span>Generado: ${ahora}</span></div>
</div></body></html>`;
  const win = window.open("","_blank");
  if (win) { win.document.write(html); win.document.close(); setTimeout(()=>win.print(),900); }
}


// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleLogin() {
    if (!email || !pass) { setError("Completá email y contraseña."); return; }
    setCargando(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pass });
      if (authError) { setError(/invalid/i.test(authError.message) ? "Email o contraseña incorrectos." : authError.message); setCargando(false); return; }
      onLogin(await perfilDeSesion(data.session));
    } catch {
      setError("Error de conexión. Verificá tu internet.");
      setCargando(false);
    }
  }

  const inputStyle = { width:"100%", padding:"11px 14px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box", transition:"border-color 0.15s" };

  return (
    <div style={{ minHeight:"100vh", background:"#F4F6F9", display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ marginBottom:36, textAlign:"center" }}>
          <img src={LOGO_AIXA} alt="Obras Grupo Aixa S.A." style={{ height:72, borderRadius:8, marginBottom:16 }} />
          <p style={{ fontSize:13, color:"#94A3B8", margin:0, letterSpacing:0.5 }}>Sistema integral de gestión de obras</p>
        </div>
        <div style={{ marginBottom:22 }}>
          <h1 style={{ fontFamily:"'Sora', sans-serif", fontSize:22, fontWeight:700, color:"#1A2B4A", margin:"0 0 4px" }}>Bienvenido</h1>
          <p style={{ fontSize:13, color:"#64748B", margin:0 }}>Ingresá tus credenciales para continuar</p>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Email</label>
          <input type="email" value={email} placeholder="tu@empresa.com"
            onChange={e => { setEmail(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={inputStyle} />
        </div>
        <div style={{ marginBottom:24 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Contraseña</label>
          <input type="password" value={pass} placeholder="••••••••"
            onChange={e => { setPass(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={inputStyle} />
        </div>
        {error && (
          <div style={{ padding:"10px 14px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:13, marginBottom:16 }}>{error}</div>
        )}
        <button onClick={handleLogin} disabled={cargando}
          style={{ width:"100%", padding:"12px", background: cargando ? "#94A3B8" : "#1A2B4A", border:"none", borderRadius:8, fontFamily:"'Inter', sans-serif", fontSize:14, fontWeight:600, color:"#ffffff", cursor: cargando ? "not-allowed" : "pointer", letterSpacing:0.3, transition:"background 0.2s" }}
          onMouseEnter={e => !cargando && (e.currentTarget.style.background="#2563EB")}
          onMouseLeave={e => !cargando && (e.currentTarget.style.background="#1A2B4A")}>
          {cargando ? "Verificando..." : "Iniciar sesión"}
        </button>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// ENTREGAS MODULE (MaderoGest) — Simplified inline component
// ═══════════════════════════════════════════════════════════════════════════════
// Manda ahora el aviso por email ("entregas" o "materiales") que también sale automáticamente
async function enviarAvisoAhora(tipo) {
  try {
    const r = await apiFetch(`/api/alertas-diarias?tipo=${tipo}`);
    avisar(r.enviado ? `Aviso enviado a ${r.destinos} destinatario(s).` : (r.motivo || "No había nada para avisar."), { tipo: r.enviado ? "ok" : "info" });
  } catch (e) { avisar(`No se pudo enviar: ${e.message}`, { tipo: "error" }); }
}

// ─── DIRECCIONES (cada pantalla tiene su link; "atrás" y recargar funcionan) ──
const RUTAS_PESTANAS = { entregas: "entregas", aceptadas: "aceptadas", avance: "produccion", avance_obra: "avance-obra", cobros: "cobros", materiales: "materiales", historial: "historial" };
const PESTANAS_RUTAS = Object.fromEntries(Object.entries(RUTAS_PESTANAS).map(([t, r]) => [r, t]));
// Link a la ficha: /obra/<id>/<nombre-legible> (el nombre es solo para que el link se entienda)
const linkFicha = p => `/obra/${encodeURIComponent(p.id)}/${(p.nombre || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

function leerRuta() {
  const [primera = "", segunda] = window.location.pathname.split("/").filter(Boolean);
  if (primera === "obra" && segunda) return { pestana: "entregas", fichaId: decodeURIComponent(segunda) };
  return { pestana: PESTANAS_RUTAS[primera] || null, fichaId: null };
}
function navegar(ruta, { reemplazar = false } = {}) {
  if (window.location.pathname === ruta) return;
  window.history[reemplazar ? "replaceState" : "pushState"](null, "", ruta);
  window.dispatchEvent(new Event("cambio-de-ruta"));
}
function useRuta() {
  const [ruta, setRuta] = useState(leerRuta);
  useEffect(() => {
    const actualizar = () => { setRuta(leerRuta()); window.scrollTo(0, 0); };
    window.addEventListener("popstate", actualizar);
    window.addEventListener("cambio-de-ruta", actualizar);
    return () => { window.removeEventListener("popstate", actualizar); window.removeEventListener("cambio-de-ruta", actualizar); };
  }, []);
  return ruta;
}

// Estado de una entrega para las tarjetas (las entregas sin fecha no muestran días)
function estadoEntrega(e) {
  if (e.estado === "terminado") return { status: "done", label: "Entregada" };
  if (!e.fecha) return { status: "ok", label: "Sin fecha" };
  const d = diasRestantes(e.fecha);
  return { status: getStatus(d, e.estado), label: d < 0 ? `Vencida hace ${-d} d` : d === 0 ? "Hoy" : `${d} día${d !== 1 ? "s" : ""}` };
}
const SC_ENTREGA = {
  urgent: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" }, vencida: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  warning: { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" }, ok: { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" },
  done: { bg: "#F8FAFC", text: "#64748B", border: "#E2E8F0" },
};
const PRIORIDAD_ESTADO = { vencida: 0, urgent: 1, warning: 2, ok: 3, done: 4 };

// ─── FICHA DE OBRA (todo lo de una obra en una página, y se edita desde acá) ──
const ESTACION_COLORES = {
  done:    { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0", label: "Completada" },
  active:  { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A", label: "En progreso" },
  blocked: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA", label: "Bloqueada" },
  pending: { bg: "#F8FAFC", text: "#94A3B8", border: "#E2E8F0", label: "Pendiente" },
};
const MATERIAL_ESTADOS = [
  { id: "pendiente", label: "Falta pedir",   color: "#DC2626" },
  { id: "pedido",    label: "Pedido",        color: "#D97706" },
  { id: "parcial",   label: "Llegó parcial", color: "#D97706" },
  { id: "recibido",  label: "Recibido",      color: "#059669" },
  { id: "stock",     label: "En stock",      color: "#2563EB" },
];
const pesos = n => `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;

// Cada rol edita en la ficha lo mismo que puede ver (igual que en las pestañas de siempre)
function FichaObra({ proyecto: p, entregas, sesion, onVolver, onModal, onEntregar }) {
  const rol = sesion.rol;
  const ve = {
    produccion: rol !== "arquitecto" && rol !== "finanzas",
    materiales: rol !== "arquitecto" && rol !== "finanzas",
    cobro: rol === "admin" || rol === "finanzas",
    obra: rol !== "finanzas",
  };
  const [solapa, setSolapa] = useState("resumen");
  const [datos, setDatos] = useState(null);
  useEffect(() => { document.title = `${p.nombre} · MaderoGest`; }, [p.nombre]);
  const [recarga, setRecarga] = useState(0);
  const [editando, setEditando] = useState(null); // { tipo: "estacion" | "item" | "montos" | "adicional" | "dia", ... }
  const [ocupado, setOcupado] = useState(false);
  const ids = entregas.map(e => e.id);
  // Si cambia la fecha o el estado de una entrega, las otras pestañas también cambian: se vuelve a leer
  const clave = entregas.map(e => `${e.id}:${e.editado_en || ""}:${e.estado}`).join(",");

  // Guarda un cambio y vuelve a leer la ficha; devuelve lo que devolvió el guardado
  async function guardar(fn, error) {
    setOcupado(true);
    try {
      const r = await fn();
      setEditando(null);
      setRecarga(n => n + 1);
      return r;
    } catch (e) { avisar(`${error}. ${e.message || ""}`, { tipo: "error" }); }
    finally { setOcupado(false); }
  }

  const cambiarCobro = (c, cambio) => guardar(() => modificarFila("cobros", c.id, fila => ({ ...cambio(fila), updated_at: new Date().toISOString() })), "No se pudo guardar el cobro");
  const cambiarItems = (lista, cambio) => guardar(() => modificarFila("materiales", lista.id, fila => ({ items: cambio(fila.items || []), updated_at: new Date().toISOString() })), "No se pudo guardar el material");

  async function guardarEstacion({ prod, idx }, form) {
    const nombre = prod.stations?.[idx]?.name;
    ofrecerInformeCierre(await guardar(() => modificarFila("avance_obras", prod.id, o => cambioEstacion(o, nombre, idx, form, sesion)), "No se pudo guardar la estación"));
  }

  function guardarItem({ lista, item }, form) {
    const datosItem = { ...form, nombre: form.nombre.trim() };
    return cambiarItems(lista, items => item
      ? items.map(i => i.id === item.id ? { ...i, ...datosItem } : i)
      : [...items, { id: uid(), tipo: "", largo: "", ancho: "", espesor: "", color: "", terminacion: "", marca: "", orden_pedido: "", numero_remito: "", cantidad_recibida: "", ...datosItem }]);
  }

  async function eliminarItem(lista, item) {
    if (!await confirmar(`¿Eliminar "${item.nombre}" de la lista de materiales?`)) return;
    cambiarItems(lista, items => items.filter(i => i.id !== item.id));
  }

  function guardarDia({ oa, dia }, form) {
    return guardar(() => dia ? updateDiaAvance(dia.id, form) : insertDiaAvance({ ...form, obra_id: oa.id, archivos: [] }), "No se pudo guardar el día");
  }

  // Para entregas viejas a las que les falta el registro en otra pestaña
  function crearRegistro(tipo, e) {
    const base = { obra_id: e.id, obra_nombre: e.nombre, obra_lugar: e.lugar };
    if (tipo === "produccion") return guardar(() => insertAixaObra({ obra_id: e.id, name: e.nombre, client: e.lugar, start_date: null, due_date: e.fecha || null, description: e.notas || "", stations: mkStations(), history: [], clarifications: [] }), "No se pudo crear");
    if (tipo === "materiales") return guardar(() => insertMaterial({ ...base, items: [], notas: "" }), "No se pudo crear");
    if (tipo === "cobro") return guardar(() => insertCobro({ ...base, monto_total: 0, adelanto_cobrado: false, adelanto_monto: 0, adelanto_porcentaje: 0, total_cobrado: false, total_fecha: null, plazo_pago: "", adicionales: [] }), "No se pudo crear");
  }

  useEffect(() => {
    let vivo = true;
    const lista = `in.(${ids.map(id => `"${id}"`).join(",")})`;
    const pedir = (ok, ruta) => ok && ids.length ? sbFetch(ruta).catch(e => { console.error("Ficha:", e); return []; }) : Promise.resolve([]);
    (async () => {
      const [produccion, materiales, cobros, obrasAvance] = await Promise.all([
        pedir(ve.produccion, `avance_obras?obra_id=${lista}`),
        pedir(ve.materiales, `materiales?obra_id=${lista}`),
        pedir(ve.cobro, `cobros?obra_id=${lista}`),
        pedir(ve.obra, `obras_avance?obra_id=${lista}`),
      ]);
      const dias = obrasAvance.length
        ? await sbFetch(`avance_dias?obra_id=in.(${obrasAvance.map(o => `"${o.id}"`).join(",")})&order=fecha.desc`).catch(() => [])
        : [];
      if (vivo) setDatos({ produccion, materiales, cobros, obrasAvance, dias });
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, recarga]);

  const de = (lista, e) => (lista || []).find(x => x.obra_id === e.id);
  const ordenadas = [...entregas].sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"));
  const pendientes = ordenadas.filter(e => e.estado !== "terminado");
  const proxima = pendientes.find(e => e.fecha);

  // Totales de la obra para los números de arriba
  const tot = { pct: null, faltan: 0, items: 0, saldo: 0, conMonto: 0, ultimoDia: null };
  if (datos) {
    const prods = ordenadas.map(e => de(datos.produccion, e)).filter(Boolean);
    if (prods.length) tot.pct = Math.round(prods.reduce((s, o) => s + obraProgressAixa(o), 0) / prods.length);
    ordenadas.forEach(e => {
      const items = de(datos.materiales, e)?.items || [];
      const r = resumenMateriales(items);
      tot.faltan += r.faltaPedir.length + r.faltaRecibir.length;
      tot.items += items.length;
      const c = de(datos.cobros, e);
      if (c && Number(c.monto_total) > 0) { tot.conMonto++; tot.saldo += saldoDeCobro(c); }
    });
    tot.ultimoDia = datos.dias[0]?.fecha || null;
  }

  const numeros = [
    { label: "Entregadas", valor: `${ordenadas.length - pendientes.length} de ${ordenadas.length}`, color: "#2563EB" },
    ve.produccion && { label: "Producción", valor: datos ? (tot.pct == null ? "—" : `${tot.pct}%`) : "…", color: "#D97706" },
    ve.materiales && { label: "Materiales que faltan", valor: datos ? (tot.items ? String(tot.faltan) : "Sin cargar") : "…", color: !tot.items ? "#94A3B8" : tot.faltan ? "#DC2626" : "#059669" },
    ve.cobro && { label: "Falta cobrar", valor: datos ? (tot.conMonto ? pesos(tot.saldo) : "Sin montos") : "…", color: "#7C3AED" },
    ve.obra && !ve.cobro && { label: "Último avance de obra", valor: datos ? (tot.ultimoDia ? formatDate(tot.ultimoDia) : "—") : "…", color: "#B45309" },
  ].filter(Boolean);

  const solapas = [
    { id: "resumen", label: "Resumen" },
    { id: "entregas", label: `Entregas (${ordenadas.length})` },
    ve.produccion && { id: "produccion", label: "Producción" },
    ve.materiales && { id: "materiales", label: "Materiales" },
    ve.cobro && { id: "cobro", label: "Cobro" },
    ve.obra && { id: "obra", label: "Avance de obra" },
  ].filter(Boolean);

  const tarjeta = { background: "#ffffff", border: "1px solid #E8ECF0", borderRadius: 14, padding: 18, marginBottom: 14 };
  const subtitulo = { fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: "#1A2B4A", margin: "0 0 12px" };
  const chip = (c, texto) => <span style={{ padding: "2px 8px", borderRadius: 6, background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, border: `1px solid ${c.border}`, whiteSpace: "nowrap" }}>{texto}</span>;
  const vacio = texto => <div style={{ fontSize: 13, color: "#94A3B8" }}>{texto}</div>;
  const cargando = !datos && vacio("Cargando…");
  const boton = { padding: "5px 11px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 7, color: "#475569", fontSize: 12, fontWeight: 600, cursor: ocupado ? "wait" : "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" };
  const botonAgregar = { ...boton, background: "#ffffff", border: "1px dashed #CBD5E1", color: "#2563EB" };
  const botonCrear = (tipo, e, texto) => <button disabled={ocupado} onClick={() => crearRegistro(tipo, e)} style={{ ...botonAgregar, marginTop: 8 }}>{texto}</button>;
  const tilde = (ok, onChange, texto) => (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", color: ok ? "#059669" : "#94A3B8", fontWeight: 600 }}>
      <input type="checkbox" checked={!!ok} disabled={ocupado} onChange={onChange} style={{ width: 16, height: 16, accentColor: "#059669", cursor: "pointer", margin: 0 }} />{texto}
    </label>
  );
  const encabezadoEntrega = (e, acciones) => {
    const est = estadoEntrega(e);
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <h3 style={{ ...subtitulo, margin: 0 }}>{e.etiqueta || "Entrega"} <span style={{ fontWeight: 500, color: "#64748B", fontSize: 12 }}>· 📅 {e.fecha ? formatDate(e.fecha) : "Sin fecha"}</span></h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>{acciones}{chip(SC_ENTREGA[est.status], est.label)}</div>
      </div>
    );
  };

  return (
    <div>
      <button onClick={onVolver} style={{ padding: "7px 14px", background: "#ffffff", border: "1px solid #E2E8F0", borderRadius: 8, color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 16, fontFamily: "'Inter', sans-serif" }}>← Volver a Entregas</button>

      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 24, fontWeight: 800, color: "#1A2B4A", margin: 0 }}>{p.nombre}</h1>
          <button title="Cambiar nombre o dirección de la obra" onClick={() => onModal({ modo: "editar-obra", proyecto: p })} style={boton}>✎ Editar obra</button>
        </div>
        <div style={{ fontSize: 13, color: "#64748B", marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
          {p.lugar && <span>📍 {p.lugar}</span>}
          <span>📦 {ordenadas.length} entrega{ordenadas.length !== 1 ? "s" : ""}</span>
          {proxima && <span>⏭ Próxima: {proxima.etiqueta || "entrega"} el {formatDate(proxima.fecha)} ({estadoEntrega(proxima).label.toLowerCase()})</span>}
        </div>
      </div>

      <div className="grid-numeros" style={{ display: "grid", gridTemplateColumns: `repeat(${numeros.length},1fr)`, gap: 12, marginBottom: 20 }}>
        {numeros.map(n => (
          <div key={n.label} style={{ background: "#ffffff", border: "1px solid #E8ECF0", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800, color: n.color, lineHeight: 1.1 }}>{n.valor}</div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{n.label}</div>
          </div>
        ))}
      </div>

      <div className="barra-filtros" style={{ display: "flex", gap: 4, background: "#ffffff", border: "1px solid #E8ECF0", borderRadius: 10, padding: 4, marginBottom: 16, width: "fit-content" }}>
        {solapas.map(s => (
          <button key={s.id} onClick={() => setSolapa(s.id)}
            style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: solapa === s.id ? "#1A2B4A" : "transparent", color: solapa === s.id ? "#ffffff" : "#64748B", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>{s.label}</button>
        ))}
      </div>

      {solapa === "resumen" && (
        <div style={tarjeta}>
          <h2 style={subtitulo}>Cada entrega, de un vistazo</h2>
          {cargando || (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#94A3B8", fontSize: 11, letterSpacing: 0.4 }}>
                    <th style={{ padding: "6px 8px" }}>ENTREGA</th><th style={{ padding: "6px 8px" }}>FECHA</th>
                    {ve.produccion && <th style={{ padding: "6px 8px" }}>PRODUCCIÓN</th>}
                    {ve.materiales && <th style={{ padding: "6px 8px" }}>MATERIALES</th>}
                    {ve.cobro && <th style={{ padding: "6px 8px" }}>COBRO</th>}
                  </tr>
                </thead>
                <tbody>
                  {ordenadas.map(e => {
                    const est = estadoEntrega(e);
                    const prod = de(datos.produccion, e);
                    const pct = prod ? obraProgressAixa(prod) : null;
                    const enCurso = prod && (prod.stations || []).find(s => s.status !== "done");
                    const mat = resumenMateriales(de(datos.materiales, e)?.items || []);
                    const nItems = (de(datos.materiales, e)?.items || []).length;
                    const c = de(datos.cobros, e);
                    return (
                      <tr key={e.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "10px 8px", fontWeight: 600, color: "#1A2B4A" }}>{e.etiqueta || "Entrega"}</td>
                        <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{e.fecha ? formatDate(e.fecha) : "—"} <span style={{ marginLeft: 4 }}>{chip(SC_ENTREGA[est.status], est.label)}</span></td>
                        {ve.produccion && <td style={{ padding: "10px 8px", minWidth: 150 }}>
                          {pct == null ? "—" : <>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: "#F1F5F9", borderRadius: 99 }}><div style={{ width: `${pct}%`, height: 6, borderRadius: 99, background: pct === 100 ? "#059669" : "#D97706" }} /></div>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{pct}%</span>
                            </div>
                            {enCurso && <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>en "{enCurso.name}"</div>}
                          </>}
                        </td>}
                        {ve.materiales && <td style={{ padding: "10px 8px", fontSize: 12 }}>
                          {!nItems ? <span style={{ color: "#94A3B8" }}>Sin cargar</span>
                            : mat.completo ? <span style={{ color: "#059669", fontWeight: 600 }}>✓ Completos</span>
                            : <span style={{ color: "#DC2626", fontWeight: 600 }}>{[mat.faltaPedir.length && `${mat.faltaPedir.length} sin pedir`, mat.faltaRecibir.length && `${mat.faltaRecibir.length} sin recibir`].filter(Boolean).join(" · ")}</span>}
                        </td>}
                        {ve.cobro && <td style={{ padding: "10px 8px", fontSize: 12 }}>
                          {!c ? "—" : c.total_cobrado ? <span style={{ color: "#059669", fontWeight: 600 }}>✓ Cobrada</span>
                            : Number(c.monto_total) > 0 ? <span style={{ fontWeight: 600 }}>Falta {pesos(saldoDeCobro(c))}</span>
                            : <span style={{ color: "#94A3B8" }}>Monto sin cargar</span>}
                        </td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {solapa === "entregas" && <>
        {ordenadas.map(e => {
        const muebles = normalizarMuebles(e.muebles || []);
        return (
          <div key={e.id} style={tarjeta}>
            {encabezadoEntrega(e, <>
              <button onClick={() => onModal({ modo: "editar-entrega", proyecto: p, entrega: e })} style={boton}>Editar</button>
              <button onClick={() => generarPDF(e)} style={boton}>PDF</button>
              {e.estado !== "terminado" && <button onClick={() => onEntregar(e)} style={{ ...boton, background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#059669" }}>Entregar</button>}
            </>)}
            {e.fecha_inicio && <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>🔨 Inicio: {formatDate(e.fecha_inicio)}</div>}
            {muebles.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {muebles.map((m, i) => <div key={i} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#475569" }}>{m.nombre}{m.cantidad > 1 ? ` ×${m.cantidad}` : ""}</div>)}
              </div>
            ) : vacio("Sin muebles cargados.")}
            {e.notas && <div style={{ fontSize: 12, color: "#64748B", marginTop: 10, whiteSpace: "pre-line" }}>📝 {e.notas}</div>}
          </div>
        );
        })}
        <button onClick={() => onModal({ modo: "nueva-entrega", proyecto: p, etiquetaSugerida: ordenadas.length ? `${ordenadas.length + 1}ª entrega` : "" })} style={{ ...botonAgregar, width: "100%", padding: "9px 0" }}>+ Agregar entrega</button>
      </>}

      {solapa === "produccion" && (cargando || <>
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 10 }}>Tocá una estación para cambiar su estado, el operario o las fechas.</div>
        {ordenadas.map(e => {
        const prod = de(datos.produccion, e);
        return (
          <div key={e.id} style={tarjeta}>
            {encabezadoEntrega(e)}
            {!prod ? <>{vacio("Sin registro en Avance de Producción.")}{botonCrear("produccion", e, "+ Agregar a Avance de Producción")}</> : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(prod.stations || []).map((s, i) => {
                  const c = ESTACION_COLORES[s.status] || ESTACION_COLORES.pending;
                  return (
                    <div key={i} onClick={() => setEditando({ tipo: "estacion", e, prod, idx: i })} title="Cambiar esta estación"
                      style={{ flex: "1 1 150px", border: `1px solid ${c.border}`, background: c.bg, borderRadius: 10, padding: "9px 11px", cursor: "pointer" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>{i + 1}. {s.name}</div>
                      <div style={{ fontSize: 11, color: c.text, fontWeight: 600, marginTop: 2 }}>{c.label}</div>
                      {(s.operario || s.end_date) && <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{[s.operario, s.end_date && formatDate(s.end_date)].filter(Boolean).join(" · ")}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
        })}
      </>)}

      {solapa === "materiales" && (cargando || ordenadas.map(e => {
        const lista = de(datos.materiales, e);
        const items = lista?.items || [];
        return (
          <div key={e.id} style={tarjeta}>
            {encabezadoEntrega(e, lista && <button disabled={ocupado} onClick={() => setEditando({ tipo: "item", lista, item: null })} style={botonAgregar}>+ Agregar material</button>)}
            {!lista ? <>{vacio("Sin lista en Materiales.")}{botonCrear("materiales", e, "+ Crear lista de materiales")}</>
              : !items.length ? vacio("Sin materiales cargados.") : MATERIAL_ESTADOS.map(est => {
              const grupo = items.filter(it => (it.estado || "pendiente") === est.id);
              if (!grupo.length) return null;
              return (
                <div key={est.id} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: est.color, letterSpacing: 0.4, marginBottom: 4 }}>{est.label.toUpperCase()} ({grupo.length})</div>
                  {grupo.map(it => (
                    <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", padding: "4px 0", borderTop: "1px solid #F8FAFC" }}>
                      <span onClick={() => setEditando({ tipo: "item", lista, item: it })} title="Editar este material" style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                        {detalleFaltante(it)}{it.proveedor ? <span style={{ color: "#94A3B8" }}> — {it.proveedor}</span> : ""}
                      </span>
                      <select value={it.estado || "pendiente"} disabled={ocupado} title="Cambiar estado"
                        onChange={ev => { const estado = ev.target.value; cambiarItems(lista, its => its.map(i => i.id === it.id ? { ...i, estado } : i)); }}
                        style={{ padding: "4px 6px", border: "1px solid #E2E8F0", borderRadius: 6, background: "#ffffff", color: "#334155", fontSize: 12, maxWidth: 150 }}>
                        {Object.entries(ESTADOS_MAT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <button disabled={ocupado} onClick={() => eliminarItem(lista, it)} title="Eliminar" style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 14, padding: 2 }}>✕</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      }))}

      {solapa === "cobro" && (cargando || ordenadas.map(e => {
        const c = de(datos.cobros, e);
        const fila = (label, valor) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid #F1F5F9", fontSize: 13 }}><span style={{ color: "#64748B" }}>{label}</span><span style={{ fontWeight: 600, color: "#1A2B4A", textAlign: "right" }}>{valor}</span></div>;
        return (
          <div key={e.id} style={tarjeta}>
            {encabezadoEntrega(e, c && <>
              <button disabled={ocupado} onClick={() => setEditando({ tipo: "montos", c })} style={boton}>Editar montos</button>
              <button disabled={ocupado} onClick={() => setEditando({ tipo: "adicional", c, adicional: null })} style={botonAgregar}>+ Adicional</button>
            </>)}
            {!c ? <>{vacio("Sin registro en Cobros.")}{botonCrear("cobro", e, "+ Agregar a Cobros")}</> : <>
              {fila("Monto total", Number(c.monto_total) > 0 ? pesos(c.monto_total) : "Sin cargar")}
              {fila(`Adelanto${Number(c.adelanto_monto) > 0 ? ` (${pesos(c.adelanto_monto)})` : ""}`, tilde(c.adelanto_cobrado, () => cambiarCobro(c, f => ({ adelanto_cobrado: !f.adelanto_cobrado })), c.adelanto_cobrado ? "Cobrado" : "Pendiente"))}
              {fila("Total", tilde(c.total_cobrado, () => cambiarCobro(c, f => ({ total_cobrado: !f.total_cobrado })), c.total_cobrado ? `Cobrado${c.total_fecha ? ` el ${formatDate(c.total_fecha)}` : ""}` : "Pendiente"))}
              {fila("Plazo de pago", c.plazo_pago || "—")}
              {(c.adicionales || []).map(a => <div key={a.id}>{fila(
                <span onClick={() => setEditando({ tipo: "adicional", c, adicional: a })} title="Editar adicional" style={{ cursor: "pointer" }}>Adicional: {a.descripcion} · {pesos(a.monto)}</span>,
                tilde(a.cobrado, () => cambiarCobro(c, f => ({ adicionales: (f.adicionales || []).map(x => x.id === a.id ? { ...x, cobrado: !x.cobrado } : x) })), a.cobrado ? "Cobrado" : "Pendiente")
              )}</div>)}
              {Number(c.monto_total) > 0 && fila("Falta cobrar", pesos(saldoDeCobro(c)))}
            </>}
          </div>
        );
      }))}

      {solapa === "obra" && (cargando || ordenadas.map(e => {
        const oa = de(datos.obrasAvance, e);
        const dias = oa ? datos.dias.filter(d => d.obra_id === oa.id) : [];
        return (
          <div key={e.id} style={tarjeta}>
            {encabezadoEntrega(e, oa && <button disabled={ocupado} onClick={() => setEditando({ tipo: "dia", oa, dia: null })} style={botonAgregar}>+ Registrar día</button>)}
            {!oa ? vacio("Sin registro en Avance de Obra.") : !dias.length ? vacio("Todavía no hay días registrados.") : <>
              {oa.finalizada && <div style={{ fontSize: 12, color: "#059669", fontWeight: 600, marginBottom: 8 }}>✅ Obra finalizada</div>}
              {dias.slice(0, 5).map(d => (
                <div key={d.id} style={{ padding: "8px 0", borderTop: "1px solid #F1F5F9", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>{formatDate(d.fecha)}{d.operarios ? <span style={{ fontWeight: 500, color: "#64748B" }}> · {d.operarios}</span> : ""}{(d.archivos || []).length ? <span style={{ fontWeight: 500, color: "#64748B" }}> · 📷 {(d.archivos || []).length}</span> : ""}</div>
                    {d.detalle && <div style={{ fontSize: 13, color: "#334155", marginTop: 2, whiteSpace: "pre-line" }}>{d.detalle}</div>}
                  </div>
                  <button disabled={ocupado} onClick={() => setEditando({ tipo: "dia", oa, dia: d })} style={boton}>Editar</button>
                </div>
              ))}
              {dias.length > 5 && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>y {dias.length - 5} días más en la pestaña Avance de Obra</div>}
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>Las fotos se suben desde la pestaña Avance de Obra.</div>
            </>}
          </div>
        );
      }))}

      {editando?.tipo === "estacion" && (() => {
        const s = editando.prod.stations[editando.idx];
        return <ModalSimple title={`${editando.e.etiqueta || "Entrega"} · Estación ${editando.idx + 1}: ${s.name}`} onClose={() => setEditando(null)}
          onSave={form => guardarEstacion(editando, form)} fields={camposEstacion(s)} />;
      })()}

      {editando?.tipo === "item" && (() => {
        const it = editando.item;
        const unidades = it?.unidad && !UNIDADES.includes(it.unidad) ? [it.unidad, ...UNIDADES] : UNIDADES;
        return <ModalSimple title={it ? "Editar material" : "Agregar material"} onClose={() => setEditando(null)}
          onSave={form => guardarItem(editando, form)}
          fields={[
            { key: "nombre", label: "Descripción", type: "text", required: true, initial: it?.nombre || "" },
            { key: "cantidad", label: "Cantidad", type: "text", initial: it?.cantidad != null ? String(it.cantidad) : "" },
            { key: "unidad", label: "Unidad", type: "select", options: unidades.map(u => ({ v: u, l: u })), initial: it?.unidad || "Unidades" },
            { key: "proveedor", label: "Proveedor", type: "text", initial: it?.proveedor || "" },
            { key: "estado", label: "Estado", type: "select", options: Object.entries(ESTADOS_MAT).map(([v, l]) => ({ v, l })), initial: it?.estado || "pendiente" },
            { key: "notas", label: "Notas", type: "textarea", initial: it?.notas || "" },
          ]} />;
      })()}

      {editando?.tipo === "montos" && (() => {
        const c = editando.c;
        const num = n => Number(n) ? String(n) : "";
        return <ModalSimple title="Montos y plazo del cobro" onClose={() => setEditando(null)}
          onSave={f => cambiarCobro(c, () => ({ monto_total: parseFloat(f.monto_total) || 0, adelanto_monto: parseFloat(f.adelanto_monto) || 0, adelanto_porcentaje: parseFloat(f.adelanto_porcentaje) || 0, total_fecha: f.total_fecha || null, plazo_pago: f.plazo_pago || "" }))}
          fields={[
            { key: "monto_total", label: "Monto total del contrato ($)", type: "number", initial: num(c.monto_total) },
            { key: "adelanto_monto", label: "Monto del adelanto ($)", type: "number", initial: num(c.adelanto_monto) },
            { key: "adelanto_porcentaje", label: "Adelanto: porcentaje del total (%)", type: "number", initial: num(c.adelanto_porcentaje) },
            { key: "total_fecha", label: "Fecha de cobro del total", type: "date", initial: c.total_fecha || "" },
            { key: "plazo_pago", label: "Plazo de pago del cliente (ej: 30 días, contado)", type: "text", initial: c.plazo_pago || "" },
          ]} />;
      })()}

      {editando?.tipo === "adicional" && (() => {
        const { c, adicional: a } = editando;
        return <ModalSimple title={a ? "Editar adicional" : "Agregar adicional"} onClose={() => setEditando(null)}
          onSave={f => cambiarCobro(c, fila => {
            const datosAdic = { descripcion: f.descripcion.trim(), monto: parseFloat(f.monto) || 0 };
            const adics = fila.adicionales || [];
            return { adicionales: a ? adics.map(x => x.id === a.id ? { ...x, ...datosAdic } : x) : [...adics, { id: uid(), ...datosAdic, cobrado: false }] };
          })}
          fields={[
            { key: "descripcion", label: "Descripción", type: "text", required: true, initial: a?.descripcion || "" },
            { key: "monto", label: "Monto ($)", type: "number", initial: a?.monto ? String(a.monto) : "" },
          ]} />;
      })()}

      {editando?.tipo === "dia" && <ModalDiaAvance dia={editando.dia} onClose={() => setEditando(null)} onSave={form => guardarDia(editando, form)} />}
    </div>
  );
}
// Lo que falta cobrar: total menos adelanto cobrado, más adicionales sin cobrar
function saldoDeCobro(c) {
  const adics = (c.adicionales || []).filter(a => !a.cobrado).reduce((s, a) => s + (Number(a.monto) || 0), 0);
  if (c.total_cobrado) return adics;
  return Math.max(0, (Number(c.monto_total) || 0) - (c.adelanto_cobrado ? Number(c.adelanto_monto) || 0 : 0)) + adics;
}

function EntregasModule({ sesion, obras, proyectos, recargarObras }) {
  const [enviandoAviso, setEnviandoAviso] = useState(false);
  const [filter, setFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const [mesFilter, setMesFilter] = useState("");
  const [modal, setModal] = useState(null); // { modo: "nueva-obra" | "editar-obra" | "nueva-entrega" | "editar-entrega", proyecto, entrega }
  const [detalleId, setDetalleId] = useState(null);
  const [verArchivo, setVerArchivo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [informeIA, setInformeIA] = useState(null);
  const { fichaId } = useRuta();

  const isAdmin = sesion.rol === "admin";
  const puedeArchivar = isAdmin || sesion.rol === "operario";
  const puedeInformeIA = ["admin", "operario", "finanzas"].includes(sesion.rol);
  const entregas = obras.filter(o => !o.archivada);
  const activas = entregas.filter(o => o.estado !== "terminado");
  const urgentes = activas.filter(o => { if (!o.fecha) return false; const d = diasRestantes(o.fecha); return d >= 0 && d <= 7; });
  const proximas = activas.filter(o => { if (!o.fecha) return false; const d = diasRestantes(o.fecha); return d > 7 && d <= 21; });
  const terminadas = entregas.filter(o => o.estado === "terminado");
  const proyectoDe = e => proyectos.find(p => p.id === e.proyecto_id);
  const enArchivo = proyectos.filter(p => p.archivada).length + obras.filter(o => o.archivada && !proyectoDe(o)?.archivada).length;

  const hayFiltro = !!(search || mesFilter || filter !== "todas");
  function coincide(o, p) {
    if (search) {
      const q = search.toLowerCase();
      if (![p.nombre, p.lugar, o.nombre, o.etiqueta, o.notas].some(t => (t || "").toLowerCase().includes(q))) return false;
    }
    if (mesFilter && !(o.fecha || "").startsWith(mesFilter) && !(o.fecha_inicio || "").startsWith(mesFilter)) return false;
    if (filter === "todas") return true;
    const s = estadoEntrega(o).status;
    return filter === "urgent" ? (s === "urgent" || s === "vencida") : s === filter;
  }
  const porFecha = (a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999");
  const grupos = proyectos.filter(p => !p.archivada).map(p => {
    const todas = entregas.filter(e => e.proyecto_id === p.id).sort(porFecha);
    const visibles = todas.filter(e => coincide(e, p));
    const peor = visibles.map(e => estadoEntrega(e).status).sort((a, b) => PRIORIDAD_ESTADO[a] - PRIORIDAD_ESTADO[b])[0] || "ok";
    const proxima = visibles.filter(e => e.estado !== "terminado").map(e => e.fecha || "9999").sort()[0];
    const ultima = todas.map(e => e.fecha || "").sort().pop() || "";
    return { p, todas, visibles, peor, proxima, ultima };
  }).filter(g => g.visibles.length || (!hayFiltro && !g.todas.length))
    .sort((a, b) => {
      if (a.proxima && !b.proxima) return -1;
      if (!a.proxima && b.proxima) return 1;
      return a.proxima ? a.proxima.localeCompare(b.proxima) : b.ultima.localeCompare(a.ultima);
    });
  const entregasVisibles = grupos.reduce((s, g) => s + g.visibles.length, 0);

  async function guardar({ obraForm, entregaForm }) {
    const ahora = new Date().toISOString();
    setGuardando(true);
    try {
      if (modal.modo === "nueva-obra") {
        await crearObraConEntrega({ nombre: obraForm.nombre, lugar: obraForm.lugar, entrega: entregaForm, sesion });
      } else if (modal.modo === "editar-obra") {
        const p = { ...modal.proyecto, nombre: obraForm.nombre.trim(), lugar: obraForm.lugar.trim() };
        await patchProyecto(p.id, { nombre: p.nombre, lugar: p.lugar });
        for (const e of obras.filter(x => x.proyecto_id === p.id)) {
          const upd = { ...e, nombre: nombreEntrega(p, e.etiqueta), lugar: p.lugar };
          await patchEntregas(`id=eq.${e.id}`, { nombre: upd.nombre, lugar: upd.lugar });
          await sincronizarEntrega(upd);
        }
      } else {
        const p = modal.proyecto, existente = modal.entrega;
        const etiqueta = entregaForm.etiqueta.trim() || null;
        const e = {
          ...(existente || {}), id: existente?.id || uid(), proyecto_id: p.id, etiqueta, nombre: nombreEntrega(p, etiqueta), lugar: p.lugar,
          fecha: entregaForm.fecha || null, fecha_inicio: entregaForm.fecha_inicio || null, estado: entregaForm.estado,
          muebles: entregaForm.muebles, notas: entregaForm.notas, archivada: existente?.archivada || false,
          creado_por: existente ? existente.creado_por : sesion.id, creado_en: existente ? existente.creado_en : ahora,
          editado_por: existente ? sesion.id : null, editado_en: existente ? ahora : null,
        };
        if (!existente) {
          // Si la obra tenía una sola entrega sin etiqueta, pasa a ser la "1ª entrega"
          const hermanas = entregas.filter(x => x.proyecto_id === p.id);
          if (hermanas.length === 1 && !hermanas[0].etiqueta) {
            const primera = { ...hermanas[0], etiqueta: "1ª entrega", nombre: nombreEntrega(p, "1ª entrega") };
            await patchEntregas(`id=eq.${primera.id}`, { etiqueta: primera.etiqueta, nombre: primera.nombre });
            await sincronizarEntrega(primera);
          }
        }
        await upsertObra(e);
        await agregarHistorial({ obra_id: e.id, obra_nombre: e.nombre, usuario_id: sesion.id, usuario_nombre: sesion.nombre, accion: existente ? "editó" : "creó", detalle: existente ? "Entrega actualizada" : "Entrega agregada" });
        if (existente) await sincronizarEntrega(e);
        else await crearRegistrosEntrega(e);
      }
      await recargarObras();
      setModal(null);
    } catch (err) { avisar(`Error al guardar: ${err.message}`, { tipo: "error" }); }
    setGuardando(false);
  }

  async function marcarEntregada(e) {
    try {
      await upsertObra({ ...e, estado: "terminado", editado_por: sesion.id, editado_en: new Date().toISOString() });
      await recargarObras();
    } catch { avisar("Error al actualizar.", { tipo: "error" }); return; }
    setDetalleId(null);
  }

  async function archivarObra(p) {
    const suyas = entregas.filter(e => e.proyecto_id === p.id);
    const ahora = new Date().toISOString();
    try {
      await patchEntregas(`proyecto_id=eq.${p.id}&archivada=is.false`, { archivada: true, archivada_en: ahora });
      await patchProyecto(p.id, { archivada: true, archivada_en: ahora });
      await Promise.allSettled(suyas.map(e => agregarHistorial({ obra_id: e.id, obra_nombre: e.nombre, usuario_id: sesion.id, usuario_nombre: sesion.nombre, accion: "archivó", detalle: "Obra archivada" })));
      await recargarObras();
    } catch (err) { avisar(`No se pudo archivar: ${err.message}`, { tipo: "error" }); return; }
    setDetalleId(null);
    // Deshacer devuelve solo las entregas que se archivaron recién (las que ya estaban archivadas siguen así)
    avisar(`Obra "${p.nombre}" archivada. Queda en "Archivo".`, { tipo: "ok", deshacer: async () => {
      try {
        await patchEntregas(`proyecto_id=eq.${p.id}&archivada_en=eq.${encodeURIComponent(ahora)}`, { archivada: false, archivada_en: null });
        await patchProyecto(p.id, { archivada: false, archivada_en: null });
        await recargarObras();
        avisar(`Obra "${p.nombre}" restaurada.`, { tipo: "ok" });
      } catch (err) { avisar(`No se pudo deshacer: ${err.message}. Restaurala desde "Archivo".`, { tipo: "error" }); }
    } });
  }

  async function archivarEntrega(e) {
    const p = proyectoDe(e);
    if (p && entregas.filter(x => x.proyecto_id === p.id).length <= 1) return archivarObra(p);
    try {
      await patchEntregas(`id=eq.${e.id}`, { archivada: true, archivada_en: new Date().toISOString() });
      await agregarHistorial({ obra_id: e.id, obra_nombre: e.nombre, usuario_id: sesion.id, usuario_nombre: sesion.nombre, accion: "archivó", detalle: "Entrega archivada" });
      await recargarObras();
    } catch (err) { avisar(`No se pudo archivar: ${err.message}`, { tipo: "error" }); return; }
    setDetalleId(null);
    avisar(`Entrega "${e.nombre}" archivada. Queda en "Archivo".`, { tipo: "ok", deshacer: async () => {
      try {
        await patchEntregas(`id=eq.${e.id}`, { archivada: false, archivada_en: null });
        await recargarObras();
        avisar(`Entrega "${e.nombre}" restaurada.`, { tipo: "ok" });
      } catch (err) { avisar(`No se pudo deshacer: ${err.message}. Restaurala desde "Archivo".`, { tipo: "error" }); }
    } });
  }

  const ficha = fichaId ? proyectos.find(p => p.id === fichaId) : null;
  // Link a una obra que ya no existe: avisar y volver a la lista (si las obras ya cargaron)
  const fichaPerdida = !!fichaId && proyectos.length > 0 && !ficha;
  useEffect(() => {
    if (!fichaPerdida) return;
    avisar("Esa obra ya no existe. Te muestro la lista de obras.", { tipo: "aviso" });
    navegar("/entregas", { reemplazar: true });
  }, [fichaPerdida]);
  if (ficha) return <>
    <FichaObra proyecto={ficha} entregas={entregas.filter(e => e.proyecto_id === ficha.id)} sesion={sesion}
      onVolver={() => navegar("/entregas")} onModal={setModal} onEntregar={marcarEntregada} />
    {modal && <ModalObraEntrega {...modal} guardando={guardando} onClose={() => setModal(null)} onSave={guardar} />}
  </>;

  const detalle = detalleId ? obras.find(o => o.id === detalleId) : null;
  const btnSm = { flex:1, padding:"6px 0", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:7, color:"#475569", fontSize:11, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" };
  const btnIcono = { padding:"4px 8px", fontSize:12, border:"1px solid #E2E8F0", borderRadius:6, background:"#F8FAFC", color:"#64748B", cursor:"pointer" };

  return (
    <div>
      {/* STATS */}
      <div className="grid-numeros" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:32 }}>
        {[
          { num: activas.length, label:"Entregas en curso", color:"#2563EB", border:"#DBEAFE" },
          { num: urgentes.length, label:"Urgentes", color:"#DC2626", border:"#FECACA" },
          { num: proximas.length, label:"Próximas", color:"#D97706", border:"#FDE68A" },
          { num: terminadas.length, label:"Entregadas", color:"#059669", border:"#A7F3D0" },
        ].map((s, i) => (
          <div key={i} style={{ background:"#ffffff", border:`1px solid ${s.border}`, borderRadius:12, padding:"20px 20px 18px", animation:`fadeUp 0.35s ease ${i*0.06}s both` }}>
            <div style={{ fontFamily:"'Sora', sans-serif", fontSize:32, fontWeight:800, color:s.color, lineHeight:1 }}>{s.num}</div>
            <div style={{ fontSize:12, color:"#64748B", fontWeight:500, marginTop:6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* FILTROS + BÚSQUEDA */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>Obras — Entregas</h2>
          {isAdmin && (
            <button disabled={enviandoAviso} title="El aviso sale solo los lunes y jueves a las 8:00. Este botón lo manda ahora."
              onClick={async () => { setEnviandoAviso(true); await enviarAvisoAhora("entregas"); setEnviandoAviso(false); }}
              style={{ padding:"6px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:12, fontWeight:600, cursor: enviandoAviso ? "not-allowed" : "pointer" }}>
              {enviandoAviso ? "Enviando..." : "📧 Enviar aviso de entregas ahora"}
            </button>
          )}
          <button onClick={() => setVerArchivo(true)} title="Obras y entregas archivadas"
            style={{ padding:"6px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:12, fontWeight:600, cursor:"pointer" }}>
            🗄 Archivo{enArchivo ? ` (${enArchivo})` : ""}
          </button>
        </div>
        <div className="barra-filtros" style={{ display:"flex", gap:4, background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:10, padding:4 }}>
          {[
            { key:"todas", label:"Todas" }, { key:"urgent", label:"Urgentes" }, { key:"warning", label:"Próximas" }, { key:"ok", label:"A tiempo" }, { key:"done", label:"Entregadas" },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} className="filter-btn"
              style={{ padding:"6px 14px", borderRadius:7, border:"none", background: filter===f.key ? "#1A2B4A" : "transparent", color: filter===f.key ? "#ffffff" : "#64748B", fontFamily:"'Inter', sans-serif", fontSize:12, fontWeight: filter===f.key ? 600 : 400, cursor:"pointer", transition:"all 0.15s" }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative", flex:"1 1 200px", maxWidth:320 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar obra, dirección, notas..."
            style={{ width:"100%", padding:"9px 12px 9px 36px", background:"#ffffff", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" }} />
          {search && <button onClick={() => setSearch("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#94A3B8", cursor:"pointer", fontSize:14, padding:2 }}>✕</button>}
        </div>
        <input type="month" value={mesFilter} onChange={e => setMesFilter(e.target.value)}
          style={{ padding:"9px 12px", background:"#ffffff", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" }} />
        {mesFilter && <button onClick={() => setMesFilter("")} style={{ padding:"6px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#64748B", fontSize:12, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Limpiar mes</button>}
        {hayFiltro && <span style={{ fontSize:12, color:"#94A3B8" }}>{grupos.length} obra{grupos.length !== 1 ? "s" : ""} · {entregasVisibles} entrega{entregasVisibles !== 1 ? "s" : ""}</span>}
      </div>

      {/* GRID DE OBRAS */}
      {grupos.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
          <div style={{ fontSize:13, color:"#94A3B8" }}>No hay obras en esta categoría</div>
        </div>
      ) : (
        <div className="grid-tarjetas" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:16, alignItems:"start" }}>
          {grupos.map(({ p, todas, visibles, peor }, idx) => (
            <div key={p.id} className="obra-card"
              style={{ background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:14, overflow:"hidden", animation:`fadeUp 0.35s ease ${idx*0.04}s both`, boxShadow:"0 1px 4px rgba(26,43,74,0.05)" }}>
              <div style={{ height:4, background: STATUS_META[peor].color }} />
              <div style={{ padding:"16px 16px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, marginBottom:4 }}>
                  <a href={linkFicha(p)} onClick={ev => { if (ev.ctrlKey || ev.metaKey || ev.shiftKey) return; ev.preventDefault(); navegar(linkFicha(p)); }} title="Ver la ficha de la obra"
                    style={{ fontFamily:"'Sora', sans-serif", fontSize:15, fontWeight:700, color:"#1A2B4A", lineHeight:1.35, cursor:"pointer", textDecoration:"underline", textDecorationColor:"#CBD5E1", textUnderlineOffset:3, display:"block" }}>{p.nombre}</a>
                  <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                    {puedeInformeIA && <button title="Informe de la obra con IA" onClick={() => setInformeIA(p)} style={{ ...btnIcono, border:"1px solid #DDD6FE", background:"#F5F3FF", color:"#7C3AED" }}>✨</button>}
                    <button title="Editar obra" onClick={() => setModal({ modo:"editar-obra", proyecto:p })} style={btnIcono}>✎</button>
                    {puedeArchivar && <button title="Archivar obra" onClick={() => archivarObra(p)} style={{ ...btnIcono, border:"1px solid #FECACA", background:"#FEF2F2", color:"#DC2626" }}>🗄</button>}
                  </div>
                </div>
                {p.lugar && <div style={{ fontSize:12, color:"#64748B", marginBottom:10 }}>📍 {p.lugar}</div>}
                <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, letterSpacing:0.4, marginBottom:6 }}>
                  {todas.length} ENTREGA{todas.length !== 1 ? "S" : ""}{hayFiltro && visibles.length < todas.length ? ` · MOSTRANDO ${visibles.length}` : ""}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {visibles.map(e => {
                    const est = estadoEntrega(e);
                    const sc = SC_ENTREGA[est.status];
                    const muebles = normalizarMuebles(e.muebles || []);
                    return (
                      <div key={e.id} onClick={() => setDetalleId(e.id)}
                        style={{ border:`1px solid ${sc.border}`, background:"#FAFBFC", borderRadius:10, padding:"9px 11px", cursor:"pointer" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"#1A2B4A" }}>{e.etiqueta || "Entrega"}</div>
                          <span style={{ padding:"2px 8px", borderRadius:6, background:sc.bg, color:sc.text, fontSize:11, fontWeight:700, border:`1px solid ${sc.border}`, whiteSpace:"nowrap" }}>{est.label}</span>
                        </div>
                        <div style={{ fontSize:12, color:"#64748B", marginTop:3, display:"flex", gap:10, flexWrap:"wrap" }}>
                          {e.fecha_inicio && <span>🔨 {formatDate(e.fecha_inicio)}</span>}
                          <span>📅 {e.fecha ? formatDate(e.fecha) : "Sin fecha"}</span>
                        </div>
                        {muebles.length > 0 && (
                          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                            {muebles.slice(0, 3).map((m, i) => (
                              <div key={i} style={{ background:"#ffffff", border:"1px solid #E2E8F0", borderRadius:4, padding:"2px 8px", fontSize:11, color:"#475569" }}>{m.nombre}{m.cantidad > 1 ? ` ×${m.cantidad}` : ""}</div>
                            ))}
                            {muebles.length > 3 && <div style={{ background:"#ffffff", border:"1px solid #E2E8F0", borderRadius:4, padding:"2px 8px", fontSize:11, color:"#94A3B8" }}>+{muebles.length - 3}</div>}
                          </div>
                        )}
                        <div onClick={ev => ev.stopPropagation()} style={{ display:"flex", gap:5, marginTop:8 }}>
                          <button onClick={() => setModal({ modo:"editar-entrega", proyecto:p, entrega:e })} style={btnSm}>Editar</button>
                          <button onClick={() => generarPDF(e)} style={btnSm}>PDF</button>
                          {e.estado !== "terminado" && <button onClick={() => marcarEntregada(e)} style={{ ...btnSm, background:"#ECFDF5", border:"1px solid #A7F3D0", color:"#059669" }}>Entregar</button>}
                          {puedeArchivar && <button title="Archivar entrega" onClick={() => archivarEntrega(e)} style={{ ...btnSm, flex:"0 0 auto", padding:"6px 9px", background:"#FEF2F2", border:"1px solid #FECACA", color:"#DC2626" }}>🗄</button>}
                        </div>
                      </div>
                    );
                  })}
                  {!todas.length && <div style={{ fontSize:12, color:"#94A3B8" }}>Sin entregas activas</div>}
                </div>
                <button onClick={() => setModal({ modo:"nueva-entrega", proyecto:p, etiquetaSugerida: todas.length ? `${todas.length + 1}ª entrega` : "" })}
                  style={{ width:"100%", marginTop:10, padding:"8px 0", background:"#ffffff", border:"1px dashed #CBD5E1", borderRadius:8, color:"#2563EB", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
                  + Agregar entrega
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setModal({ modo:"nueva-obra" })} className="boton-flotante"
        style={{ position:"fixed", bottom:28, right:24, height:48, padding:"0 22px", borderRadius:12, background:"#1A2B4A", border:"none", fontSize:13, fontWeight:600, color:"#ffffff", boxShadow:"0 4px 20px rgba(26,43,74,0.35)", cursor:"pointer", zIndex:200, display:"flex", alignItems:"center", gap:8, fontFamily:"'Inter', sans-serif" }}
        onMouseEnter={e => { e.currentTarget.style.background="#2563EB"; }}
        onMouseLeave={e => { e.currentTarget.style.background="#1A2B4A"; }}>
        + Nueva obra
      </button>

      {modal && <ModalObraEntrega {...modal} guardando={guardando} onClose={() => setModal(null)} onSave={guardar} />}

      {detalle && <DetalleObraEntrega obra={detalle} sesion={sesion} rol={sesion.rol}
        onClose={() => setDetalleId(null)}
        onEdit={() => { setModal({ modo:"editar-entrega", proyecto: proyectoDe(detalle), entrega: detalle }); setDetalleId(null); }}
        onDelete={() => archivarEntrega(detalle)} onEntregada={() => marcarEntregada(detalle)} />}

      {verArchivo && <ArchivoObras obras={obras} proyectos={proyectos} sesion={sesion} onClose={() => setVerArchivo(false)} onCambio={recargarObras} />}

      {informeIA && <ModalInformeIA proyecto={informeIA} onClose={() => setInformeIA(null)} />}
    </div>
  );
}

// ─── MODAL OBRA / ENTREGA (Entregas) ──────────────────────────────────────────
// nueva-obra: datos de la obra + su primera entrega · editar-obra: solo la obra · nueva/editar-entrega: solo la entrega
function ModalObraEntrega({ modo, proyecto, entrega, etiquetaSugerida = "", guardando, onClose, onSave }) {
  const conObra = modo === "nueva-obra" || modo === "editar-obra";
  const conEntrega = modo !== "editar-obra";
  const [obraForm, setObraForm] = useState({ nombre: proyecto?.nombre || "", lugar: proyecto?.lugar || "" });
  const [form, setForm] = useState({
    etiqueta: entrega ? (entrega.etiqueta || "") : etiquetaSugerida, fecha_inicio: entrega?.fecha_inicio || "", fecha: entrega?.fecha || "",
    estado: entrega?.estado || "pendiente", muebles: normalizarMuebles(entrega?.muebles), notas: entrega?.notas || "",
  });
  const [muebleInput, setMuebleInput] = useState("");
  const [cantInput, setCantInput] = useState("1");
  const [errors, setErrors] = useState({});

  function addMueble() { const v = muebleInput.trim(); if (!v) return; const cant = Math.max(1, parseInt(cantInput) || 1); setForm(f => ({ ...f, muebles: [...f.muebles, { nombre: v, cantidad: cant }] })); setMuebleInput(""); setCantInput("1"); }
  function rmMueble(i) { setForm(f => ({ ...f, muebles: f.muebles.filter((_,x) => x !== i) })); }

  function handleSave() {
    const e = {};
    if (conObra && !obraForm.nombre.trim()) e.nombre = "Requerido";
    if (conObra && !obraForm.lugar.trim()) e.lugar = "Requerido";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    onSave({ obraForm: conObra ? obraForm : null, entregaForm: conEntrega ? form : null });
  }

  const campoInput = { width:"100%", padding:"10px 13px", background:"#F8FAFC", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box" };
  const label = { display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 };
  const inpObra = (texto, key, ph) => (
    <div style={{ marginBottom:16 }}>
      <label style={label}>{texto}</label>
      <input value={obraForm[key]} placeholder={ph}
        onChange={e => { setObraForm(f => ({...f, [key]: e.target.value})); setErrors(er => ({...er,[key]:""})); }}
        style={{ ...campoInput, border:`1px solid ${errors[key] ? "#FCA5A5" : "#E2E8F0"}` }} />
      {errors[key] && <div style={{ color:"#DC2626", fontSize:11, marginTop:4 }}>{errors[key]}</div>}
    </div>
  );
  const inpEntrega = (texto, key, type="text", ph="") => (
    <div style={{ marginBottom:16 }}>
      <label style={label}>{texto}</label>
      <input type={type} value={form[key]} placeholder={ph} onChange={e => setForm(f => ({...f, [key]: e.target.value}))} style={{ ...campoInput, border:"1px solid #E2E8F0" }} />
    </div>
  );
  const modalInp = { padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" };
  const titulo = { "nueva-obra":"Nueva obra", "editar-obra":"Editar obra", "nueva-entrega":"Nueva entrega", "editar-entrega":"Editar entrega" }[modo];

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:540, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"#ffffff", borderRadius:"14px 14px 0 0", zIndex:1 }}>
          <div>
            <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{titulo}</h2>
            {!conObra && proyecto && <div style={{ fontSize:12, color:"#64748B", marginTop:3 }}>Obra: {proyecto.nombre}</div>}
          </div>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"24px" }}>
          {conObra && (<>
            {inpObra("Nombre de la obra", "nombre", "Ej: BBVA Flores")}
            {inpObra("Dirección", "lugar", "Calle, número, barrio...")}
            {modo === "editar-obra" && <div style={{ fontSize:12, color:"#64748B", marginBottom:20 }}>El nombre y la dirección se actualizan en todas las entregas y pestañas de esta obra.</div>}
          </>)}
          {modo === "nueva-obra" && <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", letterSpacing:0.5, margin:"4px 0 12px", paddingTop:14, borderTop:"1px solid #F1F5F9" }}>PRIMERA ENTREGA</div>}
          {conEntrega && (<>
            {inpEntrega("Nombre de la entrega (opcional)", "etiqueta", "text", "Ej: 1ª entrega, Planta baja, Mobiliario de cajas...")}
            <div className="grid-form" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {inpEntrega("Fecha de inicio / pedido", "fecha_inicio", "date")}
              {inpEntrega("Fecha de entrega", "fecha", "date")}
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={label}>Estado</label>
              <select value={form.estado} onChange={e => setForm(f => ({...f, estado: e.target.value}))} style={{ ...modalInp, width:"100%" }}>
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En proceso</option>
                <option value="terminado">Terminado</option>
              </select>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ ...label, marginBottom:10 }}>Muebles de esta entrega</label>
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <input value={muebleInput} placeholder="Nombre del mueble" onChange={e => setMuebleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addMueble(); }}} style={{ ...modalInp, flex:1 }} />
                <input value={cantInput} type="number" min="1" placeholder="Cant." onChange={e => setCantInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addMueble(); }}} style={{ ...modalInp, width:70, textAlign:"center", fontWeight:600, color:"#2563EB" }} />
                <button onClick={addMueble} style={{ padding:"10px 16px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#ffffff", fontSize:16, cursor:"pointer", fontWeight:600 }}>+</button>
              </div>
              {form.muebles.length > 0 && (
                <div style={{ border:"1px solid #E2E8F0", borderRadius:10, overflow:"hidden" }}>
                  {form.muebles.map((m, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderBottom: i < form.muebles.length-1 ? "1px solid #F1F5F9" : "none", background:"#FAFBFC" }}>
                      <span style={{ flex:1, fontSize:13, color:"#1A2B4A" }}>{m.nombre}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:"#2563EB" }}>×{m.cantidad}</span>
                      <button onClick={() => rmMueble(i)} style={{ background:"none", border:"none", color:"#CBD5E1", cursor:"pointer", fontSize:16, padding:"0 2px" }}
                        onMouseEnter={e => e.currentTarget.style.color="#EF4444"} onMouseLeave={e => e.currentTarget.style.color="#CBD5E1"}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={label}>Notas</label>
              <textarea value={form.notas} rows={3} placeholder="Observaciones..." onChange={e => setForm(f => ({...f, notas: e.target.value}))}
                style={{ ...campoInput, border:"1px solid #E2E8F0", resize:"vertical" }} />
            </div>
          </>)}
          <button onClick={handleSave} disabled={guardando} style={{ width:"100%", padding:"12px", background: guardando ? "#94A3B8" : "#1A2B4A", border:"none", borderRadius:8, fontFamily:"'Inter', sans-serif", fontSize:14, fontWeight:600, color:"#ffffff", cursor: guardando ? "not-allowed" : "pointer" }}>
            {guardando ? "Guardando..." : modo === "editar-obra" ? "Guardar obra" : modo === "nueva-obra" ? "Crear obra" : "Guardar entrega"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ARCHIVO (obras y entregas archivadas) ────────────────────────────────────
function ArchivoObras({ obras, proyectos, sesion, onClose, onCambio }) {
  const [trabajando, setTrabajando] = useState(null);
  const isAdmin = sesion.rol === "admin";
  const obrasArchivadas = proyectos.filter(p => p.archivada)
    .map(p => ({ p, entregas: obras.filter(e => e.proyecto_id === p.id) }))
    .sort((a, b) => (b.p.archivada_en || "").localeCompare(a.p.archivada_en || ""));
  const entregasArchivadas = obras.filter(e => e.archivada && !proyectos.find(p => p.id === e.proyecto_id)?.archivada)
    .sort((a, b) => (b.archivada_en || "").localeCompare(a.archivada_en || ""));
  const fechaArch = iso => iso ? new Date(iso).toLocaleDateString("es-AR") : "";

  async function hacer(id, accion) {
    setTrabajando(id);
    try { await accion(); await onCambio(); }
    catch (e) { avisar(`No se pudo completar: ${e.message}`, { tipo: "error" }); }
    setTrabajando(null);
  }
  const restaurarObra = ({ p }) => hacer(p.id, async () => {
    await patchEntregas(`proyecto_id=eq.${p.id}`, { archivada: false, archivada_en: null });
    await patchProyecto(p.id, { archivada: false, archivada_en: null });
  });
  const restaurarEntrega = e => hacer(e.id, () => patchEntregas(`id=eq.${e.id}`, { archivada: false, archivada_en: null }));
  async function eliminarObra({ p, entregas }) {
    if (!await confirmar(`¿Eliminar DEFINITIVAMENTE la obra "${p.nombre}"?\n\nSe borran sus ${entregas.length} entrega(s) y todo lo vinculado en las otras pestañas: cobros, materiales, avance de producción, avance de obra (con fotos e informes) y obras aceptadas.\n\nNo se puede deshacer.`, { boton: "Eliminar definitivamente" })) return;
    hacer(p.id, () => eliminarObraDefinitiva(p.id, entregas.map(e => e.id)));
  }
  async function eliminarEntrega(e) {
    if (!await confirmar(`¿Eliminar DEFINITIVAMENTE la entrega "${e.nombre}"?\n\nSe borra también su cobro, sus materiales, su avance de producción y su avance de obra (con fotos e informes).\n\nNo se puede deshacer.`, { boton: "Eliminar definitivamente" })) return;
    hacer(e.id, () => eliminarEntregaDefinitiva(e.id));
  }

  const fila = { display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, padding:"12px 14px", border:"1px solid #E2E8F0", borderRadius:10, marginBottom:8, background:"#FAFBFC" };
  const btn = { padding:"6px 12px", borderRadius:7, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif", whiteSpace:"nowrap" };
  const botones = (id, restaurar, eliminar) => (
    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
      {trabajando === id ? <span style={{ fontSize:12, color:"#94A3B8" }}>Procesando...</span> : (<>
        <button onClick={restaurar} disabled={!!trabajando} style={{ ...btn, background:"#ECFDF5", border:"1px solid #A7F3D0", color:"#059669" }}>↩ Restaurar</button>
        {isAdmin && <button onClick={eliminar} disabled={!!trabajando} style={{ ...btn, background:"#FEF2F2", border:"1px solid #FECACA", color:"#DC2626" }}>Eliminar definitivamente</button>}
      </>)}
    </div>
  );

  return (
    <div onClick={e => e.target === e.currentTarget && !trabajando && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:640, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"#ffffff", zIndex:1 }}>
          <div>
            <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>🗄 Archivo</h2>
            <div style={{ fontSize:12, color:"#64748B", marginTop:3 }}>Lo archivado no se ve en ninguna pestaña. Restaurarlo lo vuelve a mostrar en todas.</div>
          </div>
          <button onClick={onClose} disabled={!!trabajando} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"20px 24px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", letterSpacing:0.5, marginBottom:10 }}>OBRAS ARCHIVADAS ({obrasArchivadas.length})</div>
          {obrasArchivadas.length === 0 && <div style={{ fontSize:13, color:"#94A3B8", marginBottom:16 }}>No hay obras archivadas.</div>}
          {obrasArchivadas.map(g => (
            <div key={g.p.id} style={fila}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, color:"#1A2B4A" }}>{g.p.nombre}</div>
                <div style={{ fontSize:12, color:"#64748B" }}>
                  {g.p.lugar ? `📍 ${g.p.lugar} · ` : ""}{g.entregas.length} entrega{g.entregas.length !== 1 ? "s" : ""}{g.p.archivada_en ? ` · archivada el ${fechaArch(g.p.archivada_en)}` : ""}
                </div>
              </div>
              {botones(g.p.id, () => restaurarObra(g), () => eliminarObra(g))}
            </div>
          ))}
          <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", letterSpacing:0.5, margin:"20px 0 10px" }}>ENTREGAS ARCHIVADAS DE OBRAS ACTIVAS ({entregasArchivadas.length})</div>
          {entregasArchivadas.length === 0 && <div style={{ fontSize:13, color:"#94A3B8" }}>No hay entregas archivadas sueltas.</div>}
          {entregasArchivadas.map(e => (
            <div key={e.id} style={fila}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, color:"#1A2B4A" }}>{e.nombre}</div>
                <div style={{ fontSize:12, color:"#64748B" }}>📅 {e.fecha ? formatDate(e.fecha) : "Sin fecha"}{e.archivada_en ? ` · archivada el ${fechaArch(e.archivada_en)}` : ""}</div>
              </div>
              {botones(e.id, () => restaurarEntrega(e), () => eliminarEntrega(e))}
            </div>
          ))}
          {!isAdmin && <div style={{ fontSize:12, color:"#94A3B8", marginTop:16 }}>Solo un administrador puede eliminar definitivamente.</div>}
        </div>
      </div>
    </div>
  );
}

// ─── DETALLE OBRA (Entregas) ──────────────────────────────────────────────────
function DetalleObraEntrega({ obra, onClose, onEdit, onDelete, onEntregada, rol, sesion }) {
  const dias = obra.fecha ? diasRestantes(obra.fecha) : null;
  const status = obra.fecha ? getStatus(dias, obra.estado) : (obra.estado === "terminado" ? "done" : "ok");
  const sc = { urgent:{bg:"#FEF2F2",text:"#DC2626",border:"#FECACA",label:"Urgente"}, vencida:{bg:"#FEF2F2",text:"#DC2626",border:"#FECACA",label:"Vencida"}, warning:{bg:"#FFFBEB",text:"#D97706",border:"#FDE68A",label:"Próxima"}, ok:{bg:"#ECFDF5",text:"#059669",border:"#A7F3D0",label:"A tiempo"}, done:{bg:"#F8FAFC",text:"#64748B",border:"#E2E8F0",label:"Entregada"} }[status] || {bg:"#ECFDF5",text:"#059669",border:"#A7F3D0",label:"OK"};
  const diasLabel = obra.estado === "terminado" ? "Entregada" : dias == null ? "Sin fecha de entrega" : dias < 0 ? `Vencida hace ${Math.abs(dias)} días` : dias === 0 ? "Entrega hoy" : `${dias} días para entrega`;

  const [agregados, setAgregados] = useState([]);
  const [showAddAgr, setShowAddAgr] = useState(false);
  const [agrForm, setAgrForm] = useState({ articulo:"", cantidad:"1", unidad:"" });
  const [guardandoAgr, setGuardandoAgr] = useState(false);
  useEffect(() => { getAgregados(obra.id).then(a => setAgregados(a || [])).catch(() => {}); }, [obra.id]);

  async function agregarItem() {
    if (!agrForm.articulo.trim()) return;
    setGuardandoAgr(true);
    try {
      const nuevo = { id: uid(), obra_id: obra.id, articulo: agrForm.articulo.trim(), cantidad: parseFloat(agrForm.cantidad) || 1, unidad: agrForm.unidad.trim(), agregado_por: sesion.id, agregado_por_nombre: sesion.nombre, fecha: new Date().toISOString() };
      await insertAgregado(nuevo);
      setAgregados(a => [nuevo, ...a]);
      setAgrForm({ articulo:"", cantidad:"1", unidad:"" });
      setShowAddAgr(false);
    } catch { avisar("Error al guardar.", { tipo: "error" }); }
    setGuardandoAgr(false);
  }

  const agrInp = { padding:"9px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", backdropFilter:"blur(4px)", zIndex:400, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#ffffff", borderRadius:"16px 16px 0 0", width:"100%", maxWidth:620, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 -8px 40px rgba(15,23,42,0.15)" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 0" }}><div style={{ width:36, height:4, background:"#E2E8F0", borderRadius:2 }} /></div>
        <div style={{ padding:"16px 24px 0", display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
          <div style={{ flex:1, paddingRight:12 }}>
            <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:19, fontWeight:700, color:"#1A2B4A", margin:"0 0 8px" }}>{obra.nombre}</h2>
            <span style={{ display:"inline-block", padding:"4px 12px", borderRadius:6, background:sc.bg, color:sc.text, fontSize:11, fontWeight:700, border:`1px solid ${sc.border}` }}>{sc.label} — {diasLabel}</span>
          </div>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"20px 24px 36px" }}>
          <div className="grid-form" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            {[{ label:"Lugar", val: obra.lugar }, { label:"Inicio", val: obra.fecha_inicio ? formatDate(obra.fecha_inicio) : "—" }, { label:"Entrega", val: obra.fecha ? formatDate(obra.fecha) : "Sin fecha" }, { label:"Estado", val: ESTADO_LABELS[obra.estado] }, { label:"Muebles", val: `${normalizarMuebles(obra.muebles||[]).reduce((a,m)=>a+(m.cantidad||1),0)} unidades` }].map(d => (
              <div key={d.label} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, marginBottom:4 }}>{d.label.toUpperCase()}</div>
                <div style={{ fontSize:13, color:"#1A2B4A", fontWeight:500 }}>{d.val}</div>
              </div>
            ))}
          </div>
          {obra.notas && <div style={{ background:"#F8FAFC", borderLeft:"3px solid #2563EB", padding:"12px 16px", borderRadius:"0 8px 8px 0", marginBottom:20, fontSize:13, color:"#475569", lineHeight:1.7 }}>{obra.notas}</div>}

          {/* Muebles */}
          <div style={{ marginBottom:24 }}>
            <span style={{ fontSize:12, fontWeight:600, color:"#475569" }}>MUEBLES</span>
            {(obra.muebles||[]).length === 0 ? <div style={{ color:"#94A3B8", fontSize:13, marginTop:8 }}>Sin muebles</div>
              : <div style={{ border:"1px solid #E2E8F0", borderRadius:10, overflow:"hidden", marginTop:8 }}>
                {normalizarMuebles(obra.muebles).map((m, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", padding:"11px 14px", borderBottom: i < obra.muebles.length-1 ? "1px solid #F1F5F9" : "none" }}>
                    <span style={{ flex:1, fontSize:14, color:"#1A2B4A" }}>{m.nombre}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:"#2563EB", background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:6, padding:"2px 10px" }}>×{m.cantidad || 1}</span>
                  </div>
                ))}
              </div>}
          </div>

          {/* Agregados */}
          <div style={{ paddingTop:20, borderTop:"1px solid #F1F5F9" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontSize:12, fontWeight:600, color:"#475569" }}>AGREGADOS</span>
              <button onClick={() => setShowAddAgr(!showAddAgr)} style={{ padding:"5px 14px", background: showAddAgr ? "#F8FAFC" : "#1A2B4A", border:`1px solid ${showAddAgr ? "#E2E8F0" : "#1A2B4A"}`, borderRadius:7, color: showAddAgr ? "#64748B" : "#ffffff", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                {showAddAgr ? "Cancelar" : "+ Agregar"}
              </button>
            </div>
            {showAddAgr && (
              <div style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:10, padding:"14px", marginBottom:12 }}>
                <input placeholder="Artículo" value={agrForm.articulo} onChange={e => setAgrForm(f => ({...f, articulo: e.target.value}))} style={{ ...agrInp, width:"100%", marginBottom:8 }} />
                <div style={{ display:"flex", gap:8 }}>
                  <input type="number" placeholder="Cant." value={agrForm.cantidad} onChange={e => setAgrForm(f => ({...f, cantidad: e.target.value}))} style={{ ...agrInp, width:90, textAlign:"center", fontWeight:600, color:"#2563EB" }} />
                  <input placeholder="Unidad" value={agrForm.unidad} onChange={e => setAgrForm(f => ({...f, unidad: e.target.value}))} style={{ ...agrInp, flex:1 }} />
                  <button onClick={agregarItem} disabled={guardandoAgr} style={{ padding:"9px 16px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#ffffff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                    {guardandoAgr ? "..." : "OK"}
                  </button>
                </div>
              </div>
            )}
            {agregados.length === 0 ? <div style={{ color:"#94A3B8", fontSize:13, textAlign:"center", padding:"16px 0" }}>Sin agregados</div>
              : <div style={{ border:"1px solid #E2E8F0", borderRadius:10, overflow:"hidden" }}>
                {agregados.map((a, i) => (
                  <div key={a.id} style={{ display:"flex", alignItems:"center", padding:"11px 14px", borderBottom: i < agregados.length-1 ? "1px solid #F1F5F9" : "none" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, color:"#1A2B4A", fontWeight:500 }}>{a.articulo}</div>
                      <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>{a.agregado_por_nombre}</div>
                    </div>
                    <span style={{ fontSize:13, fontWeight:700, color:"#2563EB", background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:6, padding:"2px 10px" }}>{a.cantidad}{a.unidad ? ` ${a.unidad}` : ""}</span>
                  </div>
                ))}
              </div>}
          </div>

          <div style={{ display:"flex", gap:8, marginTop:24, flexWrap:"wrap" }}>
            <button onClick={onEdit} style={{ padding:"9px 18px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Editar</button>
            <button onClick={() => generarPDF(obra)} style={{ padding:"9px 18px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>PDF</button>
            {obra.estado !== "terminado" && <button onClick={onEntregada} style={{ padding:"9px 18px", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:8, color:"#059669", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Entregada</button>}
            {(rol === "admin" || rol === "operario") && <button onClick={onDelete} style={{ padding:"9px 18px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>🗄 Archivar</button>}
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// AVANCE DE OBRA MODULE (Aixaobra)
// ═══════════════════════════════════════════════════════════════════════════════
function AvanceModule({ sesion, entregas = [] }) {
  const [aixaObrasTodas, setAixaObras] = useState([]);
  const [showElegirEntrega, setShowElegirEntrega] = useState(false);
  const { activas, archivadas, existentes } = vinculoEntregas(entregas);
  // Lo de entregas archivadas no se muestra
  const aixaObras = aixaObrasTodas.filter(o => !archivadas.has(o.obra_id));
  const [aixaUsers, setAixaUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedObra, setSelectedObra] = useState(null);
  const [section, setSection] = useState("overview");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showObraModal, setShowObraModal] = useState(false);
  const [editingObra, setEditingObra] = useState(null);
  const [showStationModal, setShowStationModal] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [showClarifModal, setShowClarifModal] = useState(false);
  const [editingClarif, setEditingClarif] = useState(null);
  const [newStationName, setNewStationName] = useState("");

  const isAdmin = sesion.rol === "admin";
  const canManageStations = isAdmin || sesion.rol === "operario";

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [obs, users] = await Promise.all([getAixaObras(), getAixaUsers()]);
        setAixaObras(obs || []);
        setAixaUsers(users || []);
      } catch (e) { console.error("Error cargando Avance de Producción:", e); avisar("No se pudieron cargar las obras de Avance de Producción.", { tipo: "error" }); }
      setLoading(false);
    })();
  }, []);

  async function recargar() {
    try { const obs = await getAixaObras(); setAixaObras(obs || []); }
    catch (e) { console.error("Error recargando Avance de Producción:", e); avisar("No se pudieron recargar las obras de Avance de Producción.", { tipo: "error" }); }
  }

  const obra = selectedObra ? aixaObras.find(o => o.id === selectedObra) : null;

  // Filtered obras
  const filtered = aixaObras.filter(o => {
    const q = search.toLowerCase();
    if (q && !o.name.toLowerCase().includes(q) && !(o.client||'').toLowerCase().includes(q)) return false;
    if (filter === "active") return obraProgressAixa(o) < 100 && !isDelayedAixa(o);
    if (filter === "done") return obraProgressAixa(o) === 100;
    if (filter === "delayed") return isDelayedAixa(o);
    return true;
  });

  // Stats
  const total = aixaObras.length;
  const done = aixaObras.filter(o => obraProgressAixa(o) === 100).length;
  const delayed = aixaObras.filter(o => isDelayedAixa(o)).length;

  // Nombre, cliente y fecha de entrega vienen de la pestaña Entregas; acá se edita el inicio y la descripción
  async function saveObra({ name, client, start_date, due_date, description }) {
    setLoading(true);
    try {
      await modificarFila("avance_obras", editingObra, o => {
        const hist = o.history || [];
        hist.unshift({ user: sesion.nombre, role: sesion.rol, action: `Obra editada`, time: new Date().toISOString() });
        const datos = existentes.has(o.obra_id)
          ? { start_date: start_date||null, description }
          : { name, client, start_date: start_date||null, due_date: due_date||null, description };
        return { ...datos, history: hist };
      });
      await recargar();
    } catch { avisar("Error al guardar", { tipo: "error" }); }
    setLoading(false); setShowObraModal(false); setEditingObra(null);
  }

  async function agregarEntrega(e) {
    await insertAixaObra({ obra_id: e.id, name: e.nombre, client: e.lugar, start_date: null, due_date: e.fecha || null, description: e.notas || "", stations: mkStations(), history: [], clarifications: [] });
    await recargar();
  }

  async function delObra(id) {
    if (!await confirmar("¿Eliminar esta obra?")) return;
    setLoading(true);
    try { await deleteAixaObraApi(id); if (selectedObra === id) setSelectedObra(null); await recargar(); } catch (e) { avisar(`No se pudo eliminar la obra. ${e.message || ""}`, { tipo: "error" }); }
    setLoading(false);
  }

  async function saveStation(stationIdx, datos) {
    if (!obra) return;
    const nombre = obra.stations?.[stationIdx]?.name;
    setLoading(true);
    let guardada = null;
    try {
      guardada = await modificarFila("avance_obras", selectedObra, o => cambioEstacion(o, nombre, stationIdx, datos, sesion));
      await recargar();
    } catch (e) { avisar(`No se pudo guardar la estación. ${e.message || ""}`, { tipo: "error" }); }
    setLoading(false); setShowStationModal(false);
    ofrecerInformeCierre(guardada);
  }

  async function addStation(name) {
    if (!obra || !name.trim()) return;
    setLoading(true);
    try {
      await modificarFila("avance_obras", selectedObra, o => {
        const stations = o.stations || [];
        stations.push({ id: stations.length, name: name.trim(), status: 'pending', start_date: null, end_date: null, note: '' });
        const hist = o.history || [];
        hist.unshift({ user: sesion.nombre, role: sesion.rol, action: `Nueva estación agregada: "${name.trim()}"`, time: new Date().toISOString() });
        return { stations, history: hist };
      });
      await recargar(); setNewStationName("");
    } catch (e) { avisar(`No se pudo agregar la estación. ${e.message || ""}`, { tipo: "error" }); }
    setLoading(false);
  }

  async function deleteStation(idx) {
    if (!obra) return;
    const nombre = obra.stations?.[idx]?.name;
    if (!await confirmar(`¿Eliminar la estación "${nombre}"?`)) return;
    setLoading(true);
    try {
      await modificarFila("avance_obras", selectedObra, o => {
        const stations = (o.stations || []).filter(s => s.name !== nombre);
        if (stations.length === (o.stations || []).length) return null; // ya la borró otra persona
        // Re-index ids
        stations.forEach((s, i) => s.id = i);
        const hist = o.history || [];
        hist.unshift({ user: sesion.nombre, role: sesion.rol, action: `Estación eliminada: "${nombre}"`, time: new Date().toISOString() });
        return { stations, history: hist };
      });
      await recargar();
    } catch (e) { avisar(`No se pudo eliminar la estación. ${e.message || ""}`, { tipo: "error" }); }
    setLoading(false);
  }

  async function saveClarif(title, station, responsible, detail) {
    if (!obra) return;
    // Las aclaraciones se identifican por su fecha de creación, que no cambia aunque otra persona agregue o borre
    const creada = editingClarif !== null ? obra.clarifications?.[editingClarif]?.time : null;
    setLoading(true);
    try {
      await modificarFila("avance_obras", selectedObra, o => {
        const clarifications = o.clarifications || [];
        const hist = o.history || [];
        if (editingClarif !== null) {
          const i = clarifications.findIndex(c => c.time === creada);
          if (i < 0) throw new Error("Otra persona eliminó esta aclaración.");
          clarifications[i] = { ...clarifications[i], title, station, responsible, detail, edited: true, edited_at: new Date().toISOString() };
          hist.unshift({ user: sesion.nombre, role: sesion.rol, action: `Aclaración editada: "${title}"`, time: new Date().toISOString() });
        } else {
          clarifications.unshift({ title, station, responsible, detail, author: sesion.nombre, time: new Date().toISOString() });
          hist.unshift({ user: sesion.nombre, role: sesion.rol, action: `Nueva aclaración: "${title}"`, time: new Date().toISOString() });
        }
        return { clarifications, history: hist };
      });
      await recargar();
    } catch (e) { avisar(`No se pudo guardar la aclaración. ${e.message || ""}`, { tipo: "error" }); }
    setLoading(false); setShowClarifModal(false); setEditingClarif(null);
  }

  async function deleteClarif(idx) {
    if (!await confirmar("¿Eliminar esta aclaración?")) return;
    if (!obra) return;
    const { time: creada, title } = obra.clarifications?.[idx] || {};
    setLoading(true);
    try {
      await modificarFila("avance_obras", selectedObra, o => {
        const clarifications = (o.clarifications || []).filter(c => c.time !== creada);
        if (clarifications.length === (o.clarifications || []).length) return null; // ya la borró otra persona
        const hist = o.history || [];
        hist.unshift({ user: sesion.nombre, role: sesion.rol, action: `Aclaración eliminada: "${title}"`, time: new Date().toISOString() });
        return { clarifications, history: hist };
      });
      await recargar();
    } catch (e) { avisar(`No se pudo eliminar la aclaración. ${e.message || ""}`, { tipo: "error" }); }
    setLoading(false);
  }

  if (loading) return <div style={{ textAlign:"center", padding:"60px 0", color:"#94A3B8", fontSize:13 }}>Cargando avance de obras...</div>;

  // DETAIL VIEW
  if (obra) {
    const pct = obraProgressAixa(obra);
    const st = obra.stations || [];
    const barColor = pct === 100 ? "#059669" : pct > 50 ? "#D97706" : "#2563EB";

    return (
      <div>
        {/* Back button */}
        <button onClick={() => { setSelectedObra(null); setSection("overview"); }}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#64748B", fontSize:13, cursor:"pointer", fontFamily:"'Inter', sans-serif", marginBottom:20 }}>
          ← Volver a obras
        </button>

        {/* Obra title & tabs */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:20, fontWeight:700, color:"#1A2B4A", margin:0 }}>{obra.name}</h2>
            {pct === 100 && (
              <button onClick={() => generarInformeCierre(obra)}
                style={{ padding:"6px 16px", background:"#2563EB", border:"none", borderRadius:8, color:"#ffffff", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif", display:"flex", alignItems:"center", gap:4 }}>
                📄 Informe de cierre
              </button>
            )}
          </div>
          <div className="barra-filtros" style={{ display:"flex", gap:4, background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:10, padding:4 }}>
            {["overview","stations","history","clarifications"].map(s => {
              const labels = { overview:"Resumen", stations:"Estaciones", history:"Historial", clarifications:"Aclaraciones" };
              return (
                <button key={s} onClick={() => setSection(s)} style={{ padding:"6px 14px", borderRadius:7, border:"none", background: section===s ? "#1A2B4A" : "transparent", color: section===s ? "#ffffff" : "#64748B", fontFamily:"'Inter', sans-serif", fontSize:12, fontWeight: section===s ? 600 : 400, cursor:"pointer" }}>
                  {labels[s]}
                </button>
              );
            })}
          </div>
        </div>

        {/* OVERVIEW */}
        {section === "overview" && (
          <div>
            <div style={{ background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:12, padding:20, marginBottom:18 }}>
              <div style={{ fontSize:11, fontWeight:600, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:14 }}>Fechas y estado</div>
              <div style={{ display:"flex", gap:24, flexWrap:"wrap", marginBottom:16 }}>
                <div><div style={{ fontSize:11, color:"#94A3B8" }}>Cliente</div><div style={{ fontSize:15, fontWeight:700, color:"#1A2B4A" }}>{obra.client || "—"}</div></div>
                <div><div style={{ fontSize:11, color:"#94A3B8" }}>Inicio</div><div style={{ fontSize:15, fontWeight:700, color:"#1A2B4A" }}>{fmtDateAixa(obra.start_date)}</div></div>
                <div><div style={{ fontSize:11, color:"#94A3B8" }}>Entrega</div><div style={{ fontSize:15, fontWeight:700, color:"#1A2B4A" }}>{fmtDateAixa(obra.due_date)}</div></div>
                {obra.due_date && (() => {
                  const dd = daysDelayedAixa(obra);
                  if (dd > 0 && pct < 100) return <div style={{ padding:"5px 12px", borderRadius:7, background:"#FEF2F2", border:"1px solid #FECACA", color:"#DC2626", fontWeight:700, fontSize:13 }}>⚠ {dd} días de retraso</div>;
                  if (dd === 0) return <div style={{ padding:"5px 12px", borderRadius:7, background:"#ECFDF5", border:"1px solid #A7F3D0", color:"#059669", fontWeight:700, fontSize:13 }}>Entrega hoy</div>;
                  return <div style={{ padding:"5px 12px", borderRadius:7, background:"#ECFDF5", border:"1px solid #A7F3D0", color:"#059669", fontWeight:700, fontSize:13 }}>Faltan {Math.abs(dd)} días</div>;
                })()}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
                <span style={{ color:"#94A3B8" }}>Progreso total</span>
                <span style={{ fontWeight:700, color:barColor }}>{pct}%</span>
              </div>
              <div style={{ background:"#E8ECF0", borderRadius:99, height:7 }}>
                <div style={{ height:7, borderRadius:99, width:`${pct}%`, background:barColor, transition:"width 0.4s" }} />
              </div>
            </div>

            {/* Pipeline */}
            <div style={{ background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:12, padding:20, marginBottom:18 }}>
              <div style={{ fontSize:11, fontWeight:600, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:14 }}>Flujo de estaciones</div>
              <div style={{ display:"flex", alignItems:"center", overflowX:"auto", gap:4 }}>
                {st.map((s, i) => {
                  const colors = { done:{bg:"#ECFDF5",text:"#059669",border:"#A7F3D0"}, active:{bg:"#FFFBEB",text:"#D97706",border:"#FDE68A"}, blocked:{bg:"#FEF2F2",text:"#DC2626",border:"#FECACA"}, pending:{bg:"#F8FAFC",text:"#94A3B8",border:"#E2E8F0"} };
                  const c = colors[s.status] || colors.pending;
                  const icon = s.status==='done'?'✓ ':s.status==='active'?'▶ ':s.status==='blocked'?'✕ ':'';
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
                      <div style={{ padding:"6px 12px", borderRadius:6, background:c.bg, color:c.text, border:`1px solid ${c.border}`, fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{icon}{s.name}</div>
                      {i < st.length - 1 && <span style={{ color:"#E2E8F0", padding:"0 2px", fontSize:14 }}>›</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STATIONS */}
        {section === "stations" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:14, marginBottom:20 }}>
              {st.map((s, i) => {
                const labels = { pending:"Pendiente", active:"En progreso", done:"Completado", blocked:"Bloqueado" };
                const colors = { done:{bg:"#ECFDF5",text:"#059669",border:"#A7F3D0"}, active:{bg:"#FFFBEB",text:"#D97706",border:"#FDE68A"}, blocked:{bg:"#FEF2F2",text:"#DC2626",border:"#FECACA"}, pending:{bg:"#F8FAFC",text:"#94A3B8",border:"#E2E8F0"} };
                const c = colors[s.status] || colors.pending;
                let days = "";
                if (s.start_date && s.end_date) { const d = Math.max(0, Math.floor((new Date(s.end_date)-new Date(s.start_date))/86400000)); days = `${d} días en esta etapa`; }
                else if (s.start_date) { const d = Math.max(0, Math.floor((new Date()-new Date(s.start_date))/86400000)); days = `${d} días transcurridos`; }
                return (
                  <div key={i} onClick={() => { setEditingStation(i); setShowStationModal(true); }}
                    style={{ background:"#ffffff", border:`1.5px solid ${c.border}`, borderRadius:12, padding:"16px", cursor:"pointer", transition:"all 0.18s", position:"relative" }}>
                    <div style={{ position:"absolute", right:14, top:10, fontFamily:"'Sora', sans-serif", fontSize:28, fontWeight:800, color:"#E8ECF0" }}>{i+1}</div>
                    {canManageStations && (
                      <button onClick={(e) => { e.stopPropagation(); deleteStation(i); }} title="Eliminar estación"
                        style={{ position:"absolute", right:12, bottom:12, padding:"3px 7px", fontSize:11, border:"1px solid #FECACA", borderRadius:5, background:"#FEF2F2", color:"#DC2626", cursor:"pointer", opacity:0.6, transition:"opacity 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.opacity="1"} onMouseLeave={e => e.currentTarget.style.opacity="0.6"}>✕</button>
                    )}
                    <div style={{ fontFamily:"'Sora', sans-serif", fontSize:14, fontWeight:700, color:"#1A2B4A", textTransform:"uppercase", marginBottom:6 }}>{s.name}</div>
                    <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:99, background:c.bg, color:c.text, border:`1px solid ${c.border}`, fontSize:11, fontWeight:600 }}>{labels[s.status]}</span>
                    {days && <div style={{ fontSize:12, color:"#94A3B8", marginTop:8 }}>{days}</div>}
                    {s.operario && <div style={{ fontSize:12, color:"#475569", marginTop:6 }}>👷 {s.operario}</div>}
                    {(s.start_time || s.end_time || s.duration_min != null) && (
                      <div style={{ fontSize:12, color:"#475569", marginTop:4 }}>
                        ⏱ {s.start_time || "—"} → {s.end_time || "—"}{s.duration_min != null && <strong style={{ color:"#2563EB" }}> · {fmtDurAixa(s.duration_min)}</strong>}
                      </div>
                    )}
                    {s.note && <div style={{ fontSize:12, color:"#94A3B8", marginTop:6, borderTop:"1px solid #F1F5F9", paddingTop:6 }}>{s.note}</div>}
                    {s.start_date && <div style={{ fontSize:11, color:"#CBD5E1", marginTop:4 }}>Inicio: {fmtDateAixa(s.start_date)}</div>}
                    {s.end_date && <div style={{ fontSize:11, color:"#CBD5E1" }}>Fin: {fmtDateAixa(s.end_date)}</div>}
                  </div>
                );
              })}
            </div>
            {/* ADD STATION */}
            {canManageStations && (
              <div style={{ background:"#ffffff", border:"1.5px dashed #CBD5E1", borderRadius:12, padding:"16px 20px", display:"flex", gap:10, alignItems:"center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <input value={newStationName} onChange={e => setNewStationName(e.target.value)} placeholder="Nombre de la nueva estación..."
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addStation(newStationName); }}}
                  style={{ flex:1, padding:"9px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" }} />
                <button onClick={() => addStation(newStationName)} disabled={!newStationName.trim()}
                  style={{ padding:"9px 20px", background: newStationName.trim() ? "#1A2B4A" : "#CBD5E1", border:"none", borderRadius:8, color:"#ffffff", fontSize:13, fontWeight:600, cursor: newStationName.trim() ? "pointer" : "not-allowed", fontFamily:"'Inter', sans-serif", whiteSpace:"nowrap" }}>
                  Agregar estación
                </button>
              </div>
            )}
          </div>
        )}

        {/* HISTORY */}
        {section === "history" && (
          <div style={{ background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:12, padding:20 }}>
            {(obra.history||[]).length === 0 ? <div style={{ color:"#94A3B8", textAlign:"center", padding:20 }}>Sin cambios registrados</div>
              : (obra.history||[]).map((h, i) => (
                <div key={i} style={{ borderLeft:"2px solid #E8ECF0", padding:"10px 0 10px 16px", marginLeft:6, position:"relative" }}>
                  <div style={{ width:9, height:9, borderRadius:"50%", background:"#2563EB", position:"absolute", left:-5, top:14, border:"2px solid #F4F6F9" }} />
                  <div style={{ fontSize:12, color:"#94A3B8" }}><strong style={{ color:"#1A2B4A" }}>{h.user}</strong> <span style={{ fontSize:10, color:"#94A3B8", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:4, padding:"1px 6px" }}>{h.role}</span></div>
                  <div style={{ fontSize:13, color:"#1A2B4A", margin:"3px 0" }}>{h.action}</div>
                  <div style={{ fontSize:11, color:"#CBD5E1" }}>{fmtDateTimeAixa(h.time)}</div>
                </div>
              ))}
          </div>
        )}

        {/* CLARIFICATIONS — admin can edit/delete */}
        {section === "clarifications" && (
          <div>
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
              <button onClick={() => { setEditingClarif(null); setShowClarifModal(true); }} style={{ padding:"8px 18px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#ffffff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>+ Nueva aclaración</button>
            </div>
            {(obra.clarifications||[]).length === 0 ? <div style={{ background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:12, padding:30, textAlign:"center", color:"#94A3B8" }}>Sin aclaraciones</div>
              : (obra.clarifications||[]).map((c, i) => (
                <div key={i} style={{ background:"#ffffff", border:"1px solid #E8ECF0", borderLeft:"3px solid #D97706", borderRadius:"0 12px 12px 0", padding:16, marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:14, color:"#1A2B4A" }}>{c.title}</div>
                      {c.station && <span style={{ fontSize:12, color:"#2563EB" }}>📍 {c.station}</span>}
                    </div>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:12, color:"#94A3B8" }}>Por: <strong style={{ color:"#1A2B4A" }}>{c.author}</strong></div>
                        <div style={{ fontSize:11, color:"#CBD5E1" }}>{fmtDateTimeAixa(c.time)}{c.edited ? " (editada)" : ""}</div>
                      </div>
                      {isAdmin && (
                        <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                          <button onClick={() => { setEditingClarif(i); setShowClarifModal(true); }} title="Editar" style={{ padding:"3px 8px", fontSize:11, border:"1px solid #E2E8F0", borderRadius:5, background:"#F8FAFC", color:"#64748B", cursor:"pointer" }}>✎</button>
                          <button onClick={() => deleteClarif(i)} title="Eliminar" style={{ padding:"3px 8px", fontSize:11, border:"1px solid #FECACA", borderRadius:5, background:"#FEF2F2", color:"#DC2626", cursor:"pointer" }}>✕</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {c.responsible && <div style={{ fontSize:12, color:"#D97706", marginBottom:4 }}>⚠ Responsable: <strong>{c.responsible}</strong></div>}
                  <div style={{ fontSize:13, color:"#64748B" }}>{c.detail}</div>
                </div>
              ))}
          </div>
        )}

        {/* Station Modal */}
        {showStationModal && editingStation !== null && (() => {
          const s = st[editingStation];
          return <ModalSimple title={`Estación ${editingStation+1}: ${s.name}`} onClose={() => setShowStationModal(false)}
            onSave={(data) => saveStation(editingStation, data)}
            fields={camposEstacion(s)} />;
        })()}

        {/* Clarif Modal — supports edit */}
        {showClarifModal && (() => {
          const existing = editingClarif !== null ? (obra.clarifications||[])[editingClarif] : null;
          return <ModalSimple title={existing ? "Editar aclaración" : "Nueva aclaración"} onClose={() => { setShowClarifModal(false); setEditingClarif(null); }}
            onSave={(data) => saveClarif(data.title, data.station, data.responsible, data.detail)}
            fields={[
              { key:"title", label:"Título / Problema", type:"text", required:true, initial: existing?.title || "" },
              { key:"station", label:"Estación", type:"select", options:[{v:"",l:"— Sin estación —"}, ...st.map(s => ({v:s.name,l:s.name}))], initial: existing?.station || "" },
              { key:"responsible", label:"Responsable", type:"select", options:[{v:"",l:"— Sin responsable —"}, ...aixaUsers.map(u => ({v:u.name||u.nombre,l:u.name||u.nombre}))], initial: existing?.responsible || "" },
              { key:"detail", label:"Detalle", type:"textarea", initial: existing?.detail || "" },
            ]} />;
        })()}
      </div>
    );
  }

  // OBRAS LIST VIEW
  return (
    <div>
      {/* Stats */}
      {total > 0 && (
        <div className="grid-numeros" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
          {[
            { num: total, label:"Total obras", color:"#2563EB", border:"#DBEAFE" },
            { num: total - done - delayed, label:"En progreso", color:"#D97706", border:"#FDE68A" },
            { num: done, label:"Completadas", color:"#059669", border:"#A7F3D0" },
            { num: delayed, label:"Con demora", color:"#DC2626", border:"#FECACA" },
          ].map((s, i) => (
            <div key={i} style={{ background:"#ffffff", border:`1px solid ${s.border}`, borderRadius:12, padding:"20px 20px 18px", animation:`fadeUp 0.35s ease ${i*0.06}s both` }}>
              <div style={{ fontFamily:"'Sora', sans-serif", fontSize:32, fontWeight:800, color:s.color, lineHeight:1 }}>{s.num}</div>
              <div style={{ fontSize:12, color:"#64748B", fontWeight:500, marginTop:6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Title + filters */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>Obras — Avance de producción</h2>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            style={{ width:160, flex:"1 1 140px", padding:"8px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" }} />
          <select value={filter} onChange={e => setFilter(e.target.value)}
            style={{ padding:"8px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" }}>
            <option value="all">Todas</option>
            <option value="active">En progreso</option>
            <option value="done">Completadas</option>
            <option value="delayed">Con demora</option>
          </select>
          {(isAdmin || sesion.rol === "operario") && <button onClick={() => setShowElegirEntrega(true)} title="Las entregas nuevas se agregan solas al crearlas en Entregas" style={{ padding:"8px 18px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#ffffff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>+ Agregar entrega</button>}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🏗</div>
          <div style={{ fontSize:13, color:"#94A3B8" }}>No hay obras registradas</div>
        </div>
      ) : (
        <div className="grid-tarjetas" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:14 }}>
          {filtered.map((o, idx) => {
            const pct = obraProgressAixa(o);
            const del = isDelayedAixa(o);
            const barColor = pct === 100 ? "#059669" : del ? "#DC2626" : "#D97706";
            const st = o.stations || [];
            const ac = st.filter(s => s.status === 'active').length;
            const bl = st.filter(s => s.status === 'blocked').length;
            return (
              <div key={o.id} className="obra-card" onClick={() => { setSelectedObra(o.id); setSection("overview"); }}
                style={{ background:"#ffffff", border:`1.5px solid ${pct===100?"#A7F3D0":del?"#FECACA":"#FDE68A"}`, borderRadius:14, padding:18, cursor:"pointer", animation:`fadeUp 0.35s ease ${idx*0.04}s both`, position:"relative" }}>
                {(isAdmin || sesion.rol === "operario") && (
                  <div onClick={e => e.stopPropagation()} style={{ position:"absolute", top:10, right:10, display:"flex", gap:4 }}>
                    <button onClick={() => { setEditingObra(o.id); setShowObraModal(true); }} style={{ padding:"4px 8px", fontSize:11, border:"1px solid #E2E8F0", borderRadius:5, background:"#F8FAFC", color:"#64748B", cursor:"pointer" }}>✎</button>
                    {/* Las obras vinculadas se archivan o eliminan desde Entregas */}
                    {!existentes.has(o.obra_id) && <button onClick={() => delObra(o.id)} style={{ padding:"4px 8px", fontSize:11, border:"1px solid #FECACA", borderRadius:5, background:"#FEF2F2", color:"#DC2626", cursor:"pointer" }}>✕</button>}
                  </div>
                )}
                <div style={{ fontFamily:"'Sora', sans-serif", fontSize:15, fontWeight:700, color:"#1A2B4A", textTransform:"uppercase", marginBottom:3, paddingRight:60 }}>{o.name}</div>
                <div style={{ fontSize:12, color:"#94A3B8", marginBottom:10 }}>{o.client || "Sin cliente"}</div>
                <div style={{ height:4, background:"#E8ECF0", borderRadius:99, marginBottom:10 }}>
                  <div style={{ height:4, borderRadius:99, width:`${pct}%`, background:barColor }} />
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", fontSize:11, color:"#94A3B8" }}>
                  <span>{pct}% completado</span>
                  {o.due_date && <span>📅 {fmtDateAixa(o.due_date)}</span>}
                  {del && <span style={{ color:"#DC2626", fontWeight:700 }}>⚠ {daysDelayedAixa(o)}d demora</span>}
                  {ac > 0 && <span style={{ color:"#D97706" }}>▶ {ac} activa{ac>1?"s":""}</span>}
                  {bl > 0 && <span style={{ color:"#DC2626" }}>✕ {bl} bloqueada{bl>1?"s":""}</span>}
                  {pct === 100 && <span style={{ color:"#059669" }}>✓ Completada</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Obra modal */}
      {showObraModal && editingObra && (() => {
        const o = aixaObras.find(x => x.id === editingObra);
        if (!o) return null;
        const vinculada = existentes.has(o.obra_id);
        return <ModalSimple title={vinculada ? `Editar — ${o.name}` : "Editar Obra"} onClose={() => { setShowObraModal(false); setEditingObra(null); }}
          onSave={saveObra}
          fields={[
            ...(vinculada ? [] : [
              { key:"name", label:"Nombre de la obra", type:"text", required:true, initial: o.name },
              { key:"client", label:"Cliente", type:"text", initial: o.client },
            ]),
            { key:"start_date", label:"Fecha inicio", type:"date", initial: (o.start_date||"").split('T')[0] },
            ...(vinculada ? [] : [{ key:"due_date", label:"Fecha entrega", type:"date", initial: (o.due_date||"").split('T')[0] }]),
            { key:"description", label:"Descripción", type:"textarea", initial: o.description },
          ]} />;
      })()}

      {showElegirEntrega && <ModalElegirEntrega titulo="Agregar entrega a Avance de Producción"
        entregas={activas.filter(e => !aixaObrasTodas.some(a => a.obra_id === e.id))}
        onClose={() => setShowElegirEntrega(false)} onElegir={agregarEntrega} />}
    </div>
  );
}


// Botón "Enviar por mail": sale de la casilla de alertas a la lista fija de avisos; si se escriben
// destinatarios, van como "Para" y la lista fija en copia. enviar(para) devuelve la respuesta del servidor.
function EnviarPorMail({ enviar, deshabilitado, motivo, estiloBoton }) {
  const [abierto, setAbierto] = useState(false);
  const [para, setPara] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  async function mandar() {
    setEnviando(true); setResultado(null);
    try {
      const r = await enviar(para.trim());
      setResultado({ ok: true, texto: `Enviado a ${r.destinos} destinatario(s)${r.adjuntos ? ` con ${r.adjuntos} archivo(s) adjunto(s)` : ""}.` });
      setPara("");
    } catch (e) { setResultado({ ok: false, texto: e.message }); }
    setEnviando(false);
  }
  const cerrar = () => { if (!enviando) { setAbierto(false); setResultado(null); } };
  return (
    <>
      <button onClick={() => setAbierto(true)} disabled={deshabilitado} title={deshabilitado ? motivo : "Enviar desde la casilla de alertas"}
        style={{ ...estiloBoton, opacity: deshabilitado ? 0.5 : 1, cursor: deshabilitado ? "not-allowed" : "pointer" }}>📧 Enviar por mail</button>
      {abierto && (
        <div onClick={e => e.target === e.currentTarget && cerrar()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", zIndex:900, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:440, padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.25)", fontFamily:"'Inter', sans-serif", textTransform:"none", letterSpacing:0 }}>
            <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:"0 0 6px" }}>📧 Enviar por mail</h3>
            <p style={{ fontSize:12, color:"#64748B", margin:"0 0 14px", lineHeight:1.5 }}>Sale de la casilla de alertas a la lista de avisos. Si agregás destinatarios (por ejemplo el cliente o el arquitecto), les llega a ellos y la lista va en copia.</p>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Para (opcional)</label>
            <input value={para} onChange={e => setPara(e.target.value)} placeholder="cliente@empresa.com, otro@empresa.com" disabled={enviando}
              style={{ width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontSize:13, outline:"none", boxSizing:"border-box" }} />
            {resultado && <div style={{ marginTop:12, padding:"9px 12px", borderRadius:8, fontSize:12, background: resultado.ok ? "#ECFDF5" : "#FEF2F2", color: resultado.ok ? "#059669" : "#DC2626", border:`1px solid ${resultado.ok ? "#A7F3D0" : "#FECACA"}` }}>{resultado.texto}</div>}
            <div style={{ display:"flex", gap:10, marginTop:18 }}>
              <button onClick={cerrar} disabled={enviando} style={{ flex:1, padding:"10px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>{resultado?.ok ? "Cerrar" : "Cancelar"}</button>
              <button onClick={mandar} disabled={enviando}
                style={{ flex:1, padding:"10px", border:"none", borderRadius:8, background: enviando ? "#94A3B8" : "#0F766E", color:"#fff", cursor: enviando ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>{enviando ? "Enviando..." : "Enviar"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Informe general de una obra hecho con Claude (desde Entregas): se puede regenerar, imprimir y mandar por mail
function ModalInformeIA({ proyecto, onClose }) {
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  async function generar() {
    try {
      const r = await apiFetch("/api/informe-obra", { method: "POST", body: JSON.stringify({ proyectoId: proyecto.id, accion: "generar" }) });
      setResultado(r);
    } catch (e) { setError(e.message); }
    setCargando(false);
  }
  function regenerar() { setCargando(true); setError(""); setResultado(null); generar(); }

  // Se genera al abrir
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { generar(); }, []);

  function imprimir() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe de obra – ${proyecto.nombre}</title>
      <style>body{font-family:'Segoe UI',Arial,sans-serif;color:#1E293B;max-width:860px;margin:0 auto;padding:28px}@media print{body{padding:0}}</style></head><body>
      <div style="background:#1A2B4A;color:#fff;padding:20px 24px;border-radius:10px;margin-bottom:18px"><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.7">Obras Grupo Aixa S.A.</div>
      <div style="font-size:22px;font-weight:800;margin-top:4px">Informe de obra — ${proyecto.nombre.replace(/</g, "&lt;")}</div>${proyecto.lugar ? `<div style="font-size:13px;opacity:.8">${proyecto.lugar.replace(/</g, "&lt;")}</div>` : ""}</div>
      ${resultado.html}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  const btn = { padding:"9px 16px", borderRadius:8, fontSize:13, fontWeight:600, fontFamily:"'Inter', sans-serif", border:"1px solid #E2E8F0", background:"#F8FAFC", color:"#475569", cursor:"pointer" };
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:600, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"24px 16px", overflowY:"auto" }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:820, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"18px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, position:"sticky", top:0, background:"#fff", borderRadius:"14px 14px 0 0", zIndex:1 }}>
          <div>
            <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>✨ Informe de obra — {proyecto.nombre}</h2>
            <div style={{ fontSize:12, color:"#64748B", marginTop:3 }}>Hecho por Claude con todo lo cargado en las pestañas{resultado?.generado ? ` · ${resultado.generado}` : ""}{resultado && !resultado.incluyeCobros ? " · sin datos de cobros (tu usuario no los ve)" : ""}</div>
          </div>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16, flexShrink:0 }}>✕</button>
        </div>
        <div style={{ padding:"20px 24px" }}>
          {cargando && <div style={{ textAlign:"center", padding:"60px 0", color:"#64748B", fontSize:14 }}>✨ Claude está revisando la obra y armando el informe...<div style={{ fontSize:12, color:"#94A3B8", marginTop:6 }}>Puede tardar hasta un minuto.</div></div>}
          {error && <div style={{ padding:"12px 14px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:13 }}>{error}</div>}
          {resultado && <div dangerouslySetInnerHTML={{ __html: resultado.html }} />}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", flexWrap:"wrap", marginTop:20, paddingTop:16, borderTop:"1px solid #F1F5F9" }}>
            <button onClick={regenerar} disabled={cargando} style={{ ...btn, cursor: cargando ? "not-allowed" : "pointer" }}>↻ Volver a generar</button>
            <button onClick={imprimir} disabled={!resultado} style={{ ...btn, opacity: resultado ? 1 : 0.5 }}>🖨 PDF</button>
            <EnviarPorMail deshabilitado={!resultado} motivo="Esperá a que termine el informe"
              estiloBoton={{ ...btn, background:"#0F766E", border:"none", color:"#fff" }}
              enviar={para => apiFetch("/api/informe-obra", { method: "POST", body: JSON.stringify({ proyectoId: proyecto.id, accion: "enviar", informe: resultado.informe, generado: resultado.generado, para }) })} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Elegir una entrega de la pestaña Entregas (para crear su registro en otra pestaña)
function ModalElegirEntrega({ titulo, entregas, color = "#1A2B4A", onClose, onElegir }) {
  const [id, setId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const opciones = [...entregas].sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"));
  async function elegir() {
    const e = opciones.find(x => x.id === id);
    if (!e) return;
    setGuardando(true);
    try { await onElegir(e); onClose(); }
    catch (err) { avisar(`No se pudo agregar: ${err.message}`, { tipo: "error" }); }
    setGuardando(false);
  }
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:440, padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:"0 0 6px" }}>{titulo}</h3>
        <p style={{ fontSize:12, color:"#64748B", margin:"0 0 16px" }}>Todas las pestañas usan las obras de Entregas. Las obras y entregas nuevas se crean en la pestaña Entregas.</p>
        {opciones.length === 0 ? (
          <div style={{ fontSize:13, color:"#94A3B8", marginBottom:8 }}>Todas las entregas activas ya están en esta pestaña.</div>
        ) : (
          <select value={id} onChange={e => setId(e.target.value)} autoFocus
            style={{ width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" }}>
            <option value="">— Elegí la entrega —</option>
            {opciones.map(e => <option key={e.id} value={e.id}>{e.nombre}{e.fecha ? ` — ${formatDate(e.fecha)}` : ""}</option>)}
          </select>
        )}
        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ flex:1, padding:"10px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cancelar</button>
          <button onClick={elegir} disabled={!id || guardando}
            style={{ flex:1, padding:"10px", border:"none", borderRadius:8, background: !id || guardando ? "#94A3B8" : color, color:"#fff", cursor: !id || guardando ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>{guardando ? "Agregando..." : "Agregar"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function ModalSimple({ title, onClose, onSave, fields }) {
  const [form, setForm] = useState(() => {
    const f = {};
    fields.forEach(fi => f[fi.key] = fi.initial || "");
    return f;
  });

  function handleSave() {
    const req = fields.find(fi => fi.required && !form[fi.key]?.trim());
    if (req) { avisar(`"${req.label}" es requerido.`, { tipo: "aviso" }); return; }
    onSave(form);
  }

  const inputStyle = { width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:460, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{title}</h2>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"20px 24px" }}>
          {fields.map(fi => (
            <div key={fi.key} style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:5 }}>{fi.label}</label>
              {fi.type === "select" ? (
                <select value={form[fi.key]} onChange={e => setForm(f => ({...f, [fi.key]: e.target.value}))} style={inputStyle}>
                  {fi.options.map(op => <option key={op.v} value={op.v}>{op.l}</option>)}
                </select>
              ) : fi.type === "textarea" ? (
                <textarea value={form[fi.key]} rows={3} onChange={e => setForm(f => ({...f, [fi.key]: e.target.value}))}
                  style={{ ...inputStyle, resize:"vertical" }} />
              ) : (
                <input type={fi.type} value={form[fi.key]} onChange={e => setForm(f => ({...f, [fi.key]: e.target.value}))} style={inputStyle} />
              )}
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:18 }}>
            <button onClick={onClose} style={{ padding:"8px 18px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#64748B", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Cancelar</button>
            <button onClick={handleSave} style={{ padding:"8px 18px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#ffffff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// COBROS MODULE
// ═══════════════════════════════════════════════════════════════════════════════
function CobrosModule({ entregas = [] }) {
  const [cobrosTodos, setCobros] = useState([]);
  const { activas, archivadas, existentes } = vinculoEntregas(entregas);
  // Lo de entregas archivadas no se muestra
  const cobros = cobrosTodos.filter(c => !archivadas.has(c.obra_id));
  const [cargando, setCargando] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(null);
  const [editData, setEditData] = useState({});
  const [editingAdicionalId, setEditingAdicionalId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showNuevaObra, setShowNuevaObra] = useState(false);

  async function recargar() {
    setCargando(true);
    try {
      const c = await getCobros();
      const lista = c || [];
      setCobros(lista);
      if (selected) {
        const updated = lista.find(x => x.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch (e) { console.error("Error cargando cobros:", e); }
    setCargando(false);
  }

  // Carga inicial al abrir el módulo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { recargar(); }, []);

  // datos puede ser un objeto o una función que recibe el cobro recién leído de la base
  async function guardar(id, datos) {
    setSaving(true);
    try {
      await modificarFila("cobros", id, fila => ({ ...(typeof datos === "function" ? datos(fila) : datos), updated_at: new Date().toISOString() }));
      const c = await getCobros();
      const lista = c || [];
      setCobros(lista);
      const updated = lista.find(x => x.id === id);
      if (updated) setSelected(updated);
      setShowModal(null);
      setEditData({});
      setEditingAdicionalId(null);
    } catch (e) { avisar(`Error al guardar. ${e.message || ""}`, { tipo: "error" }); }
    setSaving(false);
  }

  async function agregarAdicional() {
    if (!editData.descripcion) { avisar("Completá la descripción.", { tipo: "aviso" }); return; }
    await guardar(selected.id, c => {
      const adics = c.adicionales || [];
      if (editingAdicionalId) {
        const idx = adics.findIndex(a => a.id === editingAdicionalId);
        if (idx >= 0) adics[idx] = { ...adics[idx], descripcion: editData.descripcion, monto: parseFloat(editData.monto) || 0 };
      } else {
        adics.push({ id: uid(), descripcion: editData.descripcion, monto: parseFloat(editData.monto) || 0, cobrado: false });
      }
      return { adicionales: adics };
    });
  }

  async function eliminarAdicional(cobroId, adicionalId) {
    if (!await confirmar("¿Eliminar este adicional?")) return;
    await guardar(cobroId, c => ({ adicionales: (c.adicionales || []).filter(a => a.id !== adicionalId) }));
  }

  async function toggleAdicionalCobrado(cobroId, adicionalId) {
    await guardar(cobroId, c => ({ adicionales: (c.adicionales || []).map(a => a.id === adicionalId ? { ...a, cobrado: !a.cobrado } : a) }));
  }

  async function eliminarCobro(id) {
    if (!await confirmar("¿Eliminar esta obra de Cobros? Esta acción no se puede deshacer.")) return;
    try {
      await deleteCobro(id);
      setSelected(null);
      await recargar();
    } catch { avisar("Error al eliminar.", { tipo: "error" }); }
  }

  async function crearCobroEntrega(e) {
    await insertCobro({ obra_id: e.id, obra_nombre: e.nombre, obra_lugar: e.lugar, monto_total: 0, adelanto_cobrado: false, adelanto_monto: 0, adelanto_porcentaje: 0, total_cobrado: false, total_fecha: null, plazo_pago: "", adicionales: [] });
    await recargar();
  }

  const fmtMonto = (n) => (n != null && n !== "" && Number(n) !== 0) ? `$${Number(n).toLocaleString("es-AR")}` : "—";

  const totalObras = cobros.length;
  const adelantosCobrados = cobros.filter(c => c.adelanto_cobrado).length;
  const totalesCobrados = cobros.filter(c => c.total_cobrado).length;
  const totalAdicionales = cobros.reduce((s, c) => s + (c.adicionales || []).length, 0);

  const si = { width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" };

  return (
    <div>
      {/* STATS */}
      <div className="grid-numeros" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:32 }}>
        {[
          { num: totalObras,        label:"Total obras",        color:"#2563EB", border:"#DBEAFE" },
          { num: adelantosCobrados, label:"Adelantos cobrados",  color:"#059669", border:"#A7F3D0" },
          { num: totalesCobrados,   label:"Totales cobrados",    color:"#D97706", border:"#FDE68A" },
          { num: totalAdicionales,  label:"Adicionales",         color:"#7C3AED", border:"#DDD6FE" },
        ].map((s, i) => (
          <div key={i} style={{ background:"#ffffff", border:`1px solid ${s.border}`, borderRadius:12, padding:"20px 20px 18px", animation:`fadeUp 0.35s ease ${i*0.06}s both` }}>
            <div style={{ fontFamily:"'Sora', sans-serif", fontSize:32, fontWeight:800, color:s.color, lineHeight:1 }}>{s.num}</div>
            <div style={{ fontSize:12, color:"#64748B", fontWeight:500, marginTop:6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>Cobros por obra</h2>
        <button onClick={() => setShowNuevaObra(true)} title="Las entregas nuevas se agregan solas al crearlas en Entregas"
          style={{ padding:"9px 18px", background:"#7C3AED", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
          + Agregar entrega
        </button>
      </div>

      {cargando ? (
        <div style={{ textAlign:"center", padding:60, color:"#94A3B8", fontSize:13 }}>Cargando...</div>
      ) : cobros.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>💰</div>
          <div style={{ fontSize:13, color:"#94A3B8" }}>No hay obras de cobro. Se crean automáticamente al crear obras en Entregas.</div>
        </div>
      ) : (
        <div className="grid-tarjetas" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:16 }}>
          {cobros.map((c, idx) => {
            const adics = c.adicionales || [];
            const adicsCobrados = adics.filter(a => a.cobrado).length;
            const topColor = c.total_cobrado ? "#059669" : c.adelanto_cobrado ? "#D97706" : "#CBD5E1";
            return (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{ background:"#ffffff", border:`1px solid ${c.total_cobrado ? "#A7F3D0" : "#E8ECF0"}`, borderRadius:14, overflow:"hidden", cursor:"pointer", animation:`fadeUp 0.35s ease ${idx*0.04}s both`, boxShadow:"0 1px 4px rgba(26,43,74,0.05)" }}>
                <div style={{ height:4, background:topColor }} />
                <div style={{ padding:"18px 18px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div style={{ fontFamily:"'Sora', sans-serif", fontSize:15, fontWeight:700, color:"#1A2B4A", flex:1, lineHeight:1.35, paddingRight:10 }}>{c.obra_nombre}</div>
                    <div style={{ padding:"3px 10px", borderRadius:6, background: c.total_cobrado ? "#ECFDF5" : "#F8FAFC", color: c.total_cobrado ? "#059669" : "#94A3B8", fontSize:11, fontWeight:700, border:`1px solid ${c.total_cobrado ? "#A7F3D0" : "#E2E8F0"}`, whiteSpace:"nowrap", flexShrink:0 }}>
                      {c.total_cobrado ? "✓ COBRADA" : "PENDIENTE"}
                    </div>
                  </div>
                  {c.obra_lugar && <div style={{ fontSize:12, color:"#64748B", marginBottom:10 }}>📍 {c.obra_lugar}</div>}
                  {c.monto_total > 0 && <div style={{ fontSize:13, fontWeight:700, color:"#1A2B4A", marginBottom:10 }}>Total: {fmtMonto(c.monto_total)}</div>}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <div style={{ fontSize:11, padding:"3px 9px", borderRadius:5, background: c.adelanto_cobrado ? "#ECFDF5" : "#FFF7ED", color: c.adelanto_cobrado ? "#059669" : "#D97706", border:`1px solid ${c.adelanto_cobrado ? "#A7F3D0" : "#FDE68A"}` }}>
                      {c.adelanto_cobrado ? "✓" : "○"} Adelanto{c.adelanto_monto > 0 ? ` ${fmtMonto(c.adelanto_monto)}` : ""}
                    </div>
                    {adics.length > 0 && (
                      <div style={{ fontSize:11, padding:"3px 9px", borderRadius:5, background:"#F5F3FF", color:"#7C3AED", border:"1px solid #DDD6FE" }}>
                        {adicsCobrados}/{adics.length} adic.
                      </div>
                    )}
                  </div>
                  {c.plazo_pago && <div style={{ marginTop:8, fontSize:12, color:"#64748B" }}>⏱ Plazo: {c.plazo_pago}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETALLE OBRA */}
      {selected && (
        <div onClick={e => e.target === e.currentTarget && setSelected(null)}
          style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:600, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
            <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"#fff", zIndex:10 }}>
              <div>
                <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>{selected.obra_nombre}</h2>
                {selected.obra_lugar && <div style={{ fontSize:12, color:"#94A3B8", marginTop:3 }}>📍 {selected.obra_lugar}</div>}
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {/* Los cobros de una entrega se archivan o eliminan desde Entregas */}
                {!existentes.has(selected.obra_id) && <button onClick={() => eliminarCobro(selected.id)}
                  style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"6px 12px", color:"#DC2626", fontSize:12, fontWeight:600, cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#FEE2E2"} onMouseLeave={e=>e.currentTarget.style.background="#FEF2F2"}>
                  🗑 Eliminar
                </button>}
                <button onClick={() => setSelected(null)} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16, flexShrink:0 }}>✕</button>
              </div>
            </div>
            <div style={{ padding:"20px 24px" }}>
              {/* MONTO TOTAL */}
              <div style={{ marginBottom:20, padding:16, background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 }}>Monto Total del Contrato</div>
                    <div style={{ fontFamily:"'Sora', sans-serif", fontSize:24, fontWeight:800, color:"#1A2B4A" }}>{fmtMonto(selected.monto_total)}</div>
                  </div>
                  <button onClick={() => { setShowModal("monto_total"); setEditData({ monto_total: selected.monto_total || "" }); }}
                    style={{ background:"#1A2B4A", border:"none", borderRadius:8, padding:"8px 14px", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>Editar</button>
                </div>
              </div>
              {/* ADELANTO */}
              <div style={{ marginBottom:16, padding:16, border:`2px solid ${selected.adelanto_cobrado ? "#A7F3D0" : "#E2E8F0"}`, borderRadius:12, background: selected.adelanto_cobrado ? "#ECFDF5" : "#fff" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#1A2B4A" }}>Adelanto</div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:13, color: selected.adelanto_cobrado ? "#059669" : "#94A3B8", fontWeight:600 }}>
                      <input type="checkbox" checked={!!selected.adelanto_cobrado}
                        onChange={async () => { await guardar(selected.id, { adelanto_cobrado: !selected.adelanto_cobrado }); }}
                        style={{ width:16, height:16, cursor:"pointer", accentColor:"#059669" }} />
                      {selected.adelanto_cobrado ? "Cobrado ✓" : "Pendiente"}
                    </label>
                    <button onClick={() => { setShowModal("adelanto"); setEditData({ adelanto_monto: selected.adelanto_monto || "", adelanto_porcentaje: selected.adelanto_porcentaje || "" }); }}
                      style={{ background:"transparent", border:"1px solid #E2E8F0", borderRadius:6, padding:"5px 10px", color:"#64748B", fontSize:12, cursor:"pointer" }}>Editar</button>
                  </div>
                </div>
                <div style={{ display:"flex", gap:32 }}>
                  <div>
                    <div style={{ fontSize:11, color:"#94A3B8", marginBottom:2 }}>Monto del adelanto</div>
                    <div style={{ fontSize:16, fontWeight:700, color:"#1A2B4A" }}>{fmtMonto(selected.adelanto_monto)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:"#94A3B8", marginBottom:2 }}>% del total</div>
                    <div style={{ fontSize:16, fontWeight:700, color:"#1A2B4A" }}>{selected.adelanto_porcentaje != null && selected.adelanto_porcentaje !== "" && Number(selected.adelanto_porcentaje) !== 0 ? `${selected.adelanto_porcentaje}%` : "—"}</div>
                  </div>
                </div>
              </div>
              {/* ADICIONALES */}
              <div style={{ marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#1A2B4A" }}>Adicionales</div>
                  <button onClick={() => { setShowModal("adicional"); setEditData({ descripcion:"", monto:"" }); setEditingAdicionalId(null); }}
                    style={{ background:"#1A2B4A", border:"none", borderRadius:8, padding:"7px 14px", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>+ Agregar</button>
                </div>
                {(selected.adicionales || []).length === 0 ? (
                  <div style={{ textAlign:"center", padding:20, background:"#F8FAFC", borderRadius:10, border:"1px solid #E2E8F0", fontSize:13, color:"#94A3B8" }}>Sin adicionales aún</div>
                ) : (
                  (selected.adicionales || []).map(a => (
                    <div key={a.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background: a.cobrado ? "#ECFDF5" : "#F8FAFC", border:`1px solid ${a.cobrado ? "#A7F3D0" : "#E2E8F0"}`, borderRadius:10, marginBottom:8 }}>
                      <input type="checkbox" checked={!!a.cobrado} onChange={() => toggleAdicionalCobrado(selected.id, a.id)} style={{ width:16, height:16, cursor:"pointer", accentColor:"#059669", flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"#1A2B4A" }}>{a.descripcion}</div>
                        <div style={{ fontSize:12, color:"#64748B" }}>{fmtMonto(a.monto)}</div>
                      </div>
                      <button onClick={() => { setShowModal("adicional"); setEditData({ descripcion: a.descripcion, monto: a.monto || "" }); setEditingAdicionalId(a.id); }}
                        style={{ background:"none", border:"1px solid #E2E8F0", borderRadius:6, padding:"4px 8px", color:"#64748B", fontSize:11, cursor:"pointer" }}>Editar</button>
                      <button onClick={() => eliminarAdicional(selected.id, a.id)}
                        style={{ background:"none", border:"none", color:"#CBD5E1", cursor:"pointer", fontSize:15, padding:0, flexShrink:0 }}
                        onMouseEnter={e => e.currentTarget.style.color="#EF4444"} onMouseLeave={e => e.currentTarget.style.color="#CBD5E1"}>✕</button>
                    </div>
                  ))
                )}
              </div>
              {/* COBRO TOTAL */}
              <div style={{ marginBottom:16, padding:16, border:`2px solid ${selected.total_cobrado ? "#A7F3D0" : "#E2E8F0"}`, borderRadius:12, background: selected.total_cobrado ? "#ECFDF5" : "#fff" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#1A2B4A" }}>Cobro Total</div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:13, color: selected.total_cobrado ? "#059669" : "#94A3B8", fontWeight:600 }}>
                      <input type="checkbox" checked={!!selected.total_cobrado}
                        onChange={async () => { await guardar(selected.id, { total_cobrado: !selected.total_cobrado }); }}
                        style={{ width:16, height:16, cursor:"pointer", accentColor:"#059669" }} />
                      {selected.total_cobrado ? "Cobrado ✓" : "Pendiente"}
                    </label>
                    <button onClick={() => { setShowModal("total"); setEditData({ total_fecha: selected.total_fecha || "", plazo_pago: selected.plazo_pago || "" }); }}
                      style={{ background:"transparent", border:"1px solid #E2E8F0", borderRadius:6, padding:"5px 10px", color:"#64748B", fontSize:12, cursor:"pointer" }}>Editar</button>
                  </div>
                </div>
                <div style={{ display:"flex", gap:32 }}>
                  <div>
                    <div style={{ fontSize:11, color:"#94A3B8", marginBottom:2 }}>Fecha de cobro total</div>
                    <div style={{ fontSize:14, fontWeight:600, color:"#1A2B4A" }}>{selected.total_fecha ? formatDate(selected.total_fecha) : "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:"#94A3B8", marginBottom:2 }}>Plazo de pago del cliente</div>
                    <div style={{ fontSize:14, fontWeight:600, color:"#1A2B4A" }}>{selected.plazo_pago || "—"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MONTO TOTAL */}
      {showModal === "monto_total" && (
        <div onClick={e => e.target === e.currentTarget && setShowModal(null)} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:380, padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
            <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:"0 0 18px" }}>Monto Total del Contrato</h3>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Monto ($)</label>
            <input type="number" value={editData.monto_total} onChange={e => setEditData(d => ({ ...d, monto_total: e.target.value }))} style={si} placeholder="0" autoFocus />
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button onClick={() => setShowModal(null)} style={{ flex:1, padding:"10px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cancelar</button>
              <button onClick={() => guardar(selected.id, { monto_total: parseFloat(editData.monto_total) || 0 })} disabled={saving}
                style={{ flex:1, padding:"10px", border:"none", borderRadius:8, background: saving ? "#94A3B8" : "#1A2B4A", color:"#fff", cursor: saving ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: ADELANTO */}
      {showModal === "adelanto" && (
        <div onClick={e => e.target === e.currentTarget && setShowModal(null)} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:380, padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
            <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:"0 0 18px" }}>Editar Adelanto</h3>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Monto del adelanto ($)</label>
              <input type="number" value={editData.adelanto_monto} onChange={e => setEditData(d => ({ ...d, adelanto_monto: e.target.value }))} style={si} placeholder="0" autoFocus />
            </div>
            <div style={{ marginBottom:4 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Porcentaje del total (%)</label>
              <input type="number" value={editData.adelanto_porcentaje} onChange={e => setEditData(d => ({ ...d, adelanto_porcentaje: e.target.value }))} style={si} placeholder="0" min="0" max="100" />
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button onClick={() => setShowModal(null)} style={{ flex:1, padding:"10px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cancelar</button>
              <button onClick={() => guardar(selected.id, { adelanto_monto: parseFloat(editData.adelanto_monto) || 0, adelanto_porcentaje: parseFloat(editData.adelanto_porcentaje) || 0 })} disabled={saving}
                style={{ flex:1, padding:"10px", border:"none", borderRadius:8, background: saving ? "#94A3B8" : "#1A2B4A", color:"#fff", cursor: saving ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: COBRO TOTAL + PLAZO */}
      {showModal === "total" && (
        <div onClick={e => e.target === e.currentTarget && setShowModal(null)} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:380, padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
            <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:"0 0 18px" }}>Editar Cobro Total</h3>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Fecha de cobro del total</label>
              <input type="date" value={editData.total_fecha} onChange={e => setEditData(d => ({ ...d, total_fecha: e.target.value }))} style={si} autoFocus />
            </div>
            <div style={{ marginBottom:4 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Plazo de pago del cliente</label>
              <input type="text" value={editData.plazo_pago} onChange={e => setEditData(d => ({ ...d, plazo_pago: e.target.value }))} style={si} placeholder="Ej: 30 días, contado, 60 días" />
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button onClick={() => setShowModal(null)} style={{ flex:1, padding:"10px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cancelar</button>
              <button onClick={() => guardar(selected.id, { total_fecha: editData.total_fecha || null, plazo_pago: editData.plazo_pago || "" })} disabled={saving}
                style={{ flex:1, padding:"10px", border:"none", borderRadius:8, background: saving ? "#94A3B8" : "#1A2B4A", color:"#fff", cursor: saving ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: ADICIONAL */}
      {showModal === "adicional" && (
        <div onClick={e => { e.target === e.currentTarget && setShowModal(null); }} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:380, padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
            <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:"0 0 18px" }}>{editingAdicionalId ? "Editar adicional" : "Agregar adicional"}</h3>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Descripción</label>
              <input type="text" value={editData.descripcion} onChange={e => setEditData(d => ({ ...d, descripcion: e.target.value }))} style={si} placeholder="Ej: Trabajo extra en cocina" autoFocus />
            </div>
            <div style={{ marginBottom:4 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Monto ($)</label>
              <input type="number" value={editData.monto} onChange={e => setEditData(d => ({ ...d, monto: e.target.value }))} style={si} placeholder="0" />
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button onClick={() => { setShowModal(null); setEditingAdicionalId(null); }} style={{ flex:1, padding:"10px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cancelar</button>
              <button onClick={agregarAdicional} disabled={saving}
                style={{ flex:1, padding:"10px", border:"none", borderRadius:8, background: saving ? "#94A3B8" : "#1A2B4A", color:"#fff", cursor: saving ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>{saving ? "Guardando..." : editingAdicionalId ? "Actualizar" : "Agregar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR ENTREGA */}
      {showNuevaObra && <ModalElegirEntrega titulo="Agregar entrega a Cobros" color="#7C3AED"
        entregas={activas.filter(e => !cobrosTodos.some(c => c.obra_id === e.id))}
        onClose={() => setShowNuevaObra(false)} onElegir={crearCobroEntrega} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL — UNIFIED
// ═══════════════════════════════════════════════════════════════════════════════
// MATERIALES MODULE
// ═══════════════════════════════════════════════════════════════════════════════
const TIPOS_MATERIAL = ["MDF","Melamina","Madera maciza","Terciado / Multilaminado","Vidrio","Espejo","Herraje","Bisagra","Corredera","Manija / Tirador","Tapacanto","Moldura / Perfil","Chapa","Pintura / Laca","Tela / Cuero","Otro"];
const UNIDADES = ["Unidades","m²","ml","Planchas","Tablas","Tiras","Cajas","Pares","Sets","kg","Litros","Metros"];
const TERMINACIONES = ["Mate","Brillante","Texturado","Natural","Pintado","Barnizado","Laqueado","Cromo","Negro mate","Blanco mate","Otro"];
// "stock" = ya lo tenemos, no hay que pedirlo. El resto son estados de un material a pedir.
const ESTADOS_MAT = { stock:"En stock", pendiente:"Falta pedir", pedido:"Pedido – falta recibir", parcial:"Llegó incompleto", recibido:"Recibido" };
const ESTADOS_MAT_PEDIR = ["pendiente","pedido","parcial","recibido"];
const ESTADO_MAT_COLORS = { stock:{bg:"#F5F3FF",text:"#7C3AED",border:"#DDD6FE"}, pendiente:{bg:"#FFF7ED",text:"#D97706",border:"#FDE68A"}, pedido:{bg:"#EFF6FF",text:"#2563EB",border:"#BFDBFE"}, parcial:{bg:"#FEF2F2",text:"#DC2626",border:"#FECACA"}, recibido:{bg:"#ECFDF5",text:"#059669",border:"#A7F3D0"} };
const DIAS_ALERTA_MAT = 10;
const CAMPOS_BUSQUEDA_MAT = ["nombre","tipo","color","terminacion","marca","proveedor","orden_pedido","numero_remito","notas"];
const sinAcentos = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function resumenMateriales(items = []) {
  const faltaPedir = items.filter(i => !i.estado || i.estado === "pendiente");
  const faltaRecibir = items.filter(i => i.estado === "pedido" || i.estado === "parcial");
  return { faltaPedir, faltaRecibir, stock: items.filter(i => i.estado === "stock").length, recibidos: items.filter(i => i.estado === "recibido").length, completo: items.length > 0 && faltaPedir.length === 0 && faltaRecibir.length === 0 };
}
function normNombreObra(s) { return (s || "").trim().toLowerCase().replace(/\s+/g, " "); }
// Obra de Entregas asociada a una lista de materiales: por id, o por nombre si se creó por separado
function entregaDeLista(lista, obras = []) {
  return obras.find(o => o.id === lista.obra_id) || obras.find(o => normNombreObra(o.nombre) === normNombreObra(lista.obra_nombre)) || null;
}
function diasHastaFecha(fecha) {
  if (!fecha) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const [y,m,d] = fecha.split("T")[0].split("-").map(Number);
  return Math.round((new Date(y, m-1, d) - hoy) / 86400000);
}
// Obras con entrega en ≤ DIAS_ALERTA_MAT días (o vencida) a las que les falta algún material
function alertasMateriales(listas = [], obras = []) {
  return listas.map(l => {
    const entrega = entregaDeLista(l, obras);
    if (!entrega || entrega.estado === "terminado" || !entrega.fecha) return null;
    const dias = diasHastaFecha(entrega.fecha);
    const r = resumenMateriales(l.items || []);
    if (dias > DIAS_ALERTA_MAT || r.faltaPedir.length + r.faltaRecibir.length === 0) return null;
    return { lista: l, entrega, dias, ...r };
  }).filter(Boolean).sort((a, b) => a.dias - b.dias);
}
function textoDiasEntrega(dias) { return dias < 0 ? `vencida hace ${-dias} día${dias === -1 ? "" : "s"}` : dias === 0 ? "entrega hoy" : `faltan ${dias} día${dias === 1 ? "" : "s"}`; }
function detalleFaltante(it) {
  const cant = [it.cantidad, it.unidad].filter(Boolean).join(" ");
  if (it.estado === "parcial") return `${it.nombre}${it.cantidad_recibida ? ` (llegaron ${it.cantidad_recibida} de ${cant || "?"})` : " (llegó incompleto)"}`;
  return `${it.nombre}${cant ? ` (${cant})` : ""}`;
}

function generarPDFMateriales(lista, entrega) {
  const ahora = new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"});
  const items = lista.items || [];
  const r = resumenMateriales(items);
  const rowsHTML = items.map((it,i) => {
    const est = it.estado || "pendiente";
    const ec = ESTADO_MAT_COLORS[est] || ESTADO_MAT_COLORS.pendiente;
    const medidas = [it.largo&&`L:${it.largo}`, it.ancho&&`An:${it.ancho}`, it.espesor&&`Esp:${it.espesor}`].filter(Boolean).join(" × ");
    const seg = [it.orden_pedido&&`Ped: ${it.orden_pedido}`, it.numero_remito&&`Rem: ${it.numero_remito}`].filter(Boolean).join("<br>");
    const estTxt = est === "parcial" && it.cantidad_recibida ? `Llegó incompleto (${it.cantidad_recibida} de ${it.cantidad||'?'})` : ESTADOS_MAT[est];
    return `<tr style="background:${i%2===0?'#f8fafc':'#ffffff'}">
      <td style="padding:8px 10px;font-size:12px;color:#1e293b;font-weight:500;border-bottom:1px solid #e2e8f0">${it.nombre||'—'}</td>
      <td style="padding:8px 10px;font-size:11px;color:#475569;border-bottom:1px solid #e2e8f0">${it.tipo||'—'}</td>
      <td style="padding:8px 10px;font-size:12px;color:#1e293b;font-weight:600;text-align:center;border-bottom:1px solid #e2e8f0">${it.cantidad||'—'} ${it.unidad||''}</td>
      <td style="padding:8px 10px;font-size:11px;color:#475569;border-bottom:1px solid #e2e8f0">${medidas||'—'}</td>
      <td style="padding:8px 10px;font-size:11px;color:#475569;border-bottom:1px solid #e2e8f0">${it.color||'—'}</td>
      <td style="padding:8px 10px;font-size:11px;color:#475569;border-bottom:1px solid #e2e8f0">${it.terminacion||'—'}</td>
      <td style="padding:8px 10px;font-size:11px;color:#475569;border-bottom:1px solid #e2e8f0">${[it.marca,it.proveedor].filter(Boolean).join(' / ')||'—'}</td>
      <td style="padding:8px 10px;font-size:10px;border-bottom:1px solid #e2e8f0"><span style="background:${ec.bg};color:${ec.text};border:1px solid ${ec.border};border-radius:4px;padding:2px 6px;font-weight:600;white-space:nowrap">${estTxt}</span></td>
      <td style="padding:8px 10px;font-size:10px;color:#475569;border-bottom:1px solid #e2e8f0">${seg||'—'}</td>
      <td style="padding:8px 10px;font-size:10px;color:#94a3b8;border-bottom:1px solid #e2e8f0">${it.notas||''}</td>
    </tr>`;
  }).join("");
  const faltantesHTML = items.length === 0 ? '' : r.completo
    ? `<div style="background:#ecfdf5;border-left:4px solid #059669;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:18px;font-size:13px;color:#065f46"><strong>✓ Están todos los materiales</strong> (${r.stock} en stock, ${r.recibidos} recibidos).</div>`
    : `<div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:18px;font-size:12px;color:#7f1d1d">
        <strong style="font-size:13px">Faltan materiales</strong>
        ${r.faltaPedir.length ? `<div style="margin-top:6px"><strong>Falta pedir (${r.faltaPedir.length}):</strong> ${r.faltaPedir.map(detalleFaltante).join(' · ')}</div>` : ''}
        ${r.faltaRecibir.length ? `<div style="margin-top:4px"><strong>Falta recibir (${r.faltaRecibir.length}):</strong> ${r.faltaRecibir.map(detalleFaltante).join(' · ')}</div>` : ''}
      </div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Materiales – ${lista.obra_nombre}</title>
<style>@page{size:A4 landscape;margin:12mm 10mm}body{font-family:'Segoe UI',system-ui,sans-serif;color:#1e293b;margin:0;font-size:13px}
.cover{background:linear-gradient(135deg,#1A2B4A 0%,#0F766E 100%);color:#fff;padding:30px 40px}
.cover h1{font-size:26px;margin:0 0 6px;font-weight:800}.cover .sub{font-size:13px;opacity:.75;margin-bottom:18px}
.cover-grid{display:flex;gap:16px;flex-wrap:wrap}.cover-item{background:rgba(255,255,255,.13);border-radius:8px;padding:10px 16px}
.cover-item .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:.7;margin-bottom:3px}
.cover-item .val{font-size:20px;font-weight:800}
.body{padding:22px 30px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th{background:#1A2B4A;color:#fff;padding:9px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;text-align:left;font-weight:700}
tr{page-break-inside:avoid}
.footer{margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}
.nota{background:#fffbeb;border-left:4px solid #d97706;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:18px;font-size:13px}
</style></head><body>
<div class="cover">
  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.6;margin-bottom:12px">Obras Grupo Aixa S.A.</div>
  <h1>Lista de Materiales</h1>
  <div class="sub">${lista.obra_nombre}${lista.obra_lugar?` — ${lista.obra_lugar}`:''}</div>
  <div class="cover-grid">
    <div class="cover-item"><div class="lbl">Total ítems</div><div class="val">${items.length}</div></div>
    <div class="cover-item"><div class="lbl">En stock</div><div class="val">${r.stock}</div></div>
    <div class="cover-item"><div class="lbl">Recibidos</div><div class="val">${r.recibidos}</div></div>
    <div class="cover-item"><div class="lbl">Falta pedir</div><div class="val">${r.faltaPedir.length}</div></div>
    <div class="cover-item"><div class="lbl">Falta recibir</div><div class="val">${r.faltaRecibir.length}</div></div>
    ${entrega?.fecha?`<div class="cover-item"><div class="lbl">Entrega</div><div class="val" style="font-size:14px">${fmtDateAixa(entrega.fecha)}</div></div>`:''}
    <div class="cover-item"><div class="lbl">Fecha</div><div class="val" style="font-size:14px">${ahora}</div></div>
  </div>
</div>
<div class="body">
  ${faltantesHTML}
  ${lista.notas?`<div class="nota">📝 <strong>Notas:</strong> ${lista.notas}</div>`:''}
  ${items.length===0?'<p style="color:#94a3b8;text-align:center;padding:40px 0">Sin materiales cargados.</p>':`
  <table>
    <thead><tr>
      <th>Descripción</th><th>Tipo</th><th>Cantidad</th><th>Medidas</th>
      <th>Color</th><th>Terminación</th><th>Marca / Proveedor</th><th>Estado</th><th>Pedido / Remito</th><th>Notas</th>
    </tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table>`}
  <div class="footer"><span>Obras Grupo Aixa S.A. — Lista de materiales</span><span>Generado: ${ahora}</span></div>
</div></body></html>`;
  const win = window.open("","_blank");
  if (win) { win.document.write(html); win.document.close(); setTimeout(()=>win.print(),600); }
}

// ─── CARGA DE MATERIALES CON CLAUDE ──────────────────────────────────────────
const EXT_IMPORTABLES = ["pdf","xlsx","xls","xlsm","ods","csv","jpg","jpeg","png","webp"];
function extArchivo(nombre) { return (nombre || "").split(".").pop().toLowerCase(); }

async function uploadArchivoImportacion(file, listaId) {
  const path = `materiales-import/${listaId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${extArchivo(file.name)}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${AVANCE_BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), apikey: SUPABASE_KEY, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
    body: file,
  });
  if (!res.ok) throw new Error(await res.text());
  return path;
}

function ImportarMaterialesIA({ lista, onClose, onAgregar }) {
  const [adjuntos, setAdjuntos] = useState([]);
  const [paso, setPaso] = useState("elegir"); // elegir | leyendo | revisar
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [observaciones, setObservaciones] = useState("");
  const [archivoNombre, setArchivoNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef(null);

  // Adjuntos de Obras Aceptadas que se pueden leer (primero los de la obra con el mismo nombre)
  useEffect(() => {
    getObrasAceptadas().then(obs => {
      const n = normNombreObra(lista.obra_nombre);
      const archivos = (obs || []).flatMap(o => (o.archivos || [])
        .filter(f => f.path && EXT_IMPORTABLES.includes(extArchivo(f.name || f.path)))
        .map(f => ({ ...f, obra: o.nombre, coincide: normNombreObra(o.nombre) === n })));
      archivos.sort((a, b) => (b.coincide - a.coincide) || (a.obra || "").localeCompare(b.obra || ""));
      setAdjuntos(archivos);
    }).catch(() => {});
  }, [lista.obra_nombre]);

  async function leer(path, nombre) {
    setError(""); setArchivoNombre(nombre); setPaso("leyendo");
    try {
      const r = await apiFetch("/api/extraer-materiales", { method: "POST", body: JSON.stringify({ path, nombre }) });
      if (!r.items.length) { setError("Claude no encontró materiales en ese documento." + (r.observaciones ? ` ${r.observaciones}` : "")); setPaso("elegir"); return; }
      setItems(r.items.map(it => ({ ...it, id: uid(), incluir: true, estado: "pendiente" })));
      setObservaciones(r.observaciones || "");
      setPaso("revisar");
    } catch (e) { setError(e.message); setPaso("elegir"); }
  }

  async function subirYLeer(file) {
    if (!file) return;
    if (!EXT_IMPORTABLES.includes(extArchivo(file.name))) { setError("Formato no soportado. Usá PDF, Excel, CSV o una imagen."); return; }
    setError(""); setArchivoNombre(file.name); setPaso("leyendo");
    try { await leer(await uploadArchivoImportacion(file, lista.id), file.name); }
    catch (e) { setError(e.message); setPaso("elegir"); }
  }

  function setItem(id, campo, valor) { setItems(xs => xs.map(x => x.id === id ? { ...x, [campo]: valor } : x)); }

  async function agregar() {
    const elegidos = items.filter(i => i.incluir && i.nombre.trim()).map(i => ({ ...i, incluir: undefined })).map(it => ({ ...it, nombre: it.nombre.trim(), notas: [it.notas, `Importado de ${archivoNombre}`].filter(Boolean).join(" · ") }));
    if (!elegidos.length) return;
    setGuardando(true);
    try { await onAgregar(elegidos); onClose(); } catch { setGuardando(false); }
  }

  const inp = { width:"100%", padding:"6px 8px", background:"#fff", border:"1px solid #E2E8F0", borderRadius:6, color:"#1A2B4A", fontSize:12, outline:"none", boxSizing:"border-box", fontFamily:"'Inter', sans-serif" };
  const incluidos = items.filter(i => i.incluir).length;

  return (
    <div onClick={e => e.target === e.currentTarget && paso !== "leyendo" && onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", zIndex:320, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth: paso === "revisar" ? 980 : 560, maxHeight:"92vh", overflowY:"auto", padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:0 }}>✨ Cargar materiales con Claude</h3>
          {paso !== "leyendo" && <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:32, height:32, cursor:"pointer", color:"#64748B" }}>✕</button>}
        </div>
        <div style={{ fontSize:12, color:"#64748B", marginBottom:16 }}>{lista.obra_nombre} · Claude lee el presupuesto, plano o planilla y arma la lista. Revisala antes de agregarla.</div>

        {error && <div style={{ padding:"10px 14px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:13, marginBottom:14 }}>{error}</div>}

        {paso === "elegir" && (
          <>
            <div onClick={() => fileRef.current?.click()}
              style={{ border:"2px dashed #CBD5E1", borderRadius:10, padding:"22px 16px", textAlign:"center", cursor:"pointer", marginBottom:16, background:"#F8FAFC" }}>
              <div style={{ fontSize:26 }}>📄</div>
              <div style={{ fontSize:13, fontWeight:600, color:"#1A2B4A", marginTop:4 }}>Subir un archivo</div>
              <div style={{ fontSize:11, color:"#94A3B8" }}>PDF, Excel (xlsx/xls), CSV o foto (JPG/PNG)</div>
              <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.xlsm,.ods,.csv,.jpg,.jpeg,.png,.webp" style={{ display:"none" }}
                onChange={e => { subirYLeer(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <div style={{ fontSize:12, fontWeight:600, color:"#475569", marginBottom:8 }}>O elegí un adjunto de Obras Aceptadas</div>
            {adjuntos.length === 0 ? <div style={{ fontSize:12, color:"#94A3B8" }}>No hay adjuntos PDF/Excel en Obras Aceptadas.</div> : (
              <div style={{ border:"1px solid #E2E8F0", borderRadius:10, maxHeight:260, overflowY:"auto" }}>
                {adjuntos.map((f, i) => (
                  <div key={f.path} onClick={() => leer(f.path, f.name)}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", cursor:"pointer", borderBottom: i < adjuntos.length - 1 ? "1px solid #F1F5F9" : "none", background: f.coincide ? "#F0FDF4" : "#fff" }}>
                    <span>{extArchivo(f.name) === "pdf" ? "📕" : ["jpg","jpeg","png","webp"].includes(extArchivo(f.name)) ? "🖼" : "📗"}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, color:"#1A2B4A", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
                      <div style={{ fontSize:11, color:"#94A3B8" }}>{f.obra}{f.coincide ? " · esta obra" : ""}</div>
                    </div>
                    <span style={{ fontSize:12, color:"#0F766E", fontWeight:600 }}>Leer →</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {paso === "leyendo" && (
          <div style={{ textAlign:"center", padding:"40px 10px" }}>
            <div style={{ fontSize:30, marginBottom:10 }}>⏳</div>
            <div style={{ fontSize:14, fontWeight:600, color:"#1A2B4A" }}>Claude está leyendo "{archivoNombre}"…</div>
            <div style={{ fontSize:12, color:"#94A3B8", marginTop:6 }}>Según el tamaño del documento puede tardar entre 20 segundos y un par de minutos. No cierres esta ventana.</div>
          </div>
        )}

        {paso === "revisar" && (
          <>
            {observaciones && <div style={{ padding:"10px 14px", background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:8, color:"#92400E", fontSize:12, marginBottom:12 }}>💬 {observaciones}</div>}
            <div style={{ fontSize:12, color:"#64748B", marginBottom:8 }}>{items.length} materiales encontrados en "{archivoNombre}". Corregí lo que haga falta, destildá lo que no va y marcá lo que ya tienen en stock.</div>
            <div style={{ overflowX:"auto", border:"1px solid #E2E8F0", borderRadius:10 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead><tr style={{ background:"#F8FAFC", color:"#475569", textAlign:"left" }}>
                  {["","Descripción","Cant.","Unidad","Tipo","Medidas (L × An × Esp)","Color","¿Pedir?"].map(h => <th key={h} style={{ padding:"8px 6px", fontWeight:600, borderBottom:"1px solid #E2E8F0", whiteSpace:"nowrap" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id} style={{ opacity: it.incluir ? 1 : 0.45, borderBottom:"1px solid #F1F5F9" }}>
                      <td style={{ padding:"6px" }}><input type="checkbox" checked={it.incluir} onChange={e => setItem(it.id, "incluir", e.target.checked)} /></td>
                      <td style={{ padding:"6px", minWidth:200 }}><input style={inp} value={it.nombre} onChange={e => setItem(it.id, "nombre", e.target.value)} />{it.notas && <div style={{ fontSize:10, color:"#94A3B8", marginTop:2 }}>{it.notas}</div>}</td>
                      <td style={{ padding:"6px", width:60 }}><input style={inp} value={it.cantidad} onChange={e => setItem(it.id, "cantidad", e.target.value)} /></td>
                      <td style={{ padding:"6px", width:90 }}><input style={inp} list="mat-opts-unidad-ia" value={it.unidad} onChange={e => setItem(it.id, "unidad", e.target.value)} /></td>
                      <td style={{ padding:"6px", width:120 }}><input style={inp} list="mat-opts-tipo-ia" value={it.tipo} onChange={e => setItem(it.id, "tipo", e.target.value)} /></td>
                      <td style={{ padding:"6px", width:170 }}>
                        <div style={{ display:"flex", gap:3 }}>
                          {["largo","ancho","espesor"].map(k => <input key={k} style={{ ...inp, padding:"6px 4px" }} placeholder={k[0].toUpperCase()} value={it[k]} onChange={e => setItem(it.id, k, e.target.value)} />)}
                        </div>
                      </td>
                      <td style={{ padding:"6px", width:110 }}><input style={inp} value={it.color} onChange={e => setItem(it.id, "color", e.target.value)} /></td>
                      <td style={{ padding:"6px", width:130 }}>
                        <select style={inp} value={it.estado} onChange={e => setItem(it.id, "estado", e.target.value)}>
                          <option value="pendiente">🛒 Hay que pedirlo</option>
                          <option value="stock">📦 En stock</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="mat-opts-unidad-ia">{UNIDADES.map(o => <option key={o} value={o} />)}</datalist>
              <datalist id="mat-opts-tipo-ia">{TIPOS_MATERIAL.map(o => <option key={o} value={o} />)}</datalist>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button onClick={() => { setPaso("elegir"); setItems([]); }} style={{ padding:"10px 16px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>← Otro archivo</button>
              <div style={{ flex:1 }} />
              <button onClick={agregar} disabled={guardando || !incluidos}
                style={{ padding:"10px 20px", border:"none", borderRadius:8, background: guardando || !incluidos ? "#94A3B8" : "#0F766E", color:"#fff", cursor: guardando || !incluidos ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>
                {guardando ? "Agregando..." : `Agregar ${incluidos} material${incluidos !== 1 ? "es" : ""} a la obra`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MaterialesModule({ sesion, entregas = [] }) {
  const [listasTodas, setListas] = useState([]);
  const { activas: obras, archivadas, existentes } = vinculoEntregas(entregas);
  // Lo de entregas archivadas no se muestra
  const listas = listasTodas.filter(l => !archivadas.has(l.obra_id));
  const [cargando, setCargando] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemData, setItemData] = useState({});
  const [saving, setSaving] = useState(false);
  const [showNuevaObra, setShowNuevaObra] = useState(false);
  const [showNotasModal, setShowNotasModal] = useState(false);
  const [notasEdit, setNotasEdit] = useState("");
  const [showImportarIA, setShowImportarIA] = useState(false);
  const [enviandoResumen, setEnviandoResumen] = useState(false);
  const [search, setSearch] = useState("");
  const isAdmin = sesion.rol === "admin";
  const puedeImportar = isAdmin || sesion.rol === "operario";

  async function recargar() {
    setCargando(true);
    try {
      const d = await getMateriales();
      const lista = d || [];
      setListas(lista);
      if (selected) {
        const upd = lista.find(x => x.id === selected.id);
        if (upd) setSelected(upd);
      }
    } catch (e) { console.error("Error cargando materiales:", e); }
    setCargando(false);
  }

  // Carga inicial al abrir el módulo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { recargar(); }, []);

  // datos puede ser un objeto o una función que recibe la lista recién leída de la base
  async function guardarLista(id, datos) {
    setSaving(true);
    try {
      await modificarFila("materiales", id, fila => ({ ...(typeof datos === "function" ? datos(fila) : datos), updated_at: new Date().toISOString() }));
      const d = await getMateriales();
      const lista = d || [];
      setListas(lista);
      const upd = lista.find(x => x.id === id);
      if (upd) setSelected(upd);
    } catch (e) { avisar(`Error al guardar. ${e.message || ""}`, { tipo: "error" }); }
    setSaving(false);
  }

  function abrirItemModal(item = null) {
    setEditingItem(item ? item.id : null);
    setItemData(item ? { ...item, estado: item.estado || "pendiente" } : { nombre:"", tipo:"", cantidad:"", unidad:"Unidades", largo:"", ancho:"", espesor:"", color:"", terminacion:"", marca:"", proveedor:"", orden_pedido:"", numero_remito:"", cantidad_recibida:"", notas:"", estado:"pendiente" });
    setShowItemModal(true);
  }

  async function guardarItem() {
    if (!itemData.nombre?.trim()) { avisar("Ingresá una descripción.", { tipo: "aviso" }); return; }
    setSaving(true);
    await guardarLista(selected.id, l => {
      const items = l.items || [];
      if (editingItem) {
        const idx = items.findIndex(i => i.id === editingItem);
        if (idx >= 0) items[idx] = { ...items[idx], ...itemData };
      } else {
        items.push({ id: uid(), ...itemData });
      }
      return { items };
    });
    setShowItemModal(false);
    setEditingItem(null);
    setSaving(false);
  }

  async function eliminarItem(itemId) {
    if (!await confirmar("¿Eliminar este material?")) return;
    await guardarLista(selected.id, l => ({ items: (l.items || []).filter(i => i.id !== itemId) }));
  }

  async function cambiarEstadoItem(itemId, nuevoEstado) {
    await guardarLista(selected.id, l => ({ items: (l.items || []).map(i => i.id === itemId ? { ...i, estado: nuevoEstado } : i) }));
  }

  async function eliminarMaterial(id) {
    if (!await confirmar("¿Eliminar esta obra de Materiales? Esta acción no se puede deshacer.")) return;
    try {
      await deleteMaterialById(id);
      setSelected(null);
      await recargar();
    } catch { avisar("Error al eliminar.", { tipo: "error" }); }
  }

  async function crearListaEntrega(e) {
    await insertMaterial({ obra_id: e.id, obra_nombre: e.nombre, obra_lugar: e.lugar, items: [], notas: "" });
    await recargar();
  }

  async function agregarItemsImportados(nuevos) {
    await guardarLista(selected.id, l => ({ items: [...(l.items || []), ...nuevos] }));
  }

  async function enviarResumenAhora() {
    setEnviandoResumen(true);
    await enviarAvisoAhora("materiales");
    setEnviandoResumen(false);
  }

  async function vincularEntrega(listaId, obraId) {
    if (!obras.some(o => o.id === obraId)) return;
    await guardarLista(listaId, { obra_id: obraId });
  }

  const resumenes = listas.map(l => resumenMateriales(l.items || []));
  const totalCompletas = resumenes.filter(r => r.completo).length;
  const totalFaltaPedir = resumenes.reduce((s, r) => s + r.faltaPedir.length, 0);
  const totalFaltaRecibir = resumenes.reduce((s, r) => s + r.faltaRecibir.length, 0);
  const alertas = alertasMateriales(listas, obras);

  // Buscador: por obra (nombre, lugar, notas) o por material (descripción, color, marca, proveedor, N° de pedido o remito...)
  const q = sinAcentos(search.trim());
  const coincide = v => !!v && sinAcentos(v).includes(q);
  const itemCoincide = it => q && CAMPOS_BUSQUEDA_MAT.some(k => coincide(it[k]));
  const visibles = listas.map((l, idx) => ({ l, idx, itemsCoinc: q ? (l.items || []).filter(itemCoincide) : [] }))
    .filter(v => !q || coincide(v.l.obra_nombre) || coincide(v.l.obra_lugar) || coincide(v.l.notas) || v.itemsCoinc.length);

  const si = { width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" };
  const siSm = { ...si, padding:"8px 10px", fontSize:12 };

  const CAMPOS_ITEM = [
    { key:"nombre",      label:"Descripción *",       type:"text",   ph:"Ej: Panel lateral izquierdo", full:true },
    { key:"tipo",        label:"Tipo de material",     type:"combo",  opts:TIPOS_MATERIAL, ph:"Elegí o escribí" },
    { key:"cantidad",    label:"Cantidad",             type:"text",   ph:"Ej: 1, 2.5" },
    { key:"unidad",      label:"Unidad",               type:"combo",  opts:UNIDADES, ph:"Elegí o escribí (ej: tiras)" },
    { key:"largo",       label:"Largo (mm/cm)",        type:"text",   ph:"Ej: 2400" },
    { key:"ancho",       label:"Ancho (mm/cm)",        type:"text",   ph:"Ej: 600" },
    { key:"espesor",     label:"Espesor (mm)",         type:"text",   ph:"Ej: 18" },
    { key:"color",       label:"Color / Tono",         type:"text",   ph:"Ej: Blanco roto, Roble natural" },
    { key:"terminacion", label:"Terminación",          type:"combo",  opts:TERMINACIONES, ph:"Elegí o escribí" },
    { key:"marca",       label:"Marca",                type:"text",   ph:"Ej: Masisa, Arauco" },
    { key:"proveedor",   label:"Proveedor",            type:"text",   ph:"Ej: Maderería Centro", soloPedir:true },
    { key:"estado",      label:"Estado del pedido",    type:"select", opts:ESTADOS_MAT_PEDIR.map(v=>({v,l:ESTADOS_MAT[v]})), isObj:true, soloPedir:true },
    { key:"cantidad_recibida", label:"Cantidad que llegó", type:"text", ph:"Ej: 3", soloParcial:true },
    { key:"orden_pedido",  label:"N° de pedido",       type:"text",   ph:"Ej: OP-0051", soloPedir:true },
    { key:"numero_remito", label:"N° de remito",       type:"text",   ph:"Ej: R-0001234", soloPedir:true },
    { key:"notas",       label:"Notas adicionales",    type:"text",   ph:"Observaciones...", full:true },
  ].filter(f => (!f.soloPedir || itemData.estado !== "stock") && (!f.soloParcial || itemData.estado === "parcial"));

  return (
    <div>
      {/* STATS */}
      <div className="grid-numeros" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:32 }}>
        {[
          { num:listas.length,     label:"Total obras",                   color:"#0F766E", border:"#99F6E4" },
          { num:totalCompletas,    label:"Obras con materiales completos", color:"#059669", border:"#A7F3D0" },
          { num:totalFaltaPedir,   label:"Materiales que falta pedir",    color:"#D97706", border:"#FDE68A" },
          { num:totalFaltaRecibir, label:"Materiales que falta recibir",  color:"#2563EB", border:"#DBEAFE" },
        ].map((s,i) => (
          <div key={i} style={{ background:"#ffffff", border:`1px solid ${s.border}`, borderRadius:12, padding:"20px 20px 18px", animation:`fadeUp 0.35s ease ${i*0.06}s both` }}>
            <div style={{ fontFamily:"'Sora', sans-serif", fontSize:32, fontWeight:800, color:s.color, lineHeight:1 }}>{s.num}</div>
            <div style={{ fontSize:12, color:"#64748B", fontWeight:500, marginTop:6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ALERTAS: entrega próxima con materiales faltantes */}
      {alertas.length > 0 && (
        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:12, padding:"14px 18px", marginBottom:24 }}>
          <div style={{ fontFamily:"'Sora', sans-serif", fontSize:14, fontWeight:700, color:"#DC2626", marginBottom:8 }}>
            ⚠ {alertas.length} obra{alertas.length!==1?"s":""} con entrega en {DIAS_ALERTA_MAT} días o menos y materiales faltantes
          </div>
          {alertas.map(a => (
            <div key={a.lista.id} onClick={() => setSelected(a.lista)}
              style={{ padding:"8px 0", borderTop:"1px solid #FEE2E2", cursor:"pointer", fontSize:12, color:"#7F1D1D" }}>
              <strong style={{ fontSize:13 }}>{a.lista.obra_nombre}</strong>
              <span style={{ marginLeft:8, fontWeight:700, color:"#DC2626" }}>📅 {fmtDateAixa(a.entrega.fecha)} · {textoDiasEntrega(a.dias)}</span>
              {a.faltaPedir.length > 0 && <div style={{ marginTop:3 }}>🛒 <strong>Falta pedir:</strong> {a.faltaPedir.map(detalleFaltante).join(" · ")}</div>}
              {a.faltaRecibir.length > 0 && <div style={{ marginTop:2 }}>🚚 <strong>Falta recibir:</strong> {a.faltaRecibir.map(detalleFaltante).join(" · ")}</div>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>Materiales por obra</h2>
        <div style={{ flex:1 }} />
        {isAdmin && (
          <button onClick={enviarResumenAhora} disabled={enviandoResumen} title="El aviso de materiales faltantes sale solo todos los días a las 8:00 cuando hay algo para avisar. Este botón lo manda ahora."
            style={{ padding:"9px 14px", marginRight:8, background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:12, fontWeight:600, cursor: enviandoResumen ? "not-allowed" : "pointer" }}>
            {enviandoResumen ? "Enviando..." : "📧 Enviar aviso de materiales ahora"}
          </button>
        )}
        <button onClick={() => setShowNuevaObra(true)} title="Las entregas nuevas se agregan solas al crearlas en Entregas"
          style={{ padding:"9px 18px", background:"#0F766E", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
          + Agregar entrega
        </button>
      </div>

      {listas.length > 0 && (
        <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ position:"relative", flex:"1 1 260px", maxWidth:420 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar obra, material, color, proveedor, N° de pedido..."
              style={{ width:"100%", padding:"9px 32px 9px 36px", background:"#ffffff", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" }} />
            {search && <button onClick={() => setSearch("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#94A3B8", cursor:"pointer", fontSize:14, padding:2 }}>✕</button>}
          </div>
          {q && <span style={{ fontSize:12, color:"#94A3B8" }}>{visibles.length} obra{visibles.length !== 1 ? "s" : ""}</span>}
        </div>
      )}

      {cargando ? (
        <div style={{ textAlign:"center", padding:60, color:"#94A3B8", fontSize:13 }}>Cargando...</div>
      ) : listas.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🪵</div>
          <div style={{ fontSize:13, color:"#94A3B8" }}>Sin obras. Se crean automáticamente al crear obras en Entregas.</div>
        </div>
      ) : visibles.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
          <div style={{ fontSize:28, marginBottom:10 }}>🔎</div>
          <div style={{ fontSize:13, color:"#94A3B8" }}>Ninguna obra ni material coincide con "{search.trim()}".</div>
        </div>
      ) : (
        <div className="grid-tarjetas" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:16 }}>
          {visibles.map(({ l, idx, itemsCoinc }, pos) => {
            const items = l.items || [];
            const r = resumenes[idx];
            const disponibles = r.stock + r.recibidos;
            const pct = items.length ? Math.round(disponibles/items.length*100) : 0;
            const urgente = alertas.find(a => a.lista.id === l.id);
            const entrega = entregaDeLista(l, obras);
            return (
              <div key={l.id} onClick={() => setSelected(l)}
                style={{ background:"#ffffff", border:`1px solid ${urgente?"#FCA5A5":r.completo?"#A7F3D0":"#E8ECF0"}`, borderRadius:14, overflow:"hidden", cursor:"pointer", animation:`fadeUp 0.35s ease ${pos*0.04}s both`, boxShadow:"0 1px 4px rgba(26,43,74,0.05)" }}>
                <div style={{ height:4, background: urgente?"#DC2626":r.completo?"#059669":pct>0?"#D97706":"#CBD5E1" }} />
                <div style={{ padding:"18px 18px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div style={{ fontFamily:"'Sora', sans-serif", fontSize:15, fontWeight:700, color:"#1A2B4A", flex:1, lineHeight:1.35, paddingRight:8 }}>{l.obra_nombre}</div>
                    <div style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:6, background:"#F0FDF4", color:"#059669", border:"1px solid #A7F3D0", whiteSpace:"nowrap" }}>{items.length} ítem{items.length!==1?"s":""}</div>
                  </div>
                  {l.obra_lugar && <div style={{ fontSize:12, color:"#64748B", marginBottom:6 }}>📍 {l.obra_lugar}</div>}
                  {entrega?.fecha && entrega.estado !== "terminado" && (
                    <div style={{ fontSize:12, color: urgente?"#DC2626":"#64748B", fontWeight: urgente?700:400, marginBottom:8 }}>📅 Entrega {fmtDateAixa(entrega.fecha)} · {textoDiasEntrega(diasHastaFecha(entrega.fecha))}</div>
                  )}
                  {items.length === 0 ? (
                    <div style={{ fontSize:12, color:"#94A3B8" }}>Sin materiales cargados</div>
                  ) : (
                    <>
                      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
                        {r.completo
                          ? <div style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:5, background:"#ECFDF5", color:"#059669", border:"1px solid #A7F3D0" }}>✅ Todos los materiales disponibles</div>
                          : <>
                              {r.faltaPedir.length>0&&<div style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:5, background:"#FFF7ED", color:"#D97706", border:"1px solid #FDE68A" }}>🛒 Falta pedir {r.faltaPedir.length}</div>}
                              {r.faltaRecibir.length>0&&<div style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:5, background:"#EFF6FF", color:"#2563EB", border:"1px solid #BFDBFE" }}>🚚 Falta recibir {r.faltaRecibir.length}</div>}
                            </>}
                        {r.stock>0&&<div style={{ fontSize:11, padding:"2px 8px", borderRadius:5, background:"#F5F3FF", color:"#7C3AED", border:"1px solid #DDD6FE" }}>{r.stock} en stock</div>}
                      </div>
                      <div style={{ height:6, background:"#F1F5F9", borderRadius:99, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background: pct===100?"#059669":"#0F766E", borderRadius:99, transition:"width 0.4s" }} />
                      </div>
                      <div style={{ fontSize:11, color:"#94A3B8", marginTop:4, textAlign:"right" }}>{pct}% disponible</div>
                    </>
                  )}
                  {itemsCoinc.length > 0 && (
                    <div style={{ marginTop:10, padding:"8px 10px", background:"#FEFCE8", border:"1px solid #FDE68A", borderRadius:8, fontSize:12, color:"#713F12" }}>
                      <div style={{ fontWeight:700, marginBottom:4 }}>🔎 {itemsCoinc.length} material{itemsCoinc.length !== 1 ? "es" : ""} coincide{itemsCoinc.length !== 1 ? "n" : ""}:</div>
                      {itemsCoinc.slice(0, 4).map(it => (
                        <div key={it.id} style={{ display:"flex", justifyContent:"space-between", gap:8, padding:"2px 0" }}>
                          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{[it.nombre, it.color, it.proveedor].filter(Boolean).join(" · ")}</span>
                          <span style={{ flexShrink:0, fontWeight:600, color:(ESTADO_MAT_COLORS[it.estado] || ESTADO_MAT_COLORS.pendiente).text }}>{ESTADOS_MAT[it.estado || "pendiente"]}</span>
                        </div>
                      ))}
                      {itemsCoinc.length > 4 && <div style={{ color:"#A16207", marginTop:2 }}>y {itemsCoinc.length - 4} más…</div>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETALLE */}
      {selected && (() => {
        const items = selected.items || [];
        const r = resumenMateriales(items);
        const pct = items.length ? Math.round((r.stock + r.recibidos)/items.length*100) : 0;
        const entrega = entregaDeLista(selected, obras);
        const diasEntrega = entrega?.fecha ? diasHastaFecha(entrega.fecha) : null;
        const urgente = diasEntrega !== null && entrega.estado !== "terminado" && diasEntrega <= DIAS_ALERTA_MAT && !r.completo && items.length > 0;
        const obrasVinculables = obras.filter(o => o.estado !== "terminado").sort((a,b) => (a.nombre||"").localeCompare(b.nombre||""));
        return (
          <div onClick={e => e.target===e.currentTarget&&setSelected(null)}
            style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
            <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:860, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)", display:"flex", flexDirection:"column" }}>
              {/* Header */}
              <div style={{ padding:"18px 24px", borderBottom:"1px solid #F1F5F9", position:"sticky", top:0, background:"#fff", zIndex:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{selected.obra_nombre}</h2>
                    {selected.obra_lugar && <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>📍 {selected.obra_lugar}</div>}
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <button onClick={() => { setNotasEdit(selected.notas||""); setShowNotasModal(true); }}
                      style={{ padding:"7px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#64748B", fontSize:12, cursor:"pointer" }}>📝 Notas</button>
                    <button onClick={() => generarPDFMateriales(selected, entrega)}
                      style={{ padding:"7px 14px", background:"#0F766E", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>⬇ PDF</button>
                    {puedeImportar && <button onClick={() => setShowImportarIA(true)}
                      style={{ padding:"7px 14px", background:"#F5F3FF", border:"1px solid #DDD6FE", borderRadius:8, color:"#7C3AED", fontSize:12, fontWeight:600, cursor:"pointer" }}>✨ Cargar con Claude</button>}
                    <button onClick={() => abrirItemModal()}
                      style={{ padding:"7px 14px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>+ Agregar</button>
                    {/* Los materiales de una entrega se archivan o eliminan desde Entregas */}
                    {!existentes.has(selected.obra_id) && <button onClick={() => eliminarMaterial(selected.id)}
                      style={{ padding:"7px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:12, fontWeight:600, cursor:"pointer" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#FEE2E2"} onMouseLeave={e=>e.currentTarget.style.background="#FEF2F2"}>
                      🗑 Eliminar
                    </button>}
                    <button onClick={() => setSelected(null)} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
                  </div>
                </div>
                {/* Entrega (desde Entregas) */}
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10, fontSize:12, color:"#64748B", flexWrap:"wrap" }}>
                  {entrega ? (
                    <span style={{ color: urgente?"#DC2626":"#64748B", fontWeight: urgente?700:500 }}>
                      📅 Entrega: {entrega.fecha ? `${fmtDateAixa(entrega.fecha)}${entrega.estado !== "terminado" ? ` · ${textoDiasEntrega(diasEntrega)}` : " · entregada"}` : "sin fecha cargada en Entregas"}
                    </span>
                  ) : (
                    <>
                      <span>📅 Sin vincular a una obra de Entregas (no se puede alertar por fecha):</span>
                      <select value="" onChange={e => e.target.value && vincularEntrega(selected.id, e.target.value)} disabled={saving}
                        style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #E2E8F0", background:"#F8FAFC", color:"#1A2B4A", fontSize:12, outline:"none" }}>
                        <option value="">— Vincular con… —</option>
                        {obrasVinculables.map(o => <option key={o.id} value={o.id}>{o.nombre}{o.fecha ? ` (${fmtDateAixa(o.fecha)})` : ""}</option>)}
                      </select>
                    </>
                  )}
                </div>
              </div>

              {/* Control general */}
              {items.length > 0 && (
                <div style={{ margin:"14px 24px 0", padding:"12px 16px", borderRadius:10,
                  background: r.completo?"#ECFDF5":urgente?"#FEF2F2":"#FFFBEB",
                  border:`1px solid ${r.completo?"#A7F3D0":urgente?"#FECACA":"#FDE68A"}` }}>
                  {r.completo ? (
                    <div style={{ fontSize:13, fontWeight:700, color:"#059669" }}>✅ Están todos los materiales para esta obra <span style={{ fontWeight:400 }}>({r.stock} en stock, {r.recibidos} recibidos)</span></div>
                  ) : (
                    <>
                      <div style={{ fontSize:13, fontWeight:700, color: urgente?"#DC2626":"#B45309", marginBottom:6 }}>
                        {urgente ? `⚠ Faltan materiales y la entrega es en ${diasEntrega <= 0 ? "0" : diasEntrega} día${diasEntrega===1?"":"s"}${diasEntrega < 0 ? " (vencida)" : ""}` : "⚠ Faltan materiales"}
                      </div>
                      {r.faltaPedir.length > 0 && <div style={{ fontSize:12, color:"#92400E", marginBottom:3 }}>🛒 <strong>Falta pedir ({r.faltaPedir.length}):</strong> {r.faltaPedir.map(detalleFaltante).join(" · ")}</div>}
                      {r.faltaRecibir.length > 0 && <div style={{ fontSize:12, color:"#1E40AF" }}>🚚 <strong>Falta recibir ({r.faltaRecibir.length}):</strong> {r.faltaRecibir.map(it => `${detalleFaltante(it)}${it.proveedor ? ` — ${it.proveedor}` : ""}${it.orden_pedido ? ` (ped. ${it.orden_pedido})` : ""}`).join(" · ")}</div>}
                    </>
                  )}
                </div>
              )}

              {/* Progress bar */}
              {items.length > 0 && (
                <div style={{ padding:"10px 24px 0", background:"#fff" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#94A3B8", marginBottom:4 }}>
                    <span>{items.length} ítem{items.length!==1?"s":""} cargados</span>
                    <span>{pct}% disponible (en stock o recibido)</span>
                  </div>
                  <div style={{ height:6, background:"#F1F5F9", borderRadius:99, overflow:"hidden", marginBottom:12 }}>
                    <div style={{ height:"100%", width:`${pct}%`, background: pct===100?"#059669":"#0F766E", borderRadius:99, transition:"width 0.4s" }} />
                  </div>
                </div>
              )}

              {/* Items list */}
              <div style={{ padding:"12px 24px 24px", flex:1 }}>
                {items.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"48px 20px", color:"#94A3B8", fontSize:13 }}>
                    <div style={{ fontSize:28, marginBottom:10 }}>🪵</div>
                    Sin materiales cargados. Hacé clic en "+ Agregar" para empezar.
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {items.map(it => {
                      const ec = ESTADO_MAT_COLORS[it.estado] || ESTADO_MAT_COLORS.pendiente;
                      const medidas = [it.largo&&`L: ${it.largo}`, it.ancho&&`An: ${it.ancho}`, it.espesor&&`Esp: ${it.espesor}`].filter(Boolean).join("  ·  ");
                      const ok = it.estado==="recibido" || it.estado==="stock";
                      const buscado = itemCoincide(it);
                      return (
                        <div key={it.id} style={{ background: ok?"#F0FDF4":"#F8FAFC", border:`1px solid ${buscado?"#EAB308":ok?"#A7F3D0":"#E2E8F0"}`, boxShadow: buscado?"0 0 0 2px #FEF08A":"none", borderRadius:10, padding:"14px 16px" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                                <div style={{ fontFamily:"'Sora', sans-serif", fontSize:14, fontWeight:700, color:"#1A2B4A" }}>{it.nombre}</div>
                                {it.tipo && <div style={{ fontSize:11, padding:"2px 8px", borderRadius:5, background:"#F1F5F9", color:"#475569", border:"1px solid #E2E8F0" }}>{it.tipo}</div>}
                              </div>
                              <div style={{ display:"flex", flexWrap:"wrap", gap:12, fontSize:12, color:"#64748B" }}>
                                {(it.cantidad||it.unidad) && <span>📦 {it.cantidad} {it.unidad}</span>}
                                {medidas && <span>📐 {medidas}</span>}
                                {it.color && <span>🎨 {it.color}</span>}
                                {it.terminacion && <span>✨ {it.terminacion}</span>}
                                {it.marca && <span>🏷 {it.marca}</span>}
                                {it.proveedor && <span>🏪 {it.proveedor}</span>}
                                {it.orden_pedido && <span>📋 Pedido {it.orden_pedido}</span>}
                                {it.numero_remito && <span>🧾 Remito {it.numero_remito}</span>}
                                {it.estado === "parcial" && <span style={{ color:"#DC2626", fontWeight:600 }}>⚠ {it.cantidad_recibida ? `Llegaron ${it.cantidad_recibida} de ${it.cantidad || "?"}` : "Llegó incompleto"}</span>}
                              </div>
                              {it.notas && <div style={{ marginTop:6, fontSize:12, color:"#94A3B8", fontStyle:"italic" }}>"{it.notas}"</div>}
                            </div>
                            <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end", flexShrink:0 }}>
                              <select value={it.estado||"pendiente"} onChange={e => cambiarEstadoItem(it.id, e.target.value)}
                                style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${ec.border}`, background:ec.bg, color:ec.text, fontSize:11, fontWeight:700, cursor:"pointer", outline:"none" }}>
                                <option value="stock">En stock (no se pide)</option>
                                <optgroup label="A pedir">
                                  {ESTADOS_MAT_PEDIR.map(v => <option key={v} value={v}>{ESTADOS_MAT[v]}</option>)}
                                </optgroup>
                              </select>
                              <div style={{ display:"flex", gap:6 }}>
                                <button onClick={() => abrirItemModal(it)}
                                  style={{ padding:"4px 10px", background:"#fff", border:"1px solid #E2E8F0", borderRadius:6, color:"#64748B", fontSize:11, cursor:"pointer" }}>Editar</button>
                                <button onClick={() => eliminarItem(it.id)}
                                  style={{ padding:"4px 8px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:6, color:"#DC2626", fontSize:11, cursor:"pointer" }}>✕</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showImportarIA && selected && (
        <ImportarMaterialesIA lista={selected} onClose={() => setShowImportarIA(false)} onAgregar={agregarItemsImportados} />
      )}

      {/* MODAL: AGREGAR / EDITAR ITEM */}
      {showItemModal && (
        <div onClick={e => e.target===e.currentTarget&&setShowItemModal(false)}
          style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:560, maxHeight:"90vh", overflowY:"auto", padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
            <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:"0 0 14px" }}>{editingItem ? "Editar material" : "Agregar material"}</h3>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {[{ stock:false, label:"🛒 Hay que pedirlo" }, { stock:true, label:"📦 Lo tenemos en stock" }].map(op => {
                const activo = (itemData.estado === "stock") === op.stock;
                return (
                  <button key={op.label} type="button"
                    onClick={() => setItemData(d => ({ ...d, estado: op.stock ? "stock" : (d.estado === "stock" ? "pendiente" : d.estado) }))}
                    style={{ flex:1, padding:"10px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer",
                      border:`1.5px solid ${activo ? (op.stock?"#7C3AED":"#D97706") : "#E2E8F0"}`,
                      background: activo ? (op.stock?"#F5F3FF":"#FFF7ED") : "#F8FAFC",
                      color: activo ? (op.stock?"#7C3AED":"#D97706") : "#64748B" }}>{op.label}</button>
                );
              })}
            </div>
            <div className="grid-form" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {CAMPOS_ITEM.map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? "1 / -1" : "auto" }}>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:5 }}>{f.label}</label>
                  {f.type === "combo" ? (
                    <>
                      <input list={`mat-opts-${f.key}`} value={itemData[f.key]||""} onChange={e => setItemData(d=>({...d,[f.key]:e.target.value}))} style={siSm} placeholder={f.ph||""} />
                      <datalist id={`mat-opts-${f.key}`}>{f.opts.map(o => <option key={o} value={o} />)}</datalist>
                    </>
                  ) : f.type === "select" ? (
                    <select value={itemData[f.key]||""} onChange={e => setItemData(d=>({...d,[f.key]:e.target.value}))} style={siSm}>
                      <option value="">— Seleccionar —</option>
                      {f.isObj ? f.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>) : f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.type} value={itemData[f.key]||""} onChange={e => setItemData(d=>({...d,[f.key]:e.target.value}))} style={siSm} placeholder={f.ph||""} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button onClick={() => { setShowItemModal(false); setEditingItem(null); }} style={{ flex:1, padding:"10px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cancelar</button>
              <button onClick={guardarItem} disabled={saving}
                style={{ flex:1, padding:"10px", border:"none", borderRadius:8, background: saving?"#94A3B8":"#1A2B4A", color:"#fff", cursor: saving?"not-allowed":"pointer", fontSize:13, fontWeight:600 }}>{saving?"Guardando...":editingItem?"Actualizar":"Agregar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOTAS */}
      {showNotasModal && (
        <div onClick={e => e.target===e.currentTarget&&setShowNotasModal(false)}
          style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:400, padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
            <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:"0 0 14px" }}>Notas de la obra</h3>
            <textarea value={notasEdit} onChange={e=>setNotasEdit(e.target.value)} rows={5}
              style={{ ...si, resize:"vertical", lineHeight:1.5 }} placeholder="Aclaraciones generales sobre los materiales..." />
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button onClick={() => setShowNotasModal(false)} style={{ flex:1, padding:"10px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cancelar</button>
              <button onClick={async () => { await guardarLista(selected.id, { notas: notasEdit }); setShowNotasModal(false); }} disabled={saving}
                style={{ flex:1, padding:"10px", border:"none", borderRadius:8, background:"#1A2B4A", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR ENTREGA */}
      {showNuevaObra && <ModalElegirEntrega titulo="Agregar entrega a Materiales" color="#0F766E"
        entregas={obras.filter(e => !listasTodas.some(l => l.obra_id === e.id))}
        onClose={() => setShowNuevaObra(false)} onElegir={crearListaEntrega} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AVANCE DE OBRA MODULE (nuevo — con días y fotos)
// ═══════════════════════════════════════════════════════════════════════════════
function AvanceObraModule({ sesion, entregas = [] }) {
  const [obrasTodas, setObras] = useState([]);
  const { activas, archivadas } = vinculoEntregas(entregas);
  // Lo de entregas archivadas no se muestra
  const obras = obrasTodas.filter(o => !archivadas.has(o.obra_id));
  const [cargando, setCargando] = useState(true);
  const [selected, setSelected] = useState(null);
  const [dias, setDias] = useState([]);
  const [cargandoDias, setCargandoDias] = useState(false);
  const [showObraModal, setShowObraModal] = useState(false);
  const [editingObra, setEditingObra] = useState(null);
  const [showDiaModal, setShowDiaModal] = useState(false);
  const [editingDia, setEditingDia] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [visor, setVisor] = useState(null); // { fotos, inicio }
  const [showInformeFinal, setShowInformeFinal] = useState(false);
  const [informeFinalObra, setInformeFinalObra] = useState(null);
  const [informesIds, setInformesIds] = useState(new Set());

  const isAdmin = sesion.rol === "admin";
  const canEdit = isAdmin || sesion.rol === "operario" || sesion.rol === "arquitecto";

  async function loadInformesIds() {
    try { const ids = await getInformesFinalesObraIds(); setInformesIds(new Set(ids)); } catch (e) { console.error("Error cargando informes finales:", e); }
  }

  async function loadObras() {
    setCargando(true);
    try { const obs = await getObrasAvance(); setObras(obs || []); } catch (e) { console.error("Error cargando obras de avance:", e); }
    setCargando(false);
  }

  // Carga inicial al abrir el módulo (cargando ya arranca en true, el setCargando(true) no re-renderiza)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadObras(); loadInformesIds(); }, []);

  async function loadDias(obraId) {
    setCargandoDias(true);
    try { const d = await getDiasAvance(obraId); setDias(d || []); } catch (e) { console.error("Error cargando los días de avance:", e); }
    setCargandoDias(false);
  }

  async function saveObra(form) {
    try {
      if (editingObra) {
        await updateObraAvance(editingObra.id, { ...form, updated_at: new Date().toISOString() });
      } else {
        await insertObraAvance({ ...form, finalizada: false });
      }
      const newObras = await getObrasAvance();
      setObras(newObras || []);
      if (selected && editingObra?.id === selected.id) {
        setSelected(newObras?.find(o => o.id === selected.id) || null);
      }
    } catch { avisar("Error al guardar la obra.", { tipo: "error" }); return; }
    setShowObraModal(false); setEditingObra(null);
  }

  async function deleteObra(id) {
    if (!await confirmar("¿Eliminar esta obra y todos sus registros?")) return;
    try {
      const ds = await getDiasAvance(id);
      for (const d of (ds || [])) {
        for (const f of (d.archivos || [])) { try { await deleteFileAvance(f.path); } catch { /* si el archivo ya no existe se sigue igual */ } }
        await deleteDiaAvanceById(d.id);
      }
      await deleteObraAvanceById(id);
      if (selected?.id === id) { setSelected(null); setDias([]); }
      await loadObras();
    } catch { avisar("Error al eliminar.", { tipo: "error" }); }
  }

  async function saveDia(form) {
    try {
      if (editingDia) {
        await updateDiaAvance(editingDia.id, form);
      } else {
        await insertDiaAvance({ ...form, obra_id: selected.id, archivos: [] });
      }
      await loadDias(selected.id);
    } catch { avisar("Error al guardar el día.", { tipo: "error" }); return; }
    setShowDiaModal(false); setEditingDia(null);
  }

  async function deleteDia(id) {
    if (!await confirmar("¿Eliminar este registro de día?")) return;
    try {
      const dia = dias.find(d => d.id === id);
      for (const f of (dia?.archivos || [])) { try { await deleteFileAvance(f.path); } catch { /* si el archivo ya no existe se sigue igual */ } }
      await deleteDiaAvanceById(id);
      await loadDias(selected.id);
    } catch { avisar("Error al eliminar.", { tipo: "error" }); }
  }

  async function handleFileUpload(files, diaId) {
    setUploadingFiles(s => ({ ...s, [diaId]: true }));
    try {
      const dia = dias.find(d => d.id === diaId);
      const archivos = [...(dia?.archivos || [])];
      for (const file of Array.from(files)) {
        try { const fi = await uploadFileAvance(file, selected.id); archivos.push(fi); }
        catch (e) { avisar(`Error al subir ${file.name}: ${e.message}`, { tipo: "error" }); }
      }
      await updateDiaAvance(diaId, { archivos });
      await loadDias(selected.id);
    } catch (e) { console.error("Error guardando los archivos del día:", e); }
    setUploadingFiles(s => ({ ...s, [diaId]: false }));
  }

  async function deleteFile(diaId, fileIdx) {
    if (!await confirmar("¿Eliminar este archivo?")) return;
    try {
      const dia = dias.find(d => d.id === diaId);
      const archivos = [...(dia?.archivos || [])];
      const removed = archivos.splice(fileIdx, 1);
      try { await deleteFileAvance(removed[0]?.path); } catch { /* si el archivo ya no existe se sigue igual */ }
      await updateDiaAvance(diaId, { archivos });
      await loadDias(selected.id);
    } catch { avisar("Error al eliminar archivo.", { tipo: "error" }); }
  }

  async function marcarFinalizada(obra) {
    try {
      const nuevoEstado = !obra.finalizada;
      await updateObraAvance(obra.id, { finalizada: nuevoEstado, updated_at: new Date().toISOString() });
      const newObras = await getObrasAvance();
      setObras(newObras || []);
      const obraActualizada = newObras?.find(o => o.id === obra.id) || null;
      if (selected?.id === obra.id) setSelected(obraActualizada);
      if (nuevoEstado) {
        setInformeFinalObra(obraActualizada || obra);
        setShowInformeFinal(true);
      }
    } catch { avisar("Error al actualizar.", { tipo: "error" }); }
  }

  const obrasActivas = obras.filter(o => !o.finalizada);
  const obrasFinalizadas = obras.filter(o => o.finalizada);

  if (cargando) return <div style={{ textAlign:"center", padding:"60px 0", color:"#94A3B8", fontSize:13 }}>Cargando avance de obras...</div>;

  return (
    <div>
      <div className="grid-numeros" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:32 }}>
        {[
          { num: obras.length, label:"Total obras", color:"#2563EB", border:"#DBEAFE" },
          { num: obrasActivas.length, label:"En curso", color:"#D97706", border:"#FDE68A" },
          { num: obrasFinalizadas.length, label:"Finalizadas", color:"#059669", border:"#A7F3D0" },
        ].map((s, i) => (
          <div key={i} style={{ background:"#ffffff", border:`1px solid ${s.border}`, borderRadius:12, padding:"20px 20px 18px" }}>
            <div style={{ fontFamily:"'Sora', sans-serif", fontSize:32, fontWeight:800, color:s.color, lineHeight:1 }}>{s.num}</div>
            <div style={{ fontSize:12, color:"#64748B", fontWeight:500, marginTop:6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>Obras — Avance de Obra</h2>
        {canEdit && (
          <button onClick={() => { setEditingObra(null); setShowObraModal(true); }}
            style={{ padding:"8px 18px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            + Agregar entrega
          </button>
        )}
      </div>

      {obras.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
          <div style={{ fontSize:13, color:"#94A3B8" }}>No hay obras registradas aún</div>
        </div>
      ) : (
        <div className="grid-tarjetas" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:16 }}>
          {obras.map((obra, idx) => (
            <div key={obra.id} onClick={() => { setSelected(obra); loadDias(obra.id); }}
              style={{ background:"#ffffff", border: obra.finalizada ? "1px solid #A7F3D0" : "1px solid #E8ECF0", borderRadius:14, overflow:"hidden", cursor:"pointer", animation:`fadeUp 0.35s ease ${idx*0.04}s both`, boxShadow:"0 1px 4px rgba(26,43,74,0.05)" }}>
              <div style={{ height:4, background: obra.finalizada ? "#059669" : "#2563EB" }} />
              <div style={{ padding:"18px 18px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ fontFamily:"'Sora', sans-serif", fontSize:15, fontWeight:700, color:"#1A2B4A", flex:1, paddingRight:8 }}>{obra.nombre}</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end", flexShrink:0 }}>
                    {obra.finalizada && <span style={{ fontSize:10, fontWeight:700, color:"#059669", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:5, padding:"2px 8px", whiteSpace:"nowrap" }}>✅ FINALIZADA</span>}
                    {informesIds.has(obra.id) && <span style={{ fontSize:10, fontWeight:700, color:"#7C3AED", background:"#F5F3FF", border:"1px solid #DDD6FE", borderRadius:5, padding:"2px 8px", whiteSpace:"nowrap" }}>💾 INFORME GUARDADO</span>}
                  </div>
                </div>
                {obra.direccion && <div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}>📍 {obra.direccion}</div>}
                {obra.fecha_entrega && <div style={{ fontSize:12, color:"#64748B", marginBottom:12 }}>📅 Entrega: {formatDate(obra.fecha_entrega)}</div>}
                <div onClick={e => e.stopPropagation()} style={{ display:"flex", gap:6, paddingTop:12, borderTop:"1px solid #F1F5F9" }}>
                  {canEdit && <button onClick={() => { setEditingObra(obra); setShowObraModal(true); }} style={{ flex:1, padding:"7px 0", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Editar</button>}
                  {canEdit && (
                    <button onClick={() => marcarFinalizada(obra)}
                      style={{ flex:1, padding:"7px 0", background: obra.finalizada ? "#F8FAFC" : "#ECFDF5", border:`1px solid ${obra.finalizada ? "#E2E8F0" : "#A7F3D0"}`, borderRadius:8, color: obra.finalizada ? "#475569" : "#059669", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
                      {obra.finalizada ? "Reabrir" : "Finalizar"}
                    </button>
                  )}
                  {obra.finalizada && <button onClick={() => { setInformeFinalObra(obra); setShowInformeFinal(true); }} style={{ flex:1, padding:"7px 0", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8, color:"#2563EB", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>📋 Informe</button>}
                  {(isAdmin || sesion.rol === "operario") && <button onClick={() => deleteObra(obra.id)} style={{ padding:"7px 10px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:12, cursor:"pointer" }}>✕</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div onClick={e => e.target === e.currentTarget && setSelected(null)}
          style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:720, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
            <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"flex-start", position:"sticky", top:0, background:"#fff", zIndex:10, borderRadius:"14px 14px 0 0" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>{selected.nombre}</h2>
                  {selected.finalizada && <span style={{ fontSize:10, fontWeight:700, color:"#059669", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:5, padding:"2px 8px" }}>✅ FINALIZADA</span>}
                </div>
                {selected.direccion && <div style={{ fontSize:12, color:"#64748B", marginTop:3 }}>📍 {selected.direccion}</div>}
                {selected.fecha_entrega && <div style={{ fontSize:12, color:"#64748B" }}>📅 Entrega pactada: {formatDate(selected.fecha_entrega)}</div>}
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                {selected.finalizada && (
                  <button onClick={() => { setInformeFinalObra(selected); setShowInformeFinal(true); }}
                    style={{ padding:"7px 14px", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8, color:"#2563EB", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    📋 Informe Final
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => marcarFinalizada(selected)}
                    style={{ padding:"7px 14px", background: selected.finalizada ? "#F8FAFC" : "#ECFDF5", border:`1px solid ${selected.finalizada ? "#E2E8F0" : "#A7F3D0"}`, borderRadius:8, color: selected.finalizada ? "#475569" : "#059669", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    {selected.finalizada ? "Reabrir obra" : "✅ Finalizar obra"}
                  </button>
                )}
                <button onClick={() => setSelected(null)} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16, flexShrink:0 }}>✕</button>
              </div>
            </div>
            <div style={{ padding:"20px 24px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#1A2B4A" }}>Registros por día ({dias.length})</div>
                {canEdit && (
                  <button onClick={() => { setEditingDia(null); setShowDiaModal(true); }}
                    style={{ padding:"7px 14px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>+ Agregar día</button>
                )}
              </div>
              {cargandoDias ? (
                <div style={{ textAlign:"center", padding:"40px 0", color:"#94A3B8", fontSize:13 }}>Cargando...</div>
              ) : dias.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px 20px", background:"#F8FAFC", borderRadius:12, border:"1px solid #E2E8F0", fontSize:13, color:"#94A3B8" }}>Sin registros aún.{canEdit ? ' Agregá el primer día.' : ''}</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  {dias.map((dia, idx) => {
                    const fotos = (dia.archivos || []).filter(f => /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(f.name));
                    const otros = (dia.archivos || []).filter(f => !/\.(jpg|jpeg|png|gif|webp|heic)$/i.test(f.name));
                    return (
                      <div key={dia.id} style={{ border:"1px solid #E2E8F0", borderRadius:12, overflow:"hidden" }}>
                        <div style={{ padding:"13px 16px", background:"#F8FAFC", borderBottom:"1px solid #E2E8F0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div>
                            <div style={{ fontSize:14, fontWeight:700, color:"#1A2B4A" }}>{dia.fecha ? formatDate(dia.fecha) : `Día ${idx + 1}`}</div>
                            {dia.operarios && <div style={{ fontSize:12, color:"#64748B", marginTop:2 }}>👷 {dia.operarios}</div>}
                          </div>
                          <div style={{ display:"flex", gap:6 }}>
                            <button onClick={() => generarPDFDiaAvance(selected, dia)}
                              style={{ padding:"5px 10px", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:7, color:"#2563EB", fontSize:11, fontWeight:600, cursor:"pointer" }}>📄 PDF</button>
                            {canEdit && <>
                              <button onClick={() => { setEditingDia(dia); setShowDiaModal(true); }} style={{ padding:"5px 10px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:7, color:"#475569", fontSize:11, cursor:"pointer" }}>Editar</button>
                              <button onClick={() => deleteDia(dia.id)} style={{ padding:"5px 8px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:7, color:"#DC2626", fontSize:11, cursor:"pointer" }}>✕</button>
                            </>}
                          </div>
                        </div>
                        <div style={{ padding:"14px 16px" }}>
                          {dia.detalle && (
                            <div style={{ marginBottom:12 }}>
                              <div style={{ fontSize:11, color:"#94A3B8", textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 }}>Detalle</div>
                              <div style={{ fontSize:13, color:"#1A2B4A", lineHeight:1.6, whiteSpace:"pre-line" }}>{dia.detalle}</div>
                            </div>
                          )}
                          {fotos.length > 0 && (
                            <div style={{ marginBottom:12 }}>
                              <div style={{ fontSize:11, color:"#94A3B8", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Fotos ({fotos.length})</div>
                              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                                {fotos.map((f, fi) => {
                                  const globalIdx = (dia.archivos||[]).indexOf(f);
                                  return (
                                    <div key={fi} style={{ position:"relative" }}>
                                      <img src={f.url} alt={f.name} title="Ver en grande" onClick={() => setVisor({ fotos, inicio: fi })}
                                        style={{ width:90, height:90, objectFit:"cover", borderRadius:8, border:"1px solid #E2E8F0", display:"block", cursor:"zoom-in" }} />
                                      {canEdit && <button onClick={() => deleteFile(dia.id, globalIdx)} style={{ position:"absolute", top:3, right:3, width:20, height:20, background:"rgba(220,38,38,0.85)", border:"none", borderRadius:"50%", color:"#fff", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0, lineHeight:1 }}>✕</button>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {otros.length > 0 && (
                            <div style={{ marginBottom:12 }}>
                              <div style={{ fontSize:11, color:"#94A3B8", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>Archivos</div>
                              {otros.map((f, fi) => {
                                const globalIdx = (dia.archivos||[]).indexOf(f);
                                return (
                                  <div key={fi} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:7, marginBottom:4 }}>
                                    <span style={{ fontSize:12, color:"#475569", flex:1 }}>📎 {f.name}</span>
                                    <a href={f.url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#2563EB", textDecoration:"none" }}>Ver</a>
                                    {canEdit && <button onClick={() => deleteFile(dia.id, globalIdx)} style={{ background:"none", border:"none", color:"#CBD5E1", cursor:"pointer", fontSize:13, padding:0 }} onMouseEnter={e=>e.currentTarget.style.color="#EF4444"} onMouseLeave={e=>e.currentTarget.style.color="#CBD5E1"}>✕</button>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {canEdit && (
                            <label style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", background:"#F8FAFC", border:"1px dashed #CBD5E1", borderRadius:8, cursor: uploadingFiles[dia.id] ? "not-allowed" : "pointer", fontSize:12, color:"#64748B" }}>
                              {uploadingFiles[dia.id] ? "Subiendo..." : "📎 Subir archivos / fotos"}
                              <input type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={e => { if (e.target.files?.length) { handleFileUpload(e.target.files, dia.id); e.target.value=""; } }} style={{ display:"none" }} disabled={!!uploadingFiles[dia.id]} />
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showObraModal && <ModalObraAvance obra={editingObra}
        entregas={activas.filter(e => e.id === editingObra?.obra_id || !obrasTodas.some(o => o.obra_id === e.id))}
        onClose={() => { setShowObraModal(false); setEditingObra(null); }} onSave={saveObra} />}
      {showDiaModal && <ModalDiaAvance dia={editingDia} onClose={() => { setShowDiaModal(false); setEditingDia(null); }} onSave={saveDia} />}
      {showInformeFinal && informeFinalObra && <ModalInformeFinalObra obra={informeFinalObra} onClose={() => { setShowInformeFinal(false); setInformeFinalObra(null); }} onSave={() => loadInformesIds()} />}
      {visor && <VisorFotos fotos={visor.fotos} inicio={visor.inicio} onCerrar={() => setVisor(null)} />}
    </div>
  );
}

// La obra de Avance de Obra se elige de las entregas: nombre, dirección y fecha vienen de Entregas
function ModalObraAvance({ obra, entregas = [], onClose, onSave }) {
  const [obraId, setObraId] = useState(obra?.obra_id || "");
  const [form, setForm] = useState({ nombre: obra?.nombre || "", direccion: obra?.direccion || "", fecha_entrega: obra?.fecha_entrega || "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const si = { width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box" };
  const vinculada = !!obraId;
  const opciones = [...entregas].sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"));

  function elegirEntrega(id) {
    setObraId(id);
    const e = entregas.find(x => x.id === id);
    if (e) setForm({ nombre: e.nombre, direccion: e.lugar || "", fecha_entrega: e.fecha || "" });
    setErrors({});
  }

  async function handleSave() {
    const e = {};
    if (!obra && !obraId) e.entrega = "Elegí la entrega";
    if (!form.nombre.trim()) e.nombre = "Requerido";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    await onSave({ ...(obraId ? { obra_id: obraId } : {}), nombre: form.nombre.trim(), direccion: form.direccion.trim(), fecha_entrega: form.fecha_entrega || null });
    setSaving(false);
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:460, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{obra ? "Editar obra" : "Agregar entrega a Avance de Obra"}</h2>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"24px" }}>
          {(!obra || !obra.obra_id) && (
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Entrega {obra ? "(vincular)" : "*"}</label>
              <select value={obraId} onChange={e => elegirEntrega(e.target.value)} autoFocus style={{ ...si, borderColor: errors.entrega ? "#FCA5A5" : "#E2E8F0" }}>
                <option value="">— Elegí la entrega de la pestaña Entregas —</option>
                {opciones.map(e => <option key={e.id} value={e.id}>{e.nombre}{e.fecha ? ` — ${formatDate(e.fecha)}` : ""}</option>)}
              </select>
              {errors.entrega && <div style={{ color:"#DC2626", fontSize:11, marginTop:4 }}>{errors.entrega}</div>}
              {!opciones.length && <div style={{ color:"#94A3B8", fontSize:11, marginTop:4 }}>Todas las entregas activas ya tienen su avance de obra.</div>}
            </div>
          )}
          {vinculada && <div style={{ fontSize:12, color:"#64748B", marginBottom:16 }}>El nombre, la dirección y la fecha se toman de Entregas y se editan desde ahí.</div>}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Nombre de la obra *</label>
            <input disabled={vinculada} style={{ ...si, borderColor: errors.nombre ? "#FCA5A5" : "#E2E8F0", opacity: vinculada ? 0.7 : 1 }} value={form.nombre} onChange={e => { setForm(f=>({...f, nombre:e.target.value})); setErrors(er=>({...er,nombre:""})); }} placeholder="Ej: Remodelación Cocina" />
            {errors.nombre && <div style={{ color:"#DC2626", fontSize:11, marginTop:4 }}>{errors.nombre}</div>}
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Dirección</label>
            <input disabled={vinculada} style={{ ...si, opacity: vinculada ? 0.7 : 1 }} value={form.direccion} onChange={e => setForm(f=>({...f, direccion:e.target.value}))} placeholder="Calle, número, barrio..." />
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Fecha de entrega de la obra</label>
            <input disabled={vinculada} type="date" style={{ ...si, opacity: vinculada ? 0.7 : 1 }} value={form.fecha_entrega} onChange={e => setForm(f=>({...f, fecha_entrega:e.target.value}))} />
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:"11px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:"11px", border:"none", borderRadius:8, background: saving ? "#94A3B8" : "#1A2B4A", color:"#fff", cursor: saving ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>{saving ? "Guardando..." : "Guardar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalDiaAvance({ dia, onClose, onSave }) {
  const [form, setForm] = useState({ fecha: dia?.fecha || "", detalle: dia?.detalle || "", operarios: dia?.operarios || "" });
  const [saving, setSaving] = useState(false);
  const si = { width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box" };

  async function handleSave() {
    setSaving(true);
    await onSave({ fecha: form.fecha || null, detalle: form.detalle, operarios: form.operarios });
    setSaving(false);
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:460, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{dia ? "Editar día" : "Agregar día"}</h2>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"24px" }}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Fecha</label>
            <input type="date" style={si} value={form.fecha} onChange={e => setForm(f=>({...f, fecha:e.target.value}))} autoFocus />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Operarios</label>
            <input type="text" style={si} value={form.operarios} onChange={e => setForm(f=>({...f, operarios:e.target.value}))} placeholder="Ej: Juan Pérez, Carlos García" />
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Detalle del trabajo</label>
            <textarea style={{ ...si, height:100, resize:"vertical" }} value={form.detalle} onChange={e => setForm(f=>({...f, detalle:e.target.value}))} placeholder="Descripción de los trabajos realizados ese día..." />
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:"11px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:"11px", border:"none", borderRadius:8, background: saving ? "#94A3B8" : "#1A2B4A", color:"#fff", cursor: saving ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>{saving ? "Guardando..." : "Guardar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── INFORME FINAL DE OBRA ────────────────────────────────────────────────────
function ModalInformeFinalObra({ obra, onClose, onSave }) {
  const defaultForm = {
    nombreObra: obra?.nombre || "",
    cliente: "",
    direccion: obra?.direccion || "",
    fecha: new Date().toISOString().slice(0, 10),
    etapa: "",
    estudioArquitecto: "",
    responsableEstudio: "",
    responsableEmpresa: "",
    operarios: "",
    informe: "",
    faltantes: "",
    informacionDestacada: "",
  };
  const [form, setForm] = useState(defaultForm);
  const [archivos, setArchivos] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [informeId, setInformeId] = useState(null);
  const fileInputRef = useRef(null);

  async function loadInforme() {
    setCargando(true);
    try {
      const informe = await getInformeFinal(obra.id);
      if (informe) {
        setInformeId(informe.id);
        setForm({ ...defaultForm, ...informe.datos });
        setArchivos(informe.archivos || []);
        setGuardado(true);
      }
    } catch (e) { console.error("Error cargando el informe final:", e); }
    setCargando(false);
  }

  // Carga inicial al abrir el informe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadInforme(); }, []);

  async function handleSave() {
    setGuardando(true);
    try {
      const archivosGuardados = [];
      for (const f of archivos) {
        if (f.path) {
          archivosGuardados.push({ name: f.name, type: f.type, size: f.size, url: f.url, path: f.path });
        } else if (f.b64) {
          try {
            const blob = b64ToBlob(f.b64, f.type);
            const file = new File([blob], f.name, { type: f.type });
            const uploaded = await uploadFileInforme(file, obra.id);
            archivosGuardados.push(uploaded);
          } catch {
            archivosGuardados.push({ name: f.name, type: f.type, size: f.size, b64: f.b64 });
          }
        }
      }
      await upsertInformeFinal(obra.id, form, archivosGuardados, informeId);
      const saved = await getInformeFinal(obra.id);
      if (saved) { setInformeId(saved.id); setArchivos(saved.archivos || archivosGuardados); }
      setGuardado(true);
      if (onSave) onSave();
    } catch (e) { avisar("Error al guardar el informe: " + e.message, { tipo: "error" }); }
    setGuardando(false);
  }

  async function handleFiles(files) {
    const nuevos = [];
    for (const file of Array.from(files)) {
      if (archivos.find(f => f.name === file.name)) continue;
      const b64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      nuevos.push({ name: file.name, type: file.type, size: file.size, b64 });
    }
    setArchivos(a => [...a, ...nuevos]);
    setGuardado(false);
  }

  function removeFile(name) { setArchivos(a => a.filter(f => f.name !== name)); setGuardado(false); }

  function getFileIcon(type) {
    if (!type) return "📎";
    if (type.startsWith("image/")) return "🖼️";
    if (type.startsWith("video/")) return "🎥";
    if (type.includes("pdf")) return "📄";
    return "📎";
  }

  function formatFileSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  async function exportPDF() {
    const archivosConSrc = await Promise.all(archivos.map(async f => {
      if (f.b64) return f;
      if (f.url && f.type?.startsWith("image/")) {
        const b64 = await imgToBase64(f.url);
        return { ...f, b64 };
      }
      return f;
    }));

    const fotosHTML = archivosConSrc.filter(f => f.type?.startsWith("image/") && f.b64).map(f =>
      `<div class="prev-img"><img src="${f.b64}" alt="${f.name}"><div class="caption">${f.name}</div></div>`
    ).join("");
    const otrosHTML = archivosConSrc.filter(f => !f.type?.startsWith("image/")).map(f =>
      `<div class="prev-file"><span style="font-size:28px">${getFileIcon(f.type)}</span><div><b>${f.name}</b><br><span style="font-size:12px;color:#666">${formatFileSize(f.size)}</span></div></div>`
    ).join("");

    const campo = (label, val) => val ? `<div class="campo"><div class="lbl">${label}</div><div class="val">${val}</div></div>` : "";
    const seccion = (titulo, contenido) => `<div class="section"><h2 class="sec-t">${titulo}</h2>${contenido}</div>`;

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Informe Final – ${form.nombreObra}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{--orange:#ff6b35;--blue:#004e89;--dark:#1a1a1a;--bg:#fafafa;--border:#e0e0e0;--text:#2a2a2a;--muted:#666}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Archivo',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;padding:20px}
.container{max-width:1100px;margin:0 auto;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.08);border-radius:2px;overflow:hidden}
.header{background:linear-gradient(135deg,#1a1a1a,#2d2d2d);color:#fff;padding:56px 44px 40px;position:relative;overflow:hidden}
.header::before{content:'';position:absolute;top:0;right:0;width:380px;height:380px;background:radial-gradient(circle,rgba(255,107,53,.15),transparent 70%);border-radius:50%}
.header h1{font-size:40px;font-weight:700;letter-spacing:-1px;margin-bottom:8px;position:relative;z-index:1}
.header .sub{font-size:15px;opacity:.75;position:relative;z-index:1}
.body{padding:48px 44px}
.section{margin-bottom:44px;page-break-inside:avoid}
.sec-t{font-size:21px;font-weight:700;color:var(--dark);margin-bottom:22px;padding-bottom:10px;border-bottom:3px solid var(--orange);display:inline-block;letter-spacing:-.5px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-bottom:20px}
.campo{display:flex;flex-direction:column;margin-bottom:12px}
.lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:6px}
.val{font-size:14px;color:var(--text);padding-bottom:10px;border-bottom:1px solid var(--border);white-space:pre-line}
.prev-img{margin-bottom:28px;page-break-inside:avoid}.prev-img img{max-width:100%;height:auto;border:1px solid var(--border);display:block}
.caption{font-size:12px;color:var(--muted);margin-top:6px;font-style:italic}
.prev-file{display:flex;align-items:center;gap:12px;padding:14px;background:var(--bg);border:2px solid var(--border);margin-bottom:10px}
.footer{margin-top:48px;padding-top:24px;border-top:2px solid var(--border);text-align:center;font-size:12px;color:var(--muted)}
@media print{body{background:#fff;padding:0}.container{box-shadow:none;max-width:100%}.section{page-break-inside:avoid}.prev-img{page-break-inside:avoid;margin-bottom:36px}.prev-img img{max-width:100%;max-height:860px}}
</style></head><body>
<div class="container">
<div class="header">
  <h1>Informe Final de Obra</h1>
  <p class="sub">Documentación completa del proyecto</p>
</div>
<div class="body">
  ${seccion("Información General", `<div class="grid">
    ${campo("Nombre de la Obra", form.nombreObra)}
    ${campo("Cliente", form.cliente)}
    ${campo("Dirección", form.direccion)}
    ${campo("Fecha del Informe", form.fecha ? formatDate(form.fecha) : "")}
    ${campo("Etapa de la Obra", form.etapa)}
    ${campo("Estudio / Arquitecto a Cargo", form.estudioArquitecto)}
  </div>`)}
  ${seccion("Personal Responsable", `<div class="grid">
    ${campo("Responsable de Obra (Estudio/Arquitecto)", form.responsableEstudio)}
    ${campo("Responsable de Obra (Nuestra Empresa)", form.responsableEmpresa)}
  </div>${campo("Operarios Asignados", form.operarios)}`)}
  ${form.informe ? seccion("Informe y Aclaraciones", campo("Detalles del Trabajo Realizado", form.informe)) : ""}
  ${archivos.length > 0 ? seccion(`Archivos Adjuntos (${archivos.length})`, fotosHTML + otrosHTML) : ""}
  ${form.faltantes ? seccion("Pendientes a Resolver", campo("Descripción de Pendientes", form.faltantes)) : ""}
  ${form.informacionDestacada ? seccion("Información a Destacar", campo("Información Relevante", form.informacionDestacada)) : ""}
  <div class="footer">
    <p>Obras Grupo Aixa S.A. — Informe Final de Obra</p>
    <p style="margin-top:5px">Generado: ${new Date().toLocaleDateString("es-AR", { day:"2-digit", month:"long", year:"numeric" })}</p>
  </div>
</div></div></body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 900); }
  }

  const inp = { width:"100%", padding:"13px 15px", background:"#fafafa", border:"2px solid #e0e0e0", borderRadius:2, color:"#2a2a2a", fontFamily:"'Inter',sans-serif", fontSize:14, outline:"none", boxSizing:"border-box", transition:"border-color .2s" };
  const ta = { ...inp, minHeight:130, resize:"vertical" };
  const lbl = { display:"block", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, color:"#666", marginBottom:8 };
  const secT = { fontFamily:"'Sora',sans-serif", fontSize:20, fontWeight:700, color:"#1a1a1a", marginBottom:22, paddingBottom:10, borderBottom:"3px solid #ff6b35", display:"inline-block" };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.75)", backdropFilter:"blur(4px)", zIndex:700, overflowY:"auto", padding:"20px 16px", display:"flex", justifyContent:"center", alignItems:"flex-start" }}>
      <div style={{ background:"#fafafa", borderRadius:4, width:"100%", maxWidth:920, boxShadow:"0 24px 60px rgba(0,0,0,.25)" }}>

        {/* HEADER */}
        <div style={{ background:"linear-gradient(135deg,#1a1a1a,#2d2d2d)", color:"#fff", padding:"48px 44px 36px", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, right:0, width:380, height:380, background:"radial-gradient(circle,rgba(255,107,53,.15),transparent 70%)", borderRadius:"50%" }} />
          <div style={{ position:"relative", zIndex:1, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <h1 style={{ fontFamily:"'Sora',sans-serif", fontSize:36, fontWeight:800, letterSpacing:-1, marginBottom:8 }}>Informe Final de Obra</h1>
              <p style={{ fontSize:14, opacity:.75 }}>
                {cargando ? "Cargando informe guardado..." : informeId ? "💾 Informe guardado en el sistema" : "Nuevo informe — aún no guardado"}
              </p>
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)", borderRadius:8, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#fff", fontSize:16, flexShrink:0 }}>✕</button>
          </div>
        </div>

        {cargando ? (
          <div style={{ padding:"80px 44px", textAlign:"center", color:"#94A3B8", fontSize:14 }}>Cargando informe guardado...</div>
        ) : (
        /* FORM */
        <div style={{ padding:"44px", background:"#fff" }}>

          {/* 1. Info General */}
          <div style={{ marginBottom:44 }}>
            <div style={secT}>Información General</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:18, marginTop:16 }}>
              {[
                { label:"Nombre de la Obra", key:"nombreObra", ph:"Ej: Remodelación Cocina" },
                { label:"Cliente", key:"cliente", ph:"Nombre del cliente" },
                { label:"Dirección", key:"direccion", ph:"Dirección completa" },
                { label:"Etapa de la Obra", key:"etapa", ph:"Ej: Estructura, Terminaciones, Final..." },
                { label:"Estudio / Arquitecto a Cargo", key:"estudioArquitecto", ph:"Nombre del estudio" },
              ].map(f => (
                <div key={f.key}>
                  <label style={lbl}>{f.label}</label>
                  <input style={inp} value={form[f.key]} onChange={e => { setForm(x => ({...x, [f.key]:e.target.value})); setGuardado(false); }} placeholder={f.ph}
                    onFocus={e => e.target.style.borderColor="#004e89"} onBlur={e => e.target.style.borderColor="#e0e0e0"} />
                </div>
              ))}
              <div>
                <label style={lbl}>Fecha del Informe</label>
                <input type="date" style={inp} value={form.fecha} onChange={e => { setForm(x => ({...x, fecha:e.target.value})); setGuardado(false); }} />
              </div>
            </div>
          </div>

          {/* 2. Personal */}
          <div style={{ marginBottom:44 }}>
            <div style={secT}>Personal Responsable</div>
            <div className="grid-form" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18, marginTop:16, marginBottom:18 }}>
              <div>
                <label style={lbl}>Responsable de Obra (Estudio/Arquitecto)</label>
                <input style={inp} value={form.responsableEstudio} onChange={e => { setForm(x => ({...x, responsableEstudio:e.target.value})); setGuardado(false); }} placeholder="Nombre completo"
                  onFocus={e => e.target.style.borderColor="#004e89"} onBlur={e => e.target.style.borderColor="#e0e0e0"} />
              </div>
              <div>
                <label style={lbl}>Responsable de Obra (Nuestra Empresa)</label>
                <input style={inp} value={form.responsableEmpresa} onChange={e => { setForm(x => ({...x, responsableEmpresa:e.target.value})); setGuardado(false); }} placeholder="Nombre completo"
                  onFocus={e => e.target.style.borderColor="#004e89"} onBlur={e => e.target.style.borderColor="#e0e0e0"} />
              </div>
            </div>
            <label style={lbl}>Operarios Asignados</label>
            <textarea style={{ ...ta, minHeight:90 }} value={form.operarios} onChange={e => { setForm(x => ({...x, operarios:e.target.value})); setGuardado(false); }} placeholder="Lista de operarios (uno por línea o separados por comas)"
              onFocus={e => e.target.style.borderColor="#004e89"} onBlur={e => e.target.style.borderColor="#e0e0e0"} />
          </div>

          {/* 3. Informe */}
          <div style={{ marginBottom:44 }}>
            <div style={secT}>Informe y Aclaraciones</div>
            <label style={{ ...lbl, marginTop:16 }}>Detalles del Trabajo Realizado</label>
            <textarea style={ta} value={form.informe} onChange={e => { setForm(x => ({...x, informe:e.target.value})); setGuardado(false); }} placeholder="Describa en detalle los trabajos realizados, observaciones y cualquier información relevante del avance de la obra..."
              onFocus={e => e.target.style.borderColor="#004e89"} onBlur={e => e.target.style.borderColor="#e0e0e0"} />
          </div>

          {/* 4. Archivos */}
          <div style={{ marginBottom:44 }}>
            <div style={secT}>Archivos Adjuntos</div>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
              style={{ marginTop:16, border:`3px dashed ${dragging ? "#ff6b35" : "#e0e0e0"}`, borderRadius:2, padding:"36px 20px", textAlign:"center", cursor:"pointer", background: dragging ? "rgba(255,107,53,.04)" : "#fafafa", transition:"all .2s" }}>
              <div style={{ fontSize:42, marginBottom:12, color:"#bbb" }}>📎</div>
              <div style={{ fontSize:14, color:"#666", marginBottom:5 }}>Arrastrá archivos aquí o hacé clic para seleccionar</div>
              <div style={{ fontSize:12, color:"#aaa" }}>Fotos, planos, documentos PDF, etc.</div>
              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" style={{ display:"none" }} onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value=""; }} />
            </div>
            {archivos.length > 0 && (
              <div style={{ marginTop:14 }}>
                {archivos.map((f, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", background:"#fafafa", borderRadius:2, marginBottom:7, border:"1px solid #e0e0e0" }}>
                    <span style={{ fontSize:22 }}>{getFileIcon(f.type)}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"#2a2a2a" }}>{f.name}</div>
                      <div style={{ fontSize:11, color:"#999" }}>{formatFileSize(f.size)}{f.path ? " · guardado" : ""}</div>
                    </div>
                    {f.type?.startsWith("image/") && <img src={f.b64 || f.url} alt={f.name} style={{ width:48, height:48, objectFit:"cover", borderRadius:3, border:"1px solid #e0e0e0" }} />}
                    <button onClick={() => removeFile(f.name)} style={{ background:"none", border:"none", color:"#bbb", cursor:"pointer", fontSize:20, padding:"2px 6px" }}
                      onMouseEnter={e => e.currentTarget.style.color="#e74c3c"} onMouseLeave={e => e.currentTarget.style.color="#bbb"}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Pendientes */}
          <div style={{ marginBottom:44 }}>
            <div style={secT}>Pendientes a Resolver</div>
            <label style={{ ...lbl, marginTop:16 }}>Descripción de Pendientes</label>
            <textarea style={ta} value={form.faltantes} onChange={e => { setForm(x => ({...x, faltantes:e.target.value})); setGuardado(false); }} placeholder="Liste los trabajos pendientes, materiales faltantes, detalles a resolver, etc."
              onFocus={e => e.target.style.borderColor="#004e89"} onBlur={e => e.target.style.borderColor="#e0e0e0"} />
          </div>

          {/* 6. Info destacada */}
          <div style={{ marginBottom:44 }}>
            <div style={secT}>Información a Destacar</div>
            <label style={{ ...lbl, marginTop:16 }}>Información Relevante</label>
            <textarea style={ta} value={form.informacionDestacada} onChange={e => { setForm(x => ({...x, informacionDestacada:e.target.value})); setGuardado(false); }} placeholder="Información importante, observaciones especiales, aspectos críticos del proyecto, etc."
              onFocus={e => e.target.style.borderColor="#004e89"} onBlur={e => e.target.style.borderColor="#e0e0e0"} />
          </div>

          {/* BOTONES */}
          <div style={{ display:"flex", gap:16, justifyContent:"space-between", alignItems:"center", paddingTop:32, borderTop:"2px solid #e0e0e0" }}>
            <div style={{ fontSize:13, color: guardado ? "#059669" : "#94A3B8", fontWeight:600 }}>
              {guardado ? "✓ Guardado en el sistema" : "Sin cambios guardados"}
            </div>
            <div style={{ display:"flex", gap:12 }}>
              <button onClick={onClose} style={{ padding:"14px 24px", border:"2px solid #e0e0e0", borderRadius:2, background:"#fafafa", color:"#666", fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:600, cursor:"pointer", textTransform:"uppercase", letterSpacing:.5 }}>Cerrar</button>
              <button onClick={handleSave} disabled={guardando}
                style={{ padding:"14px 28px", border:"none", borderRadius:2, background: guardando ? "#94A3B8" : "#059669", color:"#fff", fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:700, cursor: guardando ? "not-allowed" : "pointer", textTransform:"uppercase", letterSpacing:.5, boxShadow:"0 4px 12px rgba(5,150,105,.3)" }}
                onMouseEnter={e => { if (!guardando) e.currentTarget.style.background="#047857"; }} onMouseLeave={e => { if (!guardando) e.currentTarget.style.background="#059669"; }}>
                {guardando ? "Guardando..." : "💾 Guardar"}
              </button>
              <button onClick={exportPDF}
                style={{ padding:"14px 28px", border:"none", borderRadius:2, background:"#004e89", color:"#fff", fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:700, cursor:"pointer", textTransform:"uppercase", letterSpacing:.5, boxShadow:"0 4px 12px rgba(0,78,137,.3)" }}
                onMouseEnter={e => e.currentTarget.style.background="#003d6d"} onMouseLeave={e => e.currentTarget.style.background="#004e89"}>
                📄 Exportar PDF
              </button>
              {/* Se manda lo guardado: con cambios sin guardar, primero hay que guardar */}
              <EnviarPorMail deshabilitado={!guardado || !informeId} motivo="Guardá el informe antes de enviarlo"
                estiloBoton={{ padding:"14px 24px", border:"none", borderRadius:2, background:"#0F766E", color:"#fff", fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, boxShadow:"0 4px 12px rgba(15,118,110,.3)" }}
                enviar={para => apiFetch("/api/enviar-informe-final", { method: "POST", body: JSON.stringify({ obraAvanceId: obra.id, para }) })} />
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// OBRAS ACEPTADAS MODULE
// ═══════════════════════════════════════════════════════════════════════════════
function getFileIconAceptada(type) {
  if (!type) return "📎";
  if (type.startsWith("image/")) return "🖼️";
  if (type.includes("pdf")) return "📄";
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return "📊";
  return "📎";
}
function formatFileSizeAceptada(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}
const IMG_RE_ACEPTADA = /\.(jpe?g|png|gif|webp|bmp)$/i;
function esImagenAceptada(f) { return (f.type || "").startsWith("image/") || IMG_RE_ACEPTADA.test(f.name || ""); }

function ObrasAceptadasModule({ sesion, proyectos = [], recargarObras }) {
  const [obrasTodas, setObras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [search, setSearch] = useState("");
  const [mesFilter, setMesFilter] = useState("");
  const [modalObra, setModalObra] = useState(null);
  const [pasando, setPasando] = useState(null);

  const isAdmin = sesion.rol === "admin";
  const canEdit = isAdmin || sesion.rol === "operario" || sesion.rol === "arquitecto";
  const canDelete = isAdmin || sesion.rol === "operario";
  // Las vinculadas a una obra archivada no se muestran
  const proyectosArchivados = new Set(proyectos.filter(p => p.archivada).map(p => p.id));
  const obras = obrasTodas.filter(o => !proyectosArchivados.has(o.proyecto_id));
  const proyectosActivos = proyectos.filter(p => !p.archivada).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const obraEnEntregas = o => proyectos.find(p => p.id === o.proyecto_id);

  // Crea la obra en Entregas (con una primera entrega) y la deja vinculada
  async function pasarAEntregas(o) {
    if (!await confirmar(`¿Crear "${o.nombre}" como obra nueva en Entregas?\n\nSe crea con una primera entrega${o.fecha_entrega_aprox ? ` para el ${formatDate(o.fecha_entrega_aprox)}` : ""} y queda vinculada a esta obra aceptada. Los muebles se completan después en Entregas.`, { boton: "Crear obra", peligro: false })) return;
    setPasando(o.id);
    try {
      const { proyecto } = await crearObraConEntrega({
        nombre: o.nombre, lugar: o.direccion || "", sesion,
        entrega: { fecha: o.fecha_entrega_aprox, notas: o.descripcion || "", estado: "pendiente", muebles: [] },
      });
      await updateObraAceptada(o.id, { proyecto_id: proyecto.id, updated_at: new Date().toISOString() });
      await Promise.all([loadObras(), recargarObras()]);
    } catch (e) { avisar(`No se pudo crear la obra en Entregas: ${e.message}`, { tipo: "error" }); }
    setPasando(null);
  }

  async function loadObras() {
    setCargando(true);
    try { const obs = await getObrasAceptadas(); setObras(obs || []); } catch (e) { console.error("Error cargando obras aceptadas:", e); }
    setCargando(false);
  }

  // Carga inicial al abrir el módulo
  useEffect(() => { loadObras(); }, []);

  async function deleteObra(obra) {
    if (!await confirmar(`¿Eliminar la obra "${obra.nombre}" y todos sus archivos?`)) return;
    try {
      for (const f of (obra.archivos || [])) { try { await deleteFileAvance(f.path); } catch { /* si el archivo ya no existe se sigue igual */ } }
      await deleteObraAceptadaById(obra.id);
      setModalObra(null);
      await loadObras();
    } catch { avisar("Error al eliminar la obra.", { tipo: "error" }); }
  }

  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const esteMes = obras.filter(o => (o.fecha_aceptacion || "").startsWith(mesActual) || (o.fecha_entrega_aprox || "").startsWith(mesActual)).length;
  const conArchivos = obras.filter(o => (o.archivos || []).length > 0).length;

  const obrasFiltradas = obras.filter(o => {
    if (search) {
      const q = search.toLowerCase();
      if (!o.nombre.toLowerCase().includes(q) && !(o.direccion || "").toLowerCase().includes(q) && !(o.cliente || "").toLowerCase().includes(q)) return false;
    }
    if (mesFilter) {
      if (!(o.fecha_aceptacion || "").startsWith(mesFilter) && !(o.fecha_entrega_aprox || "").startsWith(mesFilter)) return false;
    }
    return true;
  });

  if (cargando) return <div style={{ textAlign:"center", padding:"60px 0", color:"#94A3B8", fontSize:13 }}>Cargando obras aceptadas...</div>;

  return (
    <div>
      {/* STATS */}
      <div className="grid-numeros" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:32 }}>
        {[
          { num: obras.length, label:"Total obras aceptadas", color:"#2563EB", border:"#DBEAFE" },
          { num: esteMes, label:"Este mes", color:"#D97706", border:"#FDE68A" },
          { num: conArchivos, label:"Con archivos adjuntos", color:"#059669", border:"#A7F3D0" },
        ].map((s, i) => (
          <div key={i} style={{ background:"#ffffff", border:`1px solid ${s.border}`, borderRadius:12, padding:"20px 20px 18px", animation:`fadeUp 0.35s ease ${i*0.06}s both` }}>
            <div style={{ fontFamily:"'Sora', sans-serif", fontSize:32, fontWeight:800, color:s.color, lineHeight:1 }}>{s.num}</div>
            <div style={{ fontSize:12, color:"#64748B", fontWeight:500, marginTop:6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* TITLE + FILTERS */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:12 }}>
        <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>Obras Aceptadas</h2>
        {canEdit && (
          <button onClick={() => setModalObra("nueva")}
            style={{ padding:"8px 18px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            + Nueva obra
          </button>
        )}
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative", flex:"1 1 200px", maxWidth:320 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar obra, dirección, cliente..."
            style={{ width:"100%", padding:"9px 12px 9px 36px", background:"#ffffff", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" }} />
          {search && <button onClick={() => setSearch("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#94A3B8", cursor:"pointer", fontSize:14, padding:2 }}>✕</button>}
        </div>
        <input type="month" value={mesFilter} onChange={e => setMesFilter(e.target.value)}
          style={{ padding:"9px 12px", background:"#ffffff", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" }} />
        {mesFilter && <button onClick={() => setMesFilter("")} style={{ padding:"6px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#64748B", fontSize:12, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Limpiar mes</button>}
        {(search || mesFilter) && <span style={{ fontSize:12, color:"#94A3B8" }}>{obrasFiltradas.length} resultado{obrasFiltradas.length !== 1 ? "s" : ""}</span>}
      </div>

      {/* GRID */}
      {obrasFiltradas.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🗂️</div>
          <div style={{ fontSize:13, color:"#94A3B8" }}>{obras.length === 0 ? "No hay obras aceptadas registradas aún" : "No hay obras en esta búsqueda/filtro"}</div>
        </div>
      ) : (
        <div className="grid-tarjetas" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:16 }}>
          {obrasFiltradas.map((o, idx) => (
            <div key={o.id} className="obra-card" onClick={() => setModalObra(o)}
              style={{ background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:14, overflow:"hidden", cursor:"pointer", animation:`fadeUp 0.35s ease ${idx*0.04}s both`, boxShadow:"0 1px 4px rgba(26,43,74,0.05)" }}>
              <div style={{ height:4, background:"#2563EB" }} />
              {(() => { const img = (o.archivos || []).find(esImagenAceptada); return img?.url ? (
                <img src={img.url} alt="" loading="lazy" style={{ width:"100%", height:140, objectFit:"cover", display:"block" }} />
              ) : null; })()}
              <div style={{ padding:"18px 18px 16px" }}>
                <div style={{ fontFamily:"'Sora', sans-serif", fontSize:15, fontWeight:700, color:"#1A2B4A", marginBottom:6, lineHeight:1.35 }}>{o.nombre}</div>
                {o.cliente && <div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}>👤 {o.cliente}</div>}
                {o.direccion && <div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}>📍 {o.direccion}</div>}
                <div style={{ fontSize:12, color:"#64748B", marginBottom:12, display:"flex", gap:12, flexWrap:"wrap" }}>
                  {o.fecha_aceptacion && <span>✅ Aceptada: {formatDate(o.fecha_aceptacion)}</span>}
                  {o.fecha_entrega_aprox && <span>📅 Entrega aprox: {formatDate(o.fecha_entrega_aprox)}</span>}
                </div>
                {o.descripcion && (
                  <div style={{ fontSize:12, color:"#475569", marginBottom:12, lineHeight:1.45, whiteSpace:"pre-line", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{o.descripcion}</div>
                )}
                {(() => {
                  const imgs = (o.archivos || []).filter(esImagenAceptada).length;
                  const docs = (o.archivos || []).length - imgs;
                  if (!imgs && !docs) return null;
                  const chip = { fontSize:11, color:"#2563EB", background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:6, padding:"3px 9px" };
                  return (
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                      {docs > 0 && <span style={chip}>📎 {docs} archivo{docs !== 1 ? "s" : ""}</span>}
                      {imgs > 0 && <span style={chip}>🖼️ {imgs} imagen{imgs !== 1 ? "es" : ""}</span>}
                    </div>
                  );
                })()}
                {obraEnEntregas(o) && (
                  <div style={{ fontSize:11, color:"#059669", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:6, padding:"4px 9px", marginBottom:12, display:"inline-block" }}>📦 En Entregas: {obraEnEntregas(o).nombre}</div>
                )}
                <div onClick={e => e.stopPropagation()} style={{ display:"flex", gap:6, paddingTop:12, borderTop:"1px solid #F1F5F9" }}>
                  <button onClick={() => setModalObra(o)} style={{ flex:1, padding:"7px 0", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>{canEdit ? "Editar" : "Ver"}</button>
                  {canEdit && !obraEnEntregas(o) && (
                    <button onClick={() => pasarAEntregas(o)} disabled={pasando === o.id} title="Crear esta obra en la pestaña Entregas"
                      style={{ flex:1, padding:"7px 0", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8, color:"#2563EB", fontSize:12, fontWeight:600, cursor: pasando === o.id ? "not-allowed" : "pointer", fontFamily:"'Inter', sans-serif" }}>
                      {pasando === o.id ? "Creando..." : "📦 Pasar a Entregas"}
                    </button>
                  )}
                  {canDelete && <button onClick={() => deleteObra(o)} style={{ padding:"7px 10px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:12, cursor:"pointer" }}>✕</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalObra && (
        <ModalObraAceptada
          obra={modalObra === "nueva" ? null : modalObra}
          proyectos={proyectosActivos}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => setModalObra(null)}
          onSave={loadObras}
          onDelete={deleteObra}
        />
      )}
    </div>
  );
}

function ModalObraAceptada({ obra, proyectos = [], canEdit, canDelete, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    nombre: obra?.nombre || "", direccion: obra?.direccion || "", cliente: obra?.cliente || "",
    fecha_aceptacion: obra?.fecha_aceptacion || "", fecha_entrega_aprox: obra?.fecha_entrega_aprox || "",
    descripcion: obra?.descripcion || "", proyecto_id: obra?.proyecto_id || "",
  });
  const [archivos, setArchivos] = useState(obra?.archivos || []);
  const [visor, setVisor] = useState(null); // { fotos, inicio }
  const [dragging, setDragging] = useState(false);
  const [draggingImg, setDraggingImg] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const imgInputRef = useRef(null);
  const originalArchivos = useRef(obra?.archivos || []);

  const inp = { width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box" };
  const lbl = { display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 };

  async function handleFiles(files, kind = "docs") {
    const nuevos = [];
    for (const file of Array.from(files)) {
      if (archivos.find(f => f.name === file.name)) continue;
      const okType = kind === "img" ? IMG_RE_ACEPTADA.test(file.name) : /\.(pdf|xls|xlsx|csv)$/i.test(file.name);
      if (!okType) { avisar(kind === "img" ? `"${file.name}" no es una imagen válida (JPG, PNG, WEBP, GIF).` : `"${file.name}" no es un PDF o Excel válido.`, { tipo: "aviso" }); continue; }
      const b64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      nuevos.push({ name: file.name, type: file.type, size: file.size, b64 });
    }
    setArchivos(a => [...a, ...nuevos]);
  }

  function removeFile(name) { setArchivos(a => a.filter(f => f.name !== name)); }

  async function handleSave() {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "Requerido";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    try {
      let obraId = obra?.id;
      const baseData = {
        nombre: form.nombre.trim(), direccion: form.direccion.trim(), cliente: form.cliente.trim(),
        fecha_aceptacion: form.fecha_aceptacion || null, fecha_entrega_aprox: form.fecha_entrega_aprox || null,
        descripcion: form.descripcion.trim(), proyecto_id: form.proyecto_id || null,
      };
      if (!obraId) {
        const inserted = await insertObraAceptada({ ...baseData, archivos: [] });
        obraId = inserted?.[0]?.id;
      } else {
        await updateObraAceptada(obraId, { ...baseData, updated_at: new Date().toISOString() });
      }
      for (const orig of originalArchivos.current) {
        if (orig.path && !archivos.find(a => a.path === orig.path)) { try { await deleteFileAvance(orig.path); } catch { /* si el archivo ya no existe se sigue igual */ } }
      }
      const archivosFinal = [];
      for (const f of archivos) {
        if (f.path) { archivosFinal.push({ name: f.name, type: f.type, size: f.size, url: f.url, path: f.path }); }
        else if (f.b64) {
          try {
            const blob = b64ToBlob(f.b64, f.type);
            const file = new File([blob], f.name, { type: f.type });
            const uploaded = await uploadFileObraAceptada(file, obraId);
            archivosFinal.push(uploaded);
          } catch (err) { avisar(`Error al subir ${f.name}: ${err.message}`, { tipo: "error" }); }
        }
      }
      await updateObraAceptada(obraId, { archivos: archivosFinal, updated_at: new Date().toISOString() });
      await onSave();
      onClose();
    } catch (e) { avisar("Error al guardar: " + e.message, { tipo: "error" }); }
    setSaving(false);
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:580, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"#ffffff", borderRadius:"14px 14px 0 0", zIndex:1 }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{obra ? (canEdit ? "Editar obra aceptada" : "Obra aceptada") : "Nueva obra aceptada"}</h2>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"24px" }}>
          <fieldset disabled={!canEdit} style={{ border:"none", padding:0, margin:0 }}>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Nombre de la obra *</label>
              <input style={{ ...inp, borderColor: errors.nombre ? "#FCA5A5" : "#E2E8F0" }} value={form.nombre}
                onChange={e => { setForm(f => ({...f, nombre:e.target.value})); setErrors(er => ({...er, nombre:""})); }}
                placeholder="Ej: Remodelación Cocina" autoFocus />
              {errors.nombre && <div style={{ color:"#DC2626", fontSize:11, marginTop:4 }}>{errors.nombre}</div>}
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Dirección de la obra</label>
              <input style={inp} value={form.direccion} onChange={e => setForm(f => ({...f, direccion:e.target.value}))} placeholder="Calle, número, barrio..." />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Nombre del cliente</label>
              <input style={inp} value={form.cliente} onChange={e => setForm(f => ({...f, cliente:e.target.value}))} placeholder="Nombre del cliente" />
            </div>
            <div className="grid-form" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
              <div>
                <label style={lbl}>Fecha de aceptación</label>
                <input type="date" style={inp} value={form.fecha_aceptacion} onChange={e => setForm(f => ({...f, fecha_aceptacion:e.target.value}))} />
              </div>
              <div>
                <label style={lbl}>Fecha aprox. de entrega</label>
                <input type="date" style={inp} value={form.fecha_entrega_aprox} onChange={e => setForm(f => ({...f, fecha_entrega_aprox:e.target.value}))} />
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Descripción</label>
              <textarea style={{ ...inp, minHeight:110, resize:"vertical", lineHeight:1.5 }} value={form.descripcion}
                onChange={e => setForm(f => ({...f, descripcion:e.target.value}))}
                placeholder={"Qué hay que hacer, materiales necesarios, items a fabricar y entregar...\nEj:\n- 2 bajo mesadas melamina blanca 18mm\n- 1 placard 3 puertas"} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Obra en Entregas</label>
              <select style={inp} value={form.proyecto_id} onChange={e => setForm(f => ({...f, proyecto_id:e.target.value}))}>
                <option value="">— Todavía no está en Entregas —</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.lugar ? ` — ${p.lugar}` : ""}</option>)}
              </select>
              <div style={{ fontSize:11, color:"#94A3B8", marginTop:4 }}>Si la obra ya existe en Entregas, elegila para que quede vinculada (si se archiva allá, se archiva acá).</div>
            </div>
          </fieldset>

          {/* IMÁGENES */}
          <div style={{ marginBottom:20 }}>
            <label style={lbl}>Imágenes (JPG / PNG / WEBP / GIF)</label>
            {canEdit && (
              <div
                onClick={() => imgInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDraggingImg(true); }}
                onDragLeave={() => setDraggingImg(false)}
                onDrop={e => { e.preventDefault(); setDraggingImg(false); handleFiles(e.dataTransfer.files, "img"); }}
                style={{ border:`2px dashed ${draggingImg ? "#2563EB" : "#CBD5E1"}`, borderRadius:10, padding:"22px 16px", textAlign:"center", cursor:"pointer", background: draggingImg ? "rgba(37,99,235,0.04)" : "#F8FAFC", marginBottom:10, transition:"all 0.15s" }}>
                <div style={{ fontSize:28, marginBottom:6, color:"#94A3B8" }}>🖼️</div>
                <div style={{ fontSize:13, color:"#64748B" }}>Arrastrá imágenes aquí o hacé clic para seleccionar</div>
                <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>JPG, PNG, WEBP, GIF</div>
                <input ref={imgInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,image/*"
                  style={{ display:"none" }} onChange={e => { if (e.target.files?.length) handleFiles(e.target.files, "img"); e.target.value=""; }} />
              </div>
            )}
            {archivos.filter(esImagenAceptada).length === 0 ? (
              <div style={{ color:"#94A3B8", fontSize:12, textAlign:"center", padding:"10px 0" }}>Sin imágenes</div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(110px, 1fr))", gap:8 }}>
                {archivos.filter(esImagenAceptada).map((f, fi, imgs) => (
                  <div key={f.name} style={{ position:"relative", borderRadius:8, overflow:"hidden", border:"1px solid #E2E8F0", aspectRatio:"1 / 1", background:"#F8FAFC" }}>
                    <img src={f.url || f.b64} alt={f.name} title="Ver en grande" onClick={() => setVisor({ fotos: imgs, inicio: fi })}
                      style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", cursor:"zoom-in" }} />
                    {!f.path && <div style={{ position:"absolute", left:0, right:0, bottom:0, background:"rgba(15,23,42,0.65)", color:"#fff", fontSize:10, padding:"2px 6px" }}>pendiente de subir</div>}
                    {canEdit && <button onClick={() => removeFile(f.name)} title="Quitar imagen"
                      style={{ position:"absolute", top:4, right:4, width:22, height:22, borderRadius:"50%", border:"none", background:"rgba(15,23,42,0.7)", color:"#fff", cursor:"pointer", fontSize:12, padding:0 }}>✕</button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ARCHIVOS */}
          <div style={{ marginBottom:20 }}>
            <label style={lbl}>Archivos (PDF / Excel)</label>
            {canEdit && (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
                style={{ border:`2px dashed ${dragging ? "#2563EB" : "#CBD5E1"}`, borderRadius:10, padding:"22px 16px", textAlign:"center", cursor:"pointer", background: dragging ? "rgba(37,99,235,0.04)" : "#F8FAFC", marginBottom:10, transition:"all 0.15s" }}>
                <div style={{ fontSize:28, marginBottom:6, color:"#94A3B8" }}>📎</div>
                <div style={{ fontSize:13, color:"#64748B" }}>Arrastrá archivos aquí o hacé clic para seleccionar</div>
                <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>Solo PDF y Excel (.xls, .xlsx, .csv)</div>
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.xls,.xlsx,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display:"none" }} onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value=""; }} />
              </div>
            )}
            {archivos.filter(f => !esImagenAceptada(f)).length === 0 ? (
              <div style={{ color:"#94A3B8", fontSize:12, textAlign:"center", padding:"10px 0" }}>Sin archivos adjuntos</div>
            ) : (
              <div style={{ border:"1px solid #E2E8F0", borderRadius:10, overflow:"hidden" }}>
                {archivos.filter(f => !esImagenAceptada(f)).map((f, i, docs) => (
                  <div key={f.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderBottom: i < docs.length-1 ? "1px solid #F1F5F9" : "none" }}>
                    <span style={{ fontSize:20 }}>{getFileIconAceptada(f.type)}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:"#1A2B4A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
                      <div style={{ fontSize:11, color:"#94A3B8" }}>{formatFileSizeAceptada(f.size)}{f.path ? " · guardado" : " · pendiente de subir"}</div>
                    </div>
                    {f.url && <>
                      <a href={f.url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#2563EB", textDecoration:"none", fontWeight:600, whiteSpace:"nowrap" }}>Ver</a>
                      <a href={f.url} download={f.name} style={{ fontSize:11, color:"#2563EB", textDecoration:"none", fontWeight:600, whiteSpace:"nowrap" }}>Descargar</a>
                    </>}
                    {canEdit && <button onClick={() => removeFile(f.name)} style={{ background:"none", border:"none", color:"#CBD5E1", cursor:"pointer", fontSize:16, padding:"0 2px" }}
                      onMouseEnter={e => e.currentTarget.style.color="#EF4444"} onMouseLeave={e => e.currentTarget.style.color="#CBD5E1"}>✕</button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display:"flex", gap:10 }}>
            {obra && canDelete && (
              <button onClick={() => onDelete(obra)} style={{ padding:"11px 16px", border:"1px solid #FECACA", borderRadius:8, background:"#FEF2F2", color:"#DC2626", cursor:"pointer", fontSize:13, fontWeight:500 }}>Eliminar</button>
            )}
            <button onClick={onClose} style={{ flex:1, padding:"11px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>{canEdit ? "Cancelar" : "Cerrar"}</button>
            {canEdit && (
              <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:"11px", border:"none", borderRadius:8, background: saving ? "#94A3B8" : "#1A2B4A", color:"#fff", cursor: saving ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            )}
          </div>
        </div>
      </div>
      {visor && <VisorFotos fotos={visor.fotos} inicio={visor.inicio} onCerrar={() => setVisor(null)} />}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  return <><Aplicacion /><Avisos /></>;
}

function Aplicacion() {
  const [sesion, setSesion] = useState(null);
  const [obras, setObras] = useState([]); // entregas (incluidas las archivadas)
  const [proyectos, setProyectos] = useState([]); // obras que agrupan entregas
  const [cargando, setCargando] = useState(true);
  const ruta = useRuta();
  const [showUsuarios, setShowUsuarios] = useState(false);
  const [showWA, setShowWA] = useState(false);

  async function recargarObras() {
    try {
      let [ob, pr] = await Promise.all([getObras(), getProyectos()]);
      ob = ob || []; pr = pr || [];
      // Entregas sin obra (por ejemplo, cargadas antes de este cambio): se les crea su obra
      const sueltas = ob.filter(o => !o.proyecto_id || !pr.some(p => p.id === o.proyecto_id));
      if (sueltas.length) {
        for (const o of sueltas) {
          const p = { id: uid(), nombre: o.nombre, lugar: o.lugar || "", creado_por: o.creado_por || null, creado_en: o.creado_en || new Date().toISOString(), archivada: !!o.archivada };
          await upsertProyecto(p);
          await patchEntregas(`id=eq.${o.id}`, { proyecto_id: p.id });
        }
        [ob, pr] = await Promise.all([getObras(), getProyectos()]);
      }
      setObras(ob || []); setProyectos(pr || []);
    } catch (e) { console.error("Error cargando obras:", e); }
  }

  useEffect(() => {
    (async () => {
      try {
        const s = await getSesion();
        if (s) { setSesion(s); await recargarObras(); }
      } catch (e) { console.error("Error iniciando la sesión:", e); }
      setCargando(false);
    })();
    // Si la sesión vence o se cierra en otra pestaña, volver al login
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => { if (evento === "SIGNED_OUT") setSesion(null); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const [matAlertCount, setMatAlertCount] = useState(0);
  // Recalcula el contador de alertas de materiales al entrar y al cambiar de pestaña
  useEffect(() => {
    if (!sesion || sesion.rol === "arquitecto" || sesion.rol === "finanzas") return;
    const { activas, archivadas } = vinculoEntregas(obras);
    getMateriales().then(ls => setMatAlertCount(alertasMateriales((ls || []).filter(l => !archivadas.has(l.obra_id)), activas).length)).catch(() => {});
  }, [sesion, obras, ruta]);

  function handleLogin(u) { setSesion(u); recargarObras(); }
  async function handleLogout() { await cerrarSesion(); setSesion(null); setObras([]); setProyectos([]); }
  const entregasActivas = obras.filter(o => !o.archivada);

  const isAdmin = sesion?.rol === "admin";
  const isFinanzas = sesion?.rol === "finanzas";
  const isArquitecto = sesion?.rol === "arquitecto";
  const canSeeCobros = isAdmin || isFinanzas;
  const canSeeAvanceProduccion = !isArquitecto && !isFinanzas;
  const canSeeAvanceObra = !isFinanzas;
  const canSeeMateriales = !isArquitecto && !isFinanzas;
  const canSeeHistorial = sesion?.email?.toLowerCase() === EMAIL_HISTORIAL;

  // La pestaña sale de la dirección; si el rol no la puede ver (o la dirección es "/"), va a su pantalla de inicio
  const puedeVer = { entregas: true, aceptadas: true, avance: canSeeAvanceProduccion, avance_obra: canSeeAvanceObra, cobros: canSeeCobros, materiales: canSeeMateriales, historial: canSeeHistorial };
  const activeTab = ruta.pestana && puedeVer[ruta.pestana] ? ruta.pestana : isFinanzas ? "cobros" : "entregas";
  const setActiveTab = t => navegar(`/${RUTAS_PESTANAS[t]}`);
  useEffect(() => {
    if (!sesion) return;
    if (!ruta.fichaId && ruta.pestana !== activeTab) navegar(`/${RUTAS_PESTANAS[activeTab]}`, { reemplazar: true });
    if (!ruta.fichaId) document.title = activeTab === "entregas" ? "MaderoGest" : `${{ aceptadas: "Obras Aceptadas", avance: "Producción", avance_obra: "Avance de Obra", cobros: "Cobros", materiales: "Materiales", historial: "Historial" }[activeTab]} · MaderoGest`;
  }, [sesion, ruta, activeTab]);
  const activas = entregasActivas.filter(o => o.estado !== "terminado");
  const urgentes = activas.filter(o => { const d = diasRestantes(o.fecha); return d >= 0 && d <= 7; });
  const proximas = activas.filter(o => { const d = diasRestantes(o.fecha); return d > 7 && d <= 21; });
  const alertCount = urgentes.length + proximas.length;

  if (cargando) return (
    <div style={{ minHeight:"100vh", background:"#F4F6F9", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
      <img src={LOGO_AIXA} alt="Aixa" style={{ height:56, borderRadius:6, opacity:0.7 }} />
      <div style={{ fontFamily:"'Inter', sans-serif", color:"#94A3B8", fontSize:13 }}>Cargando...</div>
    </div>
  );
  if (!sesion) return <Login onLogin={handleLogin} />;

  return (
    <div style={{ minHeight:"100vh", background:"#F4F6F9", fontFamily:"'Inter', sans-serif", color:"#1A2B4A" }}>

      {/* HEADER */}
      <header className="app-encabezado" style={{ position:"sticky", top:0, zIndex:100, background:"#ffffff", borderBottom:"1px solid #E8ECF0", padding:"0 24px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <img src={LOGO_AIXA} alt="Obras Grupo Aixa S.A." style={{ height:40, borderRadius:6 }} />

          {/* TABS (en el celular pasan a una barra fija abajo, ver index.css) */}
          <nav className="app-tabs" style={{ display:"flex", gap:2, background:"#F1F5F9", borderRadius:10, padding:3 }}>
            {[
              { id:"entregas",    icono:"📦", nombre:"Entregas",             corto:"Entregas",   ver:true },
              { id:"aceptadas",   icono:"🗂️", nombre:"Obras Aceptadas",      corto:"Aceptadas",  ver:true },
              { id:"avance",      icono:"🏗", nombre:"Avance de Producción", corto:"Producción", ver:canSeeAvanceProduccion },
              { id:"avance_obra", icono:"🏠", nombre:"Avance de Obra",       corto:"Obra",       ver:canSeeAvanceObra },
              { id:"cobros",      icono:"💰", nombre:"Cobros",               corto:"Cobros",     ver:canSeeCobros, color:"#7C3AED" },
              { id:"materiales",  icono:"🪵", nombre:"Materiales",           corto:"Materiales", ver:canSeeMateriales, color:"#0F766E", alertas:matAlertCount },
            ].filter(t => t.ver).map(t => {
              const activa = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={activa ? "app-tab activa" : "app-tab"} aria-current={activa ? "page" : undefined}
                  style={{ "--tab-color": t.color || "#1A2B4A", position:"relative", padding:"7px 18px", borderRadius:8, border:"none", background: activa ? (t.color || "#1A2B4A") : "transparent", color: activa ? "#ffffff" : "#64748B", fontFamily:"'Sora', sans-serif", fontSize:12, fontWeight: activa ? 700 : 500, cursor:"pointer", transition:"all 0.15s", letterSpacing:0.3 }}>
                  <span className="app-tab-icono">{t.icono}</span> <span className="app-tab-nombre">{t.nombre}</span><span className="app-tab-corto">{t.corto}</span>
                  {t.alertas > 0 && (
                    <span className="app-tab-alerta" title={`${t.alertas} obra(s) con entrega próxima y materiales faltantes`}
                      style={{ marginLeft:6, background:"#DC2626", color:"#fff", borderRadius:99, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{t.alertas}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {canSeeHistorial && (
            <button onClick={() => setActiveTab("historial")} className="btn-icon" title="Historial de modificaciones"
              style={{ background: activeTab === "historial" ? "#1A2B4A" : "transparent", border:"1px solid #E8ECF0", borderRadius:8, width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:16 }}>🕑</button>
          )}

          {/* WhatsApp */}
          <button onClick={() => setShowWA(true)} className="btn-icon" title="WhatsApp"
            style={{ position:"relative", background:"transparent", border:"1px solid #E8ECF0", borderRadius:8, width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            {alertCount > 0 && <div style={{ position:"absolute", top:6, right:6, background:"#22C55E", borderRadius:"50%", width:7, height:7 }} />}
          </button>

          <div style={{ width:1, height:24, background:"#E8ECF0", margin:"0 4px" }} />

          {/* User */}
          <div onClick={isAdmin ? () => setShowUsuarios(true) : undefined}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 12px 6px 8px", background:"#F8FAFC", border:"1px solid #E8ECF0", borderRadius:8, cursor: isAdmin ? "pointer" : "default" }}>
            <div style={{ width:26, height:26, borderRadius:6, background: isAdmin ? "#1A2B4A" : isFinanzas ? "#7C3AED" : isArquitecto ? "#B45309" : "#0F766E", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span className="solo-escritorio" style={{ fontSize:13, color:"#1A2B4A", fontWeight:500 }}>{sesion.nombre.split(" ")[0]}</span>
            {isAdmin && <span className="solo-escritorio" style={{ fontSize:10, color:"#1A2B4A", background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:4, padding:"1px 6px", fontWeight:600 }}>ADMIN</span>}
            {isFinanzas && <span className="solo-escritorio" style={{ fontSize:10, color:"#7C3AED", background:"#F5F3FF", border:"1px solid #DDD6FE", borderRadius:4, padding:"1px 6px", fontWeight:600 }}>FINANZAS</span>}
            {isArquitecto && <span className="solo-escritorio" style={{ fontSize:10, color:"#92400E", background:"#FEF3C7", border:"1px solid #FDE68A", borderRadius:4, padding:"1px 6px", fontWeight:600 }}>ARQUITECTO</span>}
          </div>

          <button onClick={handleLogout}
            style={{ background:"transparent", border:"1px solid #E8ECF0", borderRadius:8, padding:"7px 14px", color:"#64748B", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            Salir
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="app-main" style={{ maxWidth:1200, margin:"0 auto", padding:"28px 24px 100px" }}>
        {activeTab === "entregas" && <EntregasModule sesion={sesion} obras={obras} proyectos={proyectos} recargarObras={recargarObras} />}
        {activeTab === "aceptadas" && <ObrasAceptadasModule sesion={sesion} proyectos={proyectos} recargarObras={recargarObras} />}
        {activeTab === "avance" && canSeeAvanceProduccion && <AvanceModule sesion={sesion} entregas={obras} />}
        {activeTab === "avance_obra" && canSeeAvanceObra && <AvanceObraModule sesion={sesion} entregas={obras} />}
        {activeTab === "cobros" && canSeeCobros && <CobrosModule entregas={obras} />}
        {activeTab === "materiales" && canSeeMateriales && <MaterialesModule sesion={sesion} entregas={obras} />}
        {activeTab === "historial" && canSeeHistorial && <HistorialModule />}
      </main>

      {/* MODALES GLOBALES */}
      {showUsuarios && isAdmin && <GestionUsuarios onClose={() => setShowUsuarios(false)} />}
      {showWA && <ConfigWhatsApp obras={entregasActivas} onClose={() => setShowWA(false)} />}
    </div>
  );
}


// ─── HISTORIAL DE MODIFICACIONES (solo admin@fabrica.com) ────────────────────
// Lo anota la base sola (supabase/04-auditoria.sql); la base solo se lo entrega a esa cuenta.
const EMAIL_HISTORIAL = "admin@fabrica.com";
const TABLAS_HISTORIAL = {
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
function renglonesHistorial(r) {
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

function HistorialModule() {
  const POR_PAGINA = 100;
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [hayMas, setHayMas] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [filtro, setFiltro] = useState({ quien: "", tabla: "", obra: "", desde: "", hasta: "" });

  const consulta = offset => {
    const q = [`select=*&order=creado_en.desc&limit=${POR_PAGINA}&offset=${offset}`];
    if (filtro.quien) q.push(`usuario_nombre=eq.${encodeURIComponent(filtro.quien)}`);
    if (filtro.tabla) q.push(`tabla=eq.${filtro.tabla}`);
    if (filtro.obra.trim()) q.push(`obra=ilike.${encodeURIComponent(`*${filtro.obra.trim()}*`)}`);
    if (filtro.desde) q.push(`creado_en=gte.${new Date(`${filtro.desde}T00:00`).toISOString()}`);
    if (filtro.hasta) q.push(`creado_en=lt.${new Date(new Date(`${filtro.hasta}T00:00`).getTime() + 86400000).toISOString()}`);
    return `auditoria?${q.join("&")}`;
  };

  async function cargar(mas = false) {
    setCargando(true);
    try {
      const nuevas = await sbFetch(consulta(mas ? filas.length : 0));
      setFilas(f => mas ? [...f, ...nuevas] : nuevas);
      setHayMas(nuevas.length === POR_PAGINA);
    } catch (e) { avisar(`No se pudo cargar el historial. ${e.message || ""}`, { tipo: "error" }); }
    setCargando(false);
  }

  // Se vuelve a pedir cada vez que cambia un filtro (el de texto espera a que se deje de escribir)
  useEffect(() => {
    const t = setTimeout(() => cargar(), filtro.obra ? 400 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);
  useEffect(() => { getUsuarios().then(u => setUsuarios(u || [])).catch(() => {}); }, []);

  const si = { padding: "8px 10px", background: "#ffffff", border: "1px solid #E2E8F0", borderRadius: 8, color: "#1A2B4A", fontFamily: "'Inter', sans-serif", fontSize: 13, outline: "none", minWidth: 0 };
  const COLOR_ACCION = { "creó": "#059669", "modificó": "#2563EB", "borró": "#DC2626" };
  const hayFiltro = Object.values(filtro).some(Boolean);
  const dia = iso => new Date(iso).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hora = iso => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: "#1A2B4A", margin: 0 }}>🕑 Historial de modificaciones</h2>
        <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Quién cambió qué y cuándo, en todas las pestañas. Solo lo ve {EMAIL_HISTORIAL}.</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
        <select value={filtro.quien} onChange={e => setFiltro(f => ({ ...f, quien: e.target.value }))} style={{ ...si, flex: "1 1 150px" }}>
          <option value="">Todas las personas</option>
          {usuarios.map(u => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}
        </select>
        <select value={filtro.tabla} onChange={e => setFiltro(f => ({ ...f, tabla: e.target.value }))} style={{ ...si, flex: "1 1 150px" }}>
          <option value="">Todas las pestañas</option>
          {Object.entries(TABLAS_HISTORIAL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input value={filtro.obra} onChange={e => setFiltro(f => ({ ...f, obra: e.target.value }))} placeholder="Buscar obra..." style={{ ...si, flex: "1 1 160px" }} />
        <label style={{ fontSize: 12, color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>Desde
          <input type="date" value={filtro.desde} onChange={e => setFiltro(f => ({ ...f, desde: e.target.value }))} style={si} /></label>
        <label style={{ fontSize: 12, color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>Hasta
          <input type="date" value={filtro.hasta} onChange={e => setFiltro(f => ({ ...f, hasta: e.target.value }))} style={si} /></label>
        {hayFiltro && <button onClick={() => setFiltro({ quien: "", tabla: "", obra: "", desde: "", hasta: "" })} style={{ ...si, cursor: "pointer", color: "#64748B" }}>✕ Limpiar</button>}
      </div>

      {!filas.length ? (
        <div style={{ background: "#ffffff", border: "1px solid #E8ECF0", borderRadius: 12, padding: 30, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
          {cargando ? "Cargando…" : hayFiltro ? "No hay cambios con estos filtros." : "Todavía no hay cambios registrados."}
        </div>
      ) : (
        <div style={{ background: "#ffffff", border: "1px solid #E8ECF0", borderRadius: 12, padding: "4px 18px" }}>
          {filas.map((r, i) => {
            const nuevoDia = i === 0 || dia(filas[i - 1].creado_en) !== dia(r.creado_en);
            const renglones = renglonesHistorial(r);
            return (
              <div key={r.id}>
                {nuevoDia && <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.5, textTransform: "uppercase", padding: "14px 0 6px" }}>{dia(r.creado_en)}</div>}
                <div style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: "1px solid #F1F5F9" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", width: 44, flexShrink: 0, paddingTop: 1 }}>{hora(r.creado_en)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#1A2B4A" }}>
                      <strong>{r.usuario_nombre || "—"}</strong>{" "}
                      <span style={{ color: COLOR_ACCION[r.accion] || "#475569", fontWeight: 600 }}>{r.accion}</span>{" "}
                      <span style={{ fontSize: 11, color: "#475569", background: "#F1F5F9", borderRadius: 4, padding: "1px 6px" }}>{TABLAS_HISTORIAL[r.tabla] || r.tabla}</span>
                      {r.obra && <span style={{ color: "#64748B" }}> · {r.obra}</span>}
                    </div>
                    {renglones.map((l, j) => <div key={j} style={{ fontSize: 12, color: "#475569", marginTop: 3, overflowWrap: "anywhere" }}>{l}</div>)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {hayMas && <button disabled={cargando} onClick={() => cargar(true)} style={{ width: "100%", marginTop: 12, padding: "10px 0", background: "#ffffff", border: "1px solid #E2E8F0", borderRadius: 8, color: "#2563EB", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{cargando ? "Cargando…" : "Ver más"}</button>}
    </div>
  );
}

// ─── GESTIÓN USUARIOS ─────────────────────────────────────────────────────────
function GestionUsuarios({ onClose }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ nombre:"", email:"", password:"", rol:"operario" });
  const ROL_META = { admin: { label:"ADMIN", color:"#1A2B4A", bg:"#EFF6FF", border:"#DBEAFE" }, operario: { label:"OPERARIO", color:"#0F766E", bg:"#F0FDF4", border:"#BBF7D0" }, finanzas: { label:"FINANZAS", color:"#7C3AED", bg:"#F5F3FF", border:"#DDD6FE" }, arquitecto: { label:"ARQUITECTO", color:"#B45309", bg:"#FEF3C7", border:"#FDE68A" } };
  const [msg, setMsg] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { getUsuarios().then(u => u && setUsuarios(u)).catch(() => {}); }, []);

  async function agregar() {
    if (!form.nombre || !form.email || !form.password) { setMsg("⚠️ Completá todos los campos"); return; }
    if (usuarios.find(u => u.email.toLowerCase() === form.email.toLowerCase())) { setMsg("⚠️ Ya existe ese email"); return; }
    if (form.password.length < 6) { setMsg("⚠️ La contraseña debe tener al menos 6 caracteres"); return; }
    setGuardando(true);
    try {
      const nuevo = await crearUsuario(form);
      setUsuarios(u => [...u, nuevo]);
      setForm({ nombre:"", email:"", password:"", rol:"operario" });
      setMsg("✅ Usuario creado");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { setMsg(`⚠️ ${e.message}`); }
    setGuardando(false);
  }

  async function eliminar(id) {
    if (!await confirmar("¿Eliminar este usuario?")) return;
    try { await deleteUsuario(id); setUsuarios(u => u.filter(x => x.id !== id)); } catch (e) { avisar(e.message, { tipo: "error" }); }
  }

  const si = { width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:480, maxHeight:"88vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>Equipo</h2>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"16px 24px" }}>
          {usuarios.map(u => (
            <div key={u.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:10, marginBottom:8 }}>
              <div style={{ width:36, height:36, borderRadius:8, background: (ROL_META[u.rol]||ROL_META.operario).color, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:"#1A2B4A", fontSize:14, fontWeight:600 }}>{u.nombre}</div>
                <div style={{ color:"#94A3B8", fontSize:12 }}>{u.email}</div>
              </div>
              <span style={{ fontSize:10, fontWeight:700, color: (ROL_META[u.rol]||ROL_META.operario).color, background: (ROL_META[u.rol]||ROL_META.operario).bg, border:`1px solid ${(ROL_META[u.rol]||ROL_META.operario).border}`, borderRadius:4, padding:"2px 8px" }}>
                {(ROL_META[u.rol]||ROL_META.operario).label}
              </span>
              {u.id !== "admin" && <button onClick={() => eliminar(u.id)} style={{ background:"none", border:"none", color:"#CBD5E1", cursor:"pointer", fontSize:15, padding:0 }}
                onMouseEnter={e => e.currentTarget.style.color="#EF4444"} onMouseLeave={e => e.currentTarget.style.color="#CBD5E1"}>✕</button>}
            </div>
          ))}
          <div style={{ marginTop:20, paddingTop:20, borderTop:"1px solid #F1F5F9" }}>
            <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:14, fontWeight:700, color:"#1A2B4A", margin:"0 0 14px" }}>Agregar usuario</h3>
            {[{label:"Nombre",key:"nombre",ph:"Nombre completo"},{label:"Email",key:"email",ph:"email@empresa.com"},{label:"Contraseña",key:"password",ph:"Contraseña"}].map(f => (
              <div key={f.key} style={{ marginBottom:10 }}>
                <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:5 }}>{f.label}</label>
                <input style={si} placeholder={f.ph} value={form[f.key]} onChange={e => setForm(x => ({...x, [f.key]: e.target.value}))} />
              </div>
            ))}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:5 }}>Rol</label>
              <select value={form.rol} onChange={e => setForm(x => ({...x, rol: e.target.value}))} style={si}>
                <option value="operario">Operario</option>
                <option value="admin">Admin</option>
                <option value="finanzas">Finanzas</option>
                <option value="arquitecto">Arquitecto</option>
              </select>
            </div>
            {msg && <div style={{ padding:"9px 13px", borderRadius:8, background: msg.startsWith("✅") ? "#ECFDF5" : "#FEF2F2", border:`1px solid ${msg.startsWith("✅") ? "#A7F3D0" : "#FECACA"}`, color: msg.startsWith("✅") ? "#059669" : "#DC2626", fontSize:13, marginBottom:12 }}>{msg}</div>}
            <button onClick={agregar} disabled={guardando} style={{ width:"100%", padding:"11px", background: guardando ? "#94A3B8" : "#1A2B4A", border:"none", borderRadius:8, fontFamily:"'Inter', sans-serif", fontSize:14, fontWeight:600, color:"#ffffff", cursor: guardando ? "not-allowed" : "pointer" }}>
              {guardando ? "Guardando..." : "Agregar usuario"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── CONFIG WHATSAPP ──────────────────────────────────────────────────────────
function ConfigWhatsApp({ obras, onClose }) {
  const [numero, setNumero] = useState(() => { try { return localStorage.getItem("mg_wa_numero") || ""; } catch { return ""; } });
  const [saved, setSaved] = useState(false);
  function guardar() { localStorage.setItem("mg_wa_numero", numero); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  const urgentes = obras.filter(o => o.estado !== "terminado" && diasRestantes(o.fecha) >= 0 && diasRestantes(o.fecha) <= 7).length;
  const proximas = obras.filter(o => o.estado !== "terminado" && diasRestantes(o.fecha) > 7 && diasRestantes(o.fecha) <= 21).length;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:440, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>Alertas WhatsApp</h2>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"20px 24px" }}>
          <div className="grid-form" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:14, textAlign:"center" }}>
              <div style={{ fontFamily:"'Sora', sans-serif", fontSize:28, fontWeight:800, color:"#DC2626" }}>{urgentes}</div>
              <div style={{ fontSize:11, color:"#EF4444", fontWeight:600, marginTop:4 }}>URGENTES</div>
            </div>
            <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:10, padding:14, textAlign:"center" }}>
              <div style={{ fontFamily:"'Sora', sans-serif", fontSize:28, fontWeight:800, color:"#D97706" }}>{proximas}</div>
              <div style={{ fontSize:11, color:"#F59E0B", fontWeight:600, marginTop:4 }}>PRÓXIMAS</div>
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Número de WhatsApp</label>
            <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="5491112345678"
              style={{ width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box" }} />
            <div style={{ fontSize:11, color:"#94A3B8", marginTop:5 }}>Código país + área + número, sin espacios ni +</div>
          </div>
          <button onClick={guardar} style={{ width:"100%", padding:"10px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color: saved ? "#059669" : "#475569", fontFamily:"'Inter', sans-serif", fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:10 }}>
            {saved ? "Número guardado" : "Guardar número"}
          </button>
          <button onClick={() => { enviarWhatsApp(obras, numero); onClose(); }} style={{ width:"100%", padding:"12px", background:"#25D366", border:"none", borderRadius:8, fontFamily:"'Inter', sans-serif", fontSize:14, fontWeight:700, color:"#fff", cursor:"pointer" }}>
            Enviar resumen ahora
          </button>
        </div>
      </div>
    </div>
  );
}
