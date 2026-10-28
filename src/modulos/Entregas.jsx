// Pestaña Entregas
import { useState, useEffect } from "react";
import { avisar, confirmar } from "../lib/avisos.js";
import { agregarHistorial, crearObraConEntrega, crearRegistrosEntrega, eliminarEntregaDefinitiva, eliminarObraDefinitiva, enviarAvisoAhora, getAgregados, insertAgregado, nombreEntrega, patchEntregas, patchProyecto, sincronizarEntrega, upsertObra } from "../lib/datos.js";
import { diasRestantes, formatDate, getStatus, uid } from "../lib/formato.js";
import { generarPDF } from "../lib/pdf.js";
import { ESTADO_LABELS, PRIORIDAD_ESTADO, SC_ENTREGA, STATUS_META, estadoEntrega, normalizarMuebles } from "../lib/produccion.js";
import { linkFicha, navegar, useRuta } from "../lib/rutas.js";
import { FichaObra } from "./FichaObra.jsx";
import { ModalInformeIA } from "./Produccion.jsx";

export function EntregasModule({ sesion, obras, proyectos, recargarObras }) {
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
