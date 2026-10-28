// Pestaña Avance de Obra (días, fotos e informe final)
import { useState, useEffect, useRef } from "react";
import { VisorFotos } from "../components/VisorFotos.jsx";
import { EnviarPorMail } from "../components/comunes.jsx";
import { avisar, confirmar } from "../lib/avisos.js";
import { apiFetch, b64ToBlob, deleteDiaAvanceById, deleteFileAvance, deleteObraAvanceById, getDiasAvance, getInformeFinal, getInformesFinalesObraIds, getObrasAvance, imgToBase64, insertDiaAvance, insertObraAvance, updateDiaAvance, updateObraAvance, uploadFileAvance, uploadFileInforme, upsertInformeFinal, vinculoEntregas } from "../lib/datos.js";
import { formatDate } from "../lib/formato.js";
import { generarPDFDiaAvance } from "../lib/pdf.js";

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
