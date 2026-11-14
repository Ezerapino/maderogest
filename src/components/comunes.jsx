// Ventanas que se usan en varias pestañas
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { avisar } from "../lib/avisos.js";
import { formatDate } from "../lib/formato.js";
import { CerrarConAtras } from "../lib/atras.js";
import { linkFicha, navegar } from "../lib/rutas.js";
import { getUltimoAviso, subirArchivo } from "../lib/datos.js";
import { Icono } from "./Icono.jsx";

// Botón "Enviar por mail": sale de la casilla de alertas a la lista fija de avisos; si se escriben
// destinatarios, van como "Para" y la lista fija en copia. enviar(para) devuelve la respuesta del servidor.
export function EnviarPorMail({ enviar, deshabilitado, motivo, estiloBoton }) {
  const [abierto, setAbierto] = useState(false);
  const [para, setPara] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  async function mandar() {
    setEnviando(true); setResultado(null);
    try {
      const r = await enviar(para.trim());
      setResultado({ ok: true, texto: `Enviado a ${r.destinos} destinatario(s)${r.adjuntos ? ` con ${r.adjuntos} archivo(s) adjunto(s)` : ""}.` });
      setPara("");
    } catch (e) { setResultado({ ok: false, texto: e.message }); }
    setEnviando(false);
  }
  const cerrar = () => { if (!enviando) { setAbierto(false); setResultado(null); } };
  return (
    <>
      <button onClick={() => setAbierto(true)} disabled={deshabilitado} title={deshabilitado ? motivo : "Enviar desde la casilla de alertas"}
        style={{ ...estiloBoton, opacity: deshabilitado ? 0.5 : 1, cursor: deshabilitado ? "not-allowed" : "pointer" }}><Icono n="mail" /> Enviar por mail</button>
      {abierto && (
        <div onClick={e => e.target === e.currentTarget && cerrar()} className="modal-fondo" style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", zIndex:900, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <CerrarConAtras onClose={() => cerrar()} />
          <div className="modal-caja" style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:440, padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.25)", fontFamily:"'Inter', sans-serif", textTransform:"none", letterSpacing:0 }}>
            <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:"0 0 6px" }}><Icono n="mail" /> Enviar por mail</h3>
            <p style={{ fontSize:12, color:"#64748B", margin:"0 0 14px", lineHeight:1.5 }}>Sale de la casilla de alertas a la lista de avisos. Si agregás destinatarios (por ejemplo el cliente o el arquitecto), les llega a ellos y la lista va en copia.</p>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Para (opcional)</label>
            <input value={para} onChange={e => setPara(e.target.value)} placeholder="cliente@empresa.com, otro@empresa.com" disabled={enviando}
              style={{ width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontSize:13, outline:"none", boxSizing:"border-box" }} />
            {resultado && <div style={{ marginTop:12, padding:"9px 12px", borderRadius:8, fontSize:12, background: resultado.ok ? "#ECFDF5" : "#FEF2F2", color: resultado.ok ? "#059669" : "#DC2626", border:`1px solid ${resultado.ok ? "#A7F3D0" : "#FECACA"}` }}>{resultado.texto}</div>}
            <div style={{ display:"flex", gap:10, marginTop:18 }}>
              <button onClick={cerrar} disabled={enviando} style={{ flex:1, padding:"10px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>{resultado?.ok ? "Cerrar" : "Cancelar"}</button>
              <button onClick={mandar} disabled={enviando}
                style={{ flex:1, padding:"10px", border:"none", borderRadius:8, background: enviando ? "#94A3B8" : "#0F766E", color:"#fff", cursor: enviando ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>{enviando ? "Enviando..." : "Enviar"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Elegir una entrega de la pestaña Entregas (para crear su registro en otra pestaña)
export function ModalElegirEntrega({ titulo, entregas, color = "#1A2B4A", onClose, onElegir }) {
  const [id, setId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const opciones = [...entregas].sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"));
  async function elegir() {
    const e = opciones.find(x => x.id === id);
    if (!e) return;
    setGuardando(true);
    try { await onElegir(e); onClose(); }
    catch (err) { avisar(`No se pudo agregar: ${err.message}`, { tipo: "error" }); }
    setGuardando(false);
  }
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} className="modal-fondo" style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <CerrarConAtras onClose={() => onClose()} />
      <div className="modal-caja" style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:440, padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:"0 0 6px" }}>{titulo}</h3>
        <p style={{ fontSize:12, color:"#64748B", margin:"0 0 16px" }}>Todas las pestañas usan las obras de Entregas. Las obras y entregas nuevas se crean en la pestaña Entregas.</p>
        {opciones.length === 0 ? (
          <div style={{ fontSize:13, color:"#94A3B8", marginBottom:8 }}>Todas las entregas activas ya están en esta pestaña.</div>
        ) : (
          <select value={id} onChange={e => setId(e.target.value)} autoFocus
            style={{ width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none" }}>
            <option value="">— Elegí la entrega —</option>
            {opciones.map(e => <option key={e.id} value={e.id}>{e.nombre}{e.fecha ? ` — ${formatDate(e.fecha)}` : ""}</option>)}
          </select>
        )}
        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ flex:1, padding:"10px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cancelar</button>
          <button onClick={elegir} disabled={!id || guardando}
            style={{ flex:1, padding:"10px", border:"none", borderRadius:8, background: !id || guardando ? "#94A3B8" : color, color:"#fff", cursor: !id || guardando ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>{guardando ? "Agregando..." : "Agregar"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC MODAL
// ═══════════════════════════════════════════════════════════════════════════════
export function ModalSimple({ title, onClose, onSave, fields }) {
  const [form, setForm] = useState(() => {
    const f = {};
    fields.forEach(fi => f[fi.key] = fi.initial || "");
    return f;
  });

  function handleSave() {
    const req = fields.find(fi => fi.required && !form[fi.key]?.trim());
    if (req) { avisar(`"${req.label}" es requerido.`, { tipo: "aviso" }); return; }
    onSave(form);
  }

  const inputStyle = { width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} className="modal-fondo" style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <CerrarConAtras onClose={() => onClose()} />
      <div className="modal-caja" style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:460, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{title}</h2>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}><Icono n="cerrar" /></button>
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

// Menú "⋯" con acciones menos frecuentes (o peligrosas), para no tenerlas a un toque de distancia
// opciones: [{ texto, icono, onClick, peligro }]
export function MenuMas({ opciones, titulo = "Más acciones", estiloBoton }) {
  const [pos, setPos] = useState(null);   // dónde se abre el menú (null = cerrado)
  const boton = useRef(null);
  const menu = useRef(null);
  const abierto = !!pos;
  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setPos(null);
    const fuera = e => { if (!menu.current?.contains(e.target) && !boton.current?.contains(e.target)) cerrar(); };
    const tecla = e => { if (e.key === "Escape") cerrar(); };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    return () => { document.removeEventListener("pointerdown", fuera); document.removeEventListener("keydown", tecla); window.removeEventListener("scroll", cerrar, true); window.removeEventListener("resize", cerrar); };
  }, [abierto]);
  function alternar() {
    if (abierto) { setPos(null); return; }
    const r = boton.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }
  // El menú se dibuja aparte (portal) para que ninguna tarjeta lo tape ni lo recorte
  return (
    <>
      <button ref={boton} onClick={alternar} title={titulo} aria-label={titulo} aria-expanded={abierto} style={estiloBoton}><Icono n="puntos" /></button>
      {abierto && createPortal(
        <div ref={menu} role="menu" style={{ position:"fixed", top:pos.top, right:pos.right, zIndex:180, minWidth:180, background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, boxShadow:"0 10px 30px rgba(15,23,42,0.15)", padding:4 }}>
          {opciones.filter(Boolean).map(o => (
            <button key={o.texto} role="menuitem" onClick={() => { setPos(null); o.onClick(); }}
              style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"9px 10px", border:"none", background:"transparent", borderRadius:7, color: o.peligro ? "#DC2626" : "#1A2B4A", fontSize:13, cursor:"pointer", textAlign:"left", fontFamily:"'Inter', sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.background = o.peligro ? "#FEF2F2" : "#F1F5F9"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              {o.icono && <Icono n={o.icono} />}{o.texto}
            </button>
          ))}
        </div>, document.body
      )}
    </>
  );
}

// Filtro por mes: atajos (este mes, el próximo) y "Elegir mes…" para cualquier otro. valor = "AAAA-MM" o ""
const mesDe = (desplazamiento = 0) => { const h = new Date(); const d = new Date(h.getFullYear(), h.getMonth() + desplazamiento, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
export function FiltroMes({ valor, onCambio, etiqueta = "Fechas" }) {
  const [eligiendo, setEligiendo] = useState(false);
  const esteMes = mesDe(0), proximo = mesDe(1);
  const opcion = !valor ? "" : valor === esteMes ? "este" : valor === proximo ? "proximo" : "otro";
  const estilo = { padding:"9px 12px", background:"#ffffff", border:`1px solid ${valor ? "#93C5FD" : "#E2E8F0"}`, borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", cursor:"pointer" };
  return (
    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
      <select aria-label={`Filtrar ${etiqueta.toLowerCase()} por mes`} value={eligiendo ? "otro" : opcion} style={estilo}
        onChange={e => {
          const v = e.target.value;
          setEligiendo(v === "otro");
          if (v === "") onCambio("");
          else if (v === "este") onCambio(esteMes);
          else if (v === "proximo") onCambio(proximo);
        }}>
        <option value="">{etiqueta}: todas</option>
        <option value="este">Este mes</option>
        <option value="proximo">Próximo mes</option>
        <option value="otro">{opcion === "otro" && !eligiendo ? `Mes: ${valor.split("-").reverse().join("/")}` : "Elegir mes…"}</option>
      </select>
      {(eligiendo || opcion === "otro") && (
        <input type="month" value={valor} autoFocus={eligiendo} aria-label="Mes" onChange={e => { onCambio(e.target.value); }} style={{ ...estilo, cursor:"text" }} />
      )}
    </div>
  );
}

// Botón para ir a la ficha de la obra a la que pertenece una entrega (desde cualquier pestaña)
export function BotonFicha({ entrega, estilo, texto = "Ficha de la obra" }) {
  if (!entrega?.proyecto_id) return null;
  const link = linkFicha({ id: entrega.proyecto_id, nombre: entrega.nombre });
  return (
    <a href={link} title="Ver todo lo de esta obra en una página" onClick={e => { if (e.ctrlKey || e.metaKey || e.shiftKey) return; e.preventDefault(); navegar(link); }}
      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 12px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontSize:12, fontWeight:600, textDecoration:"none", whiteSpace:"nowrap", ...estilo }}>
      <Icono n="documento" /> {texto}
    </a>
  );
}

// "Último aviso: 13/11 08:00 (automático)" junto al botón de mandar el aviso, para no mandarlo dos veces
export function UltimoAviso({ tipo }) {
  const [ultimo, setUltimo] = useState(undefined);
  useEffect(() => {
    let vigente = true;
    const leer = () => getUltimoAviso(tipo).then(a => { if (vigente) setUltimo(a); }).catch(() => { if (vigente) setUltimo(null); });
    leer();
    const alEnviar = e => { if (e.detail === tipo) leer(); };
    window.addEventListener("aviso-enviado", alEnviar);
    return () => { vigente = false; window.removeEventListener("aviso-enviado", alEnviar); };
  }, [tipo]);
  if (ultimo === undefined) return null;
  const f = ultimo && new Date(ultimo.enviado_en);
  const texto = !ultimo ? "Todavía no hay avisos registrados"
    : `Último aviso: ${f.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} ${f.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}${ultimo.por ? ` (${ultimo.por})` : ""}`;
  return <span title="Cuándo salió el último mail de este aviso" style={{ fontSize:11, color:"#94A3B8", whiteSpace:"nowrap" }}><Icono n="reloj" /> {texto}</span>;
}

// Archivos del remito de una entrega (fotos en miniatura, el resto como link)
export function ListaRemito({ archivos = [] }) {
  if (!archivos.length) return null;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center" }}>
      {archivos.map(f => (f.type || "").startsWith("image/")
        ? <a key={f.path} href={f.url} target="_blank" rel="noreferrer" title={f.name}><img src={f.url} alt={f.name} loading="lazy" style={{ width:64, height:64, objectFit:"cover", borderRadius:6, border:"1px solid #E2E8F0", display:"block" }} /></a>
        : <a key={f.path} href={f.url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, color:"#2563EB", textDecoration:"none", padding:"6px 10px", border:"1px solid #E2E8F0", borderRadius:6 }}><Icono n="documento" /> {f.name}</a>)}
    </div>
  );
}

// Confirmar una entrega, con remito firmado o foto opcional. onConfirmar(archivosSubidos) hace el resto.
export function ModalEntregar({ entrega, onClose, onConfirmar }) {
  const [archivos, setArchivos] = useState([]);   // archivos elegidos (todavía sin subir)
  const [trabajando, setTrabajando] = useState(false);
  const input = useRef(null);
  async function confirmar() {
    setTrabajando(true);
    try {
      const subidos = [];
      for (const f of archivos) subidos.push(await subirArchivo(f, `remitos/${entrega.id}`));
      await onConfirmar(subidos);
      onClose();
    } catch (e) { avisar(`No se pudo marcar como entregada: ${e.message}`, { tipo: "error" }); setTrabajando(false); }
  }
  return (
    <div onClick={e => e.target === e.currentTarget && !trabajando && onClose()} className="modal-fondo" style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <CerrarConAtras onClose={() => { if (trabajando) return false; onClose(); }} />
      <div className="modal-caja" role="dialog" aria-label="Marcar como entregada" style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:440, padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:"0 0 6px" }}>Marcar como entregada</h3>
        <p style={{ fontSize:13, color:"#475569", margin:"0 0 16px", lineHeight:1.5 }}><b>{entrega.nombre}</b>{entrega.fecha ? ` · entrega del ${formatDate(entrega.fecha)}` : ""}</p>
        <div style={{ fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Remito firmado o foto de la entrega (opcional)</div>
        <input ref={input} type="file" accept="image/*,.pdf" multiple style={{ display:"none" }}
          onChange={e => { setArchivos(a => [...a, ...Array.from(e.target.files || [])]); e.target.value = ""; }} />
        <button type="button" onClick={() => input.current?.click()} disabled={trabajando}
          style={{ width:"100%", padding:"12px", border:"1.5px dashed #CBD5E1", borderRadius:10, background:"#F8FAFC", color:"#475569", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <Icono n="camara" /> Sacar foto o elegir archivo
        </button>
        {archivos.length > 0 && (
          <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:6 }}>
            {archivos.map((f, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#475569", padding:"6px 10px", background:"#F8FAFC", borderRadius:6 }}>
                <Icono n={(f.type || "").startsWith("image/") ? "imagen" : "documento"} />
                <span style={{ flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                <button type="button" onClick={() => setArchivos(a => a.filter((_, j) => j !== i))} disabled={trabajando} aria-label="Quitar" style={{ background:"none", border:"none", color:"#94A3B8", cursor:"pointer", display:"flex" }}><Icono n="cerrar" /></button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <button onClick={onClose} disabled={trabajando} style={{ flex:1, padding:"11px", border:"1px solid #E2E8F0", borderRadius:8, background:"#F8FAFC", color:"#64748B", cursor:"pointer", fontSize:13 }}>Cancelar</button>
          <button onClick={confirmar} disabled={trabajando} autoFocus
            style={{ flex:1, padding:"11px", border:"none", borderRadius:8, background: trabajando ? "#94A3B8" : "#059669", color:"#fff", cursor: trabajando ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>
            {trabajando ? (archivos.length ? "Subiendo..." : "Guardando...") : "Entregada"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── VISTA TARJETAS / TABLA ───────────────────────────────────────────────────
export function SelectorVista({ vista, onCambio }) {
  const op = (v, icono, texto) => (
    <button key={v} onClick={() => onCambio(v)} aria-pressed={vista === v} title={`Ver como ${texto.toLowerCase()}`}
      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:7, border:"none", background: vista === v ? "#1A2B4A" : "transparent", color: vista === v ? "#fff" : "#64748B", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
      <Icono n={icono} /> {texto}
    </button>
  );
  return <div style={{ display:"inline-flex", gap:2, background:"#fff", border:"1px solid #E8ECF0", borderRadius:10, padding:3 }}>{op("tarjetas", "carpeta", "Tarjetas")}{op("tabla", "lista", "Tabla")}</div>;
}

// Tabla que se ordena tocando el título de cada columna.
// columnas: [{ clave, titulo, valor: fila => (para ordenar), celda: fila => (lo que se muestra), alinear }]
export function TablaOrdenable({ columnas, filas, onFila, ordenInicial }) {
  const [orden, setOrden] = useState(ordenInicial || { clave: columnas[0].clave, asc: true });
  const col = columnas.find(c => c.clave === orden.clave) || columnas[0];
  const vacio = v => v == null || v === "";
  const ordenadas = [...filas].sort((a, b) => {
    const x = col.valor(a), y = col.valor(b);
    if (vacio(x) && vacio(y)) return 0;
    if (vacio(x)) return 1;            // lo vacío siempre al final
    if (vacio(y)) return -1;
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es");
    return orden.asc ? c : -c;
  });
  const th = { padding:"10px 12px", fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:0.4, textAlign:"left", whiteSpace:"nowrap", borderBottom:"1px solid #E2E8F0", background:"#F8FAFC", cursor:"pointer", userSelect:"none" };
  return (
    <div style={{ overflowX:"auto", background:"#fff", border:"1px solid #E8ECF0", borderRadius:12 }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, color:"#1A2B4A" }}>
        <thead>
          <tr>
            {columnas.map(c => (
              <th key={c.clave} style={{ ...th, textAlign: c.alinear || "left" }} aria-sort={orden.clave === c.clave ? (orden.asc ? "ascending" : "descending") : undefined}
                onClick={() => setOrden(o => ({ clave: c.clave, asc: o.clave === c.clave ? !o.asc : true }))}>
                {c.titulo}{orden.clave === c.clave ? (orden.asc ? " ↑" : " ↓") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((f, i) => (
            <tr key={f.id || i} onClick={() => onFila?.(f)} style={{ cursor: onFila ? "pointer" : "default", borderBottom:"1px solid #F1F5F9" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F8FAFC"; }} onMouseLeave={e => { e.currentTarget.style.background = ""; }}>
              {columnas.map(c => <td key={c.clave} style={{ padding:"10px 12px", textAlign: c.alinear || "left", verticalAlign:"top" }}>{c.celda ? c.celda(f) : c.valor(f)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
