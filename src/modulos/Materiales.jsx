// Pestaña Materiales
import { useState, useEffect, useRef } from "react";
import { ModalElegirEntrega } from "../components/comunes.jsx";
import { avisar, confirmar } from "../lib/avisos.js";
import { apiFetch, deleteMaterialById, enviarAvisoAhora, getMateriales, getObrasAceptadas, insertMaterial, modificarFila, uploadArchivoImportacion, vinculoEntregas } from "../lib/datos.js";
import { diasHastaFecha, fmtDateAixa, sinAcentos, textoDiasEntrega, uid } from "../lib/formato.js";
import { CAMPOS_BUSQUEDA_MAT, DIAS_ALERTA_MAT, ESTADOS_MAT, ESTADOS_MAT_PEDIR, ESTADO_MAT_COLORS, EXT_IMPORTABLES, TERMINACIONES, TIPOS_MATERIAL, UNIDADES, alertasMateriales, detalleFaltante, entregaDeLista, extArchivo, normNombreObra, resumenMateriales } from "../lib/materiales.js";
import { generarPDFMateriales } from "../lib/pdf.js";

function ImportarMaterialesIA({ lista, onClose, onAgregar }) {
  const [adjuntos, setAdjuntos] = useState([]);
  const [paso, setPaso] = useState("elegir"); // elegir | leyendo | revisar
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [observaciones, setObservaciones] = useState("");
  const [archivoNombre, setArchivoNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef(null);

  // Adjuntos de Obras Aceptadas que se pueden leer (primero los de la obra con el mismo nombre)
  useEffect(() => {
    getObrasAceptadas().then(obs => {
      const n = normNombreObra(lista.obra_nombre);
      const archivos = (obs || []).flatMap(o => (o.archivos || [])
        .filter(f => f.path && EXT_IMPORTABLES.includes(extArchivo(f.name || f.path)))
        .map(f => ({ ...f, obra: o.nombre, coincide: normNombreObra(o.nombre) === n })));
      archivos.sort((a, b) => (b.coincide - a.coincide) || (a.obra || "").localeCompare(b.obra || ""));
      setAdjuntos(archivos);
    }).catch(() => {});
  }, [lista.obra_nombre]);

  async function leer(path, nombre) {
    setError(""); setArchivoNombre(nombre); setPaso("leyendo");
    try {
      const r = await apiFetch("/api/extraer-materiales", { method: "POST", body: JSON.stringify({ path, nombre }) });
      if (!r.items.length) { setError("Claude no encontró materiales en ese documento." + (r.observaciones ? ` ${r.observaciones}` : "")); setPaso("elegir"); return; }
      setItems(r.items.map(it => ({ ...it, id: uid(), incluir: true, estado: "pendiente" })));
      setObservaciones(r.observaciones || "");
      setPaso("revisar");
    } catch (e) { setError(e.message); setPaso("elegir"); }
  }

  async function subirYLeer(file) {
    if (!file) return;
    if (!EXT_IMPORTABLES.includes(extArchivo(file.name))) { setError("Formato no soportado. Usá PDF, Excel, CSV o una imagen."); return; }
    setError(""); setArchivoNombre(file.name); setPaso("leyendo");
    try { await leer(await uploadArchivoImportacion(file, lista.id), file.name); }
    catch (e) { setError(e.message); setPaso("elegir"); }
  }

  function setItem(id, campo, valor) { setItems(xs => xs.map(x => x.id === id ? { ...x, [campo]: valor } : x)); }

  async function agregar() {
    const elegidos = items.filter(i => i.incluir && i.nombre.trim()).map(i => ({ ...i, incluir: undefined })).map(it => ({ ...it, nombre: it.nombre.trim(), notas: [it.notas, `Importado de ${archivoNombre}`].filter(Boolean).join(" · ") }));
    if (!elegidos.length) return;
    setGuardando(true);
    try { await onAgregar(elegidos); onClose(); } catch { setGuardando(false); }
  }

  const inp = { width:"100%", padding:"6px 8px", background:"#fff", border:"1px solid #E2E8F0", borderRadius:6, color:"#1A2B4A", fontSize:12, outline:"none", boxSizing:"border-box", fontFamily:"'Inter', sans-serif" };
  const incluidos = items.filter(i => i.incluir).length;

  return (
    <div onClick={e => e.target === e.currentTarget && paso !== "leyendo" && onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", zIndex:320, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth: paso === "revisar" ? 980 : 560, maxHeight:"92vh", overflowY:"auto", padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:0 }}>✨ Cargar materiales con Claude</h3>
          {paso !== "leyendo" && <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:32, height:32, cursor:"pointer", color:"#64748B" }}>✕</button>}
        </div>
        <div style={{ fontSize:12, color:"#64748B", marginBottom:16 }}>{lista.obra_nombre} · Claude lee el presupuesto, plano o planilla y arma la lista. Revisala antes de agregarla.</div>

        {error && <div style={{ padding:"10px 14px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:13, marginBottom:14 }}>{error}</div>}

        {paso === "elegir" && (
          <>
            <div onClick={() => fileRef.current?.click()}
              style={{ border:"2px dashed #CBD5E1", borderRadius:10, padding:"22px 16px", textAlign:"center", cursor:"pointer", marginBottom:16, background:"#F8FAFC" }}>
              <div style={{ fontSize:26 }}>📄</div>
              <div style={{ fontSize:13, fontWeight:600, color:"#1A2B4A", marginTop:4 }}>Subir un archivo</div>
              <div style={{ fontSize:11, color:"#94A3B8" }}>PDF, Excel (xlsx/xls), CSV o foto (JPG/PNG)</div>
              <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.xlsm,.ods,.csv,.jpg,.jpeg,.png,.webp" style={{ display:"none" }}
                onChange={e => { subirYLeer(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <div style={{ fontSize:12, fontWeight:600, color:"#475569", marginBottom:8 }}>O elegí un adjunto de Obras Aceptadas</div>
            {adjuntos.length === 0 ? <div style={{ fontSize:12, color:"#94A3B8" }}>No hay adjuntos PDF/Excel en Obras Aceptadas.</div> : (
              <div style={{ border:"1px solid #E2E8F0", borderRadius:10, maxHeight:260, overflowY:"auto" }}>
                {adjuntos.map((f, i) => (
                  <div key={f.path} onClick={() => leer(f.path, f.name)}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", cursor:"pointer", borderBottom: i < adjuntos.length - 1 ? "1px solid #F1F5F9" : "none", background: f.coincide ? "#F0FDF4" : "#fff" }}>
                    <span>{extArchivo(f.name) === "pdf" ? "📕" : ["jpg","jpeg","png","webp"].includes(extArchivo(f.name)) ? "🖼" : "📗"}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, color:"#1A2B4A", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
                      <div style={{ fontSize:11, color:"#94A3B8" }}>{f.obra}{f.coincide ? " · esta obra" : ""}</div>
                    </div>
                    <span style={{ fontSize:12, color:"#0F766E", fontWeight:600 }}>Leer →</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {paso === "leyendo" && (
          <div style={{ textAlign:"center", padding:"40px 10px" }}>
            <div style={{ fontSize:30, marginBottom:10 }}>⏳</div>
            <div style={{ fontSize:14, fontWeight:600, color:"#1A2B4A" }}>Claude está leyendo "{archivoNombre}"…</div>
            <div style={{ fontSize:12, color:"#94A3B8", marginTop:6 }}>Según el tamaño del documento puede tardar entre 20 segundos y un par de minutos. No cierres esta ventana.</div>
          </div>
        )}

        {paso === "revisar" && (
          <>
            {observaciones && <div style={{ padding:"10px 14px", background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:8, color:"#92400E", fontSize:12, marginBottom:12 }}>💬 {observaciones}</div>}
            <div style={{ fontSize:12, color:"#64748B", marginBottom:8 }}>{items.length} materiales encontrados en "{archivoNombre}". Corregí lo que haga falta, destildá lo que no va y marcá lo que ya tienen en stock.</div>
            <div style={{ overflowX:"auto", border:"1px solid #E2E8F0", borderRadius:10 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead><tr style={{ background:"#F8FAFC", color:"#475569", textAlign:"left" }}>
                  {["","Descripción","Cant.","Unidad","Tipo","Medidas (L × An × Esp)","Color","¿Pedir?"].map(h => <th key={h} style={{ padding:"8px 6px", fontWeight:600, borderBottom:"1px solid #E2E8F0", whiteSpace:"nowrap" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id} style={{ opacity: it.incluir ? 1 : 0.45, borderBottom:"1px solid #F1F5F9" }}>
                      <td style={{ padding:"6px" }}><input type="checkbox" checked={it.incluir} onChange={e => setItem(it.id, "incluir", e.target.checked)} /></td>
                      <td style={{ padding:"6px", minWidth:200 }}><input style={inp} value={it.nombre} onChange={e => setItem(it.id, "nombre", e.target.value)} />{it.notas && <div style={{ fontSize:10, color:"#94A3B8", marginTop:2 }}>{it.notas}</div>}</td>
                      <td style={{ padding:"6px", width:60 }}><input style={inp} value={it.cantidad} onChange={e => setItem(it.id, "cantidad", e.target.value)} /></td>
                      <td style={{ padding:"6px", width:90 }}><input style={inp} list="mat-opts-unidad-ia" value={it.unidad} onChange={e => setItem(it.id, "unidad", e.target.value)} /></td>
                      <td style={{ padding:"6px", width:120 }}><input style={inp} list="mat-opts-tipo-ia" value={it.tipo} onChange={e => setItem(it.id, "tipo", e.target.value)} /></td>
                      <td style={{ padding:"6px", width:170 }}>
                        <div style={{ display:"flex", gap:3 }}>
                          {["largo","ancho","espesor"].map(k => <input key={k} style={{ ...inp, padding:"6px 4px" }} placeholder={k[0].toUpperCase()} value={it[k]} onChange={e => setItem(it.id, k, e.target.value)} />)}
                        </div>
                      </td>
                      <td style={{ padding:"6px", width:110 }}><input style={inp} value={it.color} onChange={e => setItem(it.id, "color", e.target.value)} /></td>
                      <td style={{ padding:"6px", width:130 }}>
                        <select style={inp} value={it.estado} onChange={e => setItem(it.id, "estado", e.target.value)}>
                          <option value="pendiente">🛒 Hay que pedirlo</option>
                          <option value="stock">📦 En stock</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="mat-opts-unidad-ia">{UNIDADES.map(o => <option key={o} value={o} />)}</datalist>
              <datalist id="mat-opts-tipo-ia">{TIPOS_MATERIAL.map(o => <option key={o} value={o} />)}</datalist>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button onClick={() => { setPaso("elegir"); setItems([]); }} style={{ padding:"10px 16px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>← Otro archivo</button>
              <div style={{ flex:1 }} />
              <button onClick={agregar} disabled={guardando || !incluidos}
                style={{ padding:"10px 20px", border:"none", borderRadius:8, background: guardando || !incluidos ? "#94A3B8" : "#0F766E", color:"#fff", cursor: guardando || !incluidos ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>
                {guardando ? "Agregando..." : `Agregar ${incluidos} material${incluidos !== 1 ? "es" : ""} a la obra`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function MaterialesModule({ sesion, entregas = [] }) {
  const [listasTodas, setListas] = useState([]);
  const { activas: obras, archivadas, existentes } = vinculoEntregas(entregas);
  // Lo de entregas archivadas no se muestra
  const listas = listasTodas.filter(l => !archivadas.has(l.obra_id));
  const [cargando, setCargando] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemData, setItemData] = useState({});
  const [saving, setSaving] = useState(false);
  const [showNuevaObra, setShowNuevaObra] = useState(false);
  const [showNotasModal, setShowNotasModal] = useState(false);
  const [notasEdit, setNotasEdit] = useState("");
  const [showImportarIA, setShowImportarIA] = useState(false);
  const [enviandoResumen, setEnviandoResumen] = useState(false);
  const [search, setSearch] = useState("");
  const isAdmin = sesion.rol === "admin";
  const puedeImportar = isAdmin || sesion.rol === "operario";

  async function recargar() {
    setCargando(true);
    try {
      const d = await getMateriales();
      const lista = d || [];
      setListas(lista);
      if (selected) {
        const upd = lista.find(x => x.id === selected.id);
        if (upd) setSelected(upd);
      }
    } catch (e) { console.error("Error cargando materiales:", e); }
    setCargando(false);
  }

  // Carga inicial al abrir el módulo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { recargar(); }, []);

  // datos puede ser un objeto o una función que recibe la lista recién leída de la base
  async function guardarLista(id, datos) {
    setSaving(true);
    try {
      await modificarFila("materiales", id, fila => ({ ...(typeof datos === "function" ? datos(fila) : datos), updated_at: new Date().toISOString() }));
      const d = await getMateriales();
      const lista = d || [];
      setListas(lista);
      const upd = lista.find(x => x.id === id);
      if (upd) setSelected(upd);
    } catch (e) { avisar(`Error al guardar. ${e.message || ""}`, { tipo: "error" }); }
    setSaving(false);
  }

  function abrirItemModal(item = null) {
    setEditingItem(item ? item.id : null);
    setItemData(item ? { ...item, estado: item.estado || "pendiente" } : { nombre:"", tipo:"", cantidad:"", unidad:"Unidades", largo:"", ancho:"", espesor:"", color:"", terminacion:"", marca:"", proveedor:"", orden_pedido:"", numero_remito:"", cantidad_recibida:"", notas:"", estado:"pendiente" });
    setShowItemModal(true);
  }

  async function guardarItem() {
    if (!itemData.nombre?.trim()) { avisar("Ingresá una descripción.", { tipo: "aviso" }); return; }
    setSaving(true);
    await guardarLista(selected.id, l => {
      const items = l.items || [];
      if (editingItem) {
        const idx = items.findIndex(i => i.id === editingItem);
        if (idx >= 0) items[idx] = { ...items[idx], ...itemData };
      } else {
        items.push({ id: uid(), ...itemData });
      }
      return { items };
    });
    setShowItemModal(false);
    setEditingItem(null);
    setSaving(false);
  }

  async function eliminarItem(itemId) {
    if (!await confirmar("¿Eliminar este material?")) return;
    await guardarLista(selected.id, l => ({ items: (l.items || []).filter(i => i.id !== itemId) }));
  }

  async function cambiarEstadoItem(itemId, nuevoEstado) {
    await guardarLista(selected.id, l => ({ items: (l.items || []).map(i => i.id === itemId ? { ...i, estado: nuevoEstado } : i) }));
  }

  async function eliminarMaterial(id) {
    if (!await confirmar("¿Eliminar esta obra de Materiales? Esta acción no se puede deshacer.")) return;
    try {
      await deleteMaterialById(id);
      setSelected(null);
      await recargar();
    } catch { avisar("Error al eliminar.", { tipo: "error" }); }
  }

  async function crearListaEntrega(e) {
    await insertMaterial({ obra_id: e.id, obra_nombre: e.nombre, obra_lugar: e.lugar, items: [], notas: "" });
    await recargar();
  }

  async function agregarItemsImportados(nuevos) {
    await guardarLista(selected.id, l => ({ items: [...(l.items || []), ...nuevos] }));
  }

  async function enviarResumenAhora() {
    setEnviandoResumen(true);
    await enviarAvisoAhora("materiales");
    setEnviandoResumen(false);
  }

  async function vincularEntrega(listaId, obraId) {
    if (!obras.some(o => o.id === obraId)) return;
    await guardarLista(listaId, { obra_id: obraId });
  }

  const resumenes = listas.map(l => resumenMateriales(l.items || []));
  const totalCompletas = resumenes.filter(r => r.completo).length;
  const totalFaltaPedir = resumenes.reduce((s, r) => s + r.faltaPedir.length, 0);
  const totalFaltaRecibir = resumenes.reduce((s, r) => s + r.faltaRecibir.length, 0);
  const alertas = alertasMateriales(listas, obras);

  // Buscador: por obra (nombre, lugar, notas) o por material (descripción, color, marca, proveedor, N° de pedido o remito...)
  const q = sinAcentos(search.trim());
  const coincide = v => !!v && sinAcentos(v).includes(q);
  const itemCoincide = it => q && CAMPOS_BUSQUEDA_MAT.some(k => coincide(it[k]));
  const visibles = listas.map((l, idx) => ({ l, idx, itemsCoinc: q ? (l.items || []).filter(itemCoincide) : [] }))
    .filter(v => !q || coincide(v.l.obra_nombre) || coincide(v.l.obra_lugar) || coincide(v.l.notas) || v.itemsCoinc.length);

  const si = { width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" };
  const siSm = { ...si, padding:"8px 10px", fontSize:12 };

  const CAMPOS_ITEM = [
    { key:"nombre",      label:"Descripción *",       type:"text",   ph:"Ej: Panel lateral izquierdo", full:true },
    { key:"tipo",        label:"Tipo de material",     type:"combo",  opts:TIPOS_MATERIAL, ph:"Elegí o escribí" },
    { key:"cantidad",    label:"Cantidad",             type:"text",   ph:"Ej: 1, 2.5" },
    { key:"unidad",      label:"Unidad",               type:"combo",  opts:UNIDADES, ph:"Elegí o escribí (ej: tiras)" },
    { key:"largo",       label:"Largo (mm/cm)",        type:"text",   ph:"Ej: 2400" },
    { key:"ancho",       label:"Ancho (mm/cm)",        type:"text",   ph:"Ej: 600" },
    { key:"espesor",     label:"Espesor (mm)",         type:"text",   ph:"Ej: 18" },
    { key:"color",       label:"Color / Tono",         type:"text",   ph:"Ej: Blanco roto, Roble natural" },
    { key:"terminacion", label:"Terminación",          type:"combo",  opts:TERMINACIONES, ph:"Elegí o escribí" },
    { key:"marca",       label:"Marca",                type:"text",   ph:"Ej: Masisa, Arauco" },
    { key:"proveedor",   label:"Proveedor",            type:"text",   ph:"Ej: Maderería Centro", soloPedir:true },
    { key:"estado",      label:"Estado del pedido",    type:"select", opts:ESTADOS_MAT_PEDIR.map(v=>({v,l:ESTADOS_MAT[v]})), isObj:true, soloPedir:true },
    { key:"cantidad_recibida", label:"Cantidad que llegó", type:"text", ph:"Ej: 3", soloParcial:true },
    { key:"orden_pedido",  label:"N° de pedido",       type:"text",   ph:"Ej: OP-0051", soloPedir:true },
    { key:"numero_remito", label:"N° de remito",       type:"text",   ph:"Ej: R-0001234", soloPedir:true },
    { key:"notas",       label:"Notas adicionales",    type:"text",   ph:"Observaciones...", full:true },
  ].filter(f => (!f.soloPedir || itemData.estado !== "stock") && (!f.soloParcial || itemData.estado === "parcial"));

  return (
    <div>
      {/* STATS */}
      <div className="grid-numeros" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:32 }}>
        {[
          { num:listas.length,     label:"Total obras",                   color:"#0F766E", border:"#99F6E4" },
          { num:totalCompletas,    label:"Obras con materiales completos", color:"#059669", border:"#A7F3D0" },
          { num:totalFaltaPedir,   label:"Materiales que falta pedir",    color:"#D97706", border:"#FDE68A" },
          { num:totalFaltaRecibir, label:"Materiales que falta recibir",  color:"#2563EB", border:"#DBEAFE" },
        ].map((s,i) => (
          <div key={i} style={{ background:"#ffffff", border:`1px solid ${s.border}`, borderRadius:12, padding:"20px 20px 18px", animation:`fadeUp 0.35s ease ${i*0.06}s both` }}>
            <div style={{ fontFamily:"'Sora', sans-serif", fontSize:32, fontWeight:800, color:s.color, lineHeight:1 }}>{s.num}</div>
            <div style={{ fontSize:12, color:"#64748B", fontWeight:500, marginTop:6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ALERTAS: entrega próxima con materiales faltantes */}
      {alertas.length > 0 && (
        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:12, padding:"14px 18px", marginBottom:24 }}>
          <div style={{ fontFamily:"'Sora', sans-serif", fontSize:14, fontWeight:700, color:"#DC2626", marginBottom:8 }}>
            ⚠ {alertas.length} obra{alertas.length!==1?"s":""} con entrega en {DIAS_ALERTA_MAT} días o menos y materiales faltantes
          </div>
          {alertas.map(a => (
            <div key={a.lista.id} onClick={() => setSelected(a.lista)}
              style={{ padding:"8px 0", borderTop:"1px solid #FEE2E2", cursor:"pointer", fontSize:12, color:"#7F1D1D" }}>
              <strong style={{ fontSize:13 }}>{a.lista.obra_nombre}</strong>
              <span style={{ marginLeft:8, fontWeight:700, color:"#DC2626" }}>📅 {fmtDateAixa(a.entrega.fecha)} · {textoDiasEntrega(a.dias)}</span>
              {a.faltaPedir.length > 0 && <div style={{ marginTop:3 }}>🛒 <strong>Falta pedir:</strong> {a.faltaPedir.map(detalleFaltante).join(" · ")}</div>}
              {a.faltaRecibir.length > 0 && <div style={{ marginTop:2 }}>🚚 <strong>Falta recibir:</strong> {a.faltaRecibir.map(detalleFaltante).join(" · ")}</div>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>Materiales por obra</h2>
        <div style={{ flex:1 }} />
        {isAdmin && (
          <button onClick={enviarResumenAhora} disabled={enviandoResumen} title="El aviso de materiales faltantes sale solo todos los días a las 8:00 cuando hay algo para avisar. Este botón lo manda ahora."
            style={{ padding:"9px 14px", marginRight:8, background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:12, fontWeight:600, cursor: enviandoResumen ? "not-allowed" : "pointer" }}>
            {enviandoResumen ? "Enviando..." : "📧 Enviar aviso de materiales ahora"}
          </button>
        )}
        <button onClick={() => setShowNuevaObra(true)} title="Las entregas nuevas se agregan solas al crearlas en Entregas"
          style={{ padding:"9px 18px", background:"#0F766E", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
          + Agregar entrega
        </button>
      </div>

      {listas.length > 0 && (
        <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ position:"relative", flex:"1 1 260px", maxWidth:420 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar obra, material, color, proveedor, N° de pedido..."
              style={{ width:"100%", padding:"9px 32px 9px 36px", background:"#ffffff", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" }} />
            {search && <button onClick={() => setSearch("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#94A3B8", cursor:"pointer", fontSize:14, padding:2 }}>✕</button>}
          </div>
          {q && <span style={{ fontSize:12, color:"#94A3B8" }}>{visibles.length} obra{visibles.length !== 1 ? "s" : ""}</span>}
        </div>
      )}

      {cargando ? (
        <div style={{ textAlign:"center", padding:60, color:"#94A3B8", fontSize:13 }}>Cargando...</div>
      ) : listas.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🪵</div>
          <div style={{ fontSize:13, color:"#94A3B8" }}>Sin obras. Se crean automáticamente al crear obras en Entregas.</div>
        </div>
      ) : visibles.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
          <div style={{ fontSize:28, marginBottom:10 }}>🔎</div>
          <div style={{ fontSize:13, color:"#94A3B8" }}>Ninguna obra ni material coincide con "{search.trim()}".</div>
        </div>
      ) : (
        <div className="grid-tarjetas" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:16 }}>
          {visibles.map(({ l, idx, itemsCoinc }, pos) => {
            const items = l.items || [];
            const r = resumenes[idx];
            const disponibles = r.stock + r.recibidos;
            const pct = items.length ? Math.round(disponibles/items.length*100) : 0;
            const urgente = alertas.find(a => a.lista.id === l.id);
            const entrega = entregaDeLista(l, obras);
            return (
              <div key={l.id} onClick={() => setSelected(l)}
                style={{ background:"#ffffff", border:`1px solid ${urgente?"#FCA5A5":r.completo?"#A7F3D0":"#E8ECF0"}`, borderRadius:14, overflow:"hidden", cursor:"pointer", animation:`fadeUp 0.35s ease ${pos*0.04}s both`, boxShadow:"0 1px 4px rgba(26,43,74,0.05)" }}>
                <div style={{ height:4, background: urgente?"#DC2626":r.completo?"#059669":pct>0?"#D97706":"#CBD5E1" }} />
                <div style={{ padding:"18px 18px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div style={{ fontFamily:"'Sora', sans-serif", fontSize:15, fontWeight:700, color:"#1A2B4A", flex:1, lineHeight:1.35, paddingRight:8 }}>{l.obra_nombre}</div>
                    <div style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:6, background:"#F0FDF4", color:"#059669", border:"1px solid #A7F3D0", whiteSpace:"nowrap" }}>{items.length} ítem{items.length!==1?"s":""}</div>
                  </div>
                  {l.obra_lugar && <div style={{ fontSize:12, color:"#64748B", marginBottom:6 }}>📍 {l.obra_lugar}</div>}
                  {entrega?.fecha && entrega.estado !== "terminado" && (
                    <div style={{ fontSize:12, color: urgente?"#DC2626":"#64748B", fontWeight: urgente?700:400, marginBottom:8 }}>📅 Entrega {fmtDateAixa(entrega.fecha)} · {textoDiasEntrega(diasHastaFecha(entrega.fecha))}</div>
                  )}
                  {items.length === 0 ? (
                    <div style={{ fontSize:12, color:"#94A3B8" }}>Sin materiales cargados</div>
                  ) : (
                    <>
                      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
                        {r.completo
                          ? <div style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:5, background:"#ECFDF5", color:"#059669", border:"1px solid #A7F3D0" }}>✅ Todos los materiales disponibles</div>
                          : <>
                              {r.faltaPedir.length>0&&<div style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:5, background:"#FFF7ED", color:"#D97706", border:"1px solid #FDE68A" }}>🛒 Falta pedir {r.faltaPedir.length}</div>}
                              {r.faltaRecibir.length>0&&<div style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:5, background:"#EFF6FF", color:"#2563EB", border:"1px solid #BFDBFE" }}>🚚 Falta recibir {r.faltaRecibir.length}</div>}
                            </>}
                        {r.stock>0&&<div style={{ fontSize:11, padding:"2px 8px", borderRadius:5, background:"#F5F3FF", color:"#7C3AED", border:"1px solid #DDD6FE" }}>{r.stock} en stock</div>}
                      </div>
                      <div style={{ height:6, background:"#F1F5F9", borderRadius:99, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background: pct===100?"#059669":"#0F766E", borderRadius:99, transition:"width 0.4s" }} />
                      </div>
                      <div style={{ fontSize:11, color:"#94A3B8", marginTop:4, textAlign:"right" }}>{pct}% disponible</div>
                    </>
                  )}
                  {itemsCoinc.length > 0 && (
                    <div style={{ marginTop:10, padding:"8px 10px", background:"#FEFCE8", border:"1px solid #FDE68A", borderRadius:8, fontSize:12, color:"#713F12" }}>
                      <div style={{ fontWeight:700, marginBottom:4 }}>🔎 {itemsCoinc.length} material{itemsCoinc.length !== 1 ? "es" : ""} coincide{itemsCoinc.length !== 1 ? "n" : ""}:</div>
                      {itemsCoinc.slice(0, 4).map(it => (
                        <div key={it.id} style={{ display:"flex", justifyContent:"space-between", gap:8, padding:"2px 0" }}>
                          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{[it.nombre, it.color, it.proveedor].filter(Boolean).join(" · ")}</span>
                          <span style={{ flexShrink:0, fontWeight:600, color:(ESTADO_MAT_COLORS[it.estado] || ESTADO_MAT_COLORS.pendiente).text }}>{ESTADOS_MAT[it.estado || "pendiente"]}</span>
                        </div>
                      ))}
                      {itemsCoinc.length > 4 && <div style={{ color:"#A16207", marginTop:2 }}>y {itemsCoinc.length - 4} más…</div>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETALLE */}
      {selected && (() => {
        const items = selected.items || [];
        const r = resumenMateriales(items);
        const pct = items.length ? Math.round((r.stock + r.recibidos)/items.length*100) : 0;
        const entrega = entregaDeLista(selected, obras);
        const diasEntrega = entrega?.fecha ? diasHastaFecha(entrega.fecha) : null;
        const urgente = diasEntrega !== null && entrega.estado !== "terminado" && diasEntrega <= DIAS_ALERTA_MAT && !r.completo && items.length > 0;
        const obrasVinculables = obras.filter(o => o.estado !== "terminado").sort((a,b) => (a.nombre||"").localeCompare(b.nombre||""));
        return (
          <div onClick={e => e.target===e.currentTarget&&setSelected(null)}
            style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
            <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:860, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)", display:"flex", flexDirection:"column" }}>
              {/* Header */}
              <div style={{ padding:"18px 24px", borderBottom:"1px solid #F1F5F9", position:"sticky", top:0, background:"#fff", zIndex:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{selected.obra_nombre}</h2>
                    {selected.obra_lugar && <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>📍 {selected.obra_lugar}</div>}
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <button onClick={() => { setNotasEdit(selected.notas||""); setShowNotasModal(true); }}
                      style={{ padding:"7px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#64748B", fontSize:12, cursor:"pointer" }}>📝 Notas</button>
                    <button onClick={() => generarPDFMateriales(selected, entrega)}
                      style={{ padding:"7px 14px", background:"#0F766E", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>⬇ PDF</button>
                    {puedeImportar && <button onClick={() => setShowImportarIA(true)}
                      style={{ padding:"7px 14px", background:"#F5F3FF", border:"1px solid #DDD6FE", borderRadius:8, color:"#7C3AED", fontSize:12, fontWeight:600, cursor:"pointer" }}>✨ Cargar con Claude</button>}
                    <button onClick={() => abrirItemModal()}
                      style={{ padding:"7px 14px", background:"#1A2B4A", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>+ Agregar</button>
                    {/* Los materiales de una entrega se archivan o eliminan desde Entregas */}
                    {!existentes.has(selected.obra_id) && <button onClick={() => eliminarMaterial(selected.id)}
                      style={{ padding:"7px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:12, fontWeight:600, cursor:"pointer" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#FEE2E2"} onMouseLeave={e=>e.currentTarget.style.background="#FEF2F2"}>
                      🗑 Eliminar
                    </button>}
                    <button onClick={() => setSelected(null)} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
                  </div>
                </div>
                {/* Entrega (desde Entregas) */}
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10, fontSize:12, color:"#64748B", flexWrap:"wrap" }}>
                  {entrega ? (
                    <span style={{ color: urgente?"#DC2626":"#64748B", fontWeight: urgente?700:500 }}>
                      📅 Entrega: {entrega.fecha ? `${fmtDateAixa(entrega.fecha)}${entrega.estado !== "terminado" ? ` · ${textoDiasEntrega(diasEntrega)}` : " · entregada"}` : "sin fecha cargada en Entregas"}
                    </span>
                  ) : (
                    <>
                      <span>📅 Sin vincular a una obra de Entregas (no se puede alertar por fecha):</span>
                      <select value="" onChange={e => e.target.value && vincularEntrega(selected.id, e.target.value)} disabled={saving}
                        style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #E2E8F0", background:"#F8FAFC", color:"#1A2B4A", fontSize:12, outline:"none" }}>
                        <option value="">— Vincular con… —</option>
                        {obrasVinculables.map(o => <option key={o.id} value={o.id}>{o.nombre}{o.fecha ? ` (${fmtDateAixa(o.fecha)})` : ""}</option>)}
                      </select>
                    </>
                  )}
                </div>
              </div>

              {/* Control general */}
              {items.length > 0 && (
                <div style={{ margin:"14px 24px 0", padding:"12px 16px", borderRadius:10,
                  background: r.completo?"#ECFDF5":urgente?"#FEF2F2":"#FFFBEB",
                  border:`1px solid ${r.completo?"#A7F3D0":urgente?"#FECACA":"#FDE68A"}` }}>
                  {r.completo ? (
                    <div style={{ fontSize:13, fontWeight:700, color:"#059669" }}>✅ Están todos los materiales para esta obra <span style={{ fontWeight:400 }}>({r.stock} en stock, {r.recibidos} recibidos)</span></div>
                  ) : (
                    <>
                      <div style={{ fontSize:13, fontWeight:700, color: urgente?"#DC2626":"#B45309", marginBottom:6 }}>
                        {urgente ? `⚠ Faltan materiales y la entrega es en ${diasEntrega <= 0 ? "0" : diasEntrega} día${diasEntrega===1?"":"s"}${diasEntrega < 0 ? " (vencida)" : ""}` : "⚠ Faltan materiales"}
                      </div>
                      {r.faltaPedir.length > 0 && <div style={{ fontSize:12, color:"#92400E", marginBottom:3 }}>🛒 <strong>Falta pedir ({r.faltaPedir.length}):</strong> {r.faltaPedir.map(detalleFaltante).join(" · ")}</div>}
                      {r.faltaRecibir.length > 0 && <div style={{ fontSize:12, color:"#1E40AF" }}>🚚 <strong>Falta recibir ({r.faltaRecibir.length}):</strong> {r.faltaRecibir.map(it => `${detalleFaltante(it)}${it.proveedor ? ` — ${it.proveedor}` : ""}${it.orden_pedido ? ` (ped. ${it.orden_pedido})` : ""}`).join(" · ")}</div>}
                    </>
                  )}
                </div>
              )}

              {/* Progress bar */}
              {items.length > 0 && (
                <div style={{ padding:"10px 24px 0", background:"#fff" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#94A3B8", marginBottom:4 }}>
                    <span>{items.length} ítem{items.length!==1?"s":""} cargados</span>
                    <span>{pct}% disponible (en stock o recibido)</span>
                  </div>
                  <div style={{ height:6, background:"#F1F5F9", borderRadius:99, overflow:"hidden", marginBottom:12 }}>
                    <div style={{ height:"100%", width:`${pct}%`, background: pct===100?"#059669":"#0F766E", borderRadius:99, transition:"width 0.4s" }} />
                  </div>
                </div>
              )}

              {/* Items list */}
              <div style={{ padding:"12px 24px 24px", flex:1 }}>
                {items.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"48px 20px", color:"#94A3B8", fontSize:13 }}>
                    <div style={{ fontSize:28, marginBottom:10 }}>🪵</div>
                    Sin materiales cargados. Hacé clic en "+ Agregar" para empezar.
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {items.map(it => {
                      const ec = ESTADO_MAT_COLORS[it.estado] || ESTADO_MAT_COLORS.pendiente;
                      const medidas = [it.largo&&`L: ${it.largo}`, it.ancho&&`An: ${it.ancho}`, it.espesor&&`Esp: ${it.espesor}`].filter(Boolean).join("  ·  ");
                      const ok = it.estado==="recibido" || it.estado==="stock";
                      const buscado = itemCoincide(it);
                      return (
                        <div key={it.id} style={{ background: ok?"#F0FDF4":"#F8FAFC", border:`1px solid ${buscado?"#EAB308":ok?"#A7F3D0":"#E2E8F0"}`, boxShadow: buscado?"0 0 0 2px #FEF08A":"none", borderRadius:10, padding:"14px 16px" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                                <div style={{ fontFamily:"'Sora', sans-serif", fontSize:14, fontWeight:700, color:"#1A2B4A" }}>{it.nombre}</div>
                                {it.tipo && <div style={{ fontSize:11, padding:"2px 8px", borderRadius:5, background:"#F1F5F9", color:"#475569", border:"1px solid #E2E8F0" }}>{it.tipo}</div>}
                              </div>
                              <div style={{ display:"flex", flexWrap:"wrap", gap:12, fontSize:12, color:"#64748B" }}>
                                {(it.cantidad||it.unidad) && <span>📦 {it.cantidad} {it.unidad}</span>}
                                {medidas && <span>📐 {medidas}</span>}
                                {it.color && <span>🎨 {it.color}</span>}
                                {it.terminacion && <span>✨ {it.terminacion}</span>}
                                {it.marca && <span>🏷 {it.marca}</span>}
                                {it.proveedor && <span>🏪 {it.proveedor}</span>}
                                {it.orden_pedido && <span>📋 Pedido {it.orden_pedido}</span>}
                                {it.numero_remito && <span>🧾 Remito {it.numero_remito}</span>}
                                {it.estado === "parcial" && <span style={{ color:"#DC2626", fontWeight:600 }}>⚠ {it.cantidad_recibida ? `Llegaron ${it.cantidad_recibida} de ${it.cantidad || "?"}` : "Llegó incompleto"}</span>}
                              </div>
                              {it.notas && <div style={{ marginTop:6, fontSize:12, color:"#94A3B8", fontStyle:"italic" }}>"{it.notas}"</div>}
                            </div>
                            <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end", flexShrink:0 }}>
                              <select value={it.estado||"pendiente"} onChange={e => cambiarEstadoItem(it.id, e.target.value)}
                                style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${ec.border}`, background:ec.bg, color:ec.text, fontSize:11, fontWeight:700, cursor:"pointer", outline:"none" }}>
                                <option value="stock">En stock (no se pide)</option>
                                <optgroup label="A pedir">
                                  {ESTADOS_MAT_PEDIR.map(v => <option key={v} value={v}>{ESTADOS_MAT[v]}</option>)}
                                </optgroup>
                              </select>
                              <div style={{ display:"flex", gap:6 }}>
                                <button onClick={() => abrirItemModal(it)}
                                  style={{ padding:"4px 10px", background:"#fff", border:"1px solid #E2E8F0", borderRadius:6, color:"#64748B", fontSize:11, cursor:"pointer" }}>Editar</button>
                                <button onClick={() => eliminarItem(it.id)}
                                  style={{ padding:"4px 8px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:6, color:"#DC2626", fontSize:11, cursor:"pointer" }}>✕</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showImportarIA && selected && (
        <ImportarMaterialesIA lista={selected} onClose={() => setShowImportarIA(false)} onAgregar={agregarItemsImportados} />
      )}

      {/* MODAL: AGREGAR / EDITAR ITEM */}
      {showItemModal && (
        <div onClick={e => e.target===e.currentTarget&&setShowItemModal(false)}
          style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:560, maxHeight:"90vh", overflowY:"auto", padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
            <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:"0 0 14px" }}>{editingItem ? "Editar material" : "Agregar material"}</h3>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {[{ stock:false, label:"🛒 Hay que pedirlo" }, { stock:true, label:"📦 Lo tenemos en stock" }].map(op => {
                const activo = (itemData.estado === "stock") === op.stock;
                return (
                  <button key={op.label} type="button"
                    onClick={() => setItemData(d => ({ ...d, estado: op.stock ? "stock" : (d.estado === "stock" ? "pendiente" : d.estado) }))}
                    style={{ flex:1, padding:"10px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer",
                      border:`1.5px solid ${activo ? (op.stock?"#7C3AED":"#D97706") : "#E2E8F0"}`,
                      background: activo ? (op.stock?"#F5F3FF":"#FFF7ED") : "#F8FAFC",
                      color: activo ? (op.stock?"#7C3AED":"#D97706") : "#64748B" }}>{op.label}</button>
                );
              })}
            </div>
            <div className="grid-form" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {CAMPOS_ITEM.map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? "1 / -1" : "auto" }}>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:5 }}>{f.label}</label>
                  {f.type === "combo" ? (
                    <>
                      <input list={`mat-opts-${f.key}`} value={itemData[f.key]||""} onChange={e => setItemData(d=>({...d,[f.key]:e.target.value}))} style={siSm} placeholder={f.ph||""} />
                      <datalist id={`mat-opts-${f.key}`}>{f.opts.map(o => <option key={o} value={o} />)}</datalist>
                    </>
                  ) : f.type === "select" ? (
                    <select value={itemData[f.key]||""} onChange={e => setItemData(d=>({...d,[f.key]:e.target.value}))} style={siSm}>
                      <option value="">— Seleccionar —</option>
                      {f.isObj ? f.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>) : f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.type} value={itemData[f.key]||""} onChange={e => setItemData(d=>({...d,[f.key]:e.target.value}))} style={siSm} placeholder={f.ph||""} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button onClick={() => { setShowItemModal(false); setEditingItem(null); }} style={{ flex:1, padding:"10px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cancelar</button>
              <button onClick={guardarItem} disabled={saving}
                style={{ flex:1, padding:"10px", border:"none", borderRadius:8, background: saving?"#94A3B8":"#1A2B4A", color:"#fff", cursor: saving?"not-allowed":"pointer", fontSize:13, fontWeight:600 }}>{saving?"Guardando...":editingItem?"Actualizar":"Agregar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOTAS */}
      {showNotasModal && (
        <div onClick={e => e.target===e.currentTarget&&setShowNotasModal(false)}
          style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:400, padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
            <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:"0 0 14px" }}>Notas de la obra</h3>
            <textarea value={notasEdit} onChange={e=>setNotasEdit(e.target.value)} rows={5}
              style={{ ...si, resize:"vertical", lineHeight:1.5 }} placeholder="Aclaraciones generales sobre los materiales..." />
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button onClick={() => setShowNotasModal(false)} style={{ flex:1, padding:"10px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cancelar</button>
              <button onClick={async () => { await guardarLista(selected.id, { notas: notasEdit }); setShowNotasModal(false); }} disabled={saving}
                style={{ flex:1, padding:"10px", border:"none", borderRadius:8, background:"#1A2B4A", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR ENTREGA */}
      {showNuevaObra && <ModalElegirEntrega titulo="Agregar entrega a Materiales" color="#0F766E"
        entregas={obras.filter(e => !listasTodas.some(l => l.obra_id === e.id))}
        onClose={() => setShowNuevaObra(false)} onElegir={crearListaEntrega} />}
    </div>
  );
}
