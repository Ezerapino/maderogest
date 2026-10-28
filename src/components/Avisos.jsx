// Avisos abajo de la pantalla y ventana de confirmación
import { useState, useEffect } from "react";
import { registrarAvisos } from "../lib/avisos.js";

const AVISO_COLORES = {
  ok:    { fondo: "#ECFDF5", borde: "#A7F3D0", texto: "#065F46", icono: "✓" },
  error: { fondo: "#FEF2F2", borde: "#FECACA", texto: "#991B1B", icono: "!" },
  aviso: { fondo: "#FFFBEB", borde: "#FDE68A", texto: "#92400E", icono: "!" },
  info:  { fondo: "#EFF6FF", borde: "#BFDBFE", texto: "#1E3A8A", icono: "i" },
};

export function Avisos() {
  const [avisos, setAvisos] = useState([]);
  const [pregunta, setPregunta] = useState(null);

  useEffect(() => {
    registrarAvisos(a => {
      setAvisos(prev => [...prev.slice(-3), a]);
      // Los errores y los que se pueden deshacer quedan más tiempo a la vista
      const ms = a.deshacer ? 8000 : a.tipo === "error" ? 7000 : 4000;
      setTimeout(() => setAvisos(prev => prev.filter(x => x.id !== a.id)), ms);
    }, setPregunta);
    return () => registrarAvisos(null, null);
  }, []);

  function cerrar(id) { setAvisos(prev => prev.filter(x => x.id !== id)); }
  function responder(si) { pregunta?.resolver(si); setPregunta(null); }

  // Escape cancela; Enter activa el botón que tiene el foco (de entrada, el de confirmar)
  useEffect(() => {
    if (!pregunta) return;
    const tecla = e => { if (e.key === "Escape") { pregunta.resolver(false); setPregunta(null); } };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [pregunta]);

  const fuente = "'Inter', sans-serif";
  return (
    <>
      <div className="avisos-pila" style={{ position:"fixed", bottom:16, left:16, right:16, zIndex:2000, display:"flex", flexDirection:"column", alignItems:"center", gap:8, pointerEvents:"none" }}>
        {avisos.map(a => {
          const c = AVISO_COLORES[a.tipo] || AVISO_COLORES.info;
          return (
            <div key={a.id} role={a.tipo === "error" ? "alert" : "status"} style={{ pointerEvents:"auto", width:"100%", maxWidth:440, display:"flex", alignItems:"center", gap:10, padding:"11px 12px 11px 14px", background:c.fondo, border:`1px solid ${c.borde}`, borderRadius:10, boxShadow:"0 6px 20px rgba(15,23,42,0.12)", fontFamily:fuente, color:c.texto, fontSize:13, lineHeight:1.4 }}>
              <span style={{ flexShrink:0, width:20, height:20, borderRadius:"50%", background:c.texto, color:c.fondo, fontSize:12, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{c.icono}</span>
              <span style={{ flex:1, whiteSpace:"pre-line" }}>{a.texto}</span>
              {a.deshacer && (
                <button onClick={() => { cerrar(a.id); a.deshacer(); }} style={{ flexShrink:0, padding:"5px 10px", background:"transparent", border:`1px solid ${c.texto}`, borderRadius:6, color:c.texto, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:fuente }}>Deshacer</button>
              )}
              <button onClick={() => cerrar(a.id)} aria-label="Cerrar aviso" style={{ flexShrink:0, background:"none", border:"none", color:c.texto, fontSize:18, lineHeight:1, cursor:"pointer", padding:"0 2px", opacity:0.6 }}>×</button>
            </div>
          );
        })}
      </div>

      {pregunta && (
        <div onClick={() => responder(false)} style={{ position:"fixed", inset:0, zIndex:2100, background:"rgba(15,23,42,0.45)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width:"100%", maxWidth:420, background:"#fff", borderRadius:14, padding:22, boxShadow:"0 20px 50px rgba(15,23,42,0.25)", fontFamily:fuente, color:"#1A2B4A" }}>
            <div style={{ fontSize:14, lineHeight:1.55, whiteSpace:"pre-line" }}>{pregunta.texto}</div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:20 }}>
              <button onClick={() => responder(false)} style={{ padding:"9px 16px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#475569", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:fuente }}>Cancelar</button>
              <button autoFocus onClick={() => responder(true)} style={{ padding:"9px 16px", background:pregunta.peligro ? "#DC2626" : "#1A2B4A", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:fuente }}>{pregunta.boton}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
