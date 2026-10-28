// Conexión con Supabase (sesión, tablas y archivos) y funciones del servidor
import { createClient } from "@supabase/supabase-js";
import { avisar } from "./avisos.js";
import { uid } from "./formato.js";
import { extArchivo } from "./materiales.js";
import { mkStations } from "./produccion.js";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
// MaderoGest Supabase (Entregas)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "";

// Supabase Auth: la sesión (token) se guarda y se renueva sola. Todas las consultas
// viajan con el token del usuario logueado; sin sesión la base no devuelve nada.
export const supabase = createClient(SUPABASE_URL.trim(), SUPABASE_KEY.trim());
let accessToken = null;
supabase.auth.onAuthStateChange((_evento, session) => { accessToken = session?.access_token || null; });
function authHeader() { return `Bearer ${accessToken || SUPABASE_KEY}`; }

// Llamadas a las funciones del servidor (/api/*) con la sesión del usuario
export async function apiFetch(path, options = {}) {
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
export async function sbFetch(path, options = {}) {
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
export async function getAixaObras() { return sbFetch("avance_obras?select=*&order=created_at.desc"); }
export async function insertAixaObra(obra) { return sbFetch("avance_obras", { method: "POST", body: JSON.stringify(obra) }); }
export async function deleteAixaObraApi(id) { return sbFetch(`avance_obras?id=eq.${id}`, { method: "DELETE" }); }

// Trae la fila tal como está ahora en la base, le aplica el cambio y la guarda. Las listas
// (estaciones, historial, ítems, adicionales) se arman así sobre lo último guardado y no
// sobre lo que la pantalla cargó al abrirse, para no pisar lo que guardó otra persona.
export async function modificarFila(tabla, id, cambio) {
  const [actual] = await sbFetch(`${tabla}?id=eq.${id}&select=*`);
  if (!actual) throw new Error("El registro ya no existe. Recargá la página.");
  const datos = cambio(JSON.parse(JSON.stringify(actual)));
  if (!datos) return actual;
  const [guardada] = await sbFetch(`${tabla}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(datos) });
  return guardada;
}
// Users for avance also come from the same "usuarios" table
export async function getAixaUsers() { return getUsuarios(); }

// ═══════════════════════════════════════════════════════════════════════════════
// ENTREGAS MODULE (MaderoGest)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── OBRAS API ────────────────────────────────────────────────────────────────
export async function getObras() { return sbFetch("obras?order=fecha.asc", { method: "GET" }); }
export async function upsertObra(obra) {
  return sbFetch("obras", { method: "POST", headers: { "Prefer": "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(obra) });
}
async function deleteObra(id) { return sbFetch(`obras?id=eq.${id}`, { method: "DELETE" }); }
export async function patchEntregas(filtro, data) { return sbFetch(`obras?${filtro}`, { method: "PATCH", body: JSON.stringify(data) }); }

// ─── OBRAS (tabla proyectos): agrupan una o varias entregas (tabla obras) ─────
export async function getProyectos() { return sbFetch("proyectos?select=*&order=creado_en.desc"); }
export async function upsertProyecto(p) {
  return sbFetch("proyectos", { method: "POST", headers: { "Prefer": "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(p) });
}
export async function patchProyecto(id, data) { return sbFetch(`proyectos?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }); }
async function deleteProyecto(id) { return sbFetch(`proyectos?id=eq.${id}`, { method: "DELETE" }); }

export function nombreEntrega(proyecto, etiqueta) { return etiqueta?.trim() ? `${proyecto.nombre} - ${etiqueta.trim()}` : proyecto.nombre; }

// Qué entregas están activas y cuáles archivadas: lo que pertenece a una entrega archivada
// no se muestra en ninguna pestaña; lo que no tiene entrega se muestra como "sin vincular".
export function vinculoEntregas(entregas = []) {
  return {
    activas: entregas.filter(e => !e.archivada),
    archivadas: new Set(entregas.filter(e => e.archivada).map(e => e.id)),
    existentes: new Set(entregas.map(e => e.id)),
  };
}

// Registros que acompañan a cada entrega nueva en Cobros, Materiales y Avance de Producción
export async function crearRegistrosEntrega(e) {
  try { await insertCobro({ obra_id: e.id, obra_nombre: e.nombre, obra_lugar: e.lugar, monto_total: 0, adelanto_cobrado: false, adelanto_monto: 0, adelanto_porcentaje: 0, total_cobrado: false, total_fecha: null, plazo_pago: "", adicionales: [] }); }
  catch (err) { console.error("Error creando el cobro de la entrega:", err); }
  try { await insertMaterial({ obra_id: e.id, obra_nombre: e.nombre, obra_lugar: e.lugar, items: [], notas: "" }); }
  catch (err) { console.error("Error creando la lista de materiales de la entrega:", err); }
  try { await insertAixaObra({ obra_id: e.id, name: e.nombre, client: e.lugar, start_date: null, due_date: e.fecha || null, description: e.notas || "", stations: mkStations(), history: [], clarifications: [] }); }
  catch (err) { console.error("Error creando la entrega en Avance de Producción:", err); avisar("La entrega se guardó, pero no se pudo crear en Avance de Producción.", { tipo: "error" }); }
}

// Copia nombre, dirección y fecha de la entrega a las otras pestañas
export async function sincronizarEntrega(e) {
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
export async function crearObraConEntrega({ nombre, lugar, entrega, sesion }) {
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
export async function eliminarEntregaDefinitiva(id) {
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
export async function eliminarObraDefinitiva(proyectoId, entregaIds) {
  for (const id of entregaIds) await eliminarEntregaDefinitiva(id);
  for (const a of (await sbFetch(`obras_aceptadas?proyecto_id=eq.${proyectoId}`)) || []) {
    await borrarArchivos(a.archivos);
    await deleteObraAceptadaById(a.id);
  }
  await deleteProyecto(proyectoId);
}

export async function getUsuarios() { return sbFetch("usuarios?select=id,nombre,email,rol&order=nombre.asc", { method: "GET" }); }
// Altas y bajas pasan por el servidor: crean/borran también el usuario de Supabase Auth
export async function crearUsuario(usuario) { return apiFetch("/api/usuarios", { method: "POST", body: JSON.stringify(usuario) }); }
export async function deleteUsuario(id) { return apiFetch(`/api/usuarios?id=${encodeURIComponent(id)}`, { method: "DELETE" }); }

export async function agregarHistorial(entrada) { return sbFetch("historial", { method: "POST", body: JSON.stringify(entrada) }); }

export async function getAgregados(obraId) { return sbFetch(`agregados?obra_id=eq.${obraId}&order=fecha.desc`, { method: "GET" }); }
export async function insertAgregado(agregado) {
  return sbFetch("agregados", { method: "POST", headers: { "Prefer": "return=representation" }, body: JSON.stringify(agregado) });
}

// ─── COBROS API ───────────────────────────────────────────────────────────────
export async function getCobros() { return sbFetch("cobros?select=*&order=created_at.desc"); }
export async function insertCobro(cobro) { return sbFetch("cobros", { method: "POST", body: JSON.stringify(cobro) }); }
export async function deleteCobro(id) { return sbFetch(`cobros?id=eq.${id}`, { method: "DELETE" }); }

// ─── MATERIALES API ───────────────────────────────────────────────────────────
// You need to create the table "materiales" in your Supabase with:
// id (uuid, default gen_random_uuid()), obra_id (text not null), obra_nombre (text),
// obra_lugar (text), items (jsonb default '[]'::jsonb), notas (text),
// created_at (timestamptz default now()), updated_at (timestamptz default now())
export async function getMateriales() { return sbFetch("materiales?select=*&order=created_at.desc"); }
export async function insertMaterial(m) { return sbFetch("materiales", { method: "POST", body: JSON.stringify(m) }); }
export async function deleteMaterialById(id) { return sbFetch(`materiales?id=eq.${id}`, { method: "DELETE" }); }

// ─── AVANCE DE OBRA API (tabla: obras_avance + avance_dias) ───────────────────
const AVANCE_BUCKET = "avance-obra-fotos";
export async function getObrasAvance() { return sbFetch("obras_avance?select=*&order=created_at.desc"); }
export async function insertObraAvance(obra) { return sbFetch("obras_avance", { method: "POST", body: JSON.stringify(obra) }); }
export async function updateObraAvance(id, data) { return sbFetch(`obras_avance?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }); }
export async function deleteObraAvanceById(id) { return sbFetch(`obras_avance?id=eq.${id}`, { method: "DELETE" }); }
export async function getDiasAvance(obraId) { return sbFetch(`avance_dias?obra_id=eq.${obraId}&order=fecha.asc,created_at.asc`); }
export async function insertDiaAvance(dia) { return sbFetch("avance_dias", { method: "POST", body: JSON.stringify(dia) }); }
export async function updateDiaAvance(id, data) { return sbFetch(`avance_dias?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }); }
export async function deleteDiaAvanceById(id) { return sbFetch(`avance_dias?id=eq.${id}`, { method: "DELETE" }); }

// ─── INFORMES FINALES API ─────────────────────────────────────────────────────
export async function getInformesFinalesObraIds() {
  const r = await sbFetch("informes_finales?select=obra_id");
  return (r || []).map(x => x.obra_id);
}
export async function getInformeFinal(obraId) {
  const r = await sbFetch(`informes_finales?obra_id=eq.${obraId}&limit=1`);
  return r?.[0] || null;
}
export async function upsertInformeFinal(obraId, datos, archivos, existingId) {
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
export async function getObrasAceptadas() { return sbFetch("obras_aceptadas?select=*&order=fecha_aceptacion.desc.nullslast,created_at.desc"); }
export async function insertObraAceptada(obra) { return sbFetch("obras_aceptadas", { method: "POST", body: JSON.stringify(obra) }); }
export async function updateObraAceptada(id, data) { return sbFetch(`obras_aceptadas?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }); }
export async function deleteObraAceptadaById(id) { return sbFetch(`obras_aceptadas?id=eq.${id}`, { method: "DELETE" }); }
export async function uploadFileObraAceptada(original, obraId) {
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

export async function uploadFileAvance(original, obraId) {
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

export async function deleteFileAvance(filePath) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${AVANCE_BUCKET}/${filePath}`, {
    method: 'DELETE',
    headers: { 'Authorization': authHeader(), 'apikey': SUPABASE_KEY }
  });
}

export async function imgToBase64(url) {
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

export function b64ToBlob(b64, type) {
  const byteStr = atob(b64.split(",")[1]);
  const arr = new Uint8Array(byteStr.length);
  for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
  return new Blob([arr], { type });
}

export async function uploadFileInforme(original, obraId) {
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
export async function perfilDeSesion(session) {
  if (!session) return null;
  accessToken = session.access_token;
  const u = session.user;
  const filas = await sbFetch(`usuarios?select=id,nombre,email,rol&auth_id=eq.${u.id}`);
  const p = filas?.[0];
  if (p) return p;
  // Respaldo por si la fila todavía no tiene auth_id
  return { id: u.app_metadata?.usuario_id || u.id, nombre: u.user_metadata?.nombre || u.email, email: u.email, rol: u.app_metadata?.rol || "operario" };
}
export async function getSesion() {
  const { data } = await supabase.auth.getSession();
  return perfilDeSesion(data.session);
}
export async function cerrarSesion() { await supabase.auth.signOut(); accessToken = null; localStorage.removeItem("mg_sesion"); }


// ═══════════════════════════════════════════════════════════════════════════════
// ENTREGAS MODULE (MaderoGest) — Simplified inline component
// ═══════════════════════════════════════════════════════════════════════════════
// Manda ahora el aviso por email ("entregas" o "materiales") que también sale automáticamente
export async function enviarAvisoAhora(tipo) {
  try {
    const r = await apiFetch(`/api/alertas-diarias?tipo=${tipo}`);
    avisar(r.enviado ? `Aviso enviado a ${r.destinos} destinatario(s).` : (r.motivo || "No había nada para avisar."), { tipo: r.enviado ? "ok" : "info" });
  } catch (e) { avisar(`No se pudo enviar: ${e.message}`, { tipo: "error" }); }
}

export async function uploadArchivoImportacion(file, listaId) {
  const path = `materiales-import/${listaId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${extArchivo(file.name)}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${AVANCE_BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), apikey: SUPABASE_KEY, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
    body: file,
  });
  if (!res.ok) throw new Error(await res.text());
  return path;
}
