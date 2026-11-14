// Revisar nombres (solo admin): muestra dónde una misma obra quedó escrita distinto y deja elegir cuál queda.
// No cambia nada por su cuenta: cada arreglo es un botón.
import { useState, useEffect } from "react";
import { Icono } from "../components/Icono.jsx";
import { avisar } from "../lib/avisos.js";
import { CerrarConAtras } from "../lib/atras.js";
import { getAixaObras, getCobros, getMateriales, getObrasAceptadas, getObrasAvance, renombrarObra, sincronizarEntrega, updateObraAceptada } from "../lib/datos.js";
import { nombresParecidos } from "../lib/formato.js";

export function RevisarNombres({ obras, proyectos, onClose, onCambio }) {
  const [datos, setDatos] = useState(null);
  const [trabajando, setTrabajando] = useState(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    Promise.all([getObrasAceptadas(), getCobros(), getMateriales(), getAixaObras(), getObrasAvance()])
      .then(([aceptadas, cobros, materiales, produccion, avance]) => { if (vigente) setDatos({ aceptadas: aceptadas || [], cobros: cobros || [], materiales: materiales || [], produccion: produccion || [], avance: avance || [] }); })
      .catch(e => { if (vigente) { avisar(`No se pudieron leer los datos: ${e.message}`, { tipo: "error" }); setDatos({ aceptadas: [], cobros: [], materiales: [], produccion: [], avance: [] }); } });
    return () => { vigente = false; };
  }, [recarga]);

  async function hacer(clave, accion, ok) {
    setTrabajando(clave);
    try { await accion(); await onCambio(); setRecarga(n => n + 1); if (ok) avisar(ok, { tipo: "ok" }); }
    catch (e) { avisar(`No se pudo: ${e.message}`, { tipo: "error" }); }
    setTrabajando(null);
  }

  const proyectoDe = id => proyectos.find(p => p.id === id);
  const entregaDe = id => obras.find(e => e.id === id);

  // 1) Obras aceptadas vinculadas cuyo nombre no coincide con el de Entregas
  const distintas = (datos?.aceptadas || []).filter(a => { const p = proyectoDe(a.proyecto_id); return p && p.nombre !== a.nombre; });
  // 2) Obras aceptadas sin vincular que parecen estar en Entregas
  const sinVincular = (datos?.aceptadas || []).filter(a => !proyectoDe(a.proyecto_id))
    .map(a => ({ a, parecidas: proyectos.filter(p => !p.archivada && nombresParecidos(a.nombre, p.nombre)) }))
    .filter(x => x.parecidas.length);
  // 3) Registros de otras pestañas con un nombre viejo (se corrigen copiando el de la entrega)
  const desactualizadas = [];
  if (datos) {
    const revisar = (lista, pestana, nombreDe) => lista.forEach(r => {
      const e = entregaDe(r.obra_id);
      if (e && nombreDe(r) !== e.nombre) desactualizadas.push({ id: `${pestana}-${r.id}`, pestana, actual: nombreDe(r), entrega: e });
    });
    revisar(datos.cobros, "Cobros", r => r.obra_nombre);
    revisar(datos.materiales, "Materiales", r => r.obra_nombre);
    revisar(datos.produccion, "Producción", r => r.name);
    revisar(datos.avance, "Avance de obra", r => r.nombre);
  }
  const entregasAActualizar = [...new Map(desactualizadas.map(d => [d.entrega.id, d.entrega])).values()];
  // 4) Obras distintas con nombres casi iguales (posibles duplicados: solo para revisar)
  const activos = proyectos.filter(p => !p.archivada);
  const duplicados = [];
  activos.forEach((p, i) => activos.slice(i + 1).forEach(q => { if (nombresParecidos(p.nombre, q.nombre)) duplicados.push([p, q]); }));

  const nada = datos && !distintas.length && !sinVincular.length && !desactualizadas.length && !duplicados.length;
  const titulo = { fontSize:11, fontWeight:700, color:"#94A3B8", letterSpacing:0.5, margin:"18px 0 8px" };
  const fila = { padding:"11px 13px", border:"1px solid #E2E8F0", borderRadius:10, marginBottom:8, background:"#FAFBFC" };
  const btn = (principal) => ({ padding:"6px 11px", borderRadius:7, fontSize:12, fontWeight:600, cursor:"pointer", border: principal ? "none" : "1px solid #CBD5E1", background: principal ? "#1A2B4A" : "#fff", color: principal ? "#fff" : "#1A2B4A", fontFamily:"'Inter', sans-serif" });

  return (
    <div onClick={e => e.target === e.currentTarget && !trabajando && onClose()} className="modal-fondo" style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <CerrarConAtras onClose={() => { if (trabajando) return false; onClose(); }} />
      <div className="modal-caja" style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:680, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"18px 22px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, position:"sticky", top:0, background:"#fff", zIndex:1 }}>
          <div>
            <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>Revisar nombres de obras</h2>
            <div style={{ fontSize:12, color:"#64748B", marginTop:3 }}>Dónde una misma obra quedó escrita distinto. Nada se cambia hasta que elegís.</div>
          </div>
          <button onClick={onClose} disabled={!!trabajando} aria-label="Cerrar" style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, flexShrink:0, cursor:"pointer", color:"#64748B", display:"flex", alignItems:"center", justifyContent:"center" }}><Icono n="cerrar" /></button>
        </div>
        <div style={{ padding:"4px 22px 22px" }}>
          {!datos && <div style={{ padding:"40px 0", textAlign:"center", color:"#94A3B8", fontSize:13 }}>Revisando...</div>}
          {nada && <div style={{ padding:"40px 0", textAlign:"center", color:"#059669", fontSize:14, fontWeight:600 }}><Icono n="checkCirculo" tam={20} /> Todos los nombres coinciden.</div>}

          {distintas.length > 0 && <>
            <div style={titulo}>OBRAS ACEPTADAS CON OTRO NOMBRE QUE EN ENTREGAS ({distintas.length})</div>
            {distintas.map(a => {
              const p = proyectoDe(a.proyecto_id);
              return (
                <div key={a.id} style={fila}>
                  <div style={{ fontSize:13, color:"#1A2B4A", marginBottom:8, lineHeight:1.5 }}>
                    Obras Aceptadas: <b>{a.nombre}</b><br />Entregas: <b>{p.nombre}</b>
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <button disabled={!!trabajando} style={btn(true)} onClick={() => hacer(a.id, () => updateObraAceptada(a.id, { nombre: p.nombre, updated_at: new Date().toISOString() }), "Nombre actualizado.")}>Dejar "{p.nombre}"</button>
                    <button disabled={!!trabajando} style={btn(false)} onClick={() => hacer(a.id, () => renombrarObra(p.id, { nombre: a.nombre }), `La obra pasó a llamarse "${a.nombre}" en todas las pestañas.`)}>Dejar "{a.nombre}" (cambia en todas)</button>
                  </div>
                </div>
              );
            })}
          </>}

          {sinVincular.length > 0 && <>
            <div style={titulo}>OBRAS ACEPTADAS SIN VINCULAR QUE PARECEN ESTAR EN ENTREGAS ({sinVincular.length})</div>
            {sinVincular.map(({ a, parecidas }) => (
              <div key={a.id} style={fila}>
                <div style={{ fontSize:13, color:"#1A2B4A", marginBottom:8 }}>Obras Aceptadas: <b>{a.nombre}</b></div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {parecidas.map(p => (
                    <button key={p.id} disabled={!!trabajando} style={btn(false)} onClick={() => hacer(a.id, () => updateObraAceptada(a.id, { proyecto_id: p.id, nombre: p.nombre, updated_at: new Date().toISOString() }), `Vinculada a "${p.nombre}".`)}>
                      <Icono n="link" /> Vincular a "{p.nombre}"
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>}

          {desactualizadas.length > 0 && <>
            <div style={titulo}>OTRAS PESTAÑAS CON UN NOMBRE VIEJO ({desactualizadas.length})</div>
            <div style={{ fontSize:12, color:"#64748B", marginBottom:8 }}>Se corrigen copiando el nombre de la entrega (el de Entregas manda).</div>
            {desactualizadas.slice(0, 30).map(d => (
              <div key={d.id} style={{ ...fila, fontSize:12, color:"#475569" }}>{d.pestana}: <b>{d.actual || "(sin nombre)"}</b> → {d.entrega.nombre}</div>
            ))}
            {desactualizadas.length > 30 && <div style={{ fontSize:12, color:"#94A3B8", marginBottom:8 }}>y {desactualizadas.length - 30} más.</div>}
            <button disabled={!!trabajando} style={btn(true)} onClick={() => hacer("sinc", async () => { for (const e of entregasAActualizar) await sincronizarEntrega(e); }, "Nombres actualizados en las otras pestañas.")}>
              {trabajando === "sinc" ? "Actualizando..." : `Actualizar ${desactualizadas.length === 1 ? "este" : `estos ${desactualizadas.length}`}`}
            </button>
          </>}

          {duplicados.length > 0 && <>
            <div style={titulo}>OBRAS DISTINTAS CON NOMBRES CASI IGUALES ({duplicados.length})</div>
            <div style={{ fontSize:12, color:"#64748B", marginBottom:8 }}>Pueden ser la misma obra cargada dos veces. Si es así, conviene pasar las entregas a una y archivar la otra; si son obras distintas, no hace falta nada.</div>
            {duplicados.map(([p, q]) => (
              <div key={`${p.id}-${q.id}`} style={{ ...fila, fontSize:13, color:"#1A2B4A" }}><b>{p.nombre}</b> · <b>{q.nombre}</b></div>
            ))}
          </>}
        </div>
      </div>
    </div>
  );
}
