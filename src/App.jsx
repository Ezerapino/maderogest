import { useState, useEffect, useCallback, useRef } from "react";

// ─── LOGO ─────────────────────────────────────────────────────────────────────
const LOGO_AIXA = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABR5VFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABFAEsDASIAAhEBAxEB/8QAGwABAAMBAQEBAAAAAAAAAAAAAAEGBwgFAgT/xAA2EAABAgUBBQUGBQUAAAAAAAABAgMABAUGEQcIEiExUTdBYXWzExQiUnShFSM2cbEyQmKBo//EABkBAQADAQEAAAAAAAAAAAAAAAABBAYFAv/EACYRAAICAQMDAwUAAAAAAAAAAAABAhEDBAUSITFSFHKxIlFhcYH/2gAMAwEAAhEDEQA/AOM8nrDJ6xEI9gnJ6wyesRCAJyesMnrEQgCcnrDJ6xEIA1DZs/XM75Yv1Wo8LU+bYa1ArSF0yUfUJk5WtToUeA+VYH2j3dmv9czvli/Vair6r9otb+pP8COalesl+kccEVLcpp+KKvCEI6R2RCNR1g0crOnVkWZck+VrTX5MrmmynHukwfjS0eHAlpSOB47yXO4CPz29p3T6ls+3LqS5UJpE7SKoxJNSqUp9k4lwt5UTzyN88ukAZtCNkquijtZp9iVjTiZm6zTrrUJNz3hKd+QnkI5LrbhSMBISFKCsckKPLEUvWKg2za1/1C3LVq01V5OnKEu9OPBIDr6eDm4E/2A/COecE8sQsFPhGpa y6O1jTi0LPr0+pS/xuTKpxs4zKTOSsNHp+Upvn3pX3YjLYA1PZlZefvueQw046oUxwkISVHHtWukeDqnMNy2obecfpMs44maUFKdLoVyHMBYH2i8bG3adUvJnfWYika79r9y/Wn+BGfx6pz3jJp2uignf9RM9pgoeu5O5fTXbsUmNU2XbIlLz1UlV1ktt27RG1VWsPO8G0sM/FuqPLClboP+O8e6Mriz25fVw29Z9ftWkvsy0hX0toqKg0PbOIQchAXzCeJyBzCjnnGgIOupuVoeqkrqLai9T7buOeueY/FLdkJYuJck5lhshtIKgAQWkIQojuSo44mMfs5l2X2JtRZd9tbTrVyyqFoWMKSoKYBBHcQYxK06/VLWuWn3FRZky1Rp76X5dzGQFJPIjvB5EciCRFmq2q121Oh3DRJpch7hcVTTVKky3KpQHJgFJ3gRxSCUgkDqYigdG7KzSLF0uZpt0XPNUKb1KmXJe3mkAZk8MrQJziPhK1KQgHv/LPI5TlGhmlMydf5ykXu2iUplmrcqNee e4NBpg7yck80LO6fFGTGb6g35cl81+XrVenEGZlJduWlUSzQZbl2m/6UtoTgJAJJ4d5iy3PrnqDcdFq1LqU7IYrMsxLVKZZkW25iabZJLYW4Bk4yf3BI5QB0jNydG1Upmodoq1Otu5qlcs0avb0jKe0S5KTLDeEpSVjBBabQg+AUe+OJH2nGHlsvIU242opWhQwUkHBBHWPStK4KratzU+4qJMmWqNPfS/LuYyAodxB5gjII7wSI+bqrc5clx1Cv1FLAnahMKmJj2LYbQpxRypQSOAycn9zEoGtbG3adUvJnfWYip63zbDWrNyIXTJR9QnVZWtToUeA+VYH2i07HbqGtTKipxW6DRnR/wBmYpWuikr1cuRSTkGdOD/oRm8WlzLe8uZwfBwSUqdN2ul9r/Bfy58GTQxwc1zUraT6196TuilQhCNIUBCEIAQhCAEIQgDYNkztFqHlDnrMxWtYpthrU64ELpko8oTasrWp0KPAfKsD7RZdkztFqHlDnrMxT9ae1S4fqz/Ai7lV6KPuM9jipbzkT8F8oqO74w3fGEIpGhG74w3fGEIAbvjDd8YQgBu+MN3xhCANf2TRjUWoeUOeszFZ1im2GtTrgQumSjyhNqytanQo8B8qwPtCEXcqvRR9xn8cVLeMl+C+Uf/Z";

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

// ─── SESION LOCAL ─────────────────────────────────────────────────────────────
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
function generarPDF(obra) {
  const dias = diasRestantes(obra.fecha);
  const status = getStatus(dias, obra.estado);
  const sm = STATUS_META[status];

  const estilos = `
    body { font-family: Georgia, serif; color: #1e293b; margin: 0; padding: 0; }
    .portada { background: #1e293b; color: #1e293b; padding: 48px 48px 36px; min-height: 160px; }
    .logo { font-size: 28px; font-weight: bold; letter-spacing: 2px; color: #1e40af; }
    .logo span { color: #1e293b; }
    .obra-titulo { font-size: 26px; margin: 20px 0 6px; font-style: italic; }
    .obra-subtitulo { font-size: 13px; color: #8a7860; letter-spacing: 1px; text-transform: uppercase; }
    .cuerpo { padding: 36px 48px; }
    .status-badge { display: inline-block; padding: 5px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; letter-spacing: 1px; background: ${sm.bg}; color: ${sm.color}; border: 1px solid ${sm.color}; margin-bottom: 24px; }
    .grid-datos { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 32px; border-bottom: 1px solid #e0d4bc; padding-bottom: 28px; }
    .dato-item .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #8a7860; margin-bottom: 4px; }
    .dato-item .valor { font-size: 15px; font-weight: bold; color: #1e293b; }
    .seccion-titulo { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #8a7860; border-bottom: 1px solid #e0d4bc; padding-bottom: 8px; margin-bottom: 16px; }
    .mueble-row { display: flex; align-items: flex-start; padding: 10px 0; border-bottom: 1px dotted #e8d8c0; }
    .mueble-num { width: 30px; font-size: 12px; color: #1e40af; font-weight: bold; }
    .mueble-icon { width: 26px; font-size: 16px; }
    .mueble-nombre { flex: 1; font-size: 14px; }
    .mueble-check { width: 24px; height: 24px; border: 1.5px solid #1e40af; border-radius: 4px; margin-left: 12px; }
    .notas-box { background: #faf6ef; border-left: 3px solid #1e40af; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-top: 28px; font-size: 13px; line-height: 1.7; color: #3a2e1e; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e0d4bc; display: flex; justify-content: space-between; font-size: 11px; color: #8a7860; }
    .firma-box { margin-top: 48px; display: flex; justify-content: space-between; }
    .firma { text-align: center; }
    .firma-linea { width: 160px; border-bottom: 1px solid #1e293b; margin-bottom: 6px; height: 36px; }
    .firma-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #8a7860; }
  `;

  const diasLabel = obra.estado === "terminado" ? "Entregada" : dias < 0 ? `Vencida hace ${Math.abs(dias)} días` : dias === 0 ? "¡Entrega HOY!" : `${dias} días para entrega`;

  const mueblesList = normalizarMuebles(obra.muebles || []);
  const totalUnidades = mueblesList.reduce((a, m) => a + (m.cantidad||1), 0);
  const mueblesHTML = mueblesList.map((m, i) => `
    <div class="mueble-row">
      <div class="mueble-num">${String(i+1).padStart(2,"0")}</div>
      <div class="mueble-icon">${muebleIcon(m.nombre)}</div>
      <div class="mueble-nombre">${m.nombre}${m.cantidad > 1 ? ` <span style="color:#1e40af;font-weight:bold">×${m.cantidad}</span>` : ""}</div>
      <div class="mueble-check"></div>
    </div>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Orden de Entrega – ${obra.nombre}</title>
<style>${estilos}</style></head>
<body>
<div class="portada">
  <div class="logo">Obras Grupo Aixa S.A.</span></div>
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
  ${mueblesList.length === 0 ? '<p style="color:#8a7860;font-size:13px">Sin muebles registrados.</p>' : mueblesHTML}

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

  if (urgentes.length === 0 && proximas.length === 0) {
    alert("No hay obras con fechas próximas para alertar.");
    return;
  }

  let msg = `🪵 *Obras Grupo Aixa – Resumen Diario*\n📅 ${new Date().toLocaleDateString("es-AR",{weekday:"long",day:"2-digit",month:"long"})}\n\n`;

  if (urgentes.length > 0) {
    msg += `🚨 *URGENTES (≤7 días):*\n`;
    urgentes.sort((a,b) => diasRestantes(a.fecha) - diasRestantes(b.fecha)).forEach(o => {
      const d = diasRestantes(o.fecha);
      const total = normalizarMuebles(o.muebles||[]).reduce((a,m) => a+(m.cantidad||1), 0);
      msg += `• *${o.nombre}*\n  📍 ${o.lugar}\n  📅 ${formatDate(o.fecha)} – ${d === 0 ? "¡HOY!" : `${d} días`}\n  🪵 ${(o.muebles||[]).length} tipos · ${total} unidades\n\n`;
    });
  }
  if (proximas.length > 0) {
    msg += `⏰ *PRÓXIMAS (≤21 días):*\n`;
    proximas.forEach(o => {
      msg += `• *${o.nombre}* – ${diasRestantes(o.fecha)} días\n  📍 ${o.lugar}\n\n`;
    });
  }
  msg += `_Total en curso: ${activas.length} obras_`;

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

  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", padding:20, fontFamily:"'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');`}</style>
      <div style={{ width:"100%", maxWidth:400 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <img src={LOGO_AIXA} alt="Obras Grupo Aixa S.A." style={{ height:56, marginBottom:12 }} />
          <div style={{ color:"#94a3b8", fontSize:13, letterSpacing:3, textTransform:"uppercase", marginTop:6 }}>Gestión de Obras</div>
        </div>

        {/* Card */}
        <div style={{ background:"#ffffff", border:"1px solid #e2e8f0", borderRadius:20, padding:"32px 28px", boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ color:"#1e293b", fontFamily:"'Playfair Display', serif", fontSize:20, marginBottom:24 }}>Iniciar sesión</div>

          {[
            { label:"Email", val:email, set:setEmail, type:"email", ph:"tu@fabrica.com" },
            { label:"Contraseña", val:pass, set:setPass, type:"password", ph:"••••••••" },
          ].map(f => (
            <div key={f.label} style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>{f.label}</label>
              <input
                type={f.type} value={f.val} placeholder={f.ph}
                onChange={e => { f.set(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                style={{ width:"100%", padding:"12px 14px", background:"#eef2ff", border:"1px solid rgba(30,64,175,0.18)", borderRadius:10, color:"#1e293b", fontFamily:"'DM Sans', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box" }}
              />
            </div>
          ))}

          {error && <div style={{ color:"#e05555", fontSize:13, marginBottom:14, padding:"8px 12px", background:"rgba(224,85,85,0.1)", borderRadius:8 }}>⚠️ {error}</div>}

          <button onClick={handleLogin} disabled={cargando} style={{ width:"100%", padding:14, background:"linear-gradient(135deg,#1e40af,#3b82f6)", border:"none", borderRadius:12, fontFamily:"'Playfair Display', serif", fontSize:16, fontWeight:700, color:"#ffffff", cursor: cargando ? "not-allowed" : "pointer", marginTop:8, opacity: cargando ? 0.7 : 1 }}>
            {cargando ? "Verificando..." : "Ingresar →"}
          </button>

          <div style={{ marginTop:16, fontSize:12, color:"#94a3b8", textAlign:"center" }}>
            Usuario inicial: <b style={{color:"#1e40af"}}>admin@fabrica.com</b> / admin123
          </div>
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
      <label style={{ display:"block", fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>{label}</label>
      <input type={type} value={form[key]} placeholder={ph}
        onChange={e => { setForm(f => ({...f, [key]: e.target.value})); setErrors(er => ({...er,[key]:""})); }}
        style={{ width:"100%", padding:"11px 14px", background:"#f8fafc", border:`1px solid ${errors[key] ? "#e05555" : "rgba(30,64,175,0.2)"}`, borderRadius:10, color:"#1e293b", fontFamily:"'DM Sans', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box" }}
      />
      {errors[key] && <div style={{ color:"#e05555", fontSize:11, marginTop:3 }}>{errors[key]}</div>}
    </div>
  );

  const totalMuebles = form.muebles.reduce((acc, m) => acc + (m.cantidad || 1), 0);

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(8px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", border:"1px solid rgba(30,64,175,0.2)", borderRadius:20, padding:"28px 24px", width:"100%", maxWidth:540, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, color:"#1e40af" }}>{obra ? "Editar Obra" : "Nueva Obra"}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#94a3b8", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>
        {inp("Nombre de la obra", "nombre", "text", "Ej: Departamento Ramos Mejía")}
        {inp("Dirección / Lugar", "lugar", "text", "Calle, número, barrio...")}
        {inp("Fecha de entrega", "fecha", "date")}

        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Estado</label>
          <select value={form.estado} onChange={e => setForm(f => ({...f, estado: e.target.value}))}
            style={{ width:"100%", padding:"11px 14px", background:"#f8fafc", border:"1px solid rgba(30,64,175,0.2)", borderRadius:10, color:"#1e293b", fontFamily:"'DM Sans', sans-serif", fontSize:14, outline:"none" }}>
            <option value="pendiente">Pendiente</option>
            <option value="en_proceso">En proceso</option>
            <option value="terminado">Terminado</option>
          </select>
        </div>

        {/* MUEBLES */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <label style={{ fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1 }}>Muebles</label>
            {form.muebles.length > 0 && (
              <span style={{ fontSize:11, color:"#64748b" }}>{form.muebles.length} tipos · {totalMuebles} unidades</span>
            )}
          </div>

          {/* Fila agregar */}
          <div style={{ display:"flex", gap:8 }}>
            <input value={muebleInput} placeholder="Nombre del mueble" onChange={e => setMuebleInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addMueble(); }}}
              style={{ flex:1, padding:"11px 14px", background:"#f8fafc", border:"1px solid rgba(30,64,175,0.2)", borderRadius:10, color:"#1e293b", fontFamily:"'DM Sans', sans-serif", fontSize:14, outline:"none" }}
            />
            <input value={cantInput} type="number" min="1" max="999" placeholder="Cant."
              onChange={e => setCantInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addMueble(); }}}
              style={{ width:68, padding:"11px 10px", background:"#f8fafc", border:"1px solid rgba(30,64,175,0.2)", borderRadius:10, color:"#1e40af", fontFamily:"'DM Sans', sans-serif", fontSize:14, outline:"none", textAlign:"center", fontWeight:700 }}
            />
            <button onClick={addMueble} style={{ padding:"11px 16px", background:"#eef2ff", border:"1px solid rgba(30,64,175,0.2)", borderRadius:10, color:"#1e40af", fontSize:20, cursor:"pointer" }}>＋</button>
          </div>
          <div style={{ display:"flex", gap:4, marginTop:5 }}>
            <div style={{ flex:1, fontSize:10, color:"#94a3b8", textAlign:"left", paddingLeft:4 }}>Nombre del mueble</div>
            <div style={{ width:68, fontSize:10, color:"#94a3b8", textAlign:"center" }}>Cantidad</div>
            <div style={{ width:46 }} />
          </div>

          {/* Lista de muebles editables */}
          {form.muebles.length > 0 && (
            <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:6 }}>
              {form.muebles.map((m, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:"#f8fafc", border:"1px solid rgba(30,64,175,0.15)", borderRadius:10, padding:"6px 8px 6px 12px" }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>{muebleIcon(m.nombre)}</span>
                  <input
                    value={m.nombre}
                    onChange={e => updateNombre(i, e.target.value)}
                    style={{ flex:1, background:"transparent", border:"none", color:"#1e293b", fontFamily:"'DM Sans', sans-serif", fontSize:13, outline:"none", minWidth:0 }}
                  />
                  {/* Botones cantidad */}
                  <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                    <button onClick={() => updateCantidad(i, m.cantidad - 1)}
                      style={{ width:24, height:24, background:"#eef2ff", border:"1px solid rgba(30,64,175,0.2)", borderRadius:6, color:"#1e40af", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, padding:0 }}>−</button>
                    <input
                      type="number" min="1" max="999" value={m.cantidad}
                      onChange={e => updateCantidad(i, e.target.value)}
                      style={{ width:44, textAlign:"center", background:"#eef2ff", border:"1px solid rgba(30,64,175,0.25)", borderRadius:6, color:"#1e40af", fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight:700, outline:"none", padding:"3px 4px" }}
                    />
                    <button onClick={() => updateCantidad(i, m.cantidad + 1)}
                      style={{ width:24, height:24, background:"#eef2ff", border:"1px solid rgba(30,64,175,0.2)", borderRadius:6, color:"#1e40af", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, padding:0 }}>＋</button>
                  </div>
                  <button onClick={() => rmMueble(i)} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:14, padding:"0 2px", flexShrink:0 }}
                    onMouseEnter={e => e.currentTarget.style.color="#e05555"}
                    onMouseLeave={e => e.currentTarget.style.color="#94a3b8"}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ display:"block", fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Notas</label>
          <textarea value={form.notas} rows={3} placeholder="Observaciones, detalles de acceso..."
            onChange={e => setForm(f => ({...f, notas: e.target.value}))}
            style={{ width:"100%", padding:"11px 14px", background:"#f8fafc", border:"1px solid rgba(30,64,175,0.2)", borderRadius:10, color:"#1e293b", fontFamily:"'DM Sans', sans-serif", fontSize:14, outline:"none", resize:"vertical", boxSizing:"border-box" }}
          />
        </div>

        <button onClick={handleSave} style={{ width:"100%", padding:14, background:"linear-gradient(135deg,#1e40af,#3b82f6)", border:"none", borderRadius:12, fontFamily:"'Playfair Display', serif", fontSize:16, fontWeight:700, color:"#ffffff", cursor:"pointer" }}>
          💾 Guardar Obra
        </button>
      </div>
    </div>
  );
}

// ─── DETALLE OBRA ─────────────────────────────────────────────────────────────
function DetalleObra({ obra, onClose, onEdit, onDelete, onEntregada, rol }) {
  const dias = diasRestantes(obra.fecha);
  const status = getStatus(dias, obra.estado);
  const sm = STATUS_META[status];
  const diasLabel = obra.estado === "terminado" ? "Entregada" : dias < 0 ? `Vencida hace ${Math.abs(dias)} días` : dias === 0 ? "¡Entrega HOY!" : `${dias} días para entrega`;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(10px)", zIndex:400, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0" }}>
      <div style={{ background:"#ffffff", border:"1px solid rgba(30,64,175,0.2)", borderRadius:"24px 24px 0 0", padding:"28px 24px 40px", width:"100%", maxWidth:600, maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, color:"#1e293b", flex:1, lineHeight:1.2 }}>{obra.nombre}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#94a3b8", fontSize:20, cursor:"pointer", marginLeft:10 }}>✕</button>
        </div>

        <div style={{ display:"inline-block", padding:"5px 16px", borderRadius:20, background:sm.bg, color:sm.color, fontSize:12, fontWeight:700, letterSpacing:1, marginBottom:20, border:`1px solid ${sm.color}40` }}>
          {sm.icon} {sm.label} — {diasLabel}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:24 }}>
          {[
            { label:"📍 Lugar", val: obra.lugar },
            { label:"📅 Fecha", val: formatDate(obra.fecha) },
            { label:"⚙️ Estado", val: ESTADO_LABELS[obra.estado] },
            { label:"🪵 Muebles", val: `${(obra.muebles||[]).length} ítems` },
          ].map(d => (
            <div key={d.label} style={{ background:"#f8fafc", border:"1px solid rgba(30,64,175,0.12)", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:10, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{d.label}</div>
              <div style={{ fontSize:14, color:"#1e293b", fontWeight:500 }}>{d.val}</div>
            </div>
          ))}
        </div>

        {obra.notas && (
          <div style={{ background:"#f8fafc", borderLeft:"3px solid #1e40af", padding:"12px 16px", borderRadius:"0 10px 10px 0", marginBottom:20, fontSize:13, color:"#475569", lineHeight:1.7 }}>
            📝 {obra.notas}
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1 }}>Lista de muebles</div>
          {(obra.muebles||[]).length > 0 && (
            <div style={{ fontSize:11, color:"#64748b" }}>
              {normalizarMuebles(obra.muebles).reduce((a,m) => a + (m.cantidad||1), 0)} unidades totales
            </div>
          )}
        </div>
        {(obra.muebles||[]).length === 0
          ? <div style={{ color:"#94a3b8", fontSize:13 }}>Sin muebles registrados</div>
          : normalizarMuebles(obra.muebles).map((m, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid rgba(30,64,175,0.08)" }}>
              <div style={{ fontSize:20 }}>{muebleIcon(m.nombre)}</div>
              <div style={{ flex:1, color:"#1e293b", fontSize:14 }}>{m.nombre}</div>
              {m.cantidad > 1 && (
                <div style={{ background:"rgba(30,64,175,0.15)", border:"1px solid rgba(30,64,175,0.3)", borderRadius:8, padding:"2px 10px", fontSize:13, fontWeight:700, color:"#1e40af" }}>
                  x{m.cantidad}
                </div>
              )}
            </div>
          ))
        }

        <div style={{ display:"flex", gap:10, marginTop:24, flexWrap:"wrap" }}>
          <button onClick={onEdit} style={{ padding:"9px 18px", background:"#eef2ff", border:"1px solid rgba(30,64,175,0.25)", borderRadius:10, color:"#1e40af", fontFamily:"'DM Sans', sans-serif", fontSize:13, cursor:"pointer" }}>✏️ Editar</button>
          <button onClick={() => { generarPDF(obra); }} style={{ padding:"9px 18px", background:"#eef2ff", border:"1px solid rgba(30,64,175,0.25)", borderRadius:10, color:"#2563eb", fontFamily:"'DM Sans', sans-serif", fontSize:13, cursor:"pointer" }}>🖨️ Imprimir PDF</button>
          {obra.estado !== "terminado" && (
            <button onClick={onEntregada} style={{ padding:"9px 18px", background:"rgba(74,154,106,0.15)", border:"1px solid rgba(74,154,106,0.3)", borderRadius:10, color:"#80c090", fontFamily:"'DM Sans', sans-serif", fontSize:13, cursor:"pointer" }}>✅ Entregada</button>
          )}
          {rol === "admin" && (
            <button onClick={onDelete} style={{ padding:"9px 18px", background:"rgba(224,85,85,0.12)", border:"1px solid rgba(224,85,85,0.25)", borderRadius:10, color:"#f08080", fontFamily:"'DM Sans', sans-serif", fontSize:13, cursor:"pointer" }}>🗑️ Eliminar</button>
          )}
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

  const si = { width:"100%", padding:"10px 13px", background:"#f8fafc", border:"1px solid rgba(30,64,175,0.2)", borderRadius:9, color:"#1e293b", fontFamily:"'DM Sans', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(8px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", border:"1px solid rgba(30,64,175,0.2)", borderRadius:20, padding:"28px 24px", width:"100%", maxWidth:480, maxHeight:"88vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, color:"#1e40af" }}>👥 Equipo</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#94a3b8", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>

        {usuarios.map(u => (
          <div key={u.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"#f8fafc", border:"1px solid rgba(30,64,175,0.12)", borderRadius:12, marginBottom:8 }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background: u.rol==="admin" ? "rgba(30,64,175,0.25)" : "rgba(74,154,106,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>
              {u.rol === "admin" ? "👑" : "🔧"}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:"#1e293b", fontSize:14, fontWeight:500 }}>{u.nombre}</div>
              <div style={{ color:"#94a3b8", fontSize:12 }}>{u.email} · {u.rol === "admin" ? "Admin" : "Operario"}</div>
            </div>
            {u.id !== "admin" && (
              <button onClick={() => eliminar(u.id)} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:16 }}>🗑️</button>
            )}
          </div>
        ))}

        <div style={{ marginTop:24, paddingTop:20, borderTop:"1px solid rgba(30,64,175,0.1)" }}>
          <div style={{ fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1, marginBottom:14 }}>Agregar usuario</div>
          {[
            { label:"Nombre", key:"nombre", ph:"Nombre completo" },
            { label:"Email", key:"email", ph:"email@fabrica.com" },
            { label:"Contraseña", key:"password", ph:"Contraseña" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom:10 }}>
              <input style={si} placeholder={f.ph} value={form[f.key]}
                onChange={e => setForm(x => ({...x, [f.key]: e.target.value}))} />
            </div>
          ))}
          <select value={form.rol} onChange={e => setForm(x => ({...x, rol: e.target.value}))} style={{...si, marginBottom:12}}>
            <option value="operario">Operario</option>
            <option value="admin">Admin</option>
          </select>
          {msg && <div style={{ padding:"8px 12px", borderRadius:8, background: msg.startsWith("✅") ? "rgba(74,154,106,0.15)" : "rgba(224,85,85,0.12)", color: msg.startsWith("✅") ? "#80c090" : "#f08080", fontSize:13, marginBottom:10 }}>{msg}</div>}
          <button onClick={agregar} disabled={guardando} style={{ width:"100%", padding:12, background:"linear-gradient(135deg,#1e40af,#3b82f6)", border:"none", borderRadius:10, fontFamily:"'Playfair Display', serif", fontSize:15, fontWeight:700, color:"#ffffff", cursor: guardando ? "not-allowed" : "pointer", opacity: guardando ? 0.7 : 1 }}>
            {guardando ? "Guardando..." : "Agregar usuario"}
          </button>
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
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(8px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", border:"1px solid rgba(30,64,175,0.2)", borderRadius:20, padding:"28px 24px", width:"100%", maxWidth:440 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, color:"#1e40af" }}>💬 Alertas WhatsApp</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#94a3b8", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>

        <div style={{ background:"#f8fafc", borderRadius:12, padding:"14px 16px", marginBottom:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:28, fontWeight:900, color:"#e05555" }}>{urgentes}</div>
            <div style={{ fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1 }}>Urgentes</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:28, fontWeight:900, color:"#d4783a" }}>{proximas}</div>
            <div style={{ fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1 }}>Próximas</div>
          </div>
        </div>

        <label style={{ display:"block", fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Tu número de WhatsApp</label>
        <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="5491112345678 (sin + ni espacios)"
          style={{ width:"100%", padding:"11px 14px", background:"#f8fafc", border:"1px solid rgba(30,64,175,0.2)", borderRadius:10, color:"#1e293b", fontFamily:"'DM Sans', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:10 }}
        />
        <div style={{ fontSize:12, color:"#94a3b8", marginBottom:16 }}>Formato: código país + área + número. Ej: 5491112345678</div>

        <button onClick={guardar} style={{ width:"100%", padding:12, background:"#eef2ff", border:"1px solid rgba(30,64,175,0.25)", borderRadius:10, color: saved ? "#80c090" : "#1e40af", fontFamily:"'DM Sans', sans-serif", fontSize:14, cursor:"pointer", marginBottom:10 }}>
          {saved ? "✅ Número guardado" : "💾 Guardar número"}
        </button>

        <button onClick={() => { enviarWhatsApp(obras, numero); onClose(); }} style={{ width:"100%", padding:13, background:"linear-gradient(135deg,#25d366,#128c7e)", border:"none", borderRadius:10, fontFamily:"'Playfair Display', serif", fontSize:16, fontWeight:700, color:"#fff", cursor:"pointer" }}>
          📤 Enviar resumen ahora
        </button>

        <div style={{ marginTop:14, padding:"10px 14px", background:"rgba(30,64,175,0.06)", borderRadius:8, border:"1px solid rgba(30,64,175,0.12)", fontSize:12, color:"#94a3b8", lineHeight:1.7 }}>
          💡 El mensaje se abre en WhatsApp listo para enviar. Guardá el número para acceso rápido desde el botón de alertas en el header.
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
    <div style={{ minHeight:"100vh", background:"#ffffff", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ fontFamily:"'Playfair Display', serif", color:"#1e40af", fontSize:20 }}>Cargando...</div>
    </div>
  );
  if (!sesion) return <Login onLogin={handleLogin} />;

  const isAdmin = sesion.rol === "admin";

  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9", fontFamily:"'DM Sans', sans-serif", color:"#1e293b" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: rgba(30,64,175,0.25); border-radius: 3px; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6) sepia(1) hue-rotate(10deg); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>

      {/* HEADER */}
      <header style={{ position:"sticky", top:0, zIndex:100, background:"#ffffff", borderBottom:"1px solid #e2e8f0", boxShadow:"0 1px 8px rgba(0,0,0,0.08)", padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <img src={LOGO_AIXA} alt="Obras Grupo Aixa S.A." style={{ height:40 }} />
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {/* WhatsApp quick button */}
          <button onClick={() => setShowWA(true)} title="Alertas WhatsApp"
            style={{ position:"relative", background:"#f8fafc", border:"1px solid rgba(30,64,175,0.18)", borderRadius:"50%", width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:18 }}>
            💬
            {alertCount > 0 && <div style={{ position:"absolute", top:2, right:2, background:"#25d366", borderRadius:"50%", width:10, height:10 }} />}
          </button>

          {/* Notif bell */}
          <div style={{ position:"relative" }}>
            <button onClick={() => setShowNotif(!showNotif)}
              style={{ position:"relative", background:"#f8fafc", border:"1px solid rgba(30,64,175,0.18)", borderRadius:"50%", width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:18 }}>
              🔔
              {alertCount > 0 && (
                <div style={{ position:"absolute", top:2, right:2, background:"#e05555", color:"#fff", fontSize:9, fontWeight:700, borderRadius:"50%", width:16, height:16, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {alertCount}
                </div>
              )}
            </button>

            {showNotif && (
              <div onClick={e => e.stopPropagation()} style={{ position:"absolute", top:48, right:0, background:"#ffffff", border:"1px solid rgba(30,64,175,0.2)", borderRadius:14, padding:16, width:290, maxHeight:360, overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.7)", zIndex:200 }}>
                <div style={{ fontSize:10, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>Obras con alerta</div>
                {alertCount === 0
                  ? <div style={{ color:"#94a3b8", fontSize:13 }}>Todo bajo control 👌</div>
                  : [...urgentes, ...proximas].sort((a,b) => diasRestantes(a.fecha) - diasRestantes(b.fecha)).map(o => {
                    const d = diasRestantes(o.fecha);
                    return (
                      <div key={o.id} onClick={() => { setDetalle(o); setShowNotif(false); }} style={{ display:"flex", gap:10, alignItems:"center", padding:"10px 12px", background:"#f8fafc", borderRadius:10, marginBottom:8, cursor:"pointer", border:"1px solid rgba(30,64,175,0.1)" }}>
                        <span style={{ fontSize:18 }}>{d <= 7 ? "🚨" : "⏰"}</span>
                        <div>
                          <div style={{ fontSize:13, color:"#1e293b", fontWeight:500 }}>{o.nombre}</div>
                          <div style={{ fontSize:11, color: d <= 7 ? "#e05555" : "#d4783a" }}>{d === 0 ? "¡Entrega HOY!" : `${d} días`}</div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>

          {/* Historial button (solo admin) */}
          {isAdmin && (
            <button onClick={verHistorial} title="Historial de cambios"
              style={{ background:"#f8fafc", border:"1px solid rgba(30,64,175,0.18)", borderRadius:"50%", width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:18 }}>
              📋
            </button>
          )}

          {/* User menu */}
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 12px", background:"#f8fafc", borderRadius:20, border:"1px solid rgba(30,64,175,0.18)", cursor:"pointer" }} onClick={isAdmin ? () => setShowUsuarios(true) : undefined}>
            <div style={{ width:24, height:24, borderRadius:"50%", background: isAdmin ? "rgba(30,64,175,0.25)" : "rgba(74,154,106,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>
              {isAdmin ? "👑" : "🔧"}
            </div>
            <span style={{ fontSize:12, color:"#475569", maxWidth:90, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sesion.nombre.split(" ")[0]}</span>
          </div>

          <button onClick={handleLogout} title="Cerrar sesión"
            style={{ background:"none", border:"1px solid rgba(30,64,175,0.15)", borderRadius:8, padding:"6px 10px", color:"#94a3b8", fontSize:12, cursor:"pointer" }}>
            Salir
          </button>
        </div>
      </header>

      {/* Click outside notif */}
      {showNotif && <div onClick={() => setShowNotif(false)} style={{ position:"fixed", inset:0, zIndex:99 }} />}

      <main style={{ maxWidth:1100, margin:"0 auto", padding:"24px 16px 80px" }}>

        {/* STATS */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:28 }}>
          {[
            { num: activas.length, label:"En curso", color:"#1e40af" },
            { num: urgentes.length, label:"Urgentes", color:"#e05555" },
            { num: proximas.length, label:"Próximas", color:"#d4783a" },
            { num: terminadas.length, label:"Entregadas", color:"#4a9a6a" },
          ].map((s, i) => (
            <div key={i} style={{ background:"#ffffff", border:"1px solid #e2e8f0", borderRadius:14, boxShadow:"0 1px 4px rgba(0,0,0,0.05)", padding:"16px 12px", textAlign:"center", animation:`fadeUp 0.4s ease ${i*0.07}s both` }}>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(22px,4vw,32px)", fontWeight:900, color:s.color, lineHeight:1 }}>{s.num}</div>
              <div style={{ fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1, marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ALERT BANNER */}
        {(urgentes.length > 0 || proximas.length > 0) && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>⚠️ Alertas activas</div>
            {[...urgentes, ...proximas].sort((a,b) => diasRestantes(a.fecha)-diasRestantes(b.fecha)).map(o => {
              const d = diasRestantes(o.fecha);
              const urgent = d <= 7;
              return (
                <div key={o.id} onClick={() => setDetalle(o)}
                  style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 16px", borderRadius:12, marginBottom:8, background: urgent ? "rgba(224,85,85,0.1)" : "rgba(212,120,58,0.1)", borderLeft:`3px solid ${urgent ? "#e05555" : "#d4783a"}`, cursor:"pointer" }}>
                  <span style={{ fontSize:22 }}>{urgent ? "🚨" : "⏰"}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, color:"#1e293b", fontSize:14 }}>{o.nombre}</div>
                    <div style={{ color:"#94a3b8", fontSize:12 }}>{o.lugar}</div>
                  </div>
                  <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:900, color: urgent ? "#e05555" : "#d4783a" }}>
                    {d === 0 ? "¡HOY!" : `${d}d`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FILTROS */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:17, color:"#1e40af" }}>🪵 Obras</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {[
              { key:"todas", label:"Todas" },
              { key:"urgent", label:"🔴 Urgentes" },
              { key:"warning", label:"🟠 Próximas" },
              { key:"ok", label:"🟢 A tiempo" },
              { key:"done", label:"📦 Entregadas" },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{ padding:"6px 14px", borderRadius:20, border: filter===f.key ? "1px solid #1e40af" : "1px solid rgba(30,64,175,0.18)", background: filter===f.key ? "#1e40af" : "#f8fafc", color: filter===f.key ? "#1a0e00" : "#64748b", fontFamily:"'DM Sans', sans-serif", fontSize:12, fontWeight: filter===f.key ? 700 : 400, cursor:"pointer" }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* GRID OBRAS */}
        {obrasFiltradas.length === 0
          ? (
            <div style={{ textAlign:"center", padding:"60px 20px", color:"#94a3b8" }}>
              <div style={{ fontSize:48, marginBottom:14, opacity:0.4 }}>🪵</div>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, color:"#64748b", marginBottom:6 }}>No hay obras aquí</div>
              <div style={{ fontSize:13 }}>Usá el botón + para agregar una nueva.</div>
            </div>
          )
          : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:18 }}>
              {obrasFiltradas.map((o, idx) => {
                const d = diasRestantes(o.fecha);
                const status = getStatus(d, o.estado);
                const sm = STATUS_META[status];
                const diasLabel = o.estado === "terminado" ? "Entregada" : d < 0 ? `+${Math.abs(d)}d` : d === 0 ? "¡HOY!" : `${d}d`;
                return (
                  <div key={o.id} onClick={() => setDetalle(o)}
                    style={{ background:"#f8fafc", border:"1px solid rgba(30,64,175,0.12)", borderRadius:16, padding:"20px 18px", cursor:"pointer", position:"relative", overflow:"hidden", animation:`fadeUp 0.4s ease ${idx*0.05}s both`, transition:"transform 0.2s, box-shadow 0.2s, border-color 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.borderColor="rgba(30,64,175,0.3)"; e.currentTarget.style.boxShadow="0 8px 40px rgba(0,0,0,0.6)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor="rgba(30,64,175,0.12)"; e.currentTarget.style.boxShadow="none"; }}>

                    {/* top accent bar */}
                    <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:sm.color, borderRadius:"16px 16px 0 0" }} />

                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                      <div style={{ fontFamily:"'Playfair Display', serif", fontSize:16, color:"#1e293b", flex:1, lineHeight:1.3 }}>{o.nombre}</div>
                      <div style={{ padding:"3px 10px", borderRadius:20, background:sm.bg, color:sm.color, fontSize:11, fontWeight:700, marginLeft:8, whiteSpace:"nowrap", border:`1px solid ${sm.color}40` }}>
                        {diasLabel}
                      </div>
                    </div>

                    <div style={{ color:"#94a3b8", fontSize:12, marginBottom:6, display:"flex", alignItems:"center", gap:4 }}>📍 {o.lugar}</div>
                    <div style={{ color:"#475569", fontSize:12, marginBottom:12, display:"flex", alignItems:"center", gap:4 }}>📅 {formatDate(o.fecha)}</div>

                    <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:14 }}>
                      {normalizarMuebles(o.muebles||[]).slice(0,4).map((m,i) => (
                        <div key={i} style={{ background:"#eef2ff", border:"1px solid rgba(30,64,175,0.12)", borderRadius:6, padding:"2px 8px", fontSize:11, color:"#475569" }}>
                          {m.nombre}{m.cantidad > 1 ? <span style={{ color:"#1e40af", fontWeight:700 }}> ×{m.cantidad}</span> : ""}
                        </div>
                      ))}
                      {(o.muebles||[]).length > 4 && <div style={{ background:"#eef2ff", border:"1px solid rgba(30,64,175,0.12)", borderRadius:6, padding:"2px 8px", fontSize:11, color:"#94a3b8" }}>+{(o.muebles||[]).length - 4}</div>}
                    </div>

                    <div onClick={e => e.stopPropagation()} style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      <button onClick={() => setModalObra(o)} style={{ padding:"5px 12px", background:"#eef2ff", border:"1px solid rgba(30,64,175,0.2)", borderRadius:8, color:"#1e40af", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>✏️ Editar</button>
                      <button onClick={() => generarPDF(o)} style={{ padding:"5px 12px", background:"#eef2ff", border:"1px solid rgba(30,64,175,0.2)", borderRadius:8, color:"#2563eb", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>🖨️ PDF</button>
                      {o.estado !== "terminado" && <button onClick={() => marcarEntregada(o.id)} style={{ padding:"5px 12px", background:"rgba(74,154,106,0.12)", border:"1px solid rgba(74,154,106,0.25)", borderRadius:8, color:"#80c090", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>✅</button>}
                      {isAdmin && <button onClick={() => eliminarObra(o.id)} style={{ padding:"5px 12px", background:"rgba(224,85,85,0.1)", border:"1px solid rgba(224,85,85,0.2)", borderRadius:8, color:"#f08080", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>🗑️</button>}
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
        style={{ position:"fixed", bottom:28, right:24, width:56, height:56, borderRadius:"50%", background:"linear-gradient(135deg,#1e40af,#3b82f6)", border:"none", fontSize:26, color:"#ffffff", boxShadow:"0 6px 30px rgba(30,64,175,0.3)", cursor:"pointer", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", transition:"transform 0.2s, box-shadow 0.2s" }}
        onMouseEnter={e => { e.currentTarget.style.transform="scale(1.1) rotate(15deg)"; e.currentTarget.style.boxShadow="0 10px 40px rgba(30,64,175,0.5)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform="scale(1) rotate(0)"; e.currentTarget.style.boxShadow="0 6px 30px rgba(30,64,175,0.3)"; }}>
        ＋
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
        <div onClick={e => e.target === e.currentTarget && setShowHistorial(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(8px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#ffffff", border:"1px solid rgba(30,64,175,0.2)", borderRadius:20, padding:"28px 24px", width:"100%", maxWidth:520, maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, color:"#1e40af" }}>📋 Historial de cambios</div>
              <button onClick={() => setShowHistorial(false)} style={{ background:"none", border:"none", color:"#94a3b8", fontSize:20, cursor:"pointer" }}>✕</button>
            </div>
            {historial.length === 0
              ? <div style={{ color:"#94a3b8", fontSize:13, textAlign:"center", padding:30 }}>Sin cambios registrados aún.</div>
              : historial.map(h => (
                <div key={h.id} style={{ display:"flex", gap:12, padding:"12px 0", borderBottom:"1px solid rgba(30,64,175,0.08)" }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(30,64,175,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                    {h.accion === "creó" ? "✨" : h.accion === "eliminó" ? "🗑️" : h.accion === "marcó como entregada" ? "✅" : "✏️"}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:"#1e293b" }}>
                      <b style={{ color:"#1e40af" }}>{h.usuario_nombre}</b> {h.accion} <b style={{ color:"#1e293b" }}>{h.obra_nombre}</b>
                    </div>
                    {h.detalle && <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>{h.detalle}</div>}
                    <div style={{ fontSize:11, color:"#94a3b8", marginTop:3 }}>
                      {new Date(h.fecha).toLocaleDateString("es-AR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
