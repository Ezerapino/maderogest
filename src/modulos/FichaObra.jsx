// Ficha de obra: todo lo de una obra en una página, y se edita desde acá
import { useState, useEffect } from "react";
import { ModalSimple } from "../components/comunes.jsx";
import { avisar, confirmar } from "../lib/avisos.js";
import { insertAixaObra, insertCobro, insertDiaAvance, insertMaterial, modificarFila, sbFetch, updateDiaAvance } from "../lib/datos.js";
import { formatDate, pesos, uid } from "../lib/formato.js";
import { ESTADOS_MAT, MATERIAL_ESTADOS, UNIDADES, detalleFaltante, resumenMateriales } from "../lib/materiales.js";
import { generarPDF, ofrecerInformeCierre } from "../lib/pdf.js";
import { ESTACION_COLORES, SC_ENTREGA, cambioEstacion, camposEstacion, estadoEntrega, mkStations, normalizarMuebles, obraProgressAixa, saldoDeCobro } from "../lib/produccion.js";
import { ModalDiaAvance } from "./AvanceObra.jsx";

// Cada rol edita en la ficha lo mismo que puede ver (igual que en las pestañas de siempre)
export function FichaObra({ proyecto: p, entregas, sesion, onVolver, onModal, onEntregar }) {
  const rol = sesion.rol;
  const ve = {
    produccion: rol !== "arquitecto" && rol !== "finanzas",
    materiales: rol !== "arquitecto" && rol !== "finanzas",
    cobro: rol === "admin" || rol === "finanzas",
    obra: rol !== "finanzas",
  };
  const [solapa, setSolapa] = useState("resumen");
  const [datos, setDatos] = useState(null);
  useEffect(() => { document.title = `${p.nombre} · MaderoGest`; }, [p.nombre]);
  const [recarga, setRecarga] = useState(0);
  const [editando, setEditando] = useState(null); // { tipo: "estacion" | "item" | "montos" | "adicional" | "dia", ... }
  const [ocupado, setOcupado] = useState(false);
  const ids = entregas.map(e => e.id);
  // Si cambia la fecha o el estado de una entrega, las otras pestañas también cambian: se vuelve a leer
  const clave = entregas.map(e => `${e.id}:${e.editado_en || ""}:${e.estado}`).join(",");

  // Guarda un cambio y vuelve a leer la ficha; devuelve lo que devolvió el guardado
  async function guardar(fn, error) {
    setOcupado(true);
    try {
      const r = await fn();
      setEditando(null);
      setRecarga(n => n + 1);
      return r;
    } catch (e) { avisar(`${error}. ${e.message || ""}`, { tipo: "error" }); }
    finally { setOcupado(false); }
  }

  const cambiarCobro = (c, cambio) => guardar(() => modificarFila("cobros", c.id, fila => ({ ...cambio(fila), updated_at: new Date().toISOString() })), "No se pudo guardar el cobro");
  const cambiarItems = (lista, cambio) => guardar(() => modificarFila("materiales", lista.id, fila => ({ items: cambio(fila.items || []), updated_at: new Date().toISOString() })), "No se pudo guardar el material");

  async function guardarEstacion({ prod, idx }, form) {
    const nombre = prod.stations?.[idx]?.name;
    ofrecerInformeCierre(await guardar(() => modificarFila("avance_obras", prod.id, o => cambioEstacion(o, nombre, idx, form, sesion)), "No se pudo guardar la estación"));
  }

  function guardarItem({ lista, item }, form) {
    const datosItem = { ...form, nombre: form.nombre.trim() };
    return cambiarItems(lista, items => item
      ? items.map(i => i.id === item.id ? { ...i, ...datosItem } : i)
      : [...items, { id: uid(), tipo: "", largo: "", ancho: "", espesor: "", color: "", terminacion: "", marca: "", orden_pedido: "", numero_remito: "", cantidad_recibida: "", ...datosItem }]);
  }

  async function eliminarItem(lista, item) {
    if (!await confirmar(`¿Eliminar "${item.nombre}" de la lista de materiales?`)) return;
    cambiarItems(lista, items => items.filter(i => i.id !== item.id));
  }

  function guardarDia({ oa, dia }, form) {
    return guardar(() => dia ? updateDiaAvance(dia.id, form) : insertDiaAvance({ ...form, obra_id: oa.id, archivos: [] }), "No se pudo guardar el día");
  }

  // Para entregas viejas a las que les falta el registro en otra pestaña
  function crearRegistro(tipo, e) {
    const base = { obra_id: e.id, obra_nombre: e.nombre, obra_lugar: e.lugar };
    if (tipo === "produccion") return guardar(() => insertAixaObra({ obra_id: e.id, name: e.nombre, client: e.lugar, start_date: null, due_date: e.fecha || null, description: e.notas || "", stations: mkStations(), history: [], clarifications: [] }), "No se pudo crear");
    if (tipo === "materiales") return guardar(() => insertMaterial({ ...base, items: [], notas: "" }), "No se pudo crear");
    if (tipo === "cobro") return guardar(() => insertCobro({ ...base, monto_total: 0, adelanto_cobrado: false, adelanto_monto: 0, adelanto_porcentaje: 0, total_cobrado: false, total_fecha: null, plazo_pago: "", adicionales: [] }), "No se pudo crear");
  }

  useEffect(() => {
    let vivo = true;
    const lista = `in.(${ids.map(id => `"${id}"`).join(",")})`;
    const pedir = (ok, ruta) => ok && ids.length ? sbFetch(ruta).catch(e => { console.error("Ficha:", e); return []; }) : Promise.resolve([]);
    (async () => {
      const [produccion, materiales, cobros, obrasAvance] = await Promise.all([
        pedir(ve.produccion, `avance_obras?obra_id=${lista}`),
        pedir(ve.materiales, `materiales?obra_id=${lista}`),
        pedir(ve.cobro, `cobros?obra_id=${lista}`),
        pedir(ve.obra, `obras_avance?obra_id=${lista}`),
      ]);
      const dias = obrasAvance.length
        ? await sbFetch(`avance_dias?obra_id=in.(${obrasAvance.map(o => `"${o.id}"`).join(",")})&order=fecha.desc`).catch(() => [])
        : [];
      if (vivo) setDatos({ produccion, materiales, cobros, obrasAvance, dias });
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, recarga]);

  const de = (lista, e) => (lista || []).find(x => x.obra_id === e.id);
  const ordenadas = [...entregas].sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"));
  const pendientes = ordenadas.filter(e => e.estado !== "terminado");
  const proxima = pendientes.find(e => e.fecha);

  // Totales de la obra para los números de arriba
  const tot = { pct: null, faltan: 0, items: 0, saldo: 0, conMonto: 0, ultimoDia: null };
  if (datos) {
    const prods = ordenadas.map(e => de(datos.produccion, e)).filter(Boolean);
    if (prods.length) tot.pct = Math.round(prods.reduce((s, o) => s + obraProgressAixa(o), 0) / prods.length);
    ordenadas.forEach(e => {
      const items = de(datos.materiales, e)?.items || [];
      const r = resumenMateriales(items);
      tot.faltan += r.faltaPedir.length + r.faltaRecibir.length;
      tot.items += items.length;
      const c = de(datos.cobros, e);
      if (c && Number(c.monto_total) > 0) { tot.conMonto++; tot.saldo += saldoDeCobro(c); }
    });
    tot.ultimoDia = datos.dias[0]?.fecha || null;
  }

  const numeros = [
    { label: "Entregadas", valor: `${ordenadas.length - pendientes.length} de ${ordenadas.length}`, color: "#2563EB" },
    ve.produccion && { label: "Producción", valor: datos ? (tot.pct == null ? "—" : `${tot.pct}%`) : "…", color: "#D97706" },
    ve.materiales && { label: "Materiales que faltan", valor: datos ? (tot.items ? String(tot.faltan) : "Sin cargar") : "…", color: !tot.items ? "#94A3B8" : tot.faltan ? "#DC2626" : "#059669" },
    ve.cobro && { label: "Falta cobrar", valor: datos ? (tot.conMonto ? pesos(tot.saldo) : "Sin montos") : "…", color: "#7C3AED" },
    ve.obra && !ve.cobro && { label: "Último avance de obra", valor: datos ? (tot.ultimoDia ? formatDate(tot.ultimoDia) : "—") : "…", color: "#B45309" },
  ].filter(Boolean);

  const solapas = [
    { id: "resumen", label: "Resumen" },
    { id: "entregas", label: `Entregas (${ordenadas.length})` },
    ve.produccion && { id: "produccion", label: "Producción" },
    ve.materiales && { id: "materiales", label: "Materiales" },
    ve.cobro && { id: "cobro", label: "Cobro" },
    ve.obra && { id: "obra", label: "Avance de obra" },
  ].filter(Boolean);

  const tarjeta = { background: "#ffffff", border: "1px solid #E8ECF0", borderRadius: 14, padding: 18, marginBottom: 14 };
  const subtitulo = { fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: "#1A2B4A", margin: "0 0 12px" };
  const chip = (c, texto) => <span style={{ padding: "2px 8px", borderRadius: 6, background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, border: `1px solid ${c.border}`, whiteSpace: "nowrap" }}>{texto}</span>;
  const vacio = texto => <div style={{ fontSize: 13, color: "#94A3B8" }}>{texto}</div>;
  const cargando = !datos && vacio("Cargando…");
  const boton = { padding: "5px 11px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 7, color: "#475569", fontSize: 12, fontWeight: 600, cursor: ocupado ? "wait" : "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" };
  const botonAgregar = { ...boton, background: "#ffffff", border: "1px dashed #CBD5E1", color: "#2563EB" };
  const botonCrear = (tipo, e, texto) => <button disabled={ocupado} onClick={() => crearRegistro(tipo, e)} style={{ ...botonAgregar, marginTop: 8 }}>{texto}</button>;
  const tilde = (ok, onChange, texto) => (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", color: ok ? "#059669" : "#94A3B8", fontWeight: 600 }}>
      <input type="checkbox" checked={!!ok} disabled={ocupado} onChange={onChange} style={{ width: 16, height: 16, accentColor: "#059669", cursor: "pointer", margin: 0 }} />{texto}
    </label>
  );
  const encabezadoEntrega = (e, acciones) => {
    const est = estadoEntrega(e);
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <h3 style={{ ...subtitulo, margin: 0 }}>{e.etiqueta || "Entrega"} <span style={{ fontWeight: 500, color: "#64748B", fontSize: 12 }}>· 📅 {e.fecha ? formatDate(e.fecha) : "Sin fecha"}</span></h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>{acciones}{chip(SC_ENTREGA[est.status], est.label)}</div>
      </div>
    );
  };

  return (
    <div>
      <button onClick={onVolver} style={{ padding: "7px 14px", background: "#ffffff", border: "1px solid #E2E8F0", borderRadius: 8, color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 16, fontFamily: "'Inter', sans-serif" }}>← Volver a Entregas</button>

      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 24, fontWeight: 800, color: "#1A2B4A", margin: 0 }}>{p.nombre}</h1>
          <button title="Cambiar nombre o dirección de la obra" onClick={() => onModal({ modo: "editar-obra", proyecto: p })} style={boton}>✎ Editar obra</button>
        </div>
        <div style={{ fontSize: 13, color: "#64748B", marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
          {p.lugar && <span>📍 {p.lugar}</span>}
          <span>📦 {ordenadas.length} entrega{ordenadas.length !== 1 ? "s" : ""}</span>
          {proxima && <span>⏭ Próxima: {proxima.etiqueta || "entrega"} el {formatDate(proxima.fecha)} ({estadoEntrega(proxima).label.toLowerCase()})</span>}
        </div>
      </div>

      <div className="grid-numeros" style={{ display: "grid", gridTemplateColumns: `repeat(${numeros.length},1fr)`, gap: 12, marginBottom: 20 }}>
        {numeros.map(n => (
          <div key={n.label} style={{ background: "#ffffff", border: "1px solid #E8ECF0", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800, color: n.color, lineHeight: 1.1 }}>{n.valor}</div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{n.label}</div>
          </div>
        ))}
      </div>

      <div className="barra-filtros" style={{ display: "flex", gap: 4, background: "#ffffff", border: "1px solid #E8ECF0", borderRadius: 10, padding: 4, marginBottom: 16, width: "fit-content" }}>
        {solapas.map(s => (
          <button key={s.id} onClick={() => setSolapa(s.id)}
            style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: solapa === s.id ? "#1A2B4A" : "transparent", color: solapa === s.id ? "#ffffff" : "#64748B", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>{s.label}</button>
        ))}
      </div>

      {solapa === "resumen" && (
        <div style={tarjeta}>
          <h2 style={subtitulo}>Cada entrega, de un vistazo</h2>
          {cargando || (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#94A3B8", fontSize: 11, letterSpacing: 0.4 }}>
                    <th style={{ padding: "6px 8px" }}>ENTREGA</th><th style={{ padding: "6px 8px" }}>FECHA</th>
                    {ve.produccion && <th style={{ padding: "6px 8px" }}>PRODUCCIÓN</th>}
                    {ve.materiales && <th style={{ padding: "6px 8px" }}>MATERIALES</th>}
                    {ve.cobro && <th style={{ padding: "6px 8px" }}>COBRO</th>}
                  </tr>
                </thead>
                <tbody>
                  {ordenadas.map(e => {
                    const est = estadoEntrega(e);
                    const prod = de(datos.produccion, e);
                    const pct = prod ? obraProgressAixa(prod) : null;
                    const enCurso = prod && (prod.stations || []).find(s => s.status !== "done");
                    const mat = resumenMateriales(de(datos.materiales, e)?.items || []);
                    const nItems = (de(datos.materiales, e)?.items || []).length;
                    const c = de(datos.cobros, e);
                    return (
                      <tr key={e.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "10px 8px", fontWeight: 600, color: "#1A2B4A" }}>{e.etiqueta || "Entrega"}</td>
                        <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{e.fecha ? formatDate(e.fecha) : "—"} <span style={{ marginLeft: 4 }}>{chip(SC_ENTREGA[est.status], est.label)}</span></td>
                        {ve.produccion && <td style={{ padding: "10px 8px", minWidth: 150 }}>
                          {pct == null ? "—" : <>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: "#F1F5F9", borderRadius: 99 }}><div style={{ width: `${pct}%`, height: 6, borderRadius: 99, background: pct === 100 ? "#059669" : "#D97706" }} /></div>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{pct}%</span>
                            </div>
                            {enCurso && <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>en "{enCurso.name}"</div>}
                          </>}
                        </td>}
                        {ve.materiales && <td style={{ padding: "10px 8px", fontSize: 12 }}>
                          {!nItems ? <span style={{ color: "#94A3B8" }}>Sin cargar</span>
                            : mat.completo ? <span style={{ color: "#059669", fontWeight: 600 }}>✓ Completos</span>
                            : <span style={{ color: "#DC2626", fontWeight: 600 }}>{[mat.faltaPedir.length && `${mat.faltaPedir.length} sin pedir`, mat.faltaRecibir.length && `${mat.faltaRecibir.length} sin recibir`].filter(Boolean).join(" · ")}</span>}
                        </td>}
                        {ve.cobro && <td style={{ padding: "10px 8px", fontSize: 12 }}>
                          {!c ? "—" : c.total_cobrado ? <span style={{ color: "#059669", fontWeight: 600 }}>✓ Cobrada</span>
                            : Number(c.monto_total) > 0 ? <span style={{ fontWeight: 600 }}>Falta {pesos(saldoDeCobro(c))}</span>
                            : <span style={{ color: "#94A3B8" }}>Monto sin cargar</span>}
                        </td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {solapa === "entregas" && <>
        {ordenadas.map(e => {
        const muebles = normalizarMuebles(e.muebles || []);
        return (
          <div key={e.id} style={tarjeta}>
            {encabezadoEntrega(e, <>
              <button onClick={() => onModal({ modo: "editar-entrega", proyecto: p, entrega: e })} style={boton}>Editar</button>
              <button onClick={() => generarPDF(e)} style={boton}>PDF</button>
              {e.estado !== "terminado" && <button onClick={() => onEntregar(e)} style={{ ...boton, background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#059669" }}>Entregar</button>}
            </>)}
            {e.fecha_inicio && <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>🔨 Inicio: {formatDate(e.fecha_inicio)}</div>}
            {muebles.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {muebles.map((m, i) => <div key={i} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#475569" }}>{m.nombre}{m.cantidad > 1 ? ` ×${m.cantidad}` : ""}</div>)}
              </div>
            ) : vacio("Sin muebles cargados.")}
            {e.notas && <div style={{ fontSize: 12, color: "#64748B", marginTop: 10, whiteSpace: "pre-line" }}>📝 {e.notas}</div>}
          </div>
        );
        })}
        <button onClick={() => onModal({ modo: "nueva-entrega", proyecto: p, etiquetaSugerida: ordenadas.length ? `${ordenadas.length + 1}ª entrega` : "" })} style={{ ...botonAgregar, width: "100%", padding: "9px 0" }}>+ Agregar entrega</button>
      </>}

      {solapa === "produccion" && (cargando || <>
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 10 }}>Tocá una estación para cambiar su estado, el operario o las fechas.</div>
        {ordenadas.map(e => {
        const prod = de(datos.produccion, e);
        return (
          <div key={e.id} style={tarjeta}>
            {encabezadoEntrega(e)}
            {!prod ? <>{vacio("Sin registro en Avance de Producción.")}{botonCrear("produccion", e, "+ Agregar a Avance de Producción")}</> : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(prod.stations || []).map((s, i) => {
                  const c = ESTACION_COLORES[s.status] || ESTACION_COLORES.pending;
                  return (
                    <div key={i} onClick={() => setEditando({ tipo: "estacion", e, prod, idx: i })} title="Cambiar esta estación"
                      style={{ flex: "1 1 150px", border: `1px solid ${c.border}`, background: c.bg, borderRadius: 10, padding: "9px 11px", cursor: "pointer" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>{i + 1}. {s.name}</div>
                      <div style={{ fontSize: 11, color: c.text, fontWeight: 600, marginTop: 2 }}>{c.label}</div>
                      {(s.operario || s.end_date) && <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{[s.operario, s.end_date && formatDate(s.end_date)].filter(Boolean).join(" · ")}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
        })}
      </>)}

      {solapa === "materiales" && (cargando || ordenadas.map(e => {
        const lista = de(datos.materiales, e);
        const items = lista?.items || [];
        return (
          <div key={e.id} style={tarjeta}>
            {encabezadoEntrega(e, lista && <button disabled={ocupado} onClick={() => setEditando({ tipo: "item", lista, item: null })} style={botonAgregar}>+ Agregar material</button>)}
            {!lista ? <>{vacio("Sin lista en Materiales.")}{botonCrear("materiales", e, "+ Crear lista de materiales")}</>
              : !items.length ? vacio("Sin materiales cargados.") : MATERIAL_ESTADOS.map(est => {
              const grupo = items.filter(it => (it.estado || "pendiente") === est.id);
              if (!grupo.length) return null;
              return (
                <div key={est.id} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: est.color, letterSpacing: 0.4, marginBottom: 4 }}>{est.label.toUpperCase()} ({grupo.length})</div>
                  {grupo.map(it => (
                    <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", padding: "4px 0", borderTop: "1px solid #F8FAFC" }}>
                      <span onClick={() => setEditando({ tipo: "item", lista, item: it })} title="Editar este material" style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                        {detalleFaltante(it)}{it.proveedor ? <span style={{ color: "#94A3B8" }}> — {it.proveedor}</span> : ""}
                      </span>
                      <select value={it.estado || "pendiente"} disabled={ocupado} title="Cambiar estado"
                        onChange={ev => { const estado = ev.target.value; cambiarItems(lista, its => its.map(i => i.id === it.id ? { ...i, estado } : i)); }}
                        style={{ padding: "4px 6px", border: "1px solid #E2E8F0", borderRadius: 6, background: "#ffffff", color: "#334155", fontSize: 12, maxWidth: 150 }}>
                        {Object.entries(ESTADOS_MAT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <button disabled={ocupado} onClick={() => eliminarItem(lista, it)} title="Eliminar" style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 14, padding: 2 }}>✕</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      }))}

      {solapa === "cobro" && (cargando || ordenadas.map(e => {
        const c = de(datos.cobros, e);
        const fila = (label, valor) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid #F1F5F9", fontSize: 13 }}><span style={{ color: "#64748B" }}>{label}</span><span style={{ fontWeight: 600, color: "#1A2B4A", textAlign: "right" }}>{valor}</span></div>;
        return (
          <div key={e.id} style={tarjeta}>
            {encabezadoEntrega(e, c && <>
              <button disabled={ocupado} onClick={() => setEditando({ tipo: "montos", c })} style={boton}>Editar montos</button>
              <button disabled={ocupado} onClick={() => setEditando({ tipo: "adicional", c, adicional: null })} style={botonAgregar}>+ Adicional</button>
            </>)}
            {!c ? <>{vacio("Sin registro en Cobros.")}{botonCrear("cobro", e, "+ Agregar a Cobros")}</> : <>
              {fila("Monto total", Number(c.monto_total) > 0 ? pesos(c.monto_total) : "Sin cargar")}
              {fila(`Adelanto${Number(c.adelanto_monto) > 0 ? ` (${pesos(c.adelanto_monto)})` : ""}`, tilde(c.adelanto_cobrado, () => cambiarCobro(c, f => ({ adelanto_cobrado: !f.adelanto_cobrado })), c.adelanto_cobrado ? "Cobrado" : "Pendiente"))}
              {fila("Total", tilde(c.total_cobrado, () => cambiarCobro(c, f => ({ total_cobrado: !f.total_cobrado })), c.total_cobrado ? `Cobrado${c.total_fecha ? ` el ${formatDate(c.total_fecha)}` : ""}` : "Pendiente"))}
              {fila("Plazo de pago", c.plazo_pago || "—")}
              {(c.adicionales || []).map(a => <div key={a.id}>{fila(
                <span onClick={() => setEditando({ tipo: "adicional", c, adicional: a })} title="Editar adicional" style={{ cursor: "pointer" }}>Adicional: {a.descripcion} · {pesos(a.monto)}</span>,
                tilde(a.cobrado, () => cambiarCobro(c, f => ({ adicionales: (f.adicionales || []).map(x => x.id === a.id ? { ...x, cobrado: !x.cobrado } : x) })), a.cobrado ? "Cobrado" : "Pendiente")
              )}</div>)}
              {Number(c.monto_total) > 0 && fila("Falta cobrar", pesos(saldoDeCobro(c)))}
            </>}
          </div>
        );
      }))}

      {solapa === "obra" && (cargando || ordenadas.map(e => {
        const oa = de(datos.obrasAvance, e);
        const dias = oa ? datos.dias.filter(d => d.obra_id === oa.id) : [];
        return (
          <div key={e.id} style={tarjeta}>
            {encabezadoEntrega(e, oa && <button disabled={ocupado} onClick={() => setEditando({ tipo: "dia", oa, dia: null })} style={botonAgregar}>+ Registrar día</button>)}
            {!oa ? vacio("Sin registro en Avance de Obra.") : !dias.length ? vacio("Todavía no hay días registrados.") : <>
              {oa.finalizada && <div style={{ fontSize: 12, color: "#059669", fontWeight: 600, marginBottom: 8 }}>✅ Obra finalizada</div>}
              {dias.slice(0, 5).map(d => (
                <div key={d.id} style={{ padding: "8px 0", borderTop: "1px solid #F1F5F9", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>{formatDate(d.fecha)}{d.operarios ? <span style={{ fontWeight: 500, color: "#64748B" }}> · {d.operarios}</span> : ""}{(d.archivos || []).length ? <span style={{ fontWeight: 500, color: "#64748B" }}> · 📷 {(d.archivos || []).length}</span> : ""}</div>
                    {d.detalle && <div style={{ fontSize: 13, color: "#334155", marginTop: 2, whiteSpace: "pre-line" }}>{d.detalle}</div>}
                  </div>
                  <button disabled={ocupado} onClick={() => setEditando({ tipo: "dia", oa, dia: d })} style={boton}>Editar</button>
                </div>
              ))}
              {dias.length > 5 && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>y {dias.length - 5} días más en la pestaña Avance de Obra</div>}
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>Las fotos se suben desde la pestaña Avance de Obra.</div>
            </>}
          </div>
        );
      }))}

      {editando?.tipo === "estacion" && (() => {
        const s = editando.prod.stations[editando.idx];
        return <ModalSimple title={`${editando.e.etiqueta || "Entrega"} · Estación ${editando.idx + 1}: ${s.name}`} onClose={() => setEditando(null)}
          onSave={form => guardarEstacion(editando, form)} fields={camposEstacion(s)} />;
      })()}

      {editando?.tipo === "item" && (() => {
        const it = editando.item;
        const unidades = it?.unidad && !UNIDADES.includes(it.unidad) ? [it.unidad, ...UNIDADES] : UNIDADES;
        return <ModalSimple title={it ? "Editar material" : "Agregar material"} onClose={() => setEditando(null)}
          onSave={form => guardarItem(editando, form)}
          fields={[
            { key: "nombre", label: "Descripción", type: "text", required: true, initial: it?.nombre || "" },
            { key: "cantidad", label: "Cantidad", type: "text", initial: it?.cantidad != null ? String(it.cantidad) : "" },
            { key: "unidad", label: "Unidad", type: "select", options: unidades.map(u => ({ v: u, l: u })), initial: it?.unidad || "Unidades" },
            { key: "proveedor", label: "Proveedor", type: "text", initial: it?.proveedor || "" },
            { key: "estado", label: "Estado", type: "select", options: Object.entries(ESTADOS_MAT).map(([v, l]) => ({ v, l })), initial: it?.estado || "pendiente" },
            { key: "notas", label: "Notas", type: "textarea", initial: it?.notas || "" },
          ]} />;
      })()}

      {editando?.tipo === "montos" && (() => {
        const c = editando.c;
        const num = n => Number(n) ? String(n) : "";
        return <ModalSimple title="Montos y plazo del cobro" onClose={() => setEditando(null)}
          onSave={f => cambiarCobro(c, () => ({ monto_total: parseFloat(f.monto_total) || 0, adelanto_monto: parseFloat(f.adelanto_monto) || 0, adelanto_porcentaje: parseFloat(f.adelanto_porcentaje) || 0, total_fecha: f.total_fecha || null, plazo_pago: f.plazo_pago || "" }))}
          fields={[
            { key: "monto_total", label: "Monto total del contrato ($)", type: "number", initial: num(c.monto_total) },
            { key: "adelanto_monto", label: "Monto del adelanto ($)", type: "number", initial: num(c.adelanto_monto) },
            { key: "adelanto_porcentaje", label: "Adelanto: porcentaje del total (%)", type: "number", initial: num(c.adelanto_porcentaje) },
            { key: "total_fecha", label: "Fecha de cobro del total", type: "date", initial: c.total_fecha || "" },
            { key: "plazo_pago", label: "Plazo de pago del cliente (ej: 30 días, contado)", type: "text", initial: c.plazo_pago || "" },
          ]} />;
      })()}

      {editando?.tipo === "adicional" && (() => {
        const { c, adicional: a } = editando;
        return <ModalSimple title={a ? "Editar adicional" : "Agregar adicional"} onClose={() => setEditando(null)}
          onSave={f => cambiarCobro(c, fila => {
            const datosAdic = { descripcion: f.descripcion.trim(), monto: parseFloat(f.monto) || 0 };
            const adics = fila.adicionales || [];
            return { adicionales: a ? adics.map(x => x.id === a.id ? { ...x, ...datosAdic } : x) : [...adics, { id: uid(), ...datosAdic, cobrado: false }] };
          })}
          fields={[
            { key: "descripcion", label: "Descripción", type: "text", required: true, initial: a?.descripcion || "" },
            { key: "monto", label: "Monto ($)", type: "number", initial: a?.monto ? String(a.monto) : "" },
          ]} />;
      })()}

      {editando?.tipo === "dia" && <ModalDiaAvance dia={editando.dia} onClose={() => setEditando(null)} onSave={form => guardarDia(editando, form)} />}
    </div>
  );
}
