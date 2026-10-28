// Historial de modificaciones (solo admin@fabrica.com)
import { useState, useEffect } from "react";
import { avisar } from "../lib/avisos.js";
import { getUsuarios, sbFetch } from "../lib/datos.js";
import { EMAIL_HISTORIAL, TABLAS_HISTORIAL, renglonesHistorial } from "../lib/historial.js";

export function HistorialModule() {
  const POR_PAGINA = 100;
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [hayMas, setHayMas] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [filtro, setFiltro] = useState({ quien: "", tabla: "", obra: "", desde: "", hasta: "" });

  const consulta = offset => {
    const q = [`select=*&order=creado_en.desc&limit=${POR_PAGINA}&offset=${offset}`];
    if (filtro.quien) q.push(`usuario_nombre=eq.${encodeURIComponent(filtro.quien)}`);
    if (filtro.tabla) q.push(`tabla=eq.${filtro.tabla}`);
    if (filtro.obra.trim()) q.push(`obra=ilike.${encodeURIComponent(`*${filtro.obra.trim()}*`)}`);
    if (filtro.desde) q.push(`creado_en=gte.${new Date(`${filtro.desde}T00:00`).toISOString()}`);
    if (filtro.hasta) q.push(`creado_en=lt.${new Date(new Date(`${filtro.hasta}T00:00`).getTime() + 86400000).toISOString()}`);
    return `auditoria?${q.join("&")}`;
  };

  async function cargar(mas = false) {
    setCargando(true);
    try {
      const nuevas = await sbFetch(consulta(mas ? filas.length : 0));
      setFilas(f => mas ? [...f, ...nuevas] : nuevas);
      setHayMas(nuevas.length === POR_PAGINA);
    } catch (e) { avisar(`No se pudo cargar el historial. ${e.message || ""}`, { tipo: "error" }); }
    setCargando(false);
  }

  // Se vuelve a pedir cada vez que cambia un filtro (el de texto espera a que se deje de escribir)
  useEffect(() => {
    const t = setTimeout(() => cargar(), filtro.obra ? 400 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);
  useEffect(() => { getUsuarios().then(u => setUsuarios(u || [])).catch(() => {}); }, []);

  const si = { padding: "8px 10px", background: "#ffffff", border: "1px solid #E2E8F0", borderRadius: 8, color: "#1A2B4A", fontFamily: "'Inter', sans-serif", fontSize: 13, outline: "none", minWidth: 0 };
  const COLOR_ACCION = { "creó": "#059669", "modificó": "#2563EB", "borró": "#DC2626" };
  const hayFiltro = Object.values(filtro).some(Boolean);
  const dia = iso => new Date(iso).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hora = iso => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: "#1A2B4A", margin: 0 }}>🕑 Historial de modificaciones</h2>
        <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Quién cambió qué y cuándo, en todas las pestañas. Solo lo ve {EMAIL_HISTORIAL}.</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
        <select value={filtro.quien} onChange={e => setFiltro(f => ({ ...f, quien: e.target.value }))} style={{ ...si, flex: "1 1 150px" }}>
          <option value="">Todas las personas</option>
          {usuarios.map(u => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}
        </select>
        <select value={filtro.tabla} onChange={e => setFiltro(f => ({ ...f, tabla: e.target.value }))} style={{ ...si, flex: "1 1 150px" }}>
          <option value="">Todas las pestañas</option>
          {Object.entries(TABLAS_HISTORIAL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input value={filtro.obra} onChange={e => setFiltro(f => ({ ...f, obra: e.target.value }))} placeholder="Buscar obra..." style={{ ...si, flex: "1 1 160px" }} />
        <label style={{ fontSize: 12, color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>Desde
          <input type="date" value={filtro.desde} onChange={e => setFiltro(f => ({ ...f, desde: e.target.value }))} style={si} /></label>
        <label style={{ fontSize: 12, color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>Hasta
          <input type="date" value={filtro.hasta} onChange={e => setFiltro(f => ({ ...f, hasta: e.target.value }))} style={si} /></label>
        {hayFiltro && <button onClick={() => setFiltro({ quien: "", tabla: "", obra: "", desde: "", hasta: "" })} style={{ ...si, cursor: "pointer", color: "#64748B" }}>✕ Limpiar</button>}
      </div>

      {!filas.length ? (
        <div style={{ background: "#ffffff", border: "1px solid #E8ECF0", borderRadius: 12, padding: 30, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
          {cargando ? "Cargando…" : hayFiltro ? "No hay cambios con estos filtros." : "Todavía no hay cambios registrados."}
        </div>
      ) : (
        <div style={{ background: "#ffffff", border: "1px solid #E8ECF0", borderRadius: 12, padding: "4px 18px" }}>
          {filas.map((r, i) => {
            const nuevoDia = i === 0 || dia(filas[i - 1].creado_en) !== dia(r.creado_en);
            const renglones = renglonesHistorial(r);
            return (
              <div key={r.id}>
                {nuevoDia && <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.5, textTransform: "uppercase", padding: "14px 0 6px" }}>{dia(r.creado_en)}</div>}
                <div style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: "1px solid #F1F5F9" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", width: 44, flexShrink: 0, paddingTop: 1 }}>{hora(r.creado_en)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#1A2B4A" }}>
                      <strong>{r.usuario_nombre || "—"}</strong>{" "}
                      <span style={{ color: COLOR_ACCION[r.accion] || "#475569", fontWeight: 600 }}>{r.accion}</span>{" "}
                      <span style={{ fontSize: 11, color: "#475569", background: "#F1F5F9", borderRadius: 4, padding: "1px 6px" }}>{TABLAS_HISTORIAL[r.tabla] || r.tabla}</span>
                      {r.obra && <span style={{ color: "#64748B" }}> · {r.obra}</span>}
                    </div>
                    {renglones.map((l, j) => <div key={j} style={{ fontSize: 12, color: "#475569", marginTop: 3, overflowWrap: "anywhere" }}>{l}</div>)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {hayMas && <button disabled={cargando} onClick={() => cargar(true)} style={{ width: "100%", marginTop: 12, padding: "10px 0", background: "#ffffff", border: "1px solid #E2E8F0", borderRadius: 8, color: "#2563EB", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{cargando ? "Cargando…" : "Ver más"}</button>}
    </div>
  );
}
