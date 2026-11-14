// Pestaña Mantenimiento planta: tareas para hacer en la planta (quién la hace, quién la supervisa)
import { useState, useEffect } from "react";
import { avisar, confirmar } from "../lib/avisos.js";
import { deleteMantenimiento, getMantenimiento, getUsuarios, insertMantenimiento, updateMantenimiento } from "../lib/datos.js";
import { formatDate, sinAcentos, uid } from "../lib/formato.js";
import { DIAS_ALERTA_MANTENIMIENTO, diasDesdeSolicitud, hoyLocal, tareaAtrasada } from "../lib/mantenimiento.js";
import { CerrarConAtras } from "../lib/atras.js";
import { Icono } from "../components/Icono.jsx";

const COLOR = "#B45309";
const textoHace = d => d < 0 ? (d === -1 ? "mañana" : `dentro de ${-d} días`) : d === 0 ? "hoy" : d === 1 ? "hace 1 día" : `hace ${d} días`;
const estadoTarea = t => !t.realizada ? "hacer" : t.supervisada ? "terminada" : "supervisar";

const FILTROS = [
  { key: "hacer", label: "Para hacer" },
  { key: "supervisar", label: "Por supervisar" },
  { key: "terminada", label: "Terminadas" },
  { key: "todas", label: "Todas" },
];

export function MantenimientoModule({ sesion }) {
  const [tareas, setTareas] = useState(null);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState("hacer");
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(null);       // { tarea } (tarea null = nueva)
  const [supervisar, setSupervisar] = useState(null);
  const [verAviso, setVerAviso] = useState(false);
  const [nombres, setNombres] = useState([]);
  const [ocupadas, setOcupadas] = useState(() => new Set());   // ids de las tareas que se están guardando
  const marcarOcupada = (id, si) => setOcupadas(s => { const n = new Set(s); if (si) n.add(id); else n.delete(id); return n; });

  async function cargar({ conAviso = false } = {}) {
    try {
      const ls = await getMantenimiento();
      setTareas(ls || []); setError(null);
      // Avisa a la barra de pestañas para que el número rojo se actualice sin cambiar de pestaña
      window.dispatchEvent(new CustomEvent("mantenimiento-actualizado", { detail: (ls || []).filter(tareaAtrasada).length }));
      if (conAviso && (ls || []).some(t => !t.realizada)) setVerAviso(true);
    } catch (e) { setError(e.message || "Error al leer las tareas"); setTareas(t => t || []); }
  }
  useEffect(() => {
    cargar({ conAviso: true });
    getUsuarios().then(us => setNombres((us || []).map(u => u.nombre).filter(Boolean))).catch(() => {});
  }, []);

  // Nombres para sugerir en "Quién la realiza / supervisa": usuarios y los que ya se usaron
  const sugeridos = [...new Set([...nombres, ...(tareas || []).flatMap(t => [t.responsable, t.supervisor])].filter(Boolean))].sort((a, b) => a.localeCompare(b));

  async function cambiar(t, cambio, { deshacer } = {}) {
    marcarOcupada(t.id, true);
    try {
      await updateMantenimiento(t.id, cambio);
      await cargar();
      if (deshacer) avisar(deshacer.texto, { tipo: "ok", deshacer: async () => {
        marcarOcupada(t.id, true);
        try { await updateMantenimiento(t.id, deshacer.volver); await cargar(); }
        catch (e) { avisar(`No se pudo deshacer: ${e.message}`, { tipo: "error" }); }
        finally { marcarOcupada(t.id, false); }
      } });
      return true;
    } catch (e) { avisar(`No se pudo guardar: ${e.message}`, { tipo: "error" }); return false; }
    finally { marcarOcupada(t.id, false); }
  }

  async function tildar(t) {
    if (!t.realizada) {
      return cambiar(t, { realizada: true, realizada_en: hoyLocal() },
        { deshacer: { texto: `"${t.tarea}" marcada como hecha.`, volver: { realizada: false, realizada_en: null, supervisada: false, supervisada_en: null, supervisada_por: null } } });
    }
    if (!await confirmar(`¿Marcar "${t.tarea}" como NO hecha?${t.supervisada ? "\nTambién se le saca la supervisión." : ""}`, { boton: "Desmarcar", peligro: false })) return;
    cambiar(t, { realizada: false, realizada_en: null, supervisada: false, supervisada_en: null, supervisada_por: null });
  }

  async function eliminar(t) {
    if (!await confirmar(`¿Eliminar la tarea "${t.tarea}"?\nNo se puede deshacer.`)) return;
    try { await deleteMantenimiento(t.id); await cargar(); avisar("Tarea eliminada.", { tipo: "ok" }); }
    catch (e) { avisar(`No se pudo eliminar: ${e.message}`, { tipo: "error" }); }
  }

  async function guardarTarea(form) {
    const orig = modal.tarea;
    const datos = {
      tarea: form.tarea.trim(), detalle: form.detalle.trim() || null, responsable: form.responsable.trim() || null, supervisor: form.supervisor.trim() || null,
      // Si se borra la fecha, se mantiene la que tenía (no se reinicia la antigüedad de la tarea)
      fecha_solicitud: form.fecha_solicitud || orig?.fecha_solicitud || hoyLocal(),
    };
    try {
      if (orig) {
        if (orig.realizada) datos.realizada_en = form.realizada_en || orig.realizada_en;
        if (orig.supervisada) datos.supervisada_en = form.supervisada_en || orig.supervisada_en;
        // Solo se guarda lo que se cambió en el formulario, para no pisar lo que otro haya guardado mientras tanto
        const cambio = Object.fromEntries(Object.entries(datos).filter(([k, v]) => (v ?? null) !== (orig[k] ?? null)));
        if (Object.keys(cambio).length) await updateMantenimiento(orig.id, cambio);
      } else {
        await insertMantenimiento({ id: uid(), ...datos, solicitado_por: sesion.nombre, realizada: false, supervisada: false });
      }
      await cargar();
      setModal(null);
    } catch (e) { avisar(`No se pudo guardar: ${e.message}`, { tipo: "error" }); }
  }

  if (tareas === null) return <div style={{ padding:60, textAlign:"center", color:"#94A3B8", fontSize:13 }}>Cargando tareas...</div>;

  const pendientes = tareas.filter(t => !t.realizada);
  const atrasadas = pendientes.filter(tareaAtrasada);
  const porSupervisar = tareas.filter(t => t.realizada && !t.supervisada);
  const terminadas = tareas.filter(t => t.realizada && t.supervisada);
  const q = sinAcentos(busqueda.trim());
  const visibles = tareas
    .filter(t => filtro === "todas" || (filtro === "atrasadas" ? tareaAtrasada(t) : estadoTarea(t) === filtro))
    .filter(t => !q || [t.tarea, t.detalle, t.responsable, t.supervisor, t.supervisada_por, t.solicitado_por].some(x => sinAcentos(x).includes(q)))
    .sort((a, b) => {
      // Lo que falta hacer, de lo más viejo a lo más nuevo; lo hecho, lo último arriba
      const ea = estadoTarea(a) === "hacer" ? 0 : 1, eb = estadoTarea(b) === "hacer" ? 0 : 1;
      if (ea !== eb) return ea - eb;
      if (ea === 0) return (a.fecha_solicitud || "").localeCompare(b.fecha_solicitud || "");
      return (b.realizada_en || "").localeCompare(a.realizada_en || "");
    });

  return (
    <div>
      {/* NÚMEROS */}
      <div className="grid-numeros" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:28 }}>
        {[
          { num: pendientes.length, label: "Para hacer", color: "#1A2B4A", border: "#E8ECF0", f: "hacer" },
          { num: atrasadas.length, label: `Atrasadas (+${DIAS_ALERTA_MANTENIMIENTO} días)`, color: "#DC2626", border: atrasadas.length ? "#FECACA" : "#E8ECF0", f: "atrasadas" },
          { num: porSupervisar.length, label: "Hechas, falta supervisar", color: "#D97706", border: "#E8ECF0", f: "supervisar" },
          { num: terminadas.length, label: "Terminadas y supervisadas", color: "#059669", border: "#E8ECF0", f: "terminada" },
        ].map((s, i) => (
          <button key={i} onClick={() => setFiltro(s.f)} title="Ver estas tareas"
            style={{ background:"#ffffff", border:`1px solid ${s.border}`, borderRadius:12, padding:"20px 20px 18px", textAlign:"left", cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            <div style={{ fontFamily:"'Sora', sans-serif", fontSize:32, fontWeight:800, color:s.color, lineHeight:1 }}>{s.num}</div>
            <div style={{ fontSize:12, color:"#64748B", fontWeight:500, marginTop:6 }}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* TÍTULO + FILTROS */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:18, fontWeight:700, color:"#1A2B4A", margin:0 }}>Mantenimiento de planta</h2>
          {pendientes.length > 0 && (
            <button onClick={() => setVerAviso(true)} style={{ padding:"6px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              <Icono n="lista" /> Ver lo pendiente
            </button>
          )}
        </div>
        <div className="barra-filtros" style={{ display:"flex", gap:4, background:"#ffffff", border:"1px solid #E8ECF0", borderRadius:10, padding:4 }}>
          {FILTROS.map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)} className="filter-btn"
              style={{ padding:"6px 14px", borderRadius:7, border:"none", background: filtro === f.key ? COLOR : "transparent", color: filtro === f.key ? "#ffffff" : "#64748B", fontFamily:"'Inter', sans-serif", fontSize:12, fontWeight: filtro === f.key ? 600 : 400, cursor:"pointer" }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative", flex:"1 1 200px", maxWidth:320 }}>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar tarea o persona..."
            style={{ width:"100%", padding:"9px 32px 9px 12px", background:"#ffffff", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" }} />
          {busqueda && <button onClick={() => setBusqueda("")} aria-label="Borrar búsqueda" style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#94A3B8", cursor:"pointer", fontSize:14, padding:2 }}><Icono n="cerrar" /></button>}
        </div>
        <span style={{ fontSize:12, color:"#94A3B8" }}>{visibles.length} tarea{visibles.length !== 1 ? "s" : ""}</span>
        {filtro === "atrasadas" && (
          <button onClick={() => setFiltro("hacer")} title="Ver todas las tareas para hacer"
            style={{ padding:"4px 10px", borderRadius:99, background:"#FEF2F2", border:"1px solid #FECACA", color:"#DC2626", fontSize:12, fontWeight:600, cursor:"pointer" }}>
            Solo atrasadas <Icono n="cerrar" />
          </button>
        )}
      </div>

      {error && <div style={{ marginBottom:16, padding:"10px 14px", borderRadius:8, background:"#FEF2F2", border:"1px solid #FECACA", color:"#DC2626", fontSize:13 }}>No se pudieron leer las tareas: {error}</div>}

      {/* LISTA */}
      {visibles.length === 0 ? (
        <div style={{ textAlign:"center", padding:"70px 20px", background:"#ffffff", borderRadius:16, border:"1px solid #E8ECF0" }}>
          <div style={{ marginBottom:10, color: (filtro === "hacer" || filtro === "atrasadas") && !q ? "#059669" : "#CBD5E1" }}><Icono n={(filtro === "hacer" || filtro === "atrasadas") && !q ? "checkCirculo" : "llave"} tam={34} grosor={1.6} /></div>
          <div style={{ fontSize:13, color:"#94A3B8" }}>{q ? "Ninguna tarea coincide con la búsqueda" : filtro === "hacer" ? "No hay tareas pendientes" : filtro === "atrasadas" ? "No hay tareas atrasadas" : "No hay tareas acá"}</div>
          {!tareas.length && <div style={{ fontSize:12, color:"#94A3B8", marginTop:6 }}>Cargá la primera con "+ Nueva tarea".</div>}
        </div>
      ) : (
        <div className="grid-tarjetas" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:14, alignItems:"start" }}>
          {visibles.map(t => <TarjetaTarea key={t.id} t={t} ocupado={ocupadas.has(t.id)}
            onTildar={() => tildar(t)} onEditar={() => setModal({ tarea: t })} onSupervisar={() => setSupervisar(t)} onEliminar={() => eliminar(t)} />)}
        </div>
      )}

      <button onClick={() => setModal({ tarea: null })} className="boton-flotante"
        style={{ position:"fixed", bottom:28, right:24, height:48, padding:"0 22px", borderRadius:12, background:COLOR, border:"none", fontSize:13, fontWeight:600, color:"#ffffff", boxShadow:"0 4px 20px rgba(180,83,9,0.35)", cursor:"pointer", zIndex:200, fontFamily:"'Inter', sans-serif" }}>
        + Nueva tarea
      </button>

      {modal && <ModalTarea tarea={modal.tarea} sugeridos={sugeridos} onClose={() => setModal(null)} onSave={guardarTarea} />}
      {supervisar && <ModalSupervisar tarea={supervisar} sugeridos={sugeridos} sesion={sesion} onClose={() => setSupervisar(null)}
        onSave={async (nombre, fecha) => { if (await cambiar(supervisar, { supervisada: true, supervisada_en: fecha, supervisada_por: nombre })) setSupervisar(null); }} />}
      {verAviso && <AvisoPendientes pendientes={pendientes} onClose={() => setVerAviso(false)} onVer={() => { setFiltro("hacer"); setBusqueda(""); setVerAviso(false); }} />}
    </div>
  );
}

// ─── TARJETA ──────────────────────────────────────────────────────────────────
function TarjetaTarea({ t, ocupado, onTildar, onEditar, onSupervisar, onEliminar }) {
  const atrasada = tareaAtrasada(t);
  const dias = diasDesdeSolicitud(t);
  const est = estadoTarea(t);
  const borde = atrasada ? "#DC2626" : est === "supervisar" ? "#FDE68A" : est === "terminada" ? "#A7F3D0" : "#E8ECF0";
  const btn = { padding:"7px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:7, color:"#475569", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" };
  return (
    <div style={{ background: atrasada ? "#FFFBFB" : "#ffffff", border:`${atrasada ? 2 : 1}px solid ${borde}`, borderRadius:14, overflow:"hidden", boxShadow: atrasada ? "0 0 0 3px rgba(220,38,38,0.10)" : "0 1px 4px rgba(26,43,74,0.05)", opacity: ocupado ? 0.6 : 1 }}>
      {atrasada && <div style={{ background:"#DC2626", color:"#fff", fontSize:12, fontWeight:700, padding:"5px 14px" }}><Icono n="alerta" /> {dias} días sin hacer</div>}
      <div style={{ padding:"14px 14px 12px", display:"flex", gap:12 }}>
        <button onClick={onTildar} disabled={ocupado} aria-label={t.realizada ? "Marcar como no hecha" : "Marcar como hecha"} title={t.realizada ? "Hecha (tocá para desmarcar)" : "Marcar como hecha"}
          style={{ flexShrink:0, width:34, height:34, borderRadius:8, border:`2.5px solid ${t.realizada ? "#059669" : atrasada ? "#DC2626" : "#94A3B8"}`, background: t.realizada ? "#059669" : "#ffffff", color:"#ffffff", fontSize:20, fontWeight:900, lineHeight:1, cursor: ocupado ? "wait" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>
          {t.realizada ? <Icono n="check" tam={20} grosor={3} /> : ""}
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"'Sora', sans-serif", fontSize:15, fontWeight:700, color:"#1A2B4A", lineHeight:1.35, textDecoration: t.realizada ? "line-through" : "none", textDecorationColor:"#94A3B8", wordBreak:"break-word" }}>{t.tarea}</div>
          {t.detalle && <div style={{ fontSize:13, color:"#475569", marginTop:4, lineHeight:1.45, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{t.detalle}</div>}
          <div style={{ display:"flex", flexDirection:"column", gap:4, marginTop:10, fontSize:12, color:"#64748B" }}>
            <span><Icono n="calendario" /> Solicitada el <b style={{ color:"#1A2B4A" }}>{formatDate(t.fecha_solicitud)}</b>{!t.realizada && <> ({textoHace(dias)})</>}{t.solicitado_por ? ` por ${t.solicitado_por}` : ""}</span>
            <span><Icono n="casco" /> Realiza: <b style={{ color: t.responsable ? "#1A2B4A" : "#94A3B8", fontWeight: t.responsable ? 600 : 400 }}>{t.responsable || "sin asignar"}</b></span>
            <span><Icono n="supervisar" /> Supervisa: <b style={{ color: t.supervisor ? "#1A2B4A" : "#94A3B8", fontWeight: t.supervisor ? 600 : 400 }}>{t.supervisor || "sin asignar"}</b></span>
          </div>
          {t.realizada && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:10 }}>
              <span style={{ padding:"3px 9px", borderRadius:6, background:"#ECFDF5", color:"#059669", border:"1px solid #A7F3D0", fontSize:12, fontWeight:600 }}><Icono n="checkCirculo" /> Hecha el {formatDate(t.realizada_en)}</span>
              {t.supervisada
                ? <span style={{ padding:"3px 9px", borderRadius:6, background:"#ECFDF5", color:"#047857", border:"1px solid #A7F3D0", fontSize:12, fontWeight:600 }}><Icono n="supervisar" /> Supervisada el {formatDate(t.supervisada_en)}{t.supervisada_por ? ` por ${t.supervisada_por}` : ""}</span>
                : <span style={{ padding:"3px 9px", borderRadius:6, background:"#FFFBEB", color:"#B45309", border:"1px solid #FDE68A", fontSize:12, fontWeight:600 }}>Falta supervisar</span>}
            </div>
          )}
        </div>
      </div>
      <div style={{ display:"flex", gap:6, padding:"0 14px 12px", flexWrap:"wrap" }}>
        {t.realizada && !t.supervisada && <button onClick={onSupervisar} disabled={ocupado} style={{ ...btn, background:"#ECFDF5", border:"1px solid #A7F3D0", color:"#047857", fontWeight:600 }}><Icono n="supervisar" /> Marcar supervisada</button>}
        <button onClick={onEditar} disabled={ocupado} style={btn}><Icono n="editar" /> Editar</button>
        <button onClick={onEliminar} disabled={ocupado} title="Eliminar tarea" aria-label="Eliminar tarea" style={{ ...btn, background:"#FEF2F2", border:"1px solid #FECACA", color:"#DC2626", marginLeft:"auto" }}><Icono n="basura" /></button>
      </div>
    </div>
  );
}

// ─── VENTANAS ─────────────────────────────────────────────────────────────────
const inp = { width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" };
const lbl = { display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:5 };
function Ventana({ titulo, onClose, children, ancho = 480 }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} className="modal-fondo" style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <CerrarConAtras onClose={() => onClose()} />
      <div className="modal-caja" role="dialog" aria-label={titulo} style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:ancho, maxHeight:"calc(100dvh - 32px)", display:"flex", flexDirection:"column", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"18px 20px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexShrink:0 }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{titulo}</h2>
          <button onClick={onClose} aria-label="Cerrar" style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, flexShrink:0, cursor:"pointer", color:"#64748B", fontSize:16 }}><Icono n="cerrar" /></button>
        </div>
        <div style={{ padding:"18px 20px", overflowY:"auto" }}>{children}</div>
      </div>
    </div>
  );
}
function Botones({ onClose, onSave, guardando, texto = "Guardar" }) {
  return (
    <div style={{ display:"flex", gap:10, marginTop:20 }}>
      <button onClick={onClose} style={{ flex:1, padding:"11px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cancelar</button>
      <button onClick={onSave} disabled={guardando} style={{ flex:1, padding:"11px", border:"none", borderRadius:8, background: guardando ? "#94A3B8" : COLOR, color:"#fff", cursor: guardando ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>{guardando ? "Guardando..." : texto}</button>
    </div>
  );
}

function ModalTarea({ tarea, sugeridos, onClose, onSave }) {
  const [form, setForm] = useState({
    tarea: tarea?.tarea || "", detalle: tarea?.detalle || "", responsable: tarea?.responsable || "", supervisor: tarea?.supervisor || "",
    fecha_solicitud: tarea?.fecha_solicitud || hoyLocal(), realizada_en: tarea?.realizada_en || "", supervisada_en: tarea?.supervisada_en || "",
  });
  const [guardando, setGuardando] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  async function guardar() {
    if (!form.tarea.trim()) { avisar("Escribí qué hay que hacer.", { tipo: "aviso" }); return; }
    setGuardando(true); await onSave(form); setGuardando(false);
  }
  return (
    <Ventana titulo={tarea ? "Editar tarea" : "Nueva tarea de mantenimiento"} onClose={onClose}>
      <datalist id="mant-nombres">{sugeridos.map(n => <option key={n} value={n} />)}</datalist>
      <div style={{ marginBottom:14 }}>
        <label style={lbl}>¿Qué hay que hacer? *</label>
        <input value={form.tarea} onChange={set("tarea")} placeholder='Ej: "Limpiar las canaletas"' autoFocus style={inp} />
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={lbl}>Detalle (opcional)</label>
        <textarea value={form.detalle} onChange={set("detalle")} rows={3} placeholder="Dónde, con qué, cualquier aclaración..." style={{ ...inp, resize:"vertical" }} />
      </div>
      <div className="grid-form" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
        <div><label style={lbl}><Icono n="casco" /> Quién la realiza</label><input value={form.responsable} onChange={set("responsable")} list="mant-nombres" placeholder="Nombre" style={inp} /></div>
        <div><label style={lbl}><Icono n="supervisar" /> Quién la supervisa</label><input value={form.supervisor} onChange={set("supervisor")} list="mant-nombres" placeholder="Nombre" style={inp} /></div>
      </div>
      <div className="grid-form" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div><label style={lbl}><Icono n="calendario" /> Fecha de solicitud</label><input type="date" value={form.fecha_solicitud} onChange={set("fecha_solicitud")} style={inp} /></div>
        {tarea?.realizada && <div><label style={lbl}><Icono n="checkCirculo" /> Hecha el</label><input type="date" value={form.realizada_en} onChange={set("realizada_en")} style={inp} /></div>}
        {tarea?.supervisada && <div><label style={lbl}><Icono n="supervisar" /> Supervisada el</label><input type="date" value={form.supervisada_en} onChange={set("supervisada_en")} style={inp} /></div>}
      </div>
      {!tarea && <p style={{ fontSize:12, color:"#94A3B8", margin:"12px 0 0", lineHeight:1.5 }}>Si pasan más de {DIAS_ALERTA_MANTENIMIENTO} días desde la solicitud sin hacerse, la tarea se marca en rojo.</p>}
      <Botones onClose={onClose} onSave={guardar} guardando={guardando} texto={tarea ? "Guardar" : "Cargar tarea"} />
    </Ventana>
  );
}

function ModalSupervisar({ tarea, sugeridos, sesion, onClose, onSave }) {
  const [nombre, setNombre] = useState(sesion.nombre || tarea.supervisor || "");
  const [fecha, setFecha] = useState(hoyLocal());
  const [guardando, setGuardando] = useState(false);
  async function guardar() {
    if (!nombre.trim()) { avisar("Escribí quién supervisó.", { tipo: "aviso" }); return; }
    setGuardando(true); await onSave(nombre.trim(), fecha || hoyLocal()); setGuardando(false);
  }
  return (
    <Ventana titulo="Marcar como supervisada" onClose={onClose} ancho={420}>
      <p style={{ fontSize:13, color:"#475569", margin:"0 0 14px", lineHeight:1.5 }}>Confirmá que <b>"{tarea.tarea}"</b> está hecha y bien hecha.</p>
      <datalist id="mant-nombres-sup">{sugeridos.map(n => <option key={n} value={n} />)}</datalist>
      <div className="grid-form" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div><label style={lbl}>Quién supervisó</label><input value={nombre} onChange={e => setNombre(e.target.value)} list="mant-nombres-sup" style={inp} /></div>
        <div><label style={lbl}>Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} /></div>
      </div>
      <Botones onClose={onClose} onSave={guardar} guardando={guardando} texto="Marcar supervisada" />
    </Ventana>
  );
}

// Se abre al entrar a la pestaña si hay tareas sin hacer (las atrasadas primero)
function AvisoPendientes({ pendientes, onClose, onVer }) {
  const lista = [...pendientes].sort((a, b) => (a.fecha_solicitud || "").localeCompare(b.fecha_solicitud || ""));
  const atrasadas = lista.filter(tareaAtrasada).length;
  return (
    <Ventana titulo={`${lista.length} tarea${lista.length !== 1 ? "s" : ""} sin realizar`} onClose={onClose} ancho={520}>
      {atrasadas > 0 && <div style={{ marginBottom:12, padding:"9px 12px", borderRadius:8, background:"#FEF2F2", border:"1px solid #FECACA", color:"#B91C1C", fontSize:13, fontWeight:600 }}><Icono n="alerta" /> {atrasadas} con más de {DIAS_ALERTA_MANTENIMIENTO} días sin hacer</div>}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {lista.map(t => {
          const atr = tareaAtrasada(t), d = diasDesdeSolicitud(t);
          return (
            <div key={t.id} style={{ border:`${atr ? 2 : 1}px solid ${atr ? "#DC2626" : "#E2E8F0"}`, background: atr ? "#FEF2F2" : "#F8FAFC", borderRadius:10, padding:"9px 12px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:10, alignItems:"baseline" }}>
                <div style={{ fontSize:14, fontWeight:600, color:"#1A2B4A", wordBreak:"break-word" }}>{t.tarea}</div>
                <div style={{ fontSize:12, fontWeight:700, color: atr ? "#DC2626" : "#64748B", whiteSpace:"nowrap" }}>{textoHace(d)}</div>
              </div>
              <div style={{ fontSize:12, color:"#64748B", marginTop:2 }}><Icono n="casco" /> {t.responsable || "sin asignar"} · solicitada el {formatDate(t.fecha_solicitud)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:10, marginTop:18 }}>
        <button onClick={onClose} style={{ flex:1, padding:"11px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cerrar</button>
        <button onClick={onVer} autoFocus style={{ flex:1, padding:"11px", border:"none", borderRadius:8, background:COLOR, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>Ver tareas para hacer</button>
      </div>
    </Ventana>
  );
}
