// Ventanas que se usan en varias pestañas
import { useState } from "react";
import { avisar } from "../lib/avisos.js";
import { formatDate } from "../lib/formato.js";

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
        style={{ ...estiloBoton, opacity: deshabilitado ? 0.5 : 1, cursor: deshabilitado ? "not-allowed" : "pointer" }}>📧 Enviar por mail</button>
      {abierto && (
        <div onClick={e => e.target === e.currentTarget && cerrar()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", zIndex:900, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:440, padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.25)", fontFamily:"'Inter', sans-serif", textTransform:"none", letterSpacing:0 }}>
            <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:16, fontWeight:700, color:"#1A2B4A", margin:"0 0 6px" }}>📧 Enviar por mail</h3>
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
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:440, padding:24, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
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
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:460, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>{title}</h2>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
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
