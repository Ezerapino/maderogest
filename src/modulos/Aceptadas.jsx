// Pestaña Obras Aceptadas
import { useState, useEffect, useRef } from "react";
import { VisorFotos } from "../components/VisorFotos.jsx";
import { IMG_RE_ACEPTADA, esImagenAceptada, formatFileSizeAceptada, getFileIconAceptada } from "../lib/aceptadas.js";
import { avisar, confirmar } from "../lib/avisos.js";
import { b64ToBlob, crearObraConEntrega, deleteFileAvance, deleteObraAceptadaById, getObrasAceptadas, insertObraAceptada, updateObraAceptada, uploadFileObraAceptada } from "../lib/datos.js";
import { formatDate } from "../lib/formato.js";

export function ObrasAceptadasModule({ sesion, proyectos = [], recargarObras }) {
  const [obrasTodas, setObras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [search, setSearch] = useState("");
  const [mesFilter, setMesFilter] = useState("");
  const [modalObra, setModalObra] = useState(null);
  const [pasando, setPasando] = useState(null);

  const isAdmin = sesion.rol === "admin";
  const canEdit = isAdmin || sesion.rol === "operario" || sesion.rol === "arquitecto";
  const canDelete = isAdmin || sesion.rol === "operario";
  // Las vinculadas a una obra archivada no se muestran
  const proyectosArchivados = new Set(proyectos.filter(p => p.archivada).map(p => p.id));
  const obras = obrasTodas.filter(o => !proyectosArchivados.has(o.proyecto_id));
  const proyectosActivos = proyectos.filter(p => !p.archivada).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const obraEnEntregas = o => proyectos.find(p => p.id === o.proyecto_id);

  // Crea la obra en Entregas (con una primera entrega) y la deja vinculada
  async function pasarAEntregas(o) {
    if (!await confirmar(`¿Crear "${o.nombre}" como obra nueva en Entregas?\n\nSe crea con una primera entrega${o.fecha_entrega_aprox ? ` para el ${formatDate(o.fecha_entrega_aprox)}` : ""} y queda vinculada a esta obra aceptada. Los muebles se completan después en Entregas.`, { boton: "Crear obra", peligro: false })) return;
    setPasando(o.id);
    try {
      const { proyecto } = await crearObraConEntrega({
        nombre: o.nombre, lugar: o.direccion || "", sesion,
        entrega: { fecha: o.fecha_entrega_aprox, notas: o.descripcion || "", estado: "pendiente", muebles: [] },
      });
      await updateObraAceptada(o.id, { proyecto_id: proyecto.id, updated_at: new Date().toISOString() });
      await Promise.all([loadObras(), recargarObras()]);
    } catch (e) { avisar(`No se pudo crear la obra en Entregas: ${e.message}`, { tipo: "error" }); }
    setPasando(null);
  }

  async function loadObras() {
    setCargando(true);
    try { const obs = await getObrasAceptadas(); setObras(obs || []); } catch (e) { console.error("Error cargando obras aceptadas:", e); }
    setCargando(false);
  }

  // Carga inicial al abrir el módulo
  useEffect(() => { loadObras(); }, []);

  async function deleteObra(obra) {
    if (!await confirmar(`¿Eliminar la obra "${obra.nombre}" y todos sus archivos?`)) return;
    try {
      for (const f of (obra.archivos || [])) { try { await deleteFileAvance(f.path); } catch { /* si el archivo ya no existe se sigue igual */ } }
      await deleteObraAceptadaById(obra.id);
      setModalObra(null);
      await loadObras();
    } catch { avisar("Error al eliminar la obra.", { tipo: "error" }); }
  }

  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const esteMes = obras.filter(o => (o.fecha_aceptacion || "").startsWith(mesActual) || (o.fecha_entrega_aprox || "").startsWith(mesActual)).length;
  const conArchivos = obras.filter(o => (o.archivos || []).length > 0).length;

  const obrasFiltradas = obras.filter(o => {
    if (search) {
      const q = search.toLowerCase();
      if (!o.nombre.toLowerCase().includes(q) && !(o.direccion || "").toLowerCase().includes(q) && !(o.cliente || "").toLowerCase().includes(q)) return false;
    }
    if (mesFilter) {
      if (!(o.fecha_aceptacion || "").startsWith(mesFilter) && !(o.fecha_entrega_aprox || "").startsWith(mesFilter)) return false;
    }
    return true;
  });

  if (cargando) return <div style={{ textAlign:"center", padding:"60px 0", color:"#94A3B8", fontSize:13 }}>Cargando obras aceptadas...</div>;

  return (
    <div>
      {/* STATS */}
      <div className="grid-numeros" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:32 }}>
        {[
          { num: obras.length, label:"Total obras aceptadas", color:"#2563EB", border:"#DBEAFE" },
          { num: esteMes, label:"Este mes", color:"#D97706", border:"#FDE68A" },
          { num: conArchivos, label:"Con archivos adjuntos", color:"#059669", border:"#A7F3D0" },
        ].map((s, i) => (
          <div key={i} style={{ background:"#ffffff", border:`1px solid ${s.border}`, borderRadius:12, padding:"20px 20px 18px", animation:`fadeUp 0.35s ease ${i*0.06}s both` }}>
            <div style={{ fontFamily:"'Sora', sans-serif", fontSize:32, fontWeight:800, color:s.color, lineHeight:1 }}>{s.num}</div>
            <div style={{ fontSize:12, color:"#64748B", fontWeight:500, marginTop:6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* TITLE + FILTERS */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:12 }}>
        <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>Obras Aceptadas</h2>
        {canEdit && (
          <button onClick={() => setModalObra("nueva")}
            style={{ padding:"8px 18px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            + Nueva obra
          </button>
        )}
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative", flex:"1 1 200px", maxWidth:320 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar obra, dirección, cliente..."
            style={{ width:"100%", padding:"9px 12px 9px 36px", background:"#ffffff", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" }} />
          {search && <button onClick={() => setSearch("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#94A3B8", cursor:"pointer", fontSize:14, padding:2 }}>✕</button>}
        </div>
        <input type="month" value={mesFilter} onChange={e => setMesFilter(e.target.value)}
          style={{ padding:"9px 12px", background:"#ffffff", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" }} />
        {mesFilter && <button onClick={() => setMesFilter("")} style={{ padding:"6px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#64748B", fontSize:12, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Limpiar mes</button>}
        {(search || mesFilter) && <span style={{ fontSize:12, color:"#94A3B8" }}>{obrasFiltradas.length} resultado{obrasFiltradas.length !== 1 ? "s" : ""}</span>}
      </div>

      {/* GRID */}
      {obrasFiltradas.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🗂️</div>
          <div style={{ fontSize:13, color:"#94A3B8" }}>{obras.length === 0 ? "No hay obras aceptadas registradas aún" : "No hay obras en esta búsqueda/filtro"}</div>
        </div>
      ) : (
        <div className="grid-tarjetas" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:16 }}>
          {obrasFiltradas.map((o, idx) => (
            <div key={o.id} className="obra-card" onClick={() => setModalObra(o)}
              style={{ background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:14, overflow:"hidden", cursor:"pointer", animation:`fadeUp 0.35s ease ${idx*0.04}s both`, boxShadow:"0 1px 4px rgba(26,43,74,0.05)" }}>
              <div style={{ height:4, background:"#2563EB" }} />
              {(() => { const img = (o.archivos || []).find(esImagenAceptada); return img?.url ? (
                <img src={img.url} alt="" loading="lazy" style={{ width:"100%", height:140, objectFit:"cover", display:"block" }} />
              ) : null; })()}
              <div style={{ padding:"18px 18px 16px" }}>
                <div style={{ fontFamily:"'Sora', sans-serif", fontSize:15, fontWeight:700, color:"#1A2B4A", marginBottom:6, lineHeight:1.35 }}>{o.nombre}</div>
                {o.cliente && <div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}>👤 {o.cliente}</div>}
                {o.direccion && <div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}>📍 {o.direccion}</div>}
                <div style={{ fontSize:12, color:"#64748B", marginBottom:12, display:"flex", gap:12, flexWrap:"wrap" }}>
                  {o.fecha_aceptacion && <span>✅ Aceptada: {formatDate(o.fecha_aceptacion)}</span>}
                  {o.fecha_entrega_aprox && <span>📅 Entrega aprox: {formatDate(o.fecha_entrega_aprox)}</span>}
                </div>
                {o.descripcion && (
                  <div style={{ fontSize:12, color:"#475569", marginBottom:12, lineHeight:1.45, whiteSpace:"pre-line", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{o.descripcion}</div>
                )}
                {(() => {
                  const imgs = (o.archivos || []).filter(esImagenAceptada).length;
                  const docs = (o.archivos || []).length - imgs;
                  if (!imgs && !docs) return null;
                  const chip = { fontSize:11, color:"#2563EB", background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:6, padding:"3px 9px" };
                  return (
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                      {docs > 0 && <span style={chip}>📎 {docs} archivo{docs !== 1 ? "s" : ""}</span>}
                      {imgs > 0 && <span style={chip}>🖼️ {imgs} imagen{imgs !== 1 ? "es" : ""}</span>}
                    </div>
                  );
                })()}
                {obraEnEntregas(o) && (
                  <div style={{ fontSize:11, color:"#059669", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:6, padding:"4px 9px", marginBottom:12, display:"inline-block" }}>📦 En Entregas: {obraEnEntregas(o).nombre}</div>
                )}
                <div onClick={e => e.stopPropagation()} style={{ display:"flex", gap:6, paddingTop:12, borderTop:"1px solid #F1F5F9" }}>
                  <button onClick={() => setModalObra(o)} style={{ flex:1, padding:"7px 0", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>{canEdit ? "Editar" : "Ver"}</button>
                  {canEdit && !obraEnEntregas(o) && (
                    <button onClick={() => pasarAEntregas(o)} disabled={pasando === o.id} title="Crear esta obra en la pestaña Entregas"
                      style={{ flex:1, padding:"7px 0", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8, color:"#2563EB", fontSize:12, fontWeight:600, cursor: pasando === o.id ? "not-allowed" : "pointer", fontFamily:"'Inter', sans-serif" }}>
                      {pasando === o.id ? "Creando..." : "📦 Pasar a Entregas"}
                    </button>
                  )}
                  {canDelete && <button onClick={() => deleteObra(o)} style={{ padding:"7px 10px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:12, cursor:"pointer" }}>✕</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalObra && (
        <ModalObraAceptada
          obra={modalObra === "nueva" ? null : modalObra}
          proyectos={proyectosActivos}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => setModalObra(null)}
          onSave={loadObras}
          onDelete={deleteObra}
        />
      )}
    </div>
  );
}

function ModalObraAceptada({ obra, proyectos = [], canEdit, canDelete, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    nombre: obra?.nombre || "", direccion: obra?.direccion || "", cliente: obra?.cliente || "",
    fecha_aceptacion: obra?.fecha_aceptacion || "", fecha_entrega_aprox: obra?.fecha_entrega_aprox || "",
    descripcion: obra?.descripcion || "", proyecto_id: obra?.proyecto_id || "",
  });
  const [archivos, setArchivos] = useState(obra?.archivos || []);
  const [visor, setVisor] = useState(null); // { fotos, inicio }
  const [dragging, setDragging] = useState(false);
  const [draggingImg, setDraggingImg] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const imgInputRef = useRef(null);
  const originalArchivos = useRef(obra?.archivos || []);

  const inp = { width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box" };
  const lbl = { display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 };

  async function handleFiles(files, kind = "docs") {
    const nuevos = [];
    for (const file of Array.from(files)) {
      if (archivos.find(f => f.name === file.name)) continue;
      const okType = kind === "img" ? IMG_RE_ACEPTADA.test(file.name) : /\.(pdf|xls|xlsx|csv)$/i.test(file.name);
      if (!okType) { avisar(kind === "img" ? `"${file.name}" no es una imagen válida (JPG, PNG, WEBP, GIF).` : `"${file.name}" no es un PDF o Excel válido.`, { tipo: "aviso" }); continue; }
      const b64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      nuevos.push({ name: file.name, type: file.type, size: file.size, b64 });
    }
    setArchivos(a => [...a, ...nuevos]);
  }

  function removeFile(name) { setArchivos(a => a.filter(f => f.name !== name)); }

  async function handleSave() {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "Requerido";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    try {
      let obraId = obra?.id;
      const baseData = {
        nombre: form.nombre.trim(), direccion: form.direccion.trim(), cliente: form.cliente.trim(),
        fecha_aceptacion: form.fecha_aceptacion || null, fecha_entrega_aprox: form.fecha_entrega_aprox || null,
        descripcion: form.descripcion.trim(), proyecto_id: form.proyecto_id || null,
      };
      if (!obraId) {
        const inserted = await insertObraAceptada({ ...baseData, archivos: [] });
        obraId = inserted?.[0]?.id;
      } else {
        await updateObraAceptada(obraId, { ...baseData, updated_at: new Date().toISOString() });
      }
      for (const orig of originalArchivos.current) {
        if (orig.path && !archivos.find(a => a.path === orig.path)) { try { await deleteFileAvance(orig.path); } catch { /* si el archivo ya no existe se sigue igual */ } }
      }
      const archivosFinal = [];
      for (const f of archivos) {
        if (f.path) { archivosFinal.push({ name: f.name, type: f.type, size: f.size, url: f.url, path: f.path }); }
        else if (f.b64) {
          try {
            const blob = b64ToBlob(f.b64, f.type);
            const file = new File([blob], f.name, { type: f.type });
            const uploaded = await uploadFileObraAceptada(file, obraId);
            archivosFinal.push(uploaded);
          } catch (err) { avisar(`Error al subir ${f.name}: ${err.message}`, { tipo: "error" }); }
        }
      }
      await updateObraAceptada(obraId, { archivos: archivosFinal, updated_at: new Date().toISOString() });
      await onSave();
      onClose();
    } catch (e) { avisar("Error al guardar: " + e.message, { tipo: "error" }); }
    setSaving(false);
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:580, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"#ffffff", borderRadius:"14px 14px 0 0", zIndex:1 }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{obra ? (canEdit ? "Editar obra aceptada" : "Obra aceptada") : "Nueva obra aceptada"}</h2>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"24px" }}>
          <fieldset disabled={!canEdit} style={{ border:"none", padding:0, margin:0 }}>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Nombre de la obra *</label>
              <input style={{ ...inp, borderColor: errors.nombre ? "#FCA5A5" : "#E2E8F0" }} value={form.nombre}
                onChange={e => { setForm(f => ({...f, nombre:e.target.value})); setErrors(er => ({...er, nombre:""})); }}
                placeholder="Ej: Remodelación Cocina" autoFocus />
              {errors.nombre && <div style={{ color:"#DC2626", fontSize:11, marginTop:4 }}>{errors.nombre}</div>}
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Dirección de la obra</label>
              <input style={inp} value={form.direccion} onChange={e => setForm(f => ({...f, direccion:e.target.value}))} placeholder="Calle, número, barrio..." />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Nombre del cliente</label>
              <input style={inp} value={form.cliente} onChange={e => setForm(f => ({...f, cliente:e.target.value}))} placeholder="Nombre del cliente" />
            </div>
            <div className="grid-form" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
              <div>
                <label style={lbl}>Fecha de aceptación</label>
                <input type="date" style={inp} value={form.fecha_aceptacion} onChange={e => setForm(f => ({...f, fecha_aceptacion:e.target.value}))} />
              </div>
              <div>
                <label style={lbl}>Fecha aprox. de entrega</label>
                <input type="date" style={inp} value={form.fecha_entrega_aprox} onChange={e => setForm(f => ({...f, fecha_entrega_aprox:e.target.value}))} />
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Descripción</label>
              <textarea style={{ ...inp, minHeight:110, resize:"vertical", lineHeight:1.5 }} value={form.descripcion}
                onChange={e => setForm(f => ({...f, descripcion:e.target.value}))}
                placeholder={"Qué hay que hacer, materiales necesarios, items a fabricar y entregar...\nEj:\n- 2 bajo mesadas melamina blanca 18mm\n- 1 placard 3 puertas"} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Obra en Entregas</label>
              <select style={inp} value={form.proyecto_id} onChange={e => setForm(f => ({...f, proyecto_id:e.target.value}))}>
                <option value="">— Todavía no está en Entregas —</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.lugar ? ` — ${p.lugar}` : ""}</option>)}
              </select>
              <div style={{ fontSize:11, color:"#94A3B8", marginTop:4 }}>Si la obra ya existe en Entregas, elegila para que quede vinculada (si se archiva allá, se archiva acá).</div>
            </div>
          </fieldset>

          {/* IMÁGENES */}
          <div style={{ marginBottom:20 }}>
            <label style={lbl}>Imágenes (JPG / PNG / WEBP / GIF)</label>
            {canEdit && (
              <div
                onClick={() => imgInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDraggingImg(true); }}
                onDragLeave={() => setDraggingImg(false)}
                onDrop={e => { e.preventDefault(); setDraggingImg(false); handleFiles(e.dataTransfer.files, "img"); }}
                style={{ border:`2px dashed ${draggingImg ? "#2563EB" : "#CBD5E1"}`, borderRadius:10, padding:"22px 16px", textAlign:"center", cursor:"pointer", background: draggingImg ? "rgba(37,99,235,0.04)" : "#F8FAFC", marginBottom:10, transition:"all 0.15s" }}>
                <div style={{ fontSize:28, marginBottom:6, color:"#94A3B8" }}>🖼️</div>
                <div style={{ fontSize:13, color:"#64748B" }}>Arrastrá imágenes aquí o hacé clic para seleccionar</div>
                <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>JPG, PNG, WEBP, GIF</div>
                <input ref={imgInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,image/*"
                  style={{ display:"none" }} onChange={e => { if (e.target.files?.length) handleFiles(e.target.files, "img"); e.target.value=""; }} />
              </div>
            )}
            {archivos.filter(esImagenAceptada).length === 0 ? (
              <div style={{ color:"#94A3B8", fontSize:12, textAlign:"center", padding:"10px 0" }}>Sin imágenes</div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(110px, 1fr))", gap:8 }}>
                {archivos.filter(esImagenAceptada).map((f, fi, imgs) => (
                  <div key={f.name} style={{ position:"relative", borderRadius:8, overflow:"hidden", border:"1px solid #E2E8F0", aspectRatio:"1 / 1", background:"#F8FAFC" }}>
                    <img src={f.url || f.b64} alt={f.name} title="Ver en grande" onClick={() => setVisor({ fotos: imgs, inicio: fi })}
                      style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", cursor:"zoom-in" }} />
                    {!f.path && <div style={{ position:"absolute", left:0, right:0, bottom:0, background:"rgba(15,23,42,0.65)", color:"#fff", fontSize:10, padding:"2px 6px" }}>pendiente de subir</div>}
                    {canEdit && <button onClick={() => removeFile(f.name)} title="Quitar imagen"
                      style={{ position:"absolute", top:4, right:4, width:22, height:22, borderRadius:"50%", border:"none", background:"rgba(15,23,42,0.7)", color:"#fff", cursor:"pointer", fontSize:12, padding:0 }}>✕</button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ARCHIVOS */}
          <div style={{ marginBottom:20 }}>
            <label style={lbl}>Archivos (PDF / Excel)</label>
            {canEdit && (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
                style={{ border:`2px dashed ${dragging ? "#2563EB" : "#CBD5E1"}`, borderRadius:10, padding:"22px 16px", textAlign:"center", cursor:"pointer", background: dragging ? "rgba(37,99,235,0.04)" : "#F8FAFC", marginBottom:10, transition:"all 0.15s" }}>
                <div style={{ fontSize:28, marginBottom:6, color:"#94A3B8" }}>📎</div>
                <div style={{ fontSize:13, color:"#64748B" }}>Arrastrá archivos aquí o hacé clic para seleccionar</div>
                <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>Solo PDF y Excel (.xls, .xlsx, .csv)</div>
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.xls,.xlsx,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display:"none" }} onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value=""; }} />
              </div>
            )}
            {archivos.filter(f => !esImagenAceptada(f)).length === 0 ? (
              <div style={{ color:"#94A3B8", fontSize:12, textAlign:"center", padding:"10px 0" }}>Sin archivos adjuntos</div>
            ) : (
              <div style={{ border:"1px solid #E2E8F0", borderRadius:10, overflow:"hidden" }}>
                {archivos.filter(f => !esImagenAceptada(f)).map((f, i, docs) => (
                  <div key={f.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderBottom: i < docs.length-1 ? "1px solid #F1F5F9" : "none" }}>
                    <span style={{ fontSize:20 }}>{getFileIconAceptada(f.type)}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:"#1A2B4A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
                      <div style={{ fontSize:11, color:"#94A3B8" }}>{formatFileSizeAceptada(f.size)}{f.path ? " · guardado" : " · pendiente de subir"}</div>
                    </div>
                    {f.url && <>
                      <a href={f.url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#2563EB", textDecoration:"none", fontWeight:600, whiteSpace:"nowrap" }}>Ver</a>
                      <a href={f.url} download={f.name} style={{ fontSize:11, color:"#2563EB", textDecoration:"none", fontWeight:600, whiteSpace:"nowrap" }}>Descargar</a>
                    </>}
                    {canEdit && <button onClick={() => removeFile(f.name)} style={{ background:"none", border:"none", color:"#CBD5E1", cursor:"pointer", fontSize:16, padding:"0 2px" }}
                      onMouseEnter={e => e.currentTarget.style.color="#EF4444"} onMouseLeave={e => e.currentTarget.style.color="#CBD5E1"}>✕</button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display:"flex", gap:10 }}>
            {obra && canDelete && (
              <button onClick={() => onDelete(obra)} style={{ padding:"11px 16px", border:"1px solid #FECACA", borderRadius:8, background:"#FEF2F2", color:"#DC2626", cursor:"pointer", fontSize:13, fontWeight:500 }}>Eliminar</button>
            )}
            <button onClick={onClose} style={{ flex:1, padding:"11px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>{canEdit ? "Cancelar" : "Cerrar"}</button>
            {canEdit && (
              <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:"11px", border:"none", borderRadius:8, background: saving ? "#94A3B8" : "#1A2B4A", color:"#fff", cursor: saving ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            )}
          </div>
        </div>
      </div>
      {visor && <VisorFotos fotos={visor.fotos} inicio={visor.inicio} onCerrar={() => setVisor(null)} />}
    </div>
  );
}
