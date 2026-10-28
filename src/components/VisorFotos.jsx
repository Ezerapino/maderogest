// Visor de fotos en grande
import { useState, useEffect, useRef, useCallback } from "react";

// Visor de fotos en grande: flechas (o teclado / deslizar en el celular) para pasar, Esc o clic afuera para cerrar
export function VisorFotos({ fotos, inicio = 0, onCerrar }) {
  const [i, setI] = useState(inicio);
  const toqueX = useRef(null);
  const total = fotos.length;
  const pasar = useCallback(d => setI(n => (n + d + total) % total), [total]);
  useEffect(() => {
    const tecla = e => {
      if (e.key === "Escape") onCerrar();
      else if (e.key === "ArrowRight") pasar(1);
      else if (e.key === "ArrowLeft") pasar(-1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [pasar, onCerrar]);
  const f = fotos[i];
  if (!f) return null;
  const src = f.url || f.b64;
  const flecha = lado => ({ position:"absolute", top:"50%", [lado]:12, transform:"translateY(-50%)", width:48, height:48, borderRadius:"50%", border:"none", background:"rgba(255,255,255,0.15)", color:"#fff", fontSize:26, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 });
  return (
    <div onClick={e => e.target === e.currentTarget && onCerrar()}
      onTouchStart={e => { toqueX.current = e.touches[0].clientX; }}
      onTouchEnd={e => { if (toqueX.current == null) return; const dx = e.changedTouches[0].clientX - toqueX.current; toqueX.current = null; if (Math.abs(dx) > 50) pasar(dx < 0 ? 1 : -1); }}
      style={{ position:"fixed", inset:0, zIndex:1500, background:"rgba(2,6,23,0.92)", display:"flex", alignItems:"center", justifyContent:"center", padding:"56px 16px 64px" }}>
      <img src={src} alt={f.name} style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain", borderRadius:4, boxShadow:"0 10px 40px rgba(0,0,0,0.5)" }} />
      <div style={{ position:"absolute", top:0, left:0, right:0, padding:"12px 16px", display:"flex", alignItems:"center", gap:12, color:"#E2E8F0", fontSize:13 }}>
        <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
        {f.url && <a href={f.url} target="_blank" rel="noreferrer" style={{ color:"#fff", fontSize:12, fontWeight:600, textDecoration:"none", padding:"6px 12px", borderRadius:8, background:"rgba(255,255,255,0.15)", whiteSpace:"nowrap" }}>Abrir original ↗</a>}
        <button onClick={onCerrar} title="Cerrar (Esc)" style={{ width:34, height:34, borderRadius:8, border:"none", background:"rgba(255,255,255,0.15)", color:"#fff", fontSize:16, cursor:"pointer" }}>✕</button>
      </div>
      {total > 1 && <>
        <button onClick={() => pasar(-1)} title="Anterior" style={flecha("left")}>‹</button>
        <button onClick={() => pasar(1)} title="Siguiente" style={flecha("right")}>›</button>
        <div style={{ position:"absolute", bottom:20, left:0, right:0, textAlign:"center", color:"#CBD5E1", fontSize:13 }}>{i + 1} de {total}</div>
      </>}
    </div>
  );
}
