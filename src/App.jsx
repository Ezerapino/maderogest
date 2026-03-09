import { useState, useEffect, useCallback, useRef } from "react";

// ─── LOGO ─────────────────────────────────────────────────────────────────────
const LOGO_AIXA = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABFAEsDASIAAhEBAxEB/8QAGwABAAMBAQEBAAAAAAAAAAAAAAEGBwgFAgT/xAA2EAABAgUBBQUGBQUAAAAAAAABAgMABAUGEQcIEiExUTdBYXWzExQiUnShFSM2cbEyQmKBo//EABkBAQADAQEAAAAAAAAAAAAAAAABBAYFAv/EACYRAAICAQMDAwUAAAAAAAAAAAABAhEDBAUSITFSFHKxIlFhcYH/2gAMAwEAAhEDEQA/AOM8nrDJ6xEI9gnJ6wyesRCAJyesMnrEQgCcnrDJ6xEIA1DZs/XM75Yv1Wo8LU+bYa1ArSF0yUfUJk5WtToUeA+VYH2j3dmv9czvli/Vair6r9otb+pP8COalesl+kcaEVLcpp+KKvCEI6R2RCNR1g0crOnVkWZck+VrTX5MrmmynHukwfjS0eHAlpSOB47yXO4CPz29p3T6ls+3LqS5UJpE7SKoxJNSqUp9k4lwt5UTzyN88ukAZtCNkquijtZp9iVjTiZm6zTrrUJNz3hKd+Qnk5LrbhSMBISFKCsckKPLEUvWKg2za1/1C3LVq01V5OnKEu9OPBIDr6eDm4E/2A/COecE8sQsFPhGpay6O1jTi0LPr0+pS/xuTKpxs4zKTOSsNHp+Upvn3pX3YjLYA1PZlZefvueQw046oUxwkISVHHtWukeDqnMNy2odbYfpMs44maUFKdLoVyHMBYH2i8bG3adUvJnfWYika79r9y/Wn+BGfx6pz3jJp2uignf9RM9pgoeu5O5fTXbsUmNU2XbIlLz1UlV1ktt27RG1VWsPO8G0sM/FuqPLClboP+O8e6Mriz25fVw29Z9ftWkvsy0hX0toqKg0PbOIQchAXzCeJyBzCjnnGgIOupuVoeqkrqLai9T7buOeueY/FLdkJYuJck5lhshtIKgAQWkIQojuSo44mMfs5l2X2JtRZd9tbTrVyyqFoWMKSoKYBBHcQYxK06/VLWuWn3FRZky1Rp76X5dzGQFJPIjvB5EciCRFmq2q121Oh3DRJpch7hcVTTVKky3KpQHJgFJ3gRxSCUgkDqYigdG7KzSLF0uZpt0XPNUKb1KmXJe3mkAZk8MrQJziPhK1KQgHv/LPI5TlGhmlMydf5ykXu2iUplmrcqNede4NBpg7yck80LO6fFGTGb6g35cl81+XrVenEGZlJduWlUSzQZbl2m/6UtoTgJAJJ4d5iy3PrnqDcdFq1LqU7IYrMsxLVKZZkW25iabZJLYW4Bk4yf3BI5QB0jNydG1Upmodoq1Otu5qlcs0avb0jKe0S5KTLDeEpSVjBBabQg+AUe+OJH2nGHlsvIU242opWhQwUkHBBHWPStK4KratzU+4qJMmWqNPfS/LuYyAodxB5gjII7wSI+bqrc5clx1Cv1FLAnahMKmJj2LYbQpxRypQSOAycn9zEoGtbG3adUvJnfWYip63zbDWrNyIXTJR9QnVZWtToUeA+VYH2i07HbqGtTKipxW6DRnR/wBmYpWuikr1cuRSTkGdOD/oRm8WlzLe8uZwfBwSUqdN2ul9r/Bfy58GTQxwc1zUraT6196TuilQhCNIUBCEIAQhCAEIQgDYNkztFqHlDnrMxWtYpthrU64ELpko8oTasrWp0KPAfKsD7RZdkztFqHlDnrMxT9ae1S4fqz/Ai7lV6KPuM9jipbzkT8F8oqO74w3fGEIpGhG74w3fGEIAbvjDd8YQgBu+MN3xhCANf2TRjUWoeUOeszFZ1im2GtTrgQumSjyhNqytanQo8B8qwPtCEXcqvRR9xn8cVLeMl+C+Uf/Z";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
// Reemplazá estos valores con los de tu proyecto en supabase.com
// Project Settings → API → Project URL y anon public key
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "";

async function sbFetch(path, options = {}) {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${SUPABASE_URL}/rest/v1/${path}${separator}apikey=${SUPABASE_KEY}`;
  const isWrite = options.method && options.method !== "GET";
  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      ...(isWrite ? { "Content-Type": "application/json" } : {}),
      "Prefer": "return=representation",
      ...options.headers,
    },
    ...(options.body ? { body: options.body } : {}),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// ─── OBRAS ────────────────────────────────────────────────────────────────────
async function getObras() {
  return sbFetch("obras?order=fecha.asc", { method: "GET" });
}
async function upsertObra(obra) {
  return sbFetch("obras", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(obra),
  });
}
async function deleteObra(id) {
  return sbFetch(`obras?id=eq.${id}`, { method: "DELETE" });
}

// ─── USUARIOS ─────────────────────────────────────────────────────────────────
async function getUsuarios() {
  return sbFetch("usuarios?select=*", { method: "GET" });
}
async function upsertUsuario(usuario) {
  return sbFetch("usuarios", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(usuario),
  });
}
async function deleteUsuario(id) {
  return sbFetch(`usuarios?id=eq.${id}`, { method: "DELETE" });
}

// ─── HISTORIAL ────────────────────────────────────────────────────────────────
async function getHistorial(obraId = null) {
  const filter = obraId ? `obra_id=eq.${obraId}&` : "";
  return sbFetch(`historial?${filter}order=fecha.desc&limit=100`, { method: "GET" });
}
async function agregarHistorial(entrada) {
  return sbFetch("historial", {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

// ─── AGREGADOS ────────────────────────────────────────────────────────────────
async function getAgregados(obraId) {
  return sbFetch(`agregados?obra_id=eq.${obraId}&order=fecha.desc`, { method: "GET" });
}
async function insertAgregado(agregado) {
  return sbFetch("agregados", {
    method: "POST",
    headers: { "Prefer": "return=representation" },
    body: JSON.stringify(agregado),
  });
}
async function deleteAgregado(id) {
  return sbFetch(`agregados?id=eq.${id}`, { method: "DELETE" });
}


function getSesion() {
  try { return JSON.parse(localStorage.getItem("mg_sesion")); } catch { return null; }
}
function setSesionLocal(u) {
  if (u) localStorage.setItem("mg_sesion", JSON.stringify(u));
  else localStorage.removeItem("mg_sesion");
}


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
function formatDate(d) {
  if (!d) return "";
  const [y,m,dia] = d.split("-");
  return `${dia}/${m}/${y}`;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function muebleIcon(n = "") {
  const l = n.toLowerCase();
  if (l.includes("cama") || l.includes("sommier")) return "🛏️";
  if (l.includes("silla") || l.includes("sillón")) return "🪑";
  if (l.includes("mesa")) return "🍽️";
  if (l.includes("placard") || l.includes("armario") || l.includes("ropero")) return "🚪";
  if (l.includes("espejo")) return "🪞";
  if (l.includes("estante") || l.includes("biblioteca")) return "📚";
  if (l.includes("escritorio")) return "🖥️";
  if (l.includes("cocina")) return "🍳";
  if (l.includes("vanitory") || l.includes("baño")) return "🚿";
  if (l.includes("sillón") || l.includes("sofa") || l.includes("sofá")) return "🛋️";
  return "🪵";
}

const ESTADO_LABELS = { pendiente: "Pendiente", en_proceso: "En proceso", terminado: "Terminado" };
const STATUS_META = {
  urgent: { color: "#e05555", bg: "rgba(224,85,85,0.13)", label: "URGENTE", icon: "🚨" },
  warning: { color: "#d4783a", bg: "rgba(212,120,58,0.13)", label: "PRÓXIMA", icon: "⏰" },
  ok:      { color: "#4a9a6a", bg: "rgba(74,154,106,0.12)", label: "A TIEMPO", icon: "✅" },
  done:    { color: "#6a8a9a", bg: "rgba(106,138,154,0.1)", label: "ENTREGADA", icon: "📦" },
  vencida: { color: "#c84040", bg: "rgba(200,64,64,0.18)", label: "VENCIDA", icon: "⛔" },
};

// ─── DEMO DATA ────────────────────────────────────────────────────────────────
function makeDemoData() {
  const hoy = new Date();
  function addDays(n) { const d = new Date(hoy); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; }
  return [
    { id:"demo1", nombre:"Departamento Barrio Norte", lugar:"Av. Santa Fe 2450, CABA", fecha:addDays(3), estado:"en_proceso", muebles:["Placard 3 puertas corredizas","Cama matrimonial con cabecero","Mesa de luz x2","Cómoda 6 cajones"], notas:"Acceso por cochera, llamar antes. Piso 7 depto B.", creadoPor:"admin", creadoEn:new Date().toISOString() },
    { id:"demo2", nombre:"Casa Palermo Soho", lugar:"Thames 1860, CABA", fecha:addDays(15), estado:"pendiente", muebles:["Sillón 3 cuerpos tela gris","Mesa comedor 8 personas madera maciza","Aparador 2 puertas","Biblioteca esquinera 6 módulos"], notas:"Cliente prefiere entrega a la mañana.", creadoPor:"admin", creadoEn:new Date().toISOString() },
    { id:"demo3", nombre:"Oficinas Centro", lugar:"Florida 620 Piso 4, CABA", fecha:addDays(5), estado:"en_proceso", muebles:["Escritorio recto x6","Silla ergonómica x6","Módulo recepción en L","Mueble cajonero x6"], notas:"Entregar en piso 4. Hay ascensor de carga.", creadoPor:"admin", creadoEn:new Date().toISOString() },
    { id:"demo4", nombre:"Dúplex San Isidro", lugar:"Centenario 430, San Isidro", fecha:addDays(45), estado:"pendiente", muebles:["Cocina integral con isla","Placard dormitorio principal","Vanitory doble mármol","Biblioteca living"], notas:"", creadoPor:"admin", creadoEn:new Date().toISOString() },
    { id:"demo5", nombre:"Estudio Belgrano", lugar:"Arribeños 2100, CABA", fecha:addDays(-8), estado:"terminado", muebles:["Mesa ratona vidrio","Estante flotante x4"], notas:"Cliente muy conforme. Recomendó a vecinos.", creadoPor:"admin", creadoEn:new Date().toISOString() },
  ];
}

const DEMO_USERS = [
  { id:"admin", nombre:"Administrador", email:"admin@fabrica.com", password:"admin123", rol:"admin" },
  { id:"op1",   nombre:"Carlos Operario", email:"carlos@fabrica.com", password:"carlos123", rol:"operario" },
];

// ─── PDF GENERATOR ────────────────────────────────────────────────────────────
async function generarPDF(obra) {
  const dias = diasRestantes(obra.fecha);
  const status = getStatus(dias, obra.estado);
  const sm = STATUS_META[status];

  // Traer agregados de Supabase
  let agregadosList = [];
  try { agregadosList = await getAgregados(obra.id); } catch {}

  const estilos = `
    body { font-family: Georgia, serif; color: #1e293b; margin: 0; padding: 0; }
    .portada { background: #1e293b; color: #e8dcc8; padding: 48px 48px 36px; min-height: 160px; }
    .logo { font-size: 28px; font-weight: bold; letter-spacing: 2px; color: #ffffff; }
    .obra-titulo { font-size: 26px; margin: 20px 0 6px; font-style: italic; color: #e8dcc8; }
    .obra-subtitulo { font-size: 13px; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; }
    .cuerpo { padding: 36px 48px; }
    .status-badge { display: inline-block; padding: 5px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; letter-spacing: 1px; background: ${sm.bg}; color: ${sm.color}; border: 1px solid ${sm.color}; margin-bottom: 24px; }
    .grid-datos { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 32px; border-bottom: 1px solid #e2e8f0; padding-bottom: 28px; }
    .dato-item .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px; }
    .dato-item .valor { font-size: 15px; font-weight: bold; color: #1e293b; }
    .seccion-titulo { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; margin-top: 28px; }
    .tabla-header { display: flex; padding: 6px 12px; background: #f1f5f9; border-radius: 6px; margin-bottom: 4px; }
    .tabla-header-nombre { flex: 1; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: bold; }
    .tabla-header-cant { width: 90px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: bold; text-align: center; }
    .mueble-row { display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    .mueble-nombre { flex: 1; font-size: 14px; color: #1e293b; }
    .mueble-cantidad { width: 90px; font-size: 14px; font-weight: bold; color: #1e40af; text-align: center; }
    .mueble-check { width: 24px; height: 24px; border: 1.5px solid #1e40af; border-radius: 4px; margin-left: 12px; flex-shrink: 0; }
    .agr-row { display: flex; align-items: center; padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
    .agr-articulo { flex: 1; font-size: 14px; color: #1e293b; }
    .agr-cantidad { width: 90px; font-size: 14px; font-weight: bold; color: #1e40af; text-align: center; }
    .agr-fecha { font-size: 11px; color: #94a3b8; width: 130px; text-align: right; }
    .notas-box { background: #f8fafc; border-left: 3px solid #1e40af; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-top: 28px; font-size: 13px; line-height: 1.7; color: #1e293b; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
    .firma-box { margin-top: 48px; display: flex; justify-content: space-between; }
    .firma { text-align: center; }
    .firma-linea { width: 160px; border-bottom: 1px solid #1e293b; margin-bottom: 6px; height: 36px; }
    .firma-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
  `;

  const diasLabel = obra.estado === "terminado" ? "Entregada" : dias < 0 ? `Vencida hace ${Math.abs(dias)} días` : dias === 0 ? "¡Entrega HOY!" : `${dias} días para entrega`;

  const mueblesList = normalizarMuebles(obra.muebles || []);
  const totalUnidades = mueblesList.reduce((a, m) => a + (m.cantidad||1), 0);
  const mueblesHTML = mueblesList.map((m) => `
    <div class="mueble-row">
      <div class="mueble-nombre">${m.nombre}</div>
      <div class="mueble-cantidad">${m.cantidad > 1 ? m.cantidad : "1"}</div>
      <div class="mueble-check"></div>
    </div>
  `).join("");

  const agregadosHTML = agregadosList.length === 0 ? '<p style="color:#94a3b8;font-size:13px">Sin agregados registrados.</p>' :
    agregadosList.map((a) => `
      <div class="agr-row">
        <div class="agr-articulo">${a.articulo}</div>
        <div class="agr-cantidad">${a.cantidad}${a.unidad ? ` ${a.unidad}` : ""}</div>
        <div class="agr-fecha">${new Date(a.fecha).toLocaleDateString("es-AR", {day:"2-digit",month:"short",year:"numeric"})}</div>
      </div>
    `).join("");

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Orden de Entrega – ${obra.nombre}</title>
<style>${estilos}</style></head>
<body>
<div class="portada">
  <div class="logo">Obras Grupo Aixa S.A.</div>
  <div class="obra-titulo">${obra.nombre}</div>
  <div class="obra-subtitulo">Orden de entrega · Obras Grupo Aixa S.A.</div>
</div>
<div class="cuerpo">
  <div class="status-badge">${sm.icon} ${sm.label} — ${diasLabel}</div>
  <div class="grid-datos">
    <div class="dato-item"><div class="label">📍 Lugar de entrega</div><div class="valor">${obra.lugar}</div></div>
    <div class="dato-item"><div class="label">📅 Fecha acordada</div><div class="valor">${formatDate(obra.fecha)}</div></div>
    <div class="dato-item"><div class="label">⚙️ Estado</div><div class="valor">${ESTADO_LABELS[obra.estado]}</div></div>
  </div>

  <div class="seccion-titulo">🪵 Lista de muebles a entregar — ${mueblesList.length} tipos · ${totalUnidades} unidades</div>
  ${mueblesList.length === 0 ? '<p style="color:#94a3b8;font-size:13px">Sin muebles registrados.</p>' : `
    <div class="tabla-header"><div class="tabla-header-nombre">Descripción</div><div class="tabla-header-cant">Cantidad</div><div style="width:36px"></div></div>
    ${mueblesHTML}
  `}

  <div class="seccion-titulo">📦 Agregados — ${agregadosList.length} ítems</div>
  ${agregadosList.length === 0 ? '<p style="color:#94a3b8;font-size:13px">Sin agregados registrados.</p>' : `
    <div class="tabla-header"><div class="tabla-header-nombre">Artículo</div><div class="tabla-header-cant">Cantidad</div><div style="width:130px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:bold;text-align:right">Fecha</div></div>
    ${agregadosHTML}
  `}

  ${obra.notas ? `<div class="notas-box">📝 <strong>Notas:</strong> ${obra.notas}</div>` : ""}

  <div class="firma-box">
    <div class="firma"><div class="firma-linea"></div><div class="firma-label">Responsable de entrega</div></div>
    <div class="firma"><div class="firma-linea"></div><div class="firma-label">Firma del cliente / Recibí conforme</div></div>
  </div>

  <div class="footer">
    <span>Obras Grupo Aixa S.A.</span>
    <span>Generado: ${new Date().toLocaleDateString("es-AR", {day:"2-digit",month:"long",year:"numeric"})}</span>
  </div>
</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  }
}

// ─── WHATSAPP ALERT ───────────────────────────────────────────────────────────
function enviarWhatsApp(obras, numero) {
  const activas = obras.filter(o => o.estado !== "terminado");
  const urgentes = activas.filter(o => diasRestantes(o.fecha) <= 7 && diasRestantes(o.fecha) >= 0);
  const proximas = activas.filter(o => diasRestantes(o.fecha) > 7 && diasRestantes(o.fecha) <= 21);
  const vencidas = activas.filter(o => diasRestantes(o.fecha) < 0);

  if (urgentes.length === 0 && proximas.length === 0 && vencidas.length === 0) {
    alert("No hay obras con fechas próximas para alertar.");
    return;
  }

  const fecha = new Date().toLocaleDateString("es-AR", { weekday:"long", day:"2-digit", month:"long", year:"numeric" });
  const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  let msg = `*OBRAS GRUPO AIXA S.A.*\n`;
  msg += `Resumen de entregas — ${fechaCap}\n`;
  msg += `${"—".repeat(30)}\n\n`;

  if (vencidas.length > 0) {
    msg += `*VENCIDAS SIN ENTREGAR (${vencidas.length})*\n`;
    vencidas.sort((a,b) => diasRestantes(a.fecha) - diasRestantes(b.fecha)).forEach(o => {
      const d = Math.abs(diasRestantes(o.fecha));
      const total = normalizarMuebles(o.muebles||[]).reduce((a,m) => a+(m.cantidad||1), 0);
      msg += `- *${o.nombre}*\n`;
      msg += `  Lugar: ${o.lugar}\n`;
      msg += `  Fecha pactada: ${formatDate(o.fecha)} (hace ${d} dias)\n`;
      msg += `  Muebles: ${(o.muebles||[]).length} tipos, ${total} unidades\n\n`;
    });
  }

  if (urgentes.length > 0) {
    msg += `*ENTREGAS URGENTES — hasta 7 dias (${urgentes.length})*\n`;
    urgentes.sort((a,b) => diasRestantes(a.fecha) - diasRestantes(b.fecha)).forEach(o => {
      const d = diasRestantes(o.fecha);
      const total = normalizarMuebles(o.muebles||[]).reduce((a,m) => a+(m.cantidad||1), 0);
      msg += `- *${o.nombre}*\n`;
      msg += `  Lugar: ${o.lugar}\n`;
      msg += `  Fecha: ${formatDate(o.fecha)} — ${d === 0 ? "*ENTREGA HOY*" : `en ${d} dias`}\n`;
      msg += `  Muebles: ${(o.muebles||[]).length} tipos, ${total} unidades\n\n`;
    });
  }

  if (proximas.length > 0) {
    msg += `*PROXIMAS ENTREGAS — hasta 21 dias (${proximas.length})*\n`;
    proximas.sort((a,b) => diasRestantes(a.fecha) - diasRestantes(b.fecha)).forEach(o => {
      const d = diasRestantes(o.fecha);
      msg += `- *${o.nombre}*\n`;
      msg += `  Lugar: ${o.lugar}\n`;
      msg += `  Fecha: ${formatDate(o.fecha)} — en ${d} dias\n\n`;
    });
  }

  msg += `${"—".repeat(30)}\n`;
  msg += `_Total obras activas: ${activas.length}_`;

  const num = (numero || "").replace(/\D/g, "");
  const url = num
    ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.location.href = url;
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTES UI
// ══════════════════════════════════════════════════════════════════════════════

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleLogin() {
    if (!email || !pass) { setError("Completá email y contraseña."); return; }
    setCargando(true);
    try {
      const usuarios = await getUsuarios();
      const u = usuarios.find(x => x.email.toLowerCase() === email.toLowerCase() && x.password === pass);
      if (!u) { setError("Email o contraseña incorrectos."); setCargando(false); return; }
      setSesionLocal({ id: u.id, nombre: u.nombre, rol: u.rol, email: u.email });
      onLogin(u);
    } catch {
      setError("Error de conexión. Verificá tu internet.");
      setCargando(false);
    }
  }

  const inputStyle = { width:"100%", padding:"11px 14px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box", transition:"border-color 0.15s" };

  return (
    <div style={{ minHeight:"100vh", background:"#F4F6F9", display:"flex", fontFamily:"'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600&display=swap'); * { box-sizing: border-box; } input:focus { border-color: #2563EB !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.08) !important; }`}</style>

      {/* Panel izquierdo decorativo */}
      <div style={{ display:"none", width:"45%", background:"#1A2B4A", padding:"60px 56px", flexDirection:"column", justifyContent:"space-between", '@media (min-width: 768px)': { display:"flex" } }} />

      {/* Formulario */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
        <div style={{ width:"100%", maxWidth:380 }}>
          <div style={{ marginBottom:36, textAlign:"center" }}>
            <img src={LOGO_AIXA} alt="Obras Grupo Aixa S.A." style={{ height:48, marginBottom:16 }} />
            <p style={{ fontSize:13, color:"#94A3B8", margin:0, letterSpacing:0.5 }}>Sistema de gestión de obras</p>
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
            <div style={{ padding:"10px 14px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:13, marginBottom:16 }}>
              {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={cargando}
            style={{ width:"100%", padding:"12px", background: cargando ? "#94A3B8" : "#1A2B4A", border:"none", borderRadius:8, fontFamily:"'Inter', sans-serif", fontSize:14, fontWeight:600, color:"#ffffff", cursor: cargando ? "not-allowed" : "pointer", letterSpacing:0.3, transition:"background 0.2s" }}
            onMouseEnter={e => !cargando && (e.currentTarget.style.background="#2563EB")}
            onMouseLeave={e => !cargando && (e.currentTarget.style.background="#1A2B4A")}>
            {cargando ? "Verificando..." : "Iniciar sesión"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HELPERS para muebles con cantidad ───────────────────────────────────────
// Los muebles se guardan como objetos { nombre, cantidad }
// Para compatibilidad con datos viejos (strings), normalizamos al leer
function normalizarMuebles(muebles) {
  if (!muebles) return [];
  return muebles.map(m => typeof m === "string" ? { nombre: m, cantidad: 1 } : m);
}
function muebleLabel(m) {
  const obj = typeof m === "string" ? { nombre: m, cantidad: 1 } : m;
  return obj.cantidad > 1 ? `${obj.nombre} x${obj.cantidad}` : obj.nombre;
}
function muebleNombre(m) { return typeof m === "string" ? m : m.nombre; }

// ─── MODAL OBRA ───────────────────────────────────────────────────────────────
function ModalObra({ obra, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: obra?.nombre || "",
    lugar: obra?.lugar || "",
    fecha: obra?.fecha || "",
    estado: obra?.estado || "pendiente",
    muebles: normalizarMuebles(obra?.muebles),
    notas: obra?.notas || "",
  });
  const [muebleInput, setMuebleInput] = useState("");
  const [cantInput, setCantInput] = useState("1");
  const [errors, setErrors] = useState({});

  function addMueble() {
    const v = muebleInput.trim();
    if (!v) return;
    const cant = Math.max(1, parseInt(cantInput) || 1);
    setForm(f => ({ ...f, muebles: [...f.muebles, { nombre: v, cantidad: cant }] }));
    setMuebleInput("");
    setCantInput("1");
  }
  function rmMueble(i) { setForm(f => ({ ...f, muebles: f.muebles.filter((_,x) => x !== i) })); }
  function updateCantidad(i, val) {
    const cant = Math.max(1, parseInt(val) || 1);
    setForm(f => ({ ...f, muebles: f.muebles.map((m, x) => x === i ? { ...m, cantidad: cant } : m) }));
  }
  function updateNombre(i, val) {
    setForm(f => ({ ...f, muebles: f.muebles.map((m, x) => x === i ? { ...m, nombre: val } : m) }));
  }

  function validate() {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "Requerido";
    if (!form.lugar.trim()) e.lugar = "Requerido";
    if (!form.fecha) e.fecha = "Requerido";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...obra, ...form, id: obra?.id || uid(), creadoEn: obra?.creadoEn || new Date().toISOString() });
  }

  const inp = (label, key, type="text", ph="") => (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>{label}</label>
      <input type={type} value={form[key]} placeholder={ph}
        onChange={e => { setForm(f => ({...f, [key]: e.target.value})); setErrors(er => ({...er,[key]:""})); }}
        style={{ width:"100%", padding:"10px 13px", background:"#F8FAFC", border:`1px solid ${errors[key] ? "#FCA5A5" : "#E2E8F0"}`, borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box" }}
      />
      {errors[key] && <div style={{ color:"#DC2626", fontSize:11, marginTop:4 }}>{errors[key]}</div>}
    </div>
  );

  const totalMuebles = form.muebles.reduce((acc, m) => acc + (m.cantidad || 1), 0);
  const modalInp = { padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:540, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"#ffffff", borderRadius:"14px 14px 0 0", zIndex:1 }}>
          <div>
            <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{obra ? "Editar obra" : "Nueva obra"}</h2>
          </div>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
        </div>

        <div style={{ padding:"24px" }}>
          {inp("Nombre de la obra", "nombre", "text", "Ej: Departamento Flores")}
          {inp("Dirección", "lugar", "text", "Calle, número, barrio...")}
          {inp("Fecha de entrega", "fecha", "date")}

          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Estado</label>
            <select value={form.estado} onChange={e => setForm(f => ({...f, estado: e.target.value}))}
              style={{ ...modalInp, width:"100%" }}>
              <option value="pendiente">Pendiente</option>
              <option value="en_proceso">En proceso</option>
              <option value="terminado">Terminado</option>
            </select>
          </div>

          {/* MUEBLES */}
          <div style={{ marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <label style={{ fontSize:12, fontWeight:600, color:"#475569" }}>Muebles</label>
              {form.muebles.length > 0 && (
                <span style={{ fontSize:11, color:"#94A3B8" }}>{form.muebles.length} tipos · {totalMuebles} unidades</span>
              )}
            </div>

            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <input value={muebleInput} placeholder="Nombre del mueble"
                onChange={e => setMuebleInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addMueble(); }}}
                style={{ ...modalInp, flex:1 }} />
              <input value={cantInput} type="number" min="1" max="999" placeholder="Cant."
                onChange={e => setCantInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addMueble(); }}}
                style={{ ...modalInp, width:70, textAlign:"center", fontWeight:600, color:"#2563EB" }} />
              <button onClick={addMueble}
                style={{ padding:"10px 16px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#ffffff", fontSize:16, cursor:"pointer", fontWeight:600 }}>+</button>
            </div>

            {form.muebles.length > 0 && (
              <div style={{ border:"1px solid #E2E8F0", borderRadius:10, overflow:"hidden" }}>
                {form.muebles.map((m, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderBottom: i < form.muebles.length-1 ? "1px solid #F1F5F9" : "none", background:"#FAFBFC" }}>
                    <input value={m.nombre} onChange={e => updateNombre(i, e.target.value)}
                      style={{ flex:1, background:"transparent", border:"none", color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", minWidth:0 }} />
                    <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                      <button onClick={() => updateCantidad(i, m.cantidad - 1)}
                        style={{ width:26, height:26, background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:6, color:"#2563EB", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>−</button>
                      <input type="number" min="1" max="999" value={m.cantidad} onChange={e => updateCantidad(i, e.target.value)}
                        style={{ width:46, textAlign:"center", background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:6, color:"#2563EB", fontFamily:"'Inter', sans-serif", fontSize:13, fontWeight:700, outline:"none", padding:"3px 4px" }} />
                      <button onClick={() => updateCantidad(i, m.cantidad + 1)}
                        style={{ width:26, height:26, background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:6, color:"#2563EB", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>+</button>
                    </div>
                    <button onClick={() => rmMueble(i)}
                      style={{ background:"none", border:"none", color:"#CBD5E1", cursor:"pointer", fontSize:16, padding:"0 2px", flexShrink:0 }}
                      onMouseEnter={e => e.currentTarget.style.color="#EF4444"}
                      onMouseLeave={e => e.currentTarget.style.color="#CBD5E1"}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Notas</label>
            <textarea value={form.notas} rows={3} placeholder="Observaciones, detalles de acceso..."
              onChange={e => setForm(f => ({...f, notas: e.target.value}))}
              style={{ width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", resize:"vertical", boxSizing:"border-box" }}
            />
          </div>

          <button onClick={handleSave}
            style={{ width:"100%", padding:"12px", background:"#1A2B4A", border:"none", borderRadius:8, fontFamily:"'Inter', sans-serif", fontSize:14, fontWeight:600, color:"#ffffff", cursor:"pointer", letterSpacing:0.3 }}
            onMouseEnter={e => e.currentTarget.style.background="#2563EB"}
            onMouseLeave={e => e.currentTarget.style.background="#1A2B4A"}>
            Guardar obra
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DETALLE OBRA ─────────────────────────────────────────────────────────────
function DetalleObra({ obra, onClose, onEdit, onDelete, onEntregada, rol, sesion }) {
  const dias = diasRestantes(obra.fecha);
  const status = getStatus(dias, obra.estado);

  const [agregados, setAgregados] = useState([]);
  const [showAddAgr, setShowAddAgr] = useState(false);
  const [agrForm, setAgrForm] = useState({ articulo:"", cantidad:"1", unidad:"" });
  const [guardandoAgr, setGuardandoAgr] = useState(false);

  useEffect(() => {
    getAgregados(obra.id).then(a => setAgregados(a || [])).catch(() => {});
  }, [obra.id]);

  async function agregarItem() {
    if (!agrForm.articulo.trim()) return;
    setGuardandoAgr(true);
    try {
      const nuevo = {
        id: uid(), obra_id: obra.id,
        articulo: agrForm.articulo.trim(),
        cantidad: parseFloat(agrForm.cantidad) || 1,
        unidad: agrForm.unidad.trim(),
        agregado_por: sesion.id,
        agregado_por_nombre: sesion.nombre,
        fecha: new Date().toISOString(),
      };
      await insertAgregado(nuevo);
      setAgregados(a => [nuevo, ...a]);
      setAgrForm({ articulo:"", cantidad:"1", unidad:"" });
      setShowAddAgr(false);
    } catch { alert("Error al guardar el agregado."); }
    setGuardandoAgr(false);
  }

  async function eliminarAgregado(id) {
    if (!confirm("¿Eliminar este agregado?")) return;
    try {
      await deleteAgregado(id);
      setAgregados(a => a.filter(x => x.id !== id));
    } catch { alert("Error al eliminar."); }
  }

  function formatFechaAgr(f) {
    return new Date(f).toLocaleDateString("es-AR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
  }

  const statusColors = {
    urgent: { bg:"#FEF2F2", text:"#DC2626", border:"#FECACA", label:"Urgente" },
    vencida: { bg:"#FEF2F2", text:"#DC2626", border:"#FECACA", label:"Vencida" },
    warning: { bg:"#FFFBEB", text:"#D97706", border:"#FDE68A", label:"Próxima" },
    ok:      { bg:"#ECFDF5", text:"#059669", border:"#A7F3D0", label:"A tiempo" },
    done:    { bg:"#F8FAFC", text:"#64748B", border:"#E2E8F0", label:"Entregada" },
  };
  const sc = statusColors[status] || statusColors.ok;
  const diasLabel = obra.estado === "terminado" ? "Entregada" : dias < 0 ? `Vencida hace ${Math.abs(dias)} días` : dias === 0 ? "Entrega hoy" : `${dias} días para entrega`;

  const agrInp = { padding:"9px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", backdropFilter:"blur(4px)", zIndex:400, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#ffffff", borderRadius:"16px 16px 0 0", width:"100%", maxWidth:620, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 -8px 40px rgba(15,23,42,0.15)" }}>

        {/* Handle drag indicator */}
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 0" }}>
          <div style={{ width:36, height:4, background:"#E2E8F0", borderRadius:2 }} />
        </div>

        {/* Header */}
        <div style={{ padding:"16px 24px 0", display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
          <div style={{ flex:1, paddingRight:12 }}>
            <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:19, fontWeight:700, color:"#1A2B4A", margin:"0 0 8px" }}>{obra.nombre}</h2>
            <span style={{ display:"inline-block", padding:"4px 12px", borderRadius:6, background:sc.bg, color:sc.text, fontSize:11, fontWeight:700, border:`1px solid ${sc.border}`, letterSpacing:0.3 }}>
              {sc.label} — {diasLabel}
            </span>
          </div>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16, flexShrink:0 }}>✕</button>
        </div>

        <div style={{ padding:"20px 24px 36px" }}>
          {/* Info grid */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            {[
              { label:"Lugar", val: obra.lugar },
              { label:"Fecha de entrega", val: formatDate(obra.fecha) },
              { label:"Estado", val: ESTADO_LABELS[obra.estado] },
              { label:"Total muebles", val: `${normalizarMuebles(obra.muebles||[]).reduce((a,m)=>a+(m.cantidad||1),0)} unidades` },
            ].map(d => (
              <div key={d.label} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, marginBottom:4 }}>{d.label.toUpperCase()}</div>
                <div style={{ fontSize:13, color:"#1A2B4A", fontWeight:500 }}>{d.val}</div>
              </div>
            ))}
          </div>

          {obra.notas && (
            <div style={{ background:"#F8FAFC", borderLeft:"3px solid #2563EB", padding:"12px 16px", borderRadius:"0 8px 8px 0", marginBottom:20, fontSize:13, color:"#475569", lineHeight:1.7 }}>
              {obra.notas}
            </div>
          )}

          {/* MUEBLES */}
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontSize:12, fontWeight:600, color:"#475569" }}>MUEBLES</span>
              {(obra.muebles||[]).length > 0 && <span style={{ fontSize:11, color:"#94A3B8" }}>{normalizarMuebles(obra.muebles).reduce((a,m)=>a+(m.cantidad||1),0)} unidades</span>}
            </div>
            {(obra.muebles||[]).length === 0
              ? <div style={{ color:"#94A3B8", fontSize:13 }}>Sin muebles registrados</div>
              : <div style={{ border:"1px solid #E2E8F0", borderRadius:10, overflow:"hidden" }}>
                  {normalizarMuebles(obra.muebles).map((m, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", padding:"11px 14px", borderBottom: i < obra.muebles.length-1 ? "1px solid #F1F5F9" : "none" }}>
                      <span style={{ flex:1, fontSize:14, color:"#1A2B4A" }}>{m.nombre}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:"#2563EB", background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:6, padding:"2px 10px" }}>×{m.cantidad || 1}</span>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* AGREGADOS */}
          <div style={{ paddingTop:20, borderTop:"1px solid #F1F5F9" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontSize:12, fontWeight:600, color:"#475569" }}>AGREGADOS</span>
              <button onClick={() => setShowAddAgr(!showAddAgr)}
                style={{ padding:"5px 14px", background: showAddAgr ? "#F8FAFC" : "#1A2B4A", border:`1px solid ${showAddAgr ? "#E2E8F0" : "#1A2B4A"}`, borderRadius:7, color: showAddAgr ? "#64748B" : "#ffffff", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                {showAddAgr ? "Cancelar" : "+ Agregar"}
              </button>
            </div>

            {showAddAgr && (
              <div style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:10, padding:"14px", marginBottom:12 }}>
                <div style={{ marginBottom:8 }}>
                  <input placeholder="Artículo o material" value={agrForm.articulo}
                    onChange={e => setAgrForm(f => ({...f, articulo: e.target.value}))}
                    style={{ ...agrInp, width:"100%" }} />
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <input type="number" min="0.1" step="0.1" placeholder="Cantidad" value={agrForm.cantidad}
                    onChange={e => setAgrForm(f => ({...f, cantidad: e.target.value}))}
                    style={{ ...agrInp, width:90, textAlign:"center", fontWeight:600, color:"#2563EB" }} />
                  <input placeholder="Unidad (kg, m², u...)" value={agrForm.unidad}
                    onChange={e => setAgrForm(f => ({...f, unidad: e.target.value}))}
                    style={{ ...agrInp, flex:1 }} />
                  <button onClick={agregarItem} disabled={guardandoAgr}
                    style={{ padding:"9px 16px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#ffffff", fontSize:13, fontWeight:600, cursor: guardandoAgr ? "not-allowed" : "pointer", opacity: guardandoAgr ? 0.7 : 1 }}>
                    {guardandoAgr ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            )}

            {agregados.length === 0
              ? <div style={{ color:"#94A3B8", fontSize:13, textAlign:"center", padding:"16px 0" }}>Sin agregados registrados</div>
              : <div style={{ border:"1px solid #E2E8F0", borderRadius:10, overflow:"hidden" }}>
                  {agregados.map((a, i) => (
                    <div key={a.id} style={{ display:"flex", alignItems:"center", padding:"11px 14px", borderBottom: i < agregados.length-1 ? "1px solid #F1F5F9" : "none" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, color:"#1A2B4A", fontWeight:500 }}>{a.articulo}</div>
                        <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>{a.agregado_por_nombre} · {formatFechaAgr(a.fecha)}</div>
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, color:"#2563EB", background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:6, padding:"2px 10px", whiteSpace:"nowrap" }}>
                        {a.cantidad}{a.unidad ? ` ${a.unidad}` : ""}
                      </span>
                      {rol === "admin" && (
                        <button onClick={() => eliminarAgregado(a.id)}
                          style={{ background:"none", border:"none", color:"#CBD5E1", cursor:"pointer", fontSize:15, padding:"0 0 0 10px", flexShrink:0 }}
                          onMouseEnter={e => e.currentTarget.style.color="#EF4444"}
                          onMouseLeave={e => e.currentTarget.style.color="#CBD5E1"}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Acciones */}
          <div style={{ display:"flex", gap:8, marginTop:24, flexWrap:"wrap" }}>
            <button onClick={onEdit}
              style={{ padding:"9px 18px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontFamily:"'Inter', sans-serif", fontSize:13, fontWeight:500, cursor:"pointer" }}>
              Editar
            </button>
            <button onClick={() => generarPDF(obra)}
              style={{ padding:"9px 18px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontFamily:"'Inter', sans-serif", fontSize:13, fontWeight:500, cursor:"pointer" }}>
              Imprimir PDF
            </button>
            {obra.estado !== "terminado" && (
              <button onClick={onEntregada}
                style={{ padding:"9px 18px", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:8, color:"#059669", fontFamily:"'Inter', sans-serif", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                Marcar entregada
              </button>
            )}
            {rol === "admin" && (
              <button onClick={onDelete}
                style={{ padding:"9px 18px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontFamily:"'Inter', sans-serif", fontSize:13, fontWeight:500, cursor:"pointer" }}>
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GESTIÓN DE USUARIOS (solo admin) ────────────────────────────────────────
function GestionUsuarios({ onClose }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ nombre:"", email:"", password:"", rol:"operario" });
  const [msg, setMsg] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { getUsuarios().then(u => u && setUsuarios(u)).catch(() => {}); }, []);

  async function agregar() {
    if (!form.nombre || !form.email || !form.password) { setMsg("⚠️ Completá todos los campos"); return; }
    if (usuarios.find(u => u.email.toLowerCase() === form.email.toLowerCase())) { setMsg("⚠️ Ya existe ese email"); return; }
    setGuardando(true);
    try {
      const nuevo = { ...form, id: uid() };
      await upsertUsuario(nuevo);
      setUsuarios(u => [...u, nuevo]);
      setForm({ nombre:"", email:"", password:"", rol:"operario" });
      setMsg("✅ Usuario creado correctamente");
      setTimeout(() => setMsg(""), 3000);
    } catch { setMsg("⚠️ Error al guardar. Intentá de nuevo."); }
    setGuardando(false);
  }

  async function eliminar(id) {
    if (!confirm("¿Eliminar este usuario?")) return;
    try {
      await deleteUsuario(id);
      setUsuarios(u => u.filter(x => x.id !== id));
    } catch { alert("Error al eliminar."); }
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
              <div style={{ width:36, height:36, borderRadius:8, background: u.rol==="admin" ? "#1A2B4A" : "#0F766E", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:"#1A2B4A", fontSize:14, fontWeight:600 }}>{u.nombre}</div>
                <div style={{ color:"#94A3B8", fontSize:12 }}>{u.email}</div>
              </div>
              <span style={{ fontSize:10, fontWeight:700, color: u.rol==="admin" ? "#1A2B4A" : "#0F766E", background: u.rol==="admin" ? "#EFF6FF" : "#F0FDF4", border:`1px solid ${u.rol==="admin" ? "#DBEAFE" : "#BBF7D0"}`, borderRadius:4, padding:"2px 8px" }}>
                {u.rol === "admin" ? "ADMIN" : "OPERARIO"}
              </span>
              {u.id !== "admin" && (
                <button onClick={() => eliminar(u.id)} style={{ background:"none", border:"none", color:"#CBD5E1", cursor:"pointer", fontSize:15, padding:0 }}
                  onMouseEnter={e => e.currentTarget.style.color="#EF4444"}
                  onMouseLeave={e => e.currentTarget.style.color="#CBD5E1"}>✕</button>
              )}
            </div>
          ))}

          <div style={{ marginTop:20, paddingTop:20, borderTop:"1px solid #F1F5F9" }}>
            <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:14, fontWeight:700, color:"#1A2B4A", margin:"0 0 14px" }}>Agregar usuario</h3>
            {[
              { label:"Nombre completo", key:"nombre", ph:"Nombre completo" },
              { label:"Email", key:"email", ph:"email@empresa.com" },
              { label:"Contraseña", key:"password", ph:"Contraseña" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:10 }}>
                <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:5 }}>{f.label}</label>
                <input style={si} placeholder={f.ph} value={form[f.key]}
                  onChange={e => setForm(x => ({...x, [f.key]: e.target.value}))} />
              </div>
            ))}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:5 }}>Rol</label>
              <select value={form.rol} onChange={e => setForm(x => ({...x, rol: e.target.value}))} style={si}>
                <option value="operario">Operario</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {msg && (
              <div style={{ padding:"9px 13px", borderRadius:8, background: msg.startsWith("✅") ? "#ECFDF5" : "#FEF2F2", border:`1px solid ${msg.startsWith("✅") ? "#A7F3D0" : "#FECACA"}`, color: msg.startsWith("✅") ? "#059669" : "#DC2626", fontSize:13, marginBottom:12 }}>
                {msg}
              </div>
            )}
            <button onClick={agregar} disabled={guardando}
              style={{ width:"100%", padding:"11px", background: guardando ? "#94A3B8" : "#1A2B4A", border:"none", borderRadius:8, fontFamily:"'Inter', sans-serif", fontSize:14, fontWeight:600, color:"#ffffff", cursor: guardando ? "not-allowed" : "pointer" }}>
              {guardando ? "Guardando..." : "Agregar usuario"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CONFIGURACIÓN WHATSAPP ───────────────────────────────────────────────────
function ConfigWhatsApp({ obras, onClose }) {
  const [numero, setNumero] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const n = localStorage.getItem("mg_wa_numero");
    if (n) setNumero(n);
  }, []);

  async function guardar() {
    localStorage.setItem("mg_wa_numero", numero);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

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
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:"14px", textAlign:"center" }}>
              <div style={{ fontFamily:"'Sora', sans-serif", fontSize:28, fontWeight:800, color:"#DC2626" }}>{urgentes}</div>
              <div style={{ fontSize:11, color:"#EF4444", fontWeight:600, marginTop:4 }}>URGENTES</div>
            </div>
            <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:10, padding:"14px", textAlign:"center" }}>
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

          <button onClick={guardar}
            style={{ width:"100%", padding:"10px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color: saved ? "#059669" : "#475569", fontFamily:"'Inter', sans-serif", fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:10 }}>
            {saved ? "Número guardado" : "Guardar número"}
          </button>

          <button onClick={() => { enviarWhatsApp(obras, numero); onClose(); }}
            style={{ width:"100%", padding:"12px", background:"#25D366", border:"none", borderRadius:8, fontFamily:"'Inter', sans-serif", fontSize:14, fontWeight:700, color:"#fff", cursor:"pointer" }}>
            Enviar resumen ahora
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [sesion, setSesion] = useState(null);
  const [obras, setObras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filter, setFilter] = useState("todas");
  const [modalObra, setModalObra] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [showUsuarios, setShowUsuarios] = useState(false);
  const [showWA, setShowWA] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [waNumero, setWaNumero] = useState(localStorage.getItem("mg_wa_numero") || "");

  // Init
  useEffect(() => {
    (async () => {
      const s = getSesion();
      if (s) setSesion(s);
      try {
        const ob = await getObras();
        setObras(ob || []);
      } catch { setObras([]); }
      setCargando(false);
    })();
  }, []);

  async function recargarObras() {
    try { const ob = await getObras(); setObras(ob || []); } catch {}
  }

  function handleLogin(u) { setSesion(u); recargarObras(); }
  function handleLogout() { setSesionLocal(null); setSesion(null); }

  async function guardarObra(obra) {
    const existente = obras.find(o => o.id === obra.id);
    const obraFinal = {
      id: obra.id,
      nombre: obra.nombre,
      lugar: obra.lugar,
      fecha: obra.fecha,
      estado: obra.estado,
      muebles: obra.muebles,
      notas: obra.notas,
      creado_por: existente ? obra.creado_por : sesion.id,
      creado_en: existente ? obra.creado_en : new Date().toISOString(),
      editado_por: existente ? sesion.id : null,
      editado_en: existente ? new Date().toISOString() : null,
    };
    try {
      await upsertObra(obraFinal);
      await agregarHistorial({
        obra_id: obraFinal.id,
        obra_nombre: obraFinal.nombre,
        usuario_id: sesion.id,
        usuario_nombre: sesion.nombre,
        accion: existente ? "editó" : "creó",
        detalle: existente ? "Obra actualizada" : "Obra creada",
      });
      await recargarObras();
    } catch (e) { alert("Error al guardar. Verificá tu conexión."); return; }
    setModalObra(null);
    setDetalle(null);
  }

  async function eliminarObra(id) {
    if (!confirm("¿Eliminar esta obra?")) return;
    const obra = obras.find(o => o.id === id);
    try {
      await agregarHistorial({
        obra_id: null,
        obra_nombre: obra?.nombre || id,
        usuario_id: sesion.id,
        usuario_nombre: sesion.nombre,
        accion: "eliminó",
        detalle: "Obra eliminada",
      });
      await deleteObra(id);
      await recargarObras();
    } catch { alert("Error al eliminar."); return; }
    setDetalle(null);
  }

  async function marcarEntregada(id) {
    const obra = obras.find(o => o.id === id);
    try {
      await upsertObra({ ...obra, estado:"terminado", editado_por: sesion.id, editado_en: new Date().toISOString() });
      await agregarHistorial({
        obra_id: id,
        obra_nombre: obra?.nombre || id,
        usuario_id: sesion.id,
        usuario_nombre: sesion.nombre,
        accion: "marcó como entregada",
        detalle: "Estado: Terminado",
      });
      await recargarObras();
    } catch { alert("Error al actualizar."); return; }
    setDetalle(null);
  }

  async function verHistorial() {
    try {
      const h = await getHistorial();
      setHistorial(h || []);
    } catch { setHistorial([]); }
    setShowHistorial(true);
  }

  // Stats
  const activas = obras.filter(o => o.estado !== "terminado");
  const urgentes = activas.filter(o => { const d = diasRestantes(o.fecha); return d >= 0 && d <= 7; });
  const proximas = activas.filter(o => { const d = diasRestantes(o.fecha); return d > 7 && d <= 21; });
  const terminadas = obras.filter(o => o.estado === "terminado");
  const alertCount = urgentes.length + proximas.length;

  // Filter
  const obrasFiltradas = obras.filter(o => {
    if (filter === "todas") return true;
    const d = diasRestantes(o.fecha);
    const s = getStatus(d, o.estado);
    if (filter === "urgent") return s === "urgent" || s === "vencida";
    if (filter === "warning") return s === "warning";
    if (filter === "ok") return s === "ok";
    if (filter === "done") return s === "done";
    return true;
  }).sort((a, b) => {
    if (a.estado === "terminado" && b.estado !== "terminado") return 1;
    if (b.estado === "terminado" && a.estado !== "terminado") return -1;
    return new Date(a.fecha) - new Date(b.fecha);
  });

  if (cargando) return (
    <div style={{ minHeight:"100vh", background:"#F4F6F9", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@700&family=Inter:wght@400;500&display=swap'); * { box-sizing: border-box; }`}</style>
      <img src={LOGO_AIXA} alt="Obras Grupo Aixa S.A." style={{ height:40, marginBottom:8, opacity:0.7 }} />
      <div style={{ fontFamily:"'Inter', sans-serif", color:"#94A3B8", fontSize:13 }}>Cargando...</div>
    </div>
  );
  if (!sesion) return <Login onLogin={handleLogin} />;

  const isAdmin = sesion.rol === "admin";

  return (
    <div style={{ minHeight:"100vh", background:"#F4F6F9", fontFamily:"'Inter', sans-serif", color:"#1A2B4A" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #F4F6F9; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
        .obra-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(26,43,74,0.10) !important; border-color: #93C5FD !important; }
        .obra-card { transition: all 0.18s ease; }
        .btn-icon:hover { background: #EFF6FF !important; }
        .filter-btn:hover { background: #EFF6FF !important; }
      `}</style>

      {/* HEADER */}
      <header style={{ position:"sticky", top:0, zIndex:100, background:"#ffffff", borderBottom:"1px solid #E8ECF0", padding:"0 24px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <img src={LOGO_AIXA} alt="Obras Grupo Aixa S.A." style={{ height:36 }} />
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>

          {/* WhatsApp */}
          <button onClick={() => setShowWA(true)} className="btn-icon" title="Enviar alerta WhatsApp"
            style={{ position:"relative", background:"transparent", border:"1px solid #E8ECF0", borderRadius:8, width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            {alertCount > 0 && <div style={{ position:"absolute", top:6, right:6, background:"#22C55E", borderRadius:"50%", width:7, height:7 }} />}
          </button>

          {/* Notificaciones */}
          <div style={{ position:"relative" }}>
            <button onClick={() => setShowNotif(!showNotif)} className="btn-icon"
              style={{ position:"relative", background:"transparent", border:"1px solid #E8ECF0", borderRadius:8, width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {alertCount > 0 && (
                <div style={{ position:"absolute", top:5, right:5, background:"#EF4444", color:"#fff", fontSize:8, fontWeight:700, borderRadius:"50%", width:15, height:15, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter', sans-serif" }}>
                  {alertCount}
                </div>
              )}
            </button>
            {showNotif && (
              <div onClick={e => e.stopPropagation()} style={{ position:"absolute", top:46, right:0, background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:12, padding:"16px", width:300, maxHeight:380, overflowY:"auto", boxShadow:"0 12px 40px rgba(26,43,74,0.15)", zIndex:200 }}>
                <div style={{ fontSize:11, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, fontFamily:"'Inter', sans-serif", fontWeight:600 }}>Alertas activas</div>
                {alertCount === 0
                  ? <div style={{ color:"#94A3B8", fontSize:13, textAlign:"center", padding:"12px 0" }}>Sin alertas pendientes</div>
                  : [...urgentes, ...proximas].sort((a,b) => diasRestantes(a.fecha) - diasRestantes(b.fecha)).map(o => {
                    const d = diasRestantes(o.fecha);
                    const isUrg = d <= 7;
                    return (
                      <div key={o.id} onClick={() => { setDetalle(o); setShowNotif(false); }}
                        style={{ display:"flex", gap:10, alignItems:"center", padding:"10px 12px", background: isUrg ? "#FEF2F2" : "#FFFBEB", borderRadius:8, marginBottom:6, cursor:"pointer", border:`1px solid ${isUrg ? "#FECACA" : "#FDE68A"}` }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background: isUrg ? "#EF4444" : "#F59E0B", flexShrink:0 }} />
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, color:"#1A2B4A", fontWeight:500 }}>{o.nombre}</div>
                          <div style={{ fontSize:11, color: isUrg ? "#EF4444" : "#F59E0B", fontWeight:600 }}>{d === 0 ? "Entrega hoy" : `${d} días`}</div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>

          {/* Historial */}
          {isAdmin && (
            <button onClick={verHistorial} className="btn-icon" title="Historial de cambios"
              style={{ background:"transparent", border:"1px solid #E8ECF0", borderRadius:8, width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </button>
          )}

          {/* Divider */}
          <div style={{ width:1, height:24, background:"#E8ECF0", margin:"0 4px" }} />

          {/* Usuario */}
          <div onClick={isAdmin ? () => setShowUsuarios(true) : undefined}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 12px 6px 8px", background:"#F8FAFC", border:"1px solid #E8ECF0", borderRadius:8, cursor: isAdmin ? "pointer" : "default" }}>
            <div style={{ width:26, height:26, borderRadius:6, background: isAdmin ? "#1A2B4A" : "#0F766E", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span style={{ fontSize:13, color:"#1A2B4A", fontWeight:500, maxWidth:90, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sesion.nombre.split(" ")[0]}</span>
            {isAdmin && <span style={{ fontSize:10, color:"#94A3B8", background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:4, padding:"1px 6px", fontWeight:600 }}>ADMIN</span>}
          </div>

          <button onClick={handleLogout}
            style={{ background:"transparent", border:"1px solid #E8ECF0", borderRadius:8, padding:"7px 14px", color:"#64748B", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            Salir
          </button>
        </div>
      </header>

      {showNotif && <div onClick={() => setShowNotif(false)} style={{ position:"fixed", inset:0, zIndex:99 }} />}

      <main style={{ maxWidth:1200, margin:"0 auto", padding:"28px 24px 100px" }}>

        {/* STATS */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:32 }}>
          {[
            { num: activas.length, label:"Obras en curso", color:"#2563EB", bg:"#EFF6FF", border:"#DBEAFE" },
            { num: urgentes.length, label:"Urgentes", color:"#DC2626", bg:"#FEF2F2", border:"#FECACA" },
            { num: proximas.length, label:"Próximas", color:"#D97706", bg:"#FFFBEB", border:"#FDE68A" },
            { num: terminadas.length, label:"Entregadas", color:"#059669", bg:"#ECFDF5", border:"#A7F3D0" },
          ].map((s, i) => (
            <div key={i} style={{ background:"#ffffff", border:`1px solid ${s.border}`, borderRadius:12, padding:"20px 20px 18px", animation:`fadeUp 0.35s ease ${i*0.06}s both` }}>
              <div style={{ fontFamily:"'Sora', sans-serif", fontSize:32, fontWeight:800, color:s.color, lineHeight:1 }}>{s.num}</div>
              <div style={{ fontSize:12, color:"#64748B", fontWeight:500, marginTop:6, letterSpacing:0.2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ALERTAS */}
        {(urgentes.length > 0 || proximas.length > 0) && (
          <div style={{ marginBottom:28, background:"#ffffff", border:"1px solid #FECACA", borderRadius:12, overflow:"hidden" }}>
            <div style={{ padding:"12px 20px", background:"#FEF2F2", borderBottom:"1px solid #FECACA", display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#EF4444" }} />
              <span style={{ fontSize:12, fontWeight:600, color:"#DC2626", letterSpacing:0.5 }}>ENTREGAS PRÓXIMAS</span>
            </div>
            {[...urgentes, ...proximas].sort((a,b) => diasRestantes(a.fecha)-diasRestantes(b.fecha)).map((o, i) => {
              const d = diasRestantes(o.fecha);
              const isUrg = d <= 7;
              return (
                <div key={o.id} onClick={() => setDetalle(o)}
                  style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 20px", borderBottom: i < urgentes.length + proximas.length - 1 ? "1px solid #F1F5F9" : "none", cursor:"pointer", transition:"background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background="#FAFBFC"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:"#1A2B4A" }}>{o.nombre}</div>
                    <div style={{ fontSize:12, color:"#64748B", marginTop:2 }}>{o.lugar}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:13, fontWeight:700, color: isUrg ? "#DC2626" : "#D97706" }}>
                      {d === 0 ? "HOY" : `${d} días`}
                    </div>
                    <div style={{ fontSize:11, color:"#94A3B8" }}>{formatDate(o.fecha)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FILTROS + TÍTULO */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>Obras</h2>
          <div style={{ display:"flex", gap:4, background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:10, padding:4 }}>
            {[
              { key:"todas", label:"Todas" },
              { key:"urgent", label:"Urgentes" },
              { key:"warning", label:"Próximas" },
              { key:"ok", label:"A tiempo" },
              { key:"done", label:"Entregadas" },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} className="filter-btn"
                style={{ padding:"6px 14px", borderRadius:7, border:"none", background: filter===f.key ? "#1A2B4A" : "transparent", color: filter===f.key ? "#ffffff" : "#64748B", fontFamily:"'Inter', sans-serif", fontSize:12, fontWeight: filter===f.key ? 600 : 400, cursor:"pointer", transition:"all 0.15s" }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* GRID OBRAS */}
        {obrasFiltradas.length === 0
          ? (
            <div style={{ textAlign:"center", padding:"80px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
              <div style={{ fontSize:13, color:"#94A3B8", marginBottom:6 }}>No hay obras en esta categoría</div>
              <div style={{ fontSize:12, color:"#CBD5E1" }}>Usá el botón + para agregar una nueva</div>
            </div>
          )
          : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:16 }}>
              {obrasFiltradas.map((o, idx) => {
                const d = diasRestantes(o.fecha);
                const status = getStatus(d, o.estado);
                const sm = STATUS_META[status];
                const statusColors = {
                  urgent: { bg:"#FEF2F2", text:"#DC2626", border:"#FECACA" },
                  vencida: { bg:"#FEF2F2", text:"#DC2626", border:"#FECACA" },
                  warning: { bg:"#FFFBEB", text:"#D97706", border:"#FDE68A" },
                  ok: { bg:"#ECFDF5", text:"#059669", border:"#A7F3D0" },
                  done: { bg:"#F8FAFC", text:"#64748B", border:"#E2E8F0" },
                };
                const sc = statusColors[status] || statusColors.ok;
                const diasLabel = o.estado === "terminado" ? "Entregada" : d < 0 ? `Vencida` : d === 0 ? "Hoy" : `${d} días`;
                return (
                  <div key={o.id} className="obra-card" onClick={() => setDetalle(o)}
                    style={{ background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:14, overflow:"hidden", cursor:"pointer", animation:`fadeUp 0.35s ease ${idx*0.04}s both`, boxShadow:"0 1px 4px rgba(26,43,74,0.05)" }}>

                    {/* Barra de estado */}
                    <div style={{ height:4, background:sm.color }} />

                    <div style={{ padding:"18px 18px 16px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                        <div style={{ fontFamily:"'Sora', sans-serif", fontSize:15, fontWeight:700, color:"#1A2B4A", flex:1, lineHeight:1.35, paddingRight:10 }}>{o.nombre}</div>
                        <div style={{ padding:"3px 10px", borderRadius:6, background:sc.bg, color:sc.text, fontSize:11, fontWeight:700, border:`1px solid ${sc.border}`, whiteSpace:"nowrap", flexShrink:0, fontFamily:"'Inter', sans-serif" }}>
                          {diasLabel}
                        </div>
                      </div>

                      <div style={{ fontSize:12, color:"#64748B", marginBottom:4, display:"flex", alignItems:"center", gap:6 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {o.lugar}
                      </div>
                      <div style={{ fontSize:12, color:"#64748B", marginBottom:14, display:"flex", alignItems:"center", gap:6 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {formatDate(o.fecha)}
                      </div>

                      {(o.muebles||[]).length > 0 && (
                        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:14 }}>
                          {normalizarMuebles(o.muebles||[]).slice(0,3).map((m,i) => (
                            <div key={i} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:4, padding:"2px 8px", fontSize:11, color:"#475569" }}>
                              {m.nombre}{m.cantidad > 1 ? ` ×${m.cantidad}` : ""}
                            </div>
                          ))}
                          {(o.muebles||[]).length > 3 && <div style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:4, padding:"2px 8px", fontSize:11, color:"#94A3B8" }}>+{(o.muebles||[]).length - 3}</div>}
                        </div>
                      )}

                      <div onClick={e => e.stopPropagation()} style={{ display:"flex", gap:6, paddingTop:12, borderTop:"1px solid #F1F5F9" }}>
                        <button onClick={() => setModalObra(o)}
                          style={{ flex:1, padding:"7px 0", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
                          Editar
                        </button>
                        <button onClick={() => generarPDF(o)}
                          style={{ flex:1, padding:"7px 0", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
                          PDF
                        </button>
                        {o.estado !== "terminado" && (
                          <button onClick={() => marcarEntregada(o.id)}
                            style={{ flex:1, padding:"7px 0", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:8, color:"#059669", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
                            Entregar
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => eliminarObra(o.id)}
                            style={{ padding:"7px 10px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:12, cursor:"pointer" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </main>

      {/* FAB */}
      <button onClick={() => setModalObra("nueva")}
        style={{ position:"fixed", bottom:28, right:24, height:48, padding:"0 22px", borderRadius:12, background:"#1A2B4A", border:"none", fontSize:13, fontWeight:600, color:"#ffffff", boxShadow:"0 4px 20px rgba(26,43,74,0.35)", cursor:"pointer", zIndex:200, display:"flex", alignItems:"center", gap:8, fontFamily:"'Inter', sans-serif", letterSpacing:0.2, transition:"all 0.18s" }}
        onMouseEnter={e => { e.currentTarget.style.background="#2563EB"; e.currentTarget.style.boxShadow="0 6px 24px rgba(37,99,235,0.4)"; }}
        onMouseLeave={e => { e.currentTarget.style.background="#1A2B4A"; e.currentTarget.style.boxShadow="0 4px 20px rgba(26,43,74,0.35)"; }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nueva obra
      </button>

      {/* MODALES */}
      {modalObra && (
        <ModalObra
          obra={modalObra === "nueva" ? null : modalObra}
          onClose={() => setModalObra(null)}
          onSave={guardarObra}
        />
      )}

      {detalle && (
        <DetalleObra
          obra={obras.find(o => o.id === detalle.id) || detalle}
          rol={sesion.rol}
          sesion={sesion}
          onClose={() => setDetalle(null)}
          onEdit={() => { setModalObra(obras.find(o => o.id === detalle.id)); setDetalle(null); }}
          onDelete={() => eliminarObra(detalle.id)}
          onEntregada={() => marcarEntregada(detalle.id)}
        />
      )}

      {showUsuarios && isAdmin && <GestionUsuarios onClose={() => setShowUsuarios(false)} />}
      {showWA && <ConfigWhatsApp obras={obras} onClose={() => setShowWA(false)} />}

      {/* HISTORIAL PANEL */}
      {showHistorial && (
        <div onClick={e => e.target === e.currentTarget && setShowHistorial(false)} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:520, maxHeight:"85vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
            <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"#ffffff", borderRadius:"14px 14px 0 0" }}>
              <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>Historial de cambios</h2>
              <button onClick={() => setShowHistorial(false)} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:"8px 24px 24px" }}>
              {historial.length === 0
                ? <div style={{ color:"#94A3B8", fontSize:13, textAlign:"center", padding:"40px 0" }}>Sin cambios registrados aún</div>
                : historial.map(h => (
                  <div key={h.id} style={{ display:"flex", gap:14, padding:"14px 0", borderBottom:"1px solid #F8FAFC" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background: h.accion==="eliminó" ? "#EF4444" : h.accion==="creó" ? "#059669" : "#2563EB", flexShrink:0, marginTop:5 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, color:"#1A2B4A", lineHeight:1.5 }}>
                        <span style={{ fontWeight:600 }}>{h.usuario_nombre}</span>
                        <span style={{ color:"#64748B" }}> {h.accion} </span>
                        <span style={{ fontWeight:600 }}>{h.obra_nombre}</span>
                      </div>
                      {h.detalle && <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>{h.detalle}</div>}
                      <div style={{ fontSize:11, color:"#CBD5E1", marginTop:4 }}>
                        {new Date(h.fecha).toLocaleDateString("es-AR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
