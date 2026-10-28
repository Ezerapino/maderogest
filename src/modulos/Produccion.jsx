// Pestaña Avance de Producción
import { useState, useEffect } from "react";
import { EnviarPorMail, ModalElegirEntrega, ModalSimple } from "../components/comunes.jsx";
import { avisar, confirmar } from "../lib/avisos.js";
import { apiFetch, deleteAixaObraApi, getAixaObras, getAixaUsers, insertAixaObra, modificarFila, vinculoEntregas } from "../lib/datos.js";
import { fmtDateAixa, fmtDateTimeAixa, fmtDurAixa } from "../lib/formato.js";
import { generarInformeCierre, ofrecerInformeCierre } from "../lib/pdf.js";
import { cambioEstacion, camposEstacion, daysDelayedAixa, isDelayedAixa, mkStations, obraProgressAixa } from "../lib/produccion.js";

// ═══════════════════════════════════════════════════════════════════════════════
// AVANCE DE OBRA MODULE (Aixaobra)
// ═══════════════════════════════════════════════════════════════════════════════
export function AvanceModule({ sesion, entregas = [] }) {
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

// Informe general de una obra hecho con Claude (desde Entregas): se puede regenerar, imprimir y mandar por mail
export function ModalInformeIA({ proyecto, onClose }) {
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
