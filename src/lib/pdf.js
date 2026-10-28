// PDF que se abren para imprimir
import { confirmar } from "./avisos.js";
import { getAgregados, imgToBase64 } from "./datos.js";
import { diasRestantes, fmtDateAixa, fmtDurAixa, formatDate, getStatus } from "./formato.js";
import { ESTADOS_MAT, ESTADO_MAT_COLORS, detalleFaltante, resumenMateriales } from "./materiales.js";
import { ESTADO_LABELS, STATUS_META, normalizarMuebles, obraProgressAixa } from "./produccion.js";

// Si con este cambio quedaron todas las estaciones completas, ofrece el informe de cierre
export function ofrecerInformeCierre(guardada) {
  if (!guardada?.stations?.length || !guardada.stations.every(s => s.status === 'done')) return;
  setTimeout(async () => {
    if (await confirmar("🎉 ¡Todas las estaciones completadas!\n¿Deseas generar el informe de cierre de obra?", { boton: "Generar informe", peligro: false })) {
      generarInformeCierre(guardada);
    }
  }, 400);
}

// ─── PDF GENERATOR ────────────────────────────────────────────────────────────
export async function generarPDF(obra) {
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


// ─── PDF: INFORME DE CIERRE DE OBRA ───────────────────────────────────────────
export function generarInformeCierre(obra) {
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


export async function generarPDFDiaAvance(obra, dia) {
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

export function generarPDFMateriales(lista, entrega) {
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
