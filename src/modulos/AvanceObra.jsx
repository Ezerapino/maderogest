// Pestaña Avance de Obra (días, fotos e informe final)
import { useState, useEffect } from "react";
import { VisorFotos } from "../components/VisorFotos.jsx";
import { BotonFicha } from "../components/comunes.jsx";
import { avisar, confirmar } from "../lib/avisos.js";
import { deleteDiaAvanceById, modificarFila, deleteFileAvance, deleteObraAvanceById, getDiasAvance, getInformesFinalesObraIds, getObrasAvance, insertDiaAvance, insertObraAvance, updateDiaAvance, updateObraAvance, uploadFileAvance, vinculoEntregas } from "../lib/datos.js";
import { formatDate } from "../lib/formato.js";
import { generarPDFDiaAvance } from "../lib/pdf.js";
import { CerrarConAtras } from "../lib/atras.js";
import { Icono } from "../components/Icono.jsx";
import { InformeFinal } from "./InformeFinal.jsx";
import { FichasTecnicas } from "./FichasTecnicas.jsx";
import { getFichasResumen } from "../lib/datos.js";

// ═══════════════════════════════════════════════════════════════════════════════
// AVANCE DE OBRA MODULE (nuevo — con días y fotos)
// ═══════════════════════════════════════════════════════════════════════════════
export function AvanceObraModule({ sesion, entregas = [] }) {
  const [obrasTodas, setObras] = useState([]);
  const { activas, archivadas } = vinculoEntregas(entregas);
  // Lo de entregas archivadas no se muestra
  const obras = obrasTodas.filter(o => !archivadas.has(o.obra_id));
  const [cargando, setCargando] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filtroObras, setFiltroObras] = useState("curso");   // curso | finalizadas | todas
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
  const [informesIds, setInformesIds] = useState(new Map());   // obra_id → { firmado_en }

  const isAdmin = sesion.rol === "admin";
  const canEdit = isAdmin || sesion.rol === "operario" || sesion.rol === "arquitecto";

  // Fichas técnicas: cuántas tiene cada obra (última versión de cada N°) y cuántas están firmadas
  const [fichasObra, setFichasObra] = useState(null);
  const [fichasResumen, setFichasResumen] = useState(new Map());
  async function loadFichas() {
    try {
      const ultimas = new Map();
      for (const f of await getFichasResumen()) { const k = `${f.obra_id}#${f.numero}`; if (!ultimas.has(k) || ultimas.get(k).revision < f.revision) ultimas.set(k, f); }
      const m = new Map();
      for (const f of ultimas.values()) { const r = m.get(f.obra_id) || { total: 0, firmadas: 0 }; r.total++; if (f.firmado_en) r.firmadas++; m.set(f.obra_id, r); }
      setFichasResumen(m);
    } catch (e) { console.error("Error cargando fichas técnicas:", e); }
  }
  const textoFichas = id => { const r = fichasResumen.get(id); return r ? `Fichas (${r.total})` : "Fichas"; };

  async function loadInformesIds() {
    try { const filas = await getInformesFinalesObraIds(); setInformesIds(new Map(filas.map(i => [i.obra_id, i]))); } catch (e) { console.error("Error cargando informes finales:", e); }
  }

  async function loadObras() {
    // "cargando" arranca en true: las recargas después de guardar no vuelven a tapar la pantalla
    try { const obs = await getObrasAvance(); setObras(obs || []); } catch (e) { console.error("Error cargando obras de avance:", e); }
    setCargando(false);
  }

  // Carga inicial al abrir el módulo (cargando ya arranca en true, el setCargando(true) no re-renderiza)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadObras(); loadInformesIds(); loadFichas(); }, []);

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
      const nuevos = [];
      for (const file of Array.from(files)) {
        try { nuevos.push(await uploadFileAvance(file, selected.id)); }
        catch (e) { avisar(`Error al subir ${file.name}: ${e.message}`, { tipo: "error" }); }
      }
      // Se suman a lo último guardado (no a lo que había en pantalla), para no pisar fotos que subió otra persona
      if (nuevos.length) await modificarFila("avance_dias", diaId, d => ({ archivos: [...(d.archivos || []), ...nuevos] }));
      await loadDias(selected.id);
    } catch (e) { console.error("Error guardando los archivos del día:", e); avisar(`No se pudieron guardar los archivos: ${e.message}`, { tipo: "error" }); }
    setUploadingFiles(s => ({ ...s, [diaId]: false }));
  }

  // El archivo se busca por su ruta en lo último guardado (no por su posición en pantalla, que pudo cambiar)
  async function deleteFile(diaId, archivo) {
    if (!archivo || !await confirmar("¿Eliminar este archivo?")) return;
    try {
      await modificarFila("avance_dias", diaId, d => ({ archivos: (d.archivos || []).filter(f => (f.path || f.url) !== (archivo.path || archivo.url)) }));
      if (archivo.path) { try { await deleteFileAvance(archivo.path); } catch { /* si el archivo ya no existe se sigue igual */ } }
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
  const obrasVisibles = filtroObras === "curso" ? obrasActivas : filtroObras === "finalizadas" ? obrasFinalizadas : obras;

  if (cargando) return <div style={{ textAlign:"center", padding:"60px 0", color:"#94A3B8", fontSize:13 }}>Cargando avance de obras...</div>;

  return (
    <div>
      <div className="grid-numeros" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:32 }}>
        {[
          { num: obras.length, label:"Total obras", color:"#2563EB", border:"#DBEAFE", f:"todas" },
          { num: obrasActivas.length, label:"En curso", color:"#D97706", border:"#FDE68A", f:"curso" },
          { num: obrasFinalizadas.length, label:"Finalizadas", color:"#059669", border:"#A7F3D0", f:"finalizadas" },
        ].map((s, i) => (
          <button key={i} onClick={() => setFiltroObras(s.f)} title="Ver estas obras" aria-pressed={filtroObras === s.f}
            style={{ background:"#ffffff", border:`${filtroObras === s.f ? 2 : 1}px solid ${s.border}`, borderRadius:12, padding:"20px 20px 18px", textAlign:"left", cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            <div style={{ fontFamily:"'Sora', sans-serif", fontSize:32, fontWeight:800, color:s.color, lineHeight:1 }}>{s.num}</div>
            <div style={{ fontSize:12, color:"#64748B", fontWeight:500, marginTop:6 }}>{s.label}</div>
          </button>
        ))}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>Obras — Avance de Obra</h2>
        <div className="barra-filtros" style={{ display:"flex", gap:4, background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:10, padding:4, marginLeft:"auto" }}>
          {[{ key:"curso", label:"En curso" }, { key:"finalizadas", label:"Finalizadas" }, { key:"todas", label:"Todas" }].map(f => (
            <button key={f.key} onClick={() => setFiltroObras(f.key)} className="filter-btn"
              style={{ padding:"6px 14px", borderRadius:7, border:"none", background: filtroObras === f.key ? "#1A2B4A" : "transparent", color: filtroObras === f.key ? "#ffffff" : "#64748B", fontFamily:"'Inter', sans-serif", fontSize:12, fontWeight: filtroObras === f.key ? 600 : 400, cursor:"pointer" }}>
              {f.label}
            </button>
          ))}
        </div>
        {canEdit && (
          <button onClick={() => { setEditingObra(null); setShowObraModal(true); }} title="Agregar a Avance de Obra una entrega de la pestaña Entregas"
            style={{ padding:"8px 18px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            <Icono n="link" /> Vincular entrega
          </button>
        )}
      </div>

      {obrasVisibles.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
          <div style={{ fontSize:13, color:"#94A3B8" }}>{!obras.length ? "No hay obras registradas aún" : filtroObras === "curso" ? "No hay obras en curso" : "No hay obras finalizadas"}</div>
        </div>
      ) : (
        <div className="grid-tarjetas" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:16 }}>
          {obrasVisibles.map((obra, idx) => (
            <div key={obra.id} onClick={() => { setSelected(obra); loadDias(obra.id); }}
              style={{ background:"#ffffff", border: obra.finalizada ? "1px solid #A7F3D0" : "1px solid #E8ECF0", borderRadius:14, overflow:"hidden", cursor:"pointer", animation:`fadeUp 0.35s ease ${idx*0.04}s both`, boxShadow:"0 1px 4px rgba(26,43,74,0.05)" }}>
              <div style={{ height:4, background: obra.finalizada ? "#059669" : "#2563EB" }} />
              <div style={{ padding:"18px 18px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ fontFamily:"'Sora', sans-serif", fontSize:15, fontWeight:700, color:"#1A2B4A", flex:1, paddingRight:8 }}>{obra.nombre}</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end", flexShrink:0 }}>
                    {obra.finalizada && <span style={{ fontSize:10, fontWeight:700, color:"#059669", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:5, padding:"2px 8px", whiteSpace:"nowrap" }}><Icono n="checkCirculo" /> FINALIZADA</span>}
                    {informesIds.get(obra.id)?.firmado_en ? <span style={{ fontSize:10, fontWeight:700, color:"#059669", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:5, padding:"2px 8px", whiteSpace:"nowrap" }}><Icono n="editar" /> INFORME FIRMADO</span>
                      : informesIds.has(obra.id) ? <span style={{ fontSize:10, fontWeight:700, color:"#7C3AED", background:"#F5F3FF", border:"1px solid #DDD6FE", borderRadius:5, padding:"2px 8px", whiteSpace:"nowrap" }}><Icono n="guardar" /> INFORME GUARDADO</span> : null}
                  </div>
                </div>
                {obra.direccion && <div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}><Icono n="ubicacion" /> {obra.direccion}</div>}
                {obra.fecha_entrega && <div style={{ fontSize:12, color:"#64748B", marginBottom:12 }}><Icono n="calendario" /> Entrega: {formatDate(obra.fecha_entrega)}</div>}
                <div onClick={e => e.stopPropagation()} style={{ display:"flex", gap:6, paddingTop:12, borderTop:"1px solid #F1F5F9" }}>
                  {canEdit && <button onClick={() => { setEditingObra(obra); setShowObraModal(true); }} style={{ flex:1, padding:"7px 0", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Editar</button>}
                  {canEdit && (
                    <button onClick={() => marcarFinalizada(obra)}
                      style={{ flex:1, padding:"7px 0", background: obra.finalizada ? "#F8FAFC" : "#ECFDF5", border:`1px solid ${obra.finalizada ? "#E2E8F0" : "#A7F3D0"}`, borderRadius:8, color: obra.finalizada ? "#475569" : "#059669", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
                      {obra.finalizada ? "Reabrir" : "Finalizar"}
                    </button>
                  )}
                  {obra.finalizada && <button onClick={() => { setInformeFinalObra(obra); setShowInformeFinal(true); }} style={{ flex:1, padding:"7px 0", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8, color:"#2563EB", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}><Icono n="lista" /> Informe</button>}
                  <button onClick={() => setFichasObra(obra)} title="Fichas técnicas de mobiliario (materiales, herrajes, medidas) con firma de conformidad" style={{ flex:1, padding:"7px 0", background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:8, color:"#C2410C", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif", whiteSpace:"nowrap" }}><Icono n="regla" /> {textoFichas(obra.id)}</button>
                  {(isAdmin || sesion.rol === "operario") && <button onClick={() => deleteObra(obra.id)} style={{ padding:"7px 10px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:12, cursor:"pointer" }}><Icono n="cerrar" /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div onClick={e => e.target === e.currentTarget && setSelected(null)} className="modal-fondo"
          style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <CerrarConAtras onClose={() => setSelected(null)} />
          <div className="modal-caja" style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:720, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
            <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"flex-start", position:"sticky", top:0, background:"#fff", zIndex:10, borderRadius:"14px 14px 0 0" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>{selected.nombre}</h2>
                  {selected.finalizada && <span style={{ fontSize:10, fontWeight:700, color:"#059669", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:5, padding:"2px 8px" }}><Icono n="checkCirculo" /> FINALIZADA</span>}
                </div>
                {selected.direccion && <div style={{ fontSize:12, color:"#64748B", marginTop:3 }}><Icono n="ubicacion" /> {selected.direccion}</div>}
                {selected.fecha_entrega && <div style={{ fontSize:12, color:"#64748B" }}><Icono n="calendario" /> Entrega pactada: {formatDate(selected.fecha_entrega)}</div>}
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
                <button onClick={() => setFichasObra(selected)}
                  style={{ padding:"7px 14px", background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:8, color:"#C2410C", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                  <Icono n="regla" /> {fichasResumen.get(selected.id) ? `Fichas técnicas (${fichasResumen.get(selected.id).total})` : "Fichas técnicas"}
                </button>
                {selected.finalizada && (
                  <button onClick={() => { setInformeFinalObra(selected); setShowInformeFinal(true); }}
                    style={{ padding:"7px 14px", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8, color:"#2563EB", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    <Icono n="lista" /> Informe Final
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => marcarFinalizada(selected)}
                    style={{ padding:"7px 14px", background: selected.finalizada ? "#F8FAFC" : "#ECFDF5", border:`1px solid ${selected.finalizada ? "#E2E8F0" : "#A7F3D0"}`, borderRadius:8, color: selected.finalizada ? "#475569" : "#059669", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    {selected.finalizada ? "Reabrir obra" : <><Icono n="checkCirculo" /> Finalizar obra</>}
                  </button>
                )}
                <BotonFicha entrega={entregas.find(e => e.id === selected.obra_id)} />
                <button onClick={() => setSelected(null)} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16, flexShrink:0 }}><Icono n="cerrar" /></button>
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
                            {dia.operarios && <div style={{ fontSize:12, color:"#64748B", marginTop:2 }}><Icono n="casco" /> {dia.operarios}</div>}
                          </div>
                          <div style={{ display:"flex", gap:6 }}>
                            <button onClick={() => generarPDFDiaAvance(selected, dia)}
                              style={{ padding:"5px 10px", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:7, color:"#2563EB", fontSize:11, fontWeight:600, cursor:"pointer" }}><Icono n="documento" /> PDF</button>
                            {canEdit && <>
                              <button onClick={() => { setEditingDia(dia); setShowDiaModal(true); }} style={{ padding:"5px 10px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:7, color:"#475569", fontSize:11, cursor:"pointer" }}>Editar</button>
                              <button onClick={() => deleteDia(dia.id)} style={{ padding:"5px 8px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:7, color:"#DC2626", fontSize:11, cursor:"pointer" }}><Icono n="cerrar" /></button>
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
                                  return (
                                    <div key={fi} style={{ position:"relative" }}>
                                      <img src={f.url} alt={f.name} title="Ver en grande" onClick={() => setVisor({ fotos, inicio: fi })}
                                        style={{ width:90, height:90, objectFit:"cover", borderRadius:8, border:"1px solid #E2E8F0", display:"block", cursor:"zoom-in" }} />
                                      {canEdit && <button onClick={() => deleteFile(dia.id, f)} style={{ position:"absolute", top:3, right:3, width:20, height:20, background:"rgba(220,38,38,0.85)", border:"none", borderRadius:"50%", color:"#fff", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0, lineHeight:1 }}><Icono n="cerrar" /></button>}
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
                                return (
                                  <div key={fi} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:7, marginBottom:4 }}>
                                    <span style={{ fontSize:12, color:"#475569", flex:1 }}><Icono n="clip" /> {f.name}</span>
                                    <a href={f.url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#2563EB", textDecoration:"none" }}>Ver</a>
                                    {canEdit && <button onClick={() => deleteFile(dia.id, f)} style={{ background:"none", border:"none", color:"#CBD5E1", cursor:"pointer", fontSize:13, padding:0 }} onMouseEnter={e=>e.currentTarget.style.color="#EF4444"} onMouseLeave={e=>e.currentTarget.style.color="#CBD5E1"}><Icono n="cerrar" /></button>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {canEdit && (
                            <label style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", background:"#F8FAFC", border:"1px dashed #CBD5E1", borderRadius:8, cursor: uploadingFiles[dia.id] ? "not-allowed" : "pointer", fontSize:12, color:"#64748B" }}>
                              {uploadingFiles[dia.id] ? "Subiendo..." : <><Icono n="clip" /> Subir archivos / fotos</>}
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
      {fichasObra && <FichasTecnicas obra={fichasObra} sesion={sesion} onClose={() => setFichasObra(null)} onCambio={loadFichas} />}
      {showInformeFinal && informeFinalObra &&<InformeFinal obra={informeFinalObra} sesion={sesion} puedeEditar={canEdit} onClose={() => { setShowInformeFinal(false); setInformeFinalObra(null); }} onSave={() => loadInformesIds()} />}
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
    <div onClick={e => e.target === e.currentTarget && onClose()} className="modal-fondo" style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <CerrarConAtras onClose={() => onClose()} />
      <div className="modal-caja" style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:460, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{obra ? "Editar obra" : "Vincular una entrega a Avance de Obra"}</h2>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}><Icono n="cerrar" /></button>
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

export function ModalDiaAvance({ dia, onClose, onSave }) {
  const [form, setForm] = useState({ fecha: dia?.fecha || "", detalle: dia?.detalle || "", operarios: dia?.operarios || "" });
  const [saving, setSaving] = useState(false);
  const si = { width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box" };

  async function handleSave() {
    setSaving(true);
    await onSave({ fecha: form.fecha || null, detalle: form.detalle, operarios: form.operarios });
    setSaving(false);
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} className="modal-fondo" style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <CerrarConAtras onClose={() => onClose()} />
      <div className="modal-caja" style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:460, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{dia ? "Editar día" : "Agregar día"}</h2>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}><Icono n="cerrar" /></button>
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
