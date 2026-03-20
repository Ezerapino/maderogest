import { useState, useEffect, useCallback, useRef } from "react";

// ─── LOGO ─────────────────────────────────────────────────────────────────────
const LOGO_AIXA = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABFAEsDASIAAhEBAxEB/8QAGwABAAMBAQEBAAAAAAAAAAAAAAEGBwgFAgT/xAA2EAABAgUBBQUGBQUAAAAAAAABAgMABAUGEQcIEiExUTdBYXWzExQiUnThFSM2cbEyQmKBo//EABkBAQADAQEAAAAAAAAAAAAAAAABBAYFAv/EACYRAAICAQMDAwUAAAAAAAAAAAABAhEDBAUSITFSFHKxIlFhcYH/2gAMAwEAAhEDEQA/AOM8nrDJ6xEI9gnJ6wyesRCAJyesMnrEQgCcnrDJ6xEIA1DZs/XM75Yv1Wo8LU+bYa1ArSF0yUfUJk5WtToUeA+VYH2j3dmv8AXM75Yv1Woir6r9otb+pP8COalesl+kcaEVLcpp+KKvCEI6R2RCNR1g0crOnVkWZck+VrTX5MrmmynHukwfjS0eHAlpSOB47yXO4CPz29p3T6ls+3LqS5UJpE7SKoxJNSqUp9k4lwt5UTzyN88ukAZtCNkquijtZp9iVjTiZm6zTrrUJNz3hKd+Qnk5LrbhSMBISFKCsckKPLEUvWKg2za1/1C3LVq01V5OnKEu9OPBIDr6eDm4E/2A/COecE8sQsFPhGpay6O1jTi0LPr0+pS/xuTKpxs4zKTOSsNHp+Upvn3pX3YjLYA1PZlZefvueQw046oUxwkISVHHtWukeDqnMNy2abseoMOrA1F5wlIS3IJ5Bxlz7RZdkztFqHlDnrMxT9ae1S4fqz/Ai7lV6KPuM9jipbzkT8F8oqO74w3fGEIpGhG74w3fGEIAbvjDd8YQgBu+MN3xhCANf2TRjUWoeUOeszFZ1im2GtTrgQumSjyhNqytanQo8B8qwPtCEXcqvRR9xn8cVLeMl+C+Uf/Z";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
// MaderoGest Supabase (Entregas)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "";

// Single DB — all avance_obras data now lives in MaderoGest's Supabase
// You need to create the table "avance_obras" in your Supabase with:
// id (uuid, default gen_random_uuid()), name (text), client (text), start_date (date),
// due_date (date), description (text), stations (jsonb), history (jsonb),
// clarifications (jsonb), created_at (timestamptz, default now())

// ─── SUPABASE FETCH (MaderoGest) ──────────────────────────────────────────────
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
  if (!res.ok) { const err = await res.text(); throw new Error(err); }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// ─── AVANCE API (same Supabase, table: avance_obras) ──────────────────────────
async function getAixaObras() { return sbFetch("avance_obras?select=*&order=created_at.desc"); }
async function insertAixaObra(obra) { return sbFetch("avance_obras", { method: "POST", body: JSON.stringify(obra) }); }
async function updateAixaObra(id, data) { return sbFetch(`avance_obras?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }); }
async function deleteAixaObraApi(id) { return sbFetch(`avance_obras?id=eq.${id}`, { method: "DELETE" }); }
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

async function getUsuarios() { return sbFetch("usuarios?select=*", { method: "GET" }); }
async function upsertUsuario(usuario) {
  return sbFetch("usuarios", { method: "POST", headers: { "Prefer": "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(usuario) });
}
async function deleteUsuario(id) { return sbFetch(`usuarios?id=eq.${id}`, { method: "DELETE" }); }

async function getHistorial(obraId = null) {
  const filter = obraId ? `obra_id=eq.${obraId}&` : "";
  return sbFetch(`historial?${filter}order=fecha.desc&limit=100`, { method: "GET" });
}
async function agregarHistorial(entrada) { return sbFetch("historial", { method: "POST", body: JSON.stringify(entrada) }); }

async function getAgregados(obraId) { return sbFetch(`agregados?obra_id=eq.${obraId}&order=fecha.desc`, { method: "GET" }); }
async function insertAgregado(agregado) {
  return sbFetch("agregados", { method: "POST", headers: { "Prefer": "return=representation" }, body: JSON.stringify(agregado) });
}
async function deleteAgregado(id) { return sbFetch(`agregados?id=eq.${id}`, { method: "DELETE" }); }

// Old separate API functions removed — now using unified functions above

// ─── SESSION ──────────────────────────────────────────────────────────────────
function getSesion() { try { return JSON.parse(localStorage.getItem("mg_sesion")); } catch { return null; } }
function setSesionLocal(u) { if (u) localStorage.setItem("mg_sesion", JSON.stringify(u)); else localStorage.removeItem("mg_sesion"); }

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

const ESTADO_LABELS = { pendiente: "Pendiente", en_proceso: "En proceso", terminado: "Terminado" };
const STATUS_META = {
  urgent:  { color: "#e05555", bg: "rgba(224,85,85,0.13)", label: "URGENTE", icon: "🚨" },
  warning: { color: "#d4783a", bg: "rgba(212,120,58,0.13)", label: "PRÓXIMA", icon: "⏰" },
  ok:      { color: "#4a9a6a", bg: "rgba(74,154,106,0.12)", label: "A TIEMPO", icon: "✅" },
  done:    { color: "#6a8a9a", bg: "rgba(106,138,154,0.1)", label: "ENTREGADA", icon: "📦" },
  vencida: { color: "#c84040", bg: "rgba(200,64,64,0.18)", label: "VENCIDA", icon: "⛔" },
};

function normalizarMuebles(muebles) {
  if (!muebles) return [];
  return muebles.map(m => typeof m === "string" ? { nombre: m, cantidad: 1 } : m);
}

// ─── AIXAOBRA UTILS ───────────────────────────────────────────────────────────
const STATION_NAMES = ['Programa','Corte','Enchapado','Agujereado','Armado y embalado','Listo para entregar'];
function mkStations() { return STATION_NAMES.map((n,i)=>({id:i,name:n,status:'pending',start_date:null,end_date:null,note:''})); }
function fmtDateAixa(d) { if(!d) return '—'; const[y,m,day]=(d.split('T')[0]).split('-'); return `${day}/${m}/${y}`; }
function fmtDateTimeAixa(iso) { return new Date(iso).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function obraProgressAixa(o) { const st=o.stations||[]; return st.length ? Math.round(st.filter(s=>s.status==='done').length/st.length*100) : 0; }
function isDelayedAixa(o) { if(!o.due_date||obraProgressAixa(o)===100) return false; const t=new Date(); t.setHours(0,0,0,0); return t>new Date(o.due_date); }
function daysDelayedAixa(o) { if(!o.due_date)return 0; const t=new Date();t.setHours(0,0,0,0); return Math.floor((t-new Date(o.due_date))/86400000); }

// ─── PDF GENERATOR ────────────────────────────────────────────────────────────
async function generarPDF(obra) {
  const dias = diasRestantes(obra.fecha);
  const status = getStatus(dias, obra.estado);
  const sm = STATUS_META[status];
  let agregadosList = [];
  try { agregadosList = await getAgregados(obra.id); } catch {}
  const mueblesList = normalizarMuebles(obra.muebles || []);
  const totalUnidades = mueblesList.reduce((a, m) => a + (m.cantidad||1), 0);
  const diasLabel = obra.estado === "terminado" ? "Entregada" : dias < 0 ? `Vencida hace ${Math.abs(dias)} días` : dias === 0 ? "¡Entrega HOY!" : `${dias} días para entrega`;
  const mueblesHTML = mueblesList.map((m) => `<div style="display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid #f1f5f9"><div style="flex:1;font-size:14px;color:#1e293b">${m.nombre}</div><div style="width:90px;font-size:14px;font-weight:bold;color:#1e40af;text-align:center">${m.cantidad > 1 ? m.cantidad : "1"}</div><div style="width:24px;height:24px;border:1.5px solid #1e40af;border-radius:4px;margin-left:12px"></div></div>`).join("");
  const agregadosHTML = agregadosList.length === 0 ? '<p style="color:#94a3b8;font-size:13px">Sin agregados.</p>' :
    agregadosList.map(a => `<div style="display:flex;align-items:center;padding:9px 12px;border-bottom:1px solid #f1f5f9"><div style="flex:1;font-size:14px;color:#1e293b">${a.articulo}</div><div style="width:90px;font-size:14px;font-weight:bold;color:#1e40af;text-align:center">${a.cantidad}${a.unidad ? ` ${a.unidad}` : ""}</div></div>`).join("");

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Orden de Entrega – ${obra.nombre}</title>
<style>body{font-family:Georgia,serif;color:#1e293b;margin:0;padding:0}.portada{background:#1e293b;color:#e8dcc8;padding:48px 48px 36px}.logo{font-size:28px;font-weight:bold;letter-spacing:2px;color:#fff}.obra-titulo{font-size:26px;margin:20px 0 6px;font-style:italic;color:#e8dcc8}.obra-subtitulo{font-size:13px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase}.cuerpo{padding:36px 48px}.status-badge{display:inline-block;padding:5px 16px;border-radius:20px;font-size:12px;font-weight:bold;letter-spacing:1px;background:${sm.bg};color:${sm.color};border:1px solid ${sm.color};margin-bottom:24px}.grid-datos{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:32px;border-bottom:1px solid #e2e8f0;padding-bottom:28px}.dato-item .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:4px}.dato-item .valor{font-size:15px;font-weight:bold;color:#1e293b}.seccion-titulo{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:16px;margin-top:28px}.firma-box{margin-top:48px;display:flex;justify-content:space-between}.firma{text-align:center}.firma-linea{width:160px;border-bottom:1px solid #1e293b;margin-bottom:6px;height:36px}.firma-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8}.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}</style></head>
<body><div class="portada"><div class="logo">Obras Grupo Aixa S.A.</div><div class="obra-titulo">${obra.nombre}</div><div class="obra-subtitulo">Orden de entrega · Obras Grupo Aixa S.A.</div></div>
<div class="cuerpo"><div class="status-badge">${sm.icon} ${sm.label} — ${diasLabel}</div>
<div class="grid-datos"><div class="dato-item"><div class="label">📍 Lugar</div><div class="valor">${obra.lugar}</div></div><div class="dato-item"><div class="label">📅 Fecha</div><div class="valor">${formatDate(obra.fecha)}</div></div><div class="dato-item"><div class="label">⚙️ Estado</div><div class="valor">${ESTADO_LABELS[obra.estado]}</div></div></div>
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
  if (urgentes.length === 0 && proximas.length === 0 && vencidas.length === 0) { alert("No hay obras con fechas próximas."); return; }
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
    return `<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9"><div style="width:28px;height:28px;border-radius:50%;background:${sc};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;flex-shrink:0">${i+1}</div><div style="flex:1"><div style="font-weight:600;font-size:13px;color:#1e293b">${s.name}</div><div style="font-size:11px;color:#64748b">${sl} · ${s.days} días${s.start_date ? ` · ${fmtDateAixa(s.start_date)}` : ''}${s.end_date ? ` → ${fmtDateAixa(s.end_date)}` : ''}</div>${s.note ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px;font-style:italic">"${s.note}"</div>` : ''}</div></div>`;
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
    <div style={{ minHeight:"100vh", background:"#F4F6F9", display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ marginBottom:36, textAlign:"center" }}>
          <img src={LOGO_AIXA} alt="Obras Grupo Aixa S.A." style={{ height:48, marginBottom:16 }} />
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
function EntregasModule({ sesion, obras, setObras, recargarObras }) {
  const [filter, setFilter] = useState("todas");
  const [modalObra, setModalObra] = useState(null);
  const [detalle, setDetalle] = useState(null);

  const isAdmin = sesion.rol === "admin";
  const activas = obras.filter(o => o.estado !== "terminado");
  const urgentes = activas.filter(o => { const d = diasRestantes(o.fecha); return d >= 0 && d <= 7; });
  const proximas = activas.filter(o => { const d = diasRestantes(o.fecha); return d > 7 && d <= 21; });
  const terminadas = obras.filter(o => o.estado === "terminado");

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

  async function guardarObra(obra) {
    const existente = obras.find(o => o.id === obra.id);
    const obraFinal = {
      id: obra.id, nombre: obra.nombre, lugar: obra.lugar, fecha: obra.fecha, estado: obra.estado,
      muebles: obra.muebles, notas: obra.notas,
      creado_por: existente ? obra.creado_por : sesion.id,
      creado_en: existente ? obra.creado_en : new Date().toISOString(),
      editado_por: existente ? sesion.id : null,
      editado_en: existente ? new Date().toISOString() : null,
    };
    try {
      await upsertObra(obraFinal);
      await agregarHistorial({ obra_id: obraFinal.id, obra_nombre: obraFinal.nombre, usuario_id: sesion.id, usuario_nombre: sesion.nombre, accion: existente ? "editó" : "creó", detalle: existente ? "Obra actualizada" : "Obra creada" });
      await recargarObras();
    } catch { alert("Error al guardar."); return; }
    setModalObra(null); setDetalle(null);
  }

  async function eliminarObra(id) {
    if (!confirm("¿Eliminar esta obra?")) return;
    try { await deleteObra(id); await recargarObras(); } catch { alert("Error al eliminar."); return; }
    setDetalle(null);
  }

  async function marcarEntregada(id) {
    const obra = obras.find(o => o.id === id);
    try {
      await upsertObra({ ...obra, estado:"terminado", editado_por: sesion.id, editado_en: new Date().toISOString() });
      await recargarObras();
    } catch { alert("Error al actualizar."); return; }
    setDetalle(null);
  }

  return (
    <div>
      {/* STATS */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:32 }}>
        {[
          { num: activas.length, label:"En curso", color:"#2563EB", border:"#DBEAFE" },
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

      {/* FILTROS */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>Obras — Entregas</h2>
        <div style={{ display:"flex", gap:4, background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:10, padding:4 }}>
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

      {/* GRID */}
      {obrasFiltradas.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
          <div style={{ fontSize:13, color:"#94A3B8" }}>No hay obras en esta categoría</div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:16 }}>
          {obrasFiltradas.map((o, idx) => {
            const d = diasRestantes(o.fecha);
            const status = getStatus(d, o.estado);
            const sm = STATUS_META[status];
            const sc = { urgent:{bg:"#FEF2F2",text:"#DC2626",border:"#FECACA"}, vencida:{bg:"#FEF2F2",text:"#DC2626",border:"#FECACA"}, warning:{bg:"#FFFBEB",text:"#D97706",border:"#FDE68A"}, ok:{bg:"#ECFDF5",text:"#059669",border:"#A7F3D0"}, done:{bg:"#F8FAFC",text:"#64748B",border:"#E2E8F0"} }[status] || {bg:"#ECFDF5",text:"#059669",border:"#A7F3D0"};
            const diasLabel = o.estado === "terminado" ? "Entregada" : d < 0 ? "Vencida" : d === 0 ? "Hoy" : `${d} días`;
            return (
              <div key={o.id} className="obra-card" onClick={() => setDetalle(o)}
                style={{ background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:14, overflow:"hidden", cursor:"pointer", animation:`fadeUp 0.35s ease ${idx*0.04}s both`, boxShadow:"0 1px 4px rgba(26,43,74,0.05)" }}>
                <div style={{ height:4, background:sm.color }} />
                <div style={{ padding:"18px 18px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                    <div style={{ fontFamily:"'Sora', sans-serif", fontSize:15, fontWeight:700, color:"#1A2B4A", flex:1, lineHeight:1.35, paddingRight:10 }}>{o.nombre}</div>
                    <div style={{ padding:"3px 10px", borderRadius:6, background:sc.bg, color:sc.text, fontSize:11, fontWeight:700, border:`1px solid ${sc.border}`, whiteSpace:"nowrap", flexShrink:0 }}>{diasLabel}</div>
                  </div>
                  <div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}>📍 {o.lugar}</div>
                  <div style={{ fontSize:12, color:"#64748B", marginBottom:14 }}>📅 {formatDate(o.fecha)}</div>
                  {(o.muebles||[]).length > 0 && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:14 }}>
                      {normalizarMuebles(o.muebles).slice(0,3).map((m,i) => (
                        <div key={i} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:4, padding:"2px 8px", fontSize:11, color:"#475569" }}>
                          {m.nombre}{m.cantidad > 1 ? ` ×${m.cantidad}` : ""}
                        </div>
                      ))}
                      {(o.muebles||[]).length > 3 && <div style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:4, padding:"2px 8px", fontSize:11, color:"#94A3B8" }}>+{(o.muebles||[]).length - 3}</div>}
                    </div>
                  )}
                  <div onClick={e => e.stopPropagation()} style={{ display:"flex", gap:6, paddingTop:12, borderTop:"1px solid #F1F5F9" }}>
                    <button onClick={() => setModalObra(o)} style={{ flex:1, padding:"7px 0", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Editar</button>
                    <button onClick={() => generarPDF(o)} style={{ flex:1, padding:"7px 0", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>PDF</button>
                    {o.estado !== "terminado" && (
                      <button onClick={() => marcarEntregada(o.id)} style={{ flex:1, padding:"7px 0", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:8, color:"#059669", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Entregar</button>
                    )}
                    {isAdmin && (
                      <button onClick={() => eliminarObra(o.id)} style={{ padding:"7px 10px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:12, cursor:"pointer" }}>✕</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setModalObra("nueva")}
        style={{ position:"fixed", bottom:28, right:24, height:48, padding:"0 22px", borderRadius:12, background:"#1A2B4A", border:"none", fontSize:13, fontWeight:600, color:"#ffffff", boxShadow:"0 4px 20px rgba(26,43,74,0.35)", cursor:"pointer", zIndex:200, display:"flex", alignItems:"center", gap:8, fontFamily:"'Inter', sans-serif" }}
        onMouseEnter={e => { e.currentTarget.style.background="#2563EB"; }}
        onMouseLeave={e => { e.currentTarget.style.background="#1A2B4A"; }}>
        + Nueva obra
      </button>

      {/* Modal Obra */}
      {modalObra && <ModalObraEntrega obra={modalObra === "nueva" ? null : modalObra} onClose={() => setModalObra(null)} onSave={guardarObra} />}

      {/* Detalle */}
      {detalle && <DetalleObraEntrega obra={obras.find(o => o.id === detalle.id) || detalle} sesion={sesion} rol={sesion.rol}
        onClose={() => setDetalle(null)} onEdit={() => { setModalObra(obras.find(o => o.id === detalle.id)); setDetalle(null); }}
        onDelete={() => eliminarObra(detalle.id)} onEntregada={() => marcarEntregada(detalle.id)} />}
    </div>
  );
}

// ─── MODAL OBRA (Entregas) ────────────────────────────────────────────────────
function ModalObraEntrega({ obra, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: obra?.nombre || "", lugar: obra?.lugar || "", fecha: obra?.fecha || "",
    estado: obra?.estado || "pendiente", muebles: normalizarMuebles(obra?.muebles), notas: obra?.notas || "",
  });
  const [muebleInput, setMuebleInput] = useState("");
  const [cantInput, setCantInput] = useState("1");
  const [errors, setErrors] = useState({});

  function addMueble() { const v = muebleInput.trim(); if (!v) return; const cant = Math.max(1, parseInt(cantInput) || 1); setForm(f => ({ ...f, muebles: [...f.muebles, { nombre: v, cantidad: cant }] })); setMuebleInput(""); setCantInput("1"); }
  function rmMueble(i) { setForm(f => ({ ...f, muebles: f.muebles.filter((_,x) => x !== i) })); }

  function handleSave() {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "Requerido";
    if (!form.lugar.trim()) e.lugar = "Requerido";
    if (!form.fecha) e.fecha = "Requerido";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    onSave({ ...obra, ...form, id: obra?.id || uid(), creadoEn: obra?.creadoEn || new Date().toISOString() });
  }

  const inp = (label, key, type="text", ph="") => (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>{label}</label>
      <input type={type} value={form[key]} placeholder={ph}
        onChange={e => { setForm(f => ({...f, [key]: e.target.value})); setErrors(er => ({...er,[key]:""})); }}
        style={{ width:"100%", padding:"10px 13px", background:"#F8FAFC", border:`1px solid ${errors[key] ? "#FCA5A5" : "#E2E8F0"}`, borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box" }} />
      {errors[key] && <div style={{ color:"#DC2626", fontSize:11, marginTop:4 }}>{errors[key]}</div>}
    </div>
  );

  const modalInp = { padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:540, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"#ffffff", borderRadius:"14px 14px 0 0", zIndex:1 }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{obra ? "Editar obra" : "Nueva obra"}</h2>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"24px" }}>
          {inp("Nombre de la obra", "nombre", "text", "Ej: Departamento Flores")}
          {inp("Dirección", "lugar", "text", "Calle, número, barrio...")}
          {inp("Fecha de entrega", "fecha", "date")}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Estado</label>
            <select value={form.estado} onChange={e => setForm(f => ({...f, estado: e.target.value}))} style={{ ...modalInp, width:"100%" }}>
              <option value="pendiente">Pendiente</option>
              <option value="en_proceso">En proceso</option>
              <option value="terminado">Terminado</option>
            </select>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, fontWeight:600, color:"#475569", marginBottom:10, display:"block" }}>Muebles</label>
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
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Notas</label>
            <textarea value={form.notas} rows={3} placeholder="Observaciones..." onChange={e => setForm(f => ({...f, notas: e.target.value}))}
              style={{ width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
          </div>
          <button onClick={handleSave} style={{ width:"100%", padding:"12px", background:"#1A2B4A", border:"none", borderRadius:8, fontFamily:"'Inter', sans-serif", fontSize:14, fontWeight:600, color:"#ffffff", cursor:"pointer" }}
            onMouseEnter={e => e.currentTarget.style.background="#2563EB"} onMouseLeave={e => e.currentTarget.style.background="#1A2B4A"}>Guardar obra</button>
        </div>
      </div>
    </div>
  );
}

// ─── DETALLE OBRA (Entregas) ──────────────────────────────────────────────────
function DetalleObraEntrega({ obra, onClose, onEdit, onDelete, onEntregada, rol, sesion }) {
  const dias = diasRestantes(obra.fecha);
  const status = getStatus(dias, obra.estado);
  const sc = { urgent:{bg:"#FEF2F2",text:"#DC2626",border:"#FECACA",label:"Urgente"}, vencida:{bg:"#FEF2F2",text:"#DC2626",border:"#FECACA",label:"Vencida"}, warning:{bg:"#FFFBEB",text:"#D97706",border:"#FDE68A",label:"Próxima"}, ok:{bg:"#ECFDF5",text:"#059669",border:"#A7F3D0",label:"A tiempo"}, done:{bg:"#F8FAFC",text:"#64748B",border:"#E2E8F0",label:"Entregada"} }[status] || {bg:"#ECFDF5",text:"#059669",border:"#A7F3D0",label:"OK"};
  const diasLabel = obra.estado === "terminado" ? "Entregada" : dias < 0 ? `Vencida hace ${Math.abs(dias)} días` : dias === 0 ? "Entrega hoy" : `${dias} días para entrega`;

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
    } catch { alert("Error al guardar."); }
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
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            {[{ label:"Lugar", val: obra.lugar }, { label:"Fecha", val: formatDate(obra.fecha) }, { label:"Estado", val: ESTADO_LABELS[obra.estado] }, { label:"Muebles", val: `${normalizarMuebles(obra.muebles||[]).reduce((a,m)=>a+(m.cantidad||1),0)} unidades` }].map(d => (
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
            {rol === "admin" && <button onClick={onDelete} style={{ padding:"9px 18px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Eliminar</button>}
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// AVANCE DE OBRA MODULE (Aixaobra)
// ═══════════════════════════════════════════════════════════════════════════════
function AvanceModule({ sesion }) {
  const [aixaObras, setAixaObras] = useState([]);
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

  const isAdmin = sesion.rol === "admin";

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [obs, users] = await Promise.all([getAixaObras(), getAixaUsers()]);
        setAixaObras(obs || []);
        setAixaUsers(users || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  async function recargar() {
    try { const obs = await getAixaObras(); setAixaObras(obs || []); } catch {}
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

  async function saveObra(name, client, start_date, due_date, description) {
    setLoading(true);
    try {
      if (editingObra) {
        const o = aixaObras.find(x => x.id === editingObra);
        const hist = [...(o.history||[])];
        hist.unshift({ user: sesion.nombre, role: sesion.rol, action: `Obra editada`, time: new Date().toISOString() });
        await updateAixaObra(editingObra, { name, client, start_date: start_date||null, due_date: due_date||null, description, history: hist });
      } else {
        await insertAixaObra({ name, client, start_date: start_date||null, due_date: due_date||null, description, stations: mkStations(), history: [], clarifications: [] });
      }
      await recargar();
    } catch { alert("Error al guardar"); }
    setLoading(false); setShowObraModal(false); setEditingObra(null);
  }

  async function delObra(id) {
    if (!confirm("¿Eliminar esta obra?")) return;
    setLoading(true);
    try { await deleteAixaObraApi(id); if (selectedObra === id) setSelectedObra(null); await recargar(); } catch { alert("Error"); }
    setLoading(false);
  }

  async function saveStation(stationIdx, status, start_date, end_date, note) {
    if (!obra) return;
    const stations = JSON.parse(JSON.stringify(obra.stations || []));
    const s = stations[stationIdx];
    const old = s.status;
    s.status = status; s.start_date = start_date || null; s.end_date = end_date || null; s.note = note;
    const hist = JSON.parse(JSON.stringify(obra.history || []));
    hist.unshift({ user: sesion.nombre, role: sesion.rol, action: `Estación "${s.name}": "${old}" → "${status}"${note ? ' — '+note : ''}`, time: new Date().toISOString() });
    setLoading(true);
    try { await updateAixaObra(selectedObra, { stations, history: hist }); await recargar(); } catch { alert("Error"); }
    setLoading(false); setShowStationModal(false);
    // If all stations are now done, offer completion report
    if (stations.every(s => s.status === 'done')) {
      setTimeout(() => {
        if (confirm("🎉 ¡Todas las estaciones completadas!\n¿Deseas generar el informe de cierre de obra?")) {
          const updatedObra = { ...obra, stations, history: hist };
          generarInformeCierre(updatedObra);
        }
      }, 400);
    }
  }

  async function saveClarif(title, station, responsible, detail) {
    if (!obra) return;
    const clarifications = JSON.parse(JSON.stringify(obra.clarifications || []));
    const hist = JSON.parse(JSON.stringify(obra.history || []));
    if (editingClarif !== null) {
      clarifications[editingClarif] = { ...clarifications[editingClarif], title, station, responsible, detail, edited: true, edited_at: new Date().toISOString() };
      hist.unshift({ user: sesion.nombre, role: sesion.rol, action: `Aclaración editada: "${title}"`, time: new Date().toISOString() });
    } else {
      clarifications.unshift({ title, station, responsible, detail, author: sesion.nombre, time: new Date().toISOString() });
      hist.unshift({ user: sesion.nombre, role: sesion.rol, action: `Nueva aclaración: "${title}"`, time: new Date().toISOString() });
    }
    setLoading(true);
    try { await updateAixaObra(selectedObra, { clarifications, history: hist }); await recargar(); } catch { alert("Error"); }
    setLoading(false); setShowClarifModal(false); setEditingClarif(null);
  }

  async function deleteClarif(idx) {
    if (!confirm("¿Eliminar esta aclaración?")) return;
    if (!obra) return;
    const clarifications = JSON.parse(JSON.stringify(obra.clarifications || []));
    const removed = clarifications.splice(idx, 1);
    const hist = JSON.parse(JSON.stringify(obra.history || []));
    hist.unshift({ user: sesion.nombre, role: sesion.rol, action: `Aclaración eliminada: "${removed[0]?.title}"`, time: new Date().toISOString() });
    setLoading(true);
    try { await updateAixaObra(selectedObra, { clarifications, history: hist }); await recargar(); } catch { alert("Error"); }
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
          <div style={{ display:"flex", gap:4, background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:10, padding:4 }}>
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
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:14 }}>
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
                  <div style={{ fontFamily:"'Sora', sans-serif", fontSize:14, fontWeight:700, color:"#1A2B4A", textTransform:"uppercase", marginBottom:6 }}>{s.name}</div>
                  <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:99, background:c.bg, color:c.text, border:`1px solid ${c.border}`, fontSize:11, fontWeight:600 }}>{labels[s.status]}</span>
                  {days && <div style={{ fontSize:12, color:"#94A3B8", marginTop:8 }}>{days}</div>}
                  {s.note && <div style={{ fontSize:12, color:"#94A3B8", marginTop:6, borderTop:"1px solid #F1F5F9", paddingTop:6 }}>{s.note}</div>}
                  {s.start_date && <div style={{ fontSize:11, color:"#CBD5E1", marginTop:4 }}>Inicio: {fmtDateAixa(s.start_date)}</div>}
                  {s.end_date && <div style={{ fontSize:11, color:"#CBD5E1" }}>Fin: {fmtDateAixa(s.end_date)}</div>}
                </div>
              );
            })}
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
            onSave={(data) => saveStation(editingStation, data.status, data.start_date, data.end_date, data.note)}
            fields={[
              { key:"status", label:"Estado", type:"select", options:[{v:"pending",l:"Pendiente"},{v:"active",l:"En progreso"},{v:"done",l:"Completado"},{v:"blocked",l:"Bloqueado"}], initial:s.status },
              { key:"start_date", label:"Fecha inicio", type:"date", initial:s.start_date?.split('T')[0]||"" },
              { key:"end_date", label:"Fecha fin", type:"date", initial:s.end_date?.split('T')[0]||"" },
              { key:"note", label:"Observación", type:"textarea", initial:s.note||"" },
            ]} />;
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
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
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
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            style={{ width:160, padding:"8px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" }} />
          <select value={filter} onChange={e => setFilter(e.target.value)}
            style={{ padding:"8px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" }}>
            <option value="all">Todas</option>
            <option value="active">En progreso</option>
            <option value="done">Completadas</option>
            <option value="delayed">Con demora</option>
          </select>
          {isAdmin && <button onClick={() => { setEditingObra(null); setShowObraModal(true); }} style={{ padding:"8px 18px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#ffffff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>+ Nueva obra</button>}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🏗</div>
          <div style={{ fontSize:13, color:"#94A3B8" }}>No hay obras registradas</div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:14 }}>
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
                {isAdmin && (
                  <div onClick={e => e.stopPropagation()} style={{ position:"absolute", top:10, right:10, display:"flex", gap:4 }}>
                    <button onClick={() => { setEditingObra(o.id); setShowObraModal(true); }} style={{ padding:"4px 8px", fontSize:11, border:"1px solid #E2E8F0", borderRadius:5, background:"#F8FAFC", color:"#64748B", cursor:"pointer" }}>✎</button>
                    <button onClick={() => delObra(o.id)} style={{ padding:"4px 8px", fontSize:11, border:"1px solid #FECACA", borderRadius:5, background:"#FEF2F2", color:"#DC2626", cursor:"pointer" }}>✕</button>
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
      {showObraModal && <ModalSimple title={editingObra ? "Editar Obra" : "Nueva Obra"} onClose={() => { setShowObraModal(false); setEditingObra(null); }}
        onSave={(d) => saveObra(d.name, d.client, d.start_date, d.due_date, d.description)}
        fields={[
          { key:"name", label:"Nombre de la obra", type:"text", required:true, initial: editingObra ? aixaObras.find(x=>x.id===editingObra)?.name : "" },
          { key:"client", label:"Cliente", type:"text", initial: editingObra ? aixaObras.find(x=>x.id===editingObra)?.client : "" },
          { key:"start_date", label:"Fecha inicio", type:"date", initial: editingObra ? (aixaObras.find(x=>x.id===editingObra)?.start_date||"").split('T')[0] : "" },
          { key:"due_date", label:"Fecha entrega", type:"date", initial: editingObra ? (aixaObras.find(x=>x.id===editingObra)?.due_date||"").split('T')[0] : "" },
          { key:"description", label:"Descripción", type:"textarea", initial: editingObra ? aixaObras.find(x=>x.id===editingObra)?.description : "" },
        ]} />}
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
    if (req) { alert(`"${req.label}" es requerido.`); return; }
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
// APP PRINCIPAL — UNIFIED
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [sesion, setSesion] = useState(null);
  const [obras, setObras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [activeTab, setActiveTab] = useState("entregas");
  const [showUsuarios, setShowUsuarios] = useState(false);
  const [showWA, setShowWA] = useState(false);

  useEffect(() => {
    (async () => {
      const s = getSesion();
      if (s) setSesion(s);
      try { const ob = await getObras(); setObras(ob || []); } catch { setObras([]); }
      setCargando(false);
    })();
  }, []);

  async function recargarObras() { try { const ob = await getObras(); setObras(ob || []); } catch {} }
  function handleLogin(u) { setSesion(u); recargarObras(); }
  function handleLogout() { setSesionLocal(null); setSesion(null); }

  const isAdmin = sesion?.rol === "admin";
  const activas = obras.filter(o => o.estado !== "terminado");
  const urgentes = activas.filter(o => { const d = diasRestantes(o.fecha); return d >= 0 && d <= 7; });
  const proximas = activas.filter(o => { const d = diasRestantes(o.fecha); return d > 7 && d <= 21; });
  const alertCount = urgentes.length + proximas.length;

  if (cargando) return (
    <div style={{ minHeight:"100vh", background:"#F4F6F9", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
      <img src={LOGO_AIXA} alt="Aixa" style={{ height:40, opacity:0.7 }} />
      <div style={{ fontFamily:"'Inter', sans-serif", color:"#94A3B8", fontSize:13 }}>Cargando...</div>
    </div>
  );
  if (!sesion) return <Login onLogin={handleLogin} />;

  return (
    <div style={{ minHeight:"100vh", background:"#F4F6F9", fontFamily:"'Inter', sans-serif", color:"#1A2B4A" }}>

      {/* HEADER */}
      <header style={{ position:"sticky", top:0, zIndex:100, background:"#ffffff", borderBottom:"1px solid #E8ECF0", padding:"0 24px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <img src={LOGO_AIXA} alt="Obras Grupo Aixa S.A." style={{ height:36 }} />

          {/* TABS */}
          <div style={{ display:"flex", gap:2, background:"#F1F5F9", borderRadius:10, padding:3 }}>
            <button onClick={() => setActiveTab("entregas")}
              style={{ padding:"7px 18px", borderRadius:8, border:"none", background: activeTab==="entregas" ? "#1A2B4A" : "transparent", color: activeTab==="entregas" ? "#ffffff" : "#64748B", fontFamily:"'Sora', sans-serif", fontSize:12, fontWeight: activeTab==="entregas" ? 700 : 500, cursor:"pointer", transition:"all 0.15s", letterSpacing:0.3 }}>
              📦 Entregas
            </button>
            <button onClick={() => setActiveTab("avance")}
              style={{ padding:"7px 18px", borderRadius:8, border:"none", background: activeTab==="avance" ? "#1A2B4A" : "transparent", color: activeTab==="avance" ? "#ffffff" : "#64748B", fontFamily:"'Sora', sans-serif", fontSize:12, fontWeight: activeTab==="avance" ? 700 : 500, cursor:"pointer", transition:"all 0.15s", letterSpacing:0.3 }}>
              🏗 Avance de Obra
            </button>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
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
            <div style={{ width:26, height:26, borderRadius:6, background: isAdmin ? "#1A2B4A" : "#0F766E", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span style={{ fontSize:13, color:"#1A2B4A", fontWeight:500 }}>{sesion.nombre.split(" ")[0]}</span>
            {isAdmin && <span style={{ fontSize:10, color:"#94A3B8", background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:4, padding:"1px 6px", fontWeight:600 }}>ADMIN</span>}
          </div>

          <button onClick={handleLogout}
            style={{ background:"transparent", border:"1px solid #E8ECF0", borderRadius:8, padding:"7px 14px", color:"#64748B", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            Salir
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{ maxWidth:1200, margin:"0 auto", padding:"28px 24px 100px" }}>
        {activeTab === "entregas" && <EntregasModule sesion={sesion} obras={obras} setObras={setObras} recargarObras={recargarObras} />}
        {activeTab === "avance" && <AvanceModule sesion={sesion} />}
      </main>

      {/* MODALES GLOBALES */}
      {showUsuarios && isAdmin && <GestionUsuarios onClose={() => setShowUsuarios(false)} />}
      {showWA && <ConfigWhatsApp obras={obras} onClose={() => setShowWA(false)} />}
    </div>
  );
}


// ─── GESTIÓN USUARIOS ─────────────────────────────────────────────────────────
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
      setMsg("✅ Usuario creado");
      setTimeout(() => setMsg(""), 3000);
    } catch { setMsg("⚠️ Error al guardar."); }
    setGuardando(false);
  }

  async function eliminar(id) {
    if (!confirm("¿Eliminar este usuario?")) return;
    try { await deleteUsuario(id); setUsuarios(u => u.filter(x => x.id !== id)); } catch { alert("Error."); }
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
  const [numero, setNumero] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { const n = localStorage.getItem("mg_wa_numero"); if (n) setNumero(n); }, []);
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
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
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
