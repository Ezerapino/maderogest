// Pestaña Cobros
import { useState, useEffect } from "react";
import { ModalElegirEntrega } from "../components/comunes.jsx";
import { avisar, confirmar } from "../lib/avisos.js";
import { deleteCobro, getCobros, insertCobro, modificarFila, vinculoEntregas } from "../lib/datos.js";
import { formatDate, uid } from "../lib/formato.js";

// ═══════════════════════════════════════════════════════════════════════════════
// COBROS MODULE
// ═══════════════════════════════════════════════════════════════════════════════
export function CobrosModule({ entregas = [] }) {
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
