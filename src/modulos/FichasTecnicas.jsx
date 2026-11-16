// Fichas técnicas de desarrollo de mobiliario (Avance de Obra): una para toda la obra o una por ambiente / mueble.
// Las carga el arquitecto (o un admin) junto con el arquitecto de la obra o el cliente, y al final la firma quien aprueba.
// Firmada queda cerrada; si piden cambios se hace una nueva versión (mismo N°, Rev. 2, 3...). Pensado primero para el celular.
import { useEffect, useMemo, useRef, useState } from "react";
import { EnviarPorMail } from "../components/comunes.jsx";
import { Icono } from "../components/Icono.jsx";
import { CerrarConAtras } from "../lib/atras.js";
import { avisar, confirmar } from "../lib/avisos.js";
import { apiFetch, b64ToBlob, borrarArchivosFichaSinUso, borrarFicha, crearFicha, deleteFileAvance, firmarFicha, getFicha, getFichasDatos, getFichasObra, guardarFicha, uploadFileInforme } from "../lib/datos.js";
import { armarPdfFicha, CARGOS_FICHA, COMPONENTES, ESPESORES_TAPACANTO, fichaVacia, HERRAJES, LED, NOTA_MEDIDAS, nombrePdfFicha, numeroFicha, TEXTO_CONFORMIDAD, tituloFicha } from "../lib/fichaTecnica.js";
import { fmtDateTimeAixa, formatDate, uid } from "../lib/formato.js";
import { ModalFirma } from "./InformeFinal.jsx";

const AZUL = "#1A2B4A", NARANJA = "#ff6b35", VERDE = "#059669", GRIS = "#64748B", BORDE = "#E2E8F0";
const esImagen = f => (f?.type || "").startsWith("image/") || /\.(jpe?g|png|gif|webp|heic)$/i.test(f?.name || "");
const inp = { width: "100%", padding: "12px 14px", background: "#F8FAFC", border: `1.5px solid ${BORDE}`, borderRadius: 10, color: AZUL, fontFamily: "'Inter',sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box" };
const lbl = { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, color: GRIS, marginBottom: 6 };
const boton = (fondo, color = "#fff", borde = "none") => ({ padding: "12px 16px", minHeight: 46, border: borde, borderRadius: 10, background: fondo, color, fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 });
const chip = activo => ({ padding: "9px 13px", minHeight: 40, borderRadius: 20, fontSize: 13, fontWeight: 600, fontFamily: "'Inter',sans-serif", border: `1.5px solid ${activo ? AZUL : BORDE}`, background: activo ? AZUL : "#fff", color: activo ? "#fff" : AZUL, display: "inline-flex", alignItems: "center", gap: 5 });
const fondoModal = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.75)", overflowY: "auto", padding: "20px 16px", display: "flex", justifyContent: "center", alignItems: "flex-start" };
const cajaModal = { background: "#fff", borderRadius: 14, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,.25)", overflow: "hidden", display: "flex", flexDirection: "column" };

const claveBorrador = id => `maderogest-ficha-borrador-${id}`;
function leerBorrador(id) { try { return JSON.parse(localStorage.getItem(claveBorrador(id)) || "null"); } catch { return null; } }
function guardarBorrador(id, b) { try { localStorage.setItem(claveBorrador(id), JSON.stringify({ ...b, t: Date.now() })); } catch { /* sin espacio: no es grave */ } }
function borrarBorrador(id) { try { localStorage.removeItem(claveBorrador(id)); } catch { /* nada */ } }
const leerComoB64 = file => new Promise(resolve => { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = () => resolve(null); r.readAsDataURL(file); });

function Encabezado({ arriba, titulo, abajo, onCerrar }) {
  return (
    <div style={{ background: AZUL, color: "#fff", padding: "18px clamp(16px,4vw,32px)", display: "flex", alignItems: "flex-start", gap: 12, borderBottom: `3px solid ${NARANJA}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", opacity: .7 }}>{arriba}</div>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{titulo}</div>
        {abajo && <div style={{ fontSize: 12, opacity: .8, marginTop: 4 }}>{abajo}</div>}
      </div>
      <button onClick={onCerrar} aria-label="Cerrar" style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 10, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", flexShrink: 0 }}><Icono n="cerrar" /></button>
    </div>
  );
}
function Seccion({ n, titulo, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: AZUL, margin: "0 0 14px" }}>
        {n && <span style={{ width: 26, height: 26, borderRadius: 13, background: AZUL, color: "#fff", fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>}
        <span style={{ paddingBottom: 4, borderBottom: `3px solid ${NARANJA}` }}>{titulo}</span>
      </h2>
      {children}
    </section>
  );
}
function Estado({ ficha }) {
  if (ficha.firmado_en) return <span style={{ fontSize: 11, fontWeight: 700, color: VERDE, background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}><Icono n="check" /> FIRMADA</span>;
  return <span style={{ fontSize: 11, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>BORRADOR</span>;
}

// ─── Lista de fichas de una obra ───────────────────────────────────────────────
export function FichasTecnicas({ obra, sesion, onClose, onCambio }) {
  const [fichas, setFichas] = useState(null);
  const [abierta, setAbierta] = useState(null);     // id de la ficha que se está viendo
  const [nueva, setNueva] = useState(false);
  const [creando, setCreando] = useState(false);
  const puedeEditar = sesion?.rol === "admin" || sesion?.rol === "arquitecto";

  async function cargar() {
    try { setFichas(await getFichasObra(obra.id)); }
    catch (e) { setFichas([]); avisar("No se pudieron leer las fichas: " + e.message, { tipo: "error" }); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, []);
  const cambio = () => { cargar(); onCambio?.(); };

  // Agrupadas por N°: la última versión arriba, las anteriores como historial
  const grupos = useMemo(() => {
    const m = new Map();
    for (const f of fichas || []) { if (!m.has(f.numero)) m.set(f.numero, []); m.get(f.numero).push(f); }
    return [...m.values()].map(v => v.sort((a, b) => b.revision - a.revision));
  }, [fichas]);

  async function crear({ alcance, ambiente, copiarDe }) {
    setCreando(true);
    try {
      const previa = (fichas || []).slice().sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
      let datos = fichaVacia({ obra, previa, sesion, alcance, ambiente });
      if (copiarDe) {
        // Se copian materiales y herrajes (lo que suele repetirse); medidas, notas y fotos son de cada ambiente
        const o = copiarDe.datos || {};
        datos = { ...datos, ...Object.fromEntries(["materiales", "correderas", "correderasOtro", "bisagras", "bisagrasOtro", "tiradores", "tiradoresOtro", "led", "ledOtro", "herrajeExtra"].map(k => [k, o[k] ?? datos[k]])) };
        datos.materiales = (datos.materiales || []).map(m => ({ ...m, id: uid() }));
      }
      const fila = await crearFicha({ obra_id: obra.id, alcance, datos, archivos: [], creado_por: sesion?.nombre || "" });
      setNueva(false); await cargar(); onCambio?.(); setAbierta(fila.id);
    } catch (e) { avisar("No se pudo crear la ficha: " + e.message, { tipo: "error" }); }
    setCreando(false);
  }

  async function nuevaVersion(ficha) {
    const grupo = grupos.find(g => g[0].numero === ficha.numero) || [ficha];
    if (!await confirmar(`Se crea la Rev. ${grupo[0].revision + 1} de la ficha N° ${numeroFicha({ numero: ficha.numero })} con los mismos datos, para hacer los cambios y volver a firmarla. La versión firmada queda guardada en el historial.`, { boton: "Crear nueva versión", peligro: false })) return null;
    try {
      const fila = await crearFicha({ obra_id: obra.id, numero: ficha.numero, revision: grupo[0].revision + 1, alcance: ficha.alcance, datos: { ...ficha.datos, fecha: new Date().toISOString().slice(0, 10), responsable: ficha.datos?.responsable || sesion?.nombre || "" }, archivos: ficha.archivos || [], creado_por: sesion?.nombre || "" });
      await cargar(); onCambio?.();
      return fila;
    } catch (e) { avisar("No se pudo crear la nueva versión: " + e.message, { tipo: "error" }); return null; }
  }

  const cerrar = () => { if (creando) return false; onClose(); };
  return (
    <div onClick={e => e.target === e.currentTarget && cerrar()} className="modal-fondo" style={{ ...fondoModal, zIndex: 650 }}>
      <CerrarConAtras onClose={cerrar} />
      <div className="modal-caja" style={{ ...cajaModal, maxWidth: 720 }}>
        <Encabezado arriba="Fichas técnicas de mobiliario" titulo={obra.nombre} abajo={fichas ? `${grupos.length || "Sin"} ficha${grupos.length === 1 ? "" : "s"}` : "Cargando…"} onCerrar={cerrar} />
        <div style={{ padding: "20px clamp(16px,4vw,32px) 24px" }}>
          {fichas === null ? <div style={{ padding: 50, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>Cargando fichas…</div> : <>
            {grupos.length === 0 && !nueva && (
              <div style={{ textAlign: "center", padding: "26px 10px 30px", color: GRIS, fontSize: 14, lineHeight: 1.6 }}>
                <div style={{ marginBottom: 6, color: AZUL, fontWeight: 700, fontSize: 15 }}>Todavía no hay fichas para esta obra</div>
                Se completa en la reunión con el arquitecto de la obra o el cliente: materiales, colores, herrajes y medidas de referencia. Al final firma quien aprueba.
              </div>
            )}

            {grupos.map(g => {
              const f = g[0], d = f.datos || {};
              return (
                <div key={f.numero} style={{ border: `1px solid ${f.firmado_en ? "#A7F3D0" : BORDE}`, borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
                  <button onClick={() => setAbierta(f.id)} style={{ width: "100%", textAlign: "left", background: "#fff", border: "none", padding: "14px 16px", cursor: "pointer", display: "flex", gap: 12, alignItems: "center", fontFamily: "'Inter',sans-serif" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: f.alcance === "obra" ? "#EFF6FF" : "#FFF7ED", color: f.alcance === "obra" ? "#2563EB" : "#C2410C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icono n={f.alcance === "obra" ? "casa" : "regla"} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: AZUL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tituloFicha(f)}</div>
                      <div style={{ fontSize: 12, color: GRIS, marginTop: 2 }}>N° {numeroFicha(f)}{d.tipoMueble ? ` · ${d.tipoMueble}` : ""}</div>
                      <div style={{ fontSize: 12, color: f.firmado_en ? VERDE : "#94A3B8", marginTop: 2 }}>{f.firmado_en ? `Firmó ${f.firma?.nombre}${f.firma?.cargo ? ` (${f.firma.cargo})` : ""} · ${formatDate(f.firmado_en.slice(0, 10))}` : `Actualizada ${fmtDateTimeAixa(f.updated_at)}`}</div>
                    </div>
                    <Estado ficha={f} />
                  </button>
                  {g.length > 1 && (
                    <div style={{ background: "#F8FAFC", borderTop: `1px solid ${BORDE}`, padding: "8px 16px 10px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: GRIS, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Versiones anteriores</div>
                      {g.slice(1).map(v => (
                        <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: GRIS, padding: "4px 0" }}>
                          <span style={{ flex: 1 }}>Rev. {v.revision}{v.firmado_en ? ` · firmada por ${v.firma?.nombre} el ${formatDate(v.firmado_en.slice(0, 10))}` : " · sin firmar"}</span>
                          {v.pdf?.url ? <a href={v.pdf.url} target="_blank" rel="noreferrer" style={{ color: "#2563EB", fontWeight: 600 }}>PDF</a> : <button onClick={() => setAbierta(v.id)} style={{ background: "none", border: "none", color: "#2563EB", fontWeight: 600, cursor: "pointer", fontSize: 12.5 }}>Ver</button>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {puedeEditar && (nueva
              ? <NuevaFicha fichas={grupos.map(g => g[0])} creando={creando} onCancelar={() => setNueva(false)} onCrear={crear} />
              : <button onClick={() => setNueva(true)} style={{ ...boton(AZUL), width: "100%", marginTop: 4 }}><Icono n="mas" /> Nueva ficha</button>)}
            {!puedeEditar && grupos.length === 0 && <div style={{ textAlign: "center", fontSize: 12, color: "#94A3B8" }}>Las fichas las carga el arquitecto.</div>}
          </>}
        </div>
      </div>

      {abierta && <FichaTecnica id={abierta} obra={obra} sesion={sesion} puedeEditar={puedeEditar}
        onClose={() => setAbierta(null)} onCambio={cambio}
        onNuevaVersion={async f => { const n = await nuevaVersion(f); if (n) setAbierta(n.id); }} />}
    </div>
  );
}

function NuevaFicha({ fichas, creando, onCancelar, onCrear }) {
  const [alcance, setAlcance] = useState(fichas.length ? "ambiente" : "obra");
  const [ambiente, setAmbiente] = useState("");
  const [copiar, setCopiar] = useState("");
  const listo = !creando && (alcance === "obra" || ambiente.trim());
  const opcion = (valor, icono, titulo, texto) => (
    <button onClick={() => setAlcance(valor)} style={{ flex: "1 1 200px", textAlign: "left", padding: 14, borderRadius: 12, cursor: "pointer", border: `2px solid ${alcance === valor ? AZUL : BORDE}`, background: alcance === valor ? "#F1F5F9" : "#fff", fontFamily: "'Inter',sans-serif", display: "flex", gap: 10 }}>
      <span style={{ color: alcance === valor ? AZUL : GRIS, marginTop: 1 }}><Icono n={icono} /></span>
      <span><span style={{ display: "block", fontSize: 14, fontWeight: 700, color: AZUL }}>{titulo}</span><span style={{ display: "block", fontSize: 12, color: GRIS, marginTop: 3, lineHeight: 1.4 }}>{texto}</span></span>
    </button>
  );
  return (
    <div style={{ border: `1.5px solid ${AZUL}`, borderRadius: 12, padding: 16, marginTop: 4 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: AZUL, marginBottom: 12 }}>Nueva ficha</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        {opcion("obra", "casa", "Toda la obra", "Una sola ficha: todos los muebles llevan los mismos materiales y herrajes.")}
        {opcion("ambiente", "regla", "Un ambiente o mueble", "Una ficha por ambiente cuando las especificaciones cambian (cocina, placard, baño…).")}
      </div>
      {alcance === "ambiente" && <>
        <label style={lbl}>Ambiente o mueble</label>
        <input value={ambiente} onChange={e => setAmbiente(e.target.value)} placeholder="Ej: Cocina, Placard dormitorio principal" autoFocus style={{ ...inp, marginBottom: 14 }} />
      </>}
      {fichas.length > 0 && <>
        <label style={lbl}>Materiales y herrajes</label>
        <select value={copiar} onChange={e => setCopiar(e.target.value)} style={{ ...inp, marginBottom: 14 }}>
          <option value="">Empezar en blanco</option>
          {fichas.map(f => <option key={f.id} value={f.id}>Copiar de N° {numeroFicha(f)} · {tituloFicha(f)}</option>)}
        </select>
      </>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancelar} disabled={creando} style={{ ...boton("#F1F5F9", AZUL, `1px solid ${BORDE}`), flex: 1 }}>Cancelar</button>
        <button onClick={() => onCrear({ alcance, ambiente: ambiente.trim(), copiarDe: fichas.find(f => f.id === copiar) })} disabled={!listo} style={{ ...boton(listo ? VERDE : "#CBD5E1"), flex: 2, cursor: listo ? "pointer" : "not-allowed" }}><Icono n="mas" /> {creando ? "Creando…" : "Crear ficha"}</button>
      </div>
    </div>
  );
}

// Botones para elegir una o varias opciones, con "Especificar" para escribir otra cosa
function Opciones({ opciones, valor = [], otro = "", onCambio, onOtro, bloqueado, exclusiva }) {
  const alternar = o => {
    if (bloqueado) return;
    if (valor.includes(o)) return onCambio(valor.filter(x => x !== o));
    // "No incluye" no se combina con las demás
    if (exclusiva && o === exclusiva) return onCambio([o]);
    onCambio([...valor.filter(x => x !== exclusiva), o]);
  };
  const visibles = bloqueado ? opciones.filter(o => valor.includes(o)) : opciones;
  return <>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {visibles.map(o => <button key={o} onClick={() => alternar(o)} disabled={bloqueado} style={{ ...chip(valor.includes(o)), cursor: bloqueado ? "default" : "pointer" }}>{valor.includes(o) && <Icono n="check" tam={14} />}{o}</button>)}
      {bloqueado && !visibles.length && !otro && <span style={{ fontSize: 13, color: "#94A3B8" }}>—</span>}
    </div>
    {bloqueado ? (otro ? <div style={{ fontSize: 14, color: AZUL, marginTop: 8 }}><b style={{ fontSize: 12, color: GRIS }}>ESPECIFICAR:</b> {otro}</div> : null)
      : <input value={otro} onChange={e => onOtro(e.target.value)} placeholder="Especificar (otro tipo, marca, modelo…)" style={{ ...inp, marginTop: 10, padding: "10px 12px", fontSize: 13 }} />}
  </>;
}

// ─── Una ficha ─────────────────────────────────────────────────────────────────
function FichaTecnica({ id, obra, sesion, puedeEditar, onClose, onCambio, onNuevaVersion }) {
  const [ficha, setFicha] = useState(null);     // la fila guardada
  const [datos, setDatos] = useState(null);
  const [archivos, setArchivos] = useState([]);
  const [cambios, setCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [paso, setPaso] = useState(null);
  const [firmando, setFirmando] = useState(false);
  const [sug, setSug] = useState({ marcas: [], colores: [], espesores: [] });
  const camaraRef = useRef(null), galeriaRef = useRef(null);

  const firmada = !!ficha?.firmado_en;
  const bloqueado = firmada || !puedeEditar;
  const ocupado = guardando || !!paso;

  async function cargar(conBorrador = true) {
    try {
      const f = await getFicha(id);
      if (!f) throw new Error("La ficha ya no existe.");
      let d = f.datos || {}, arch = f.archivos || [];
      const b = conBorrador && !f.firmado_en ? leerBorrador(id) : null;
      if (b && b.t > (Date.parse(f.updated_at) || 0)) {
        d = b.datos; arch = b.archivos || arch; setCambios(true);
        avisar("Recuperamos lo que habías cargado sin guardar.", { deshacer: () => { borrarBorrador(id); setCambios(false); cargar(false); } });
      } else { if (b) borrarBorrador(id); setCambios(false); }
      setFicha(f); setDatos(d); setArchivos(arch);
    } catch (e) { avisar("No se pudo abrir la ficha: " + e.message, { tipo: "error" }); onClose(); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [id]);
  // Sugerencias: marcas, colores y espesores que ya se usaron en otras fichas
  useEffect(() => {
    if (!puedeEditar) return;
    getFichasDatos().then(filas => {
      const juntar = k => [...new Set(filas.flatMap(f => (f.datos?.materiales || []).map(m => (m[k] || "").trim())).filter(Boolean))].slice(0, 60);
      setSug({ marcas: juntar("marca"), colores: juntar("color"), espesores: [...new Set(["18 mm", "15 mm", "25 mm", "5.5 mm", "3 mm", ...juntar("espesor")])] });
    }).catch(() => {});
  }, [puedeEditar]);
  useEffect(() => {
    if (!cambios || firmada || !datos) return;
    const t = setTimeout(() => guardarBorrador(id, { datos, archivos: archivos.filter(a => a.path) }), 600);
    return () => clearTimeout(t);
  }, [datos, archivos, cambios, firmada, id]);

  const set = (k, v) => { setDatos(x => ({ ...x, [k]: v })); setCambios(true); };
  const setDim = (k, v) => { setDatos(x => ({ ...x, dimensiones: { ...(x.dimensiones || {}), [k]: v } })); setCambios(true); };
  const setMat = (mid, k, v) => { setDatos(x => ({ ...x, materiales: x.materiales.map(m => m.id === mid ? { ...m, [k]: v } : m) })); setCambios(true); };

  async function agregarArchivos(lista) {
    let sinSenal = false;
    await Promise.all(Array.from(lista || []).map(async file => {
      const tmp = uid();
      setArchivos(a => [...a, { tmp, name: file.name, type: file.type, size: file.size, previa: URL.createObjectURL(file), subiendo: true }]);
      try { const subido = await uploadFileInforme(file, obra.id); setArchivos(a => a.map(x => x.tmp === tmp ? subido : x)); }
      catch { sinSenal = true; const b64 = await leerComoB64(file); setArchivos(a => a.map(x => x.tmp === tmp ? { tmp, name: file.name, type: file.type, size: file.size, b64 } : x)); }
    }));
    setCambios(true);
    if (sinSenal) avisar("Algunas fotos no se pudieron subir (¿sin señal?). Quedan en el teléfono y se suben al guardar.", { tipo: "aviso" });
  }

  async function guardar() {
    setGuardando(true);
    try {
      const guardados = [];
      for (const f of archivos) {
        if (f.subiendo) throw new Error("Esperá a que terminen de subir las fotos.");
        if (f.path) { guardados.push({ name: f.name, type: f.type, size: f.size, url: f.url, path: f.path }); continue; }
        if (f.b64) {
          try { guardados.push(await uploadFileInforme(new File([b64ToBlob(f.b64, f.type)], f.name, { type: f.type }), obra.id)); }
          catch { throw new Error(`No se pudo subir "${f.name}". Revisá la conexión y probá de nuevo.`); }
        }
      }
      const g = await guardarFicha(id, datos, guardados);
      const quitados = (ficha.archivos || []).map(a => a.path).filter(p => p && !guardados.some(x => x.path === p));
      await borrarArchivosFichaSinUso(obra.id, quitados, id).catch(() => {});
      setFicha(g || { ...ficha, datos, archivos: guardados }); setArchivos(guardados);
      setCambios(false); borrarBorrador(id); onCambio?.();
      return g || { ...ficha, datos, archivos: guardados };
    } catch (e) { avisar("No se pudo guardar: " + e.message, { tipo: "error" }); return null; }
    finally { setGuardando(false); }
  }

  async function verPdf() {
    if (firmada && ficha.pdf?.url) { window.open(ficha.pdf.url, "_blank"); return; }
    const win = window.open("", "_blank");
    win?.document.write(`<body style="font-family:Arial;padding:40px;color:#64748B">Armando el PDF…</body>`);
    setPaso("Armando el PDF…");
    try {
      const blob = await armarPdfFicha({ ficha: { ...ficha, datos, archivos }, obraNombre: obra.nombre, onPaso: setPaso });
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else { const a = document.createElement("a"); a.href = url; a.download = nombrePdfFicha(ficha, obra.nombre, false); a.click(); }
    } catch (e) { win?.close(); avisar("No se pudo armar el PDF: " + e.message, { tipo: "error" }); }
    setPaso(null);
  }

  async function firmar({ nombre, cargo, email, imagenData }) {
    let f = ficha;
    if (cambios) { f = await guardar(); if (!f) return false; }
    try {
      const firma = { nombre, cargo, email: email || null, fecha: new Date().toISOString(), tomada_por: sesion?.nombre || "" };
      setPaso("Armando el PDF firmado…");
      const blob = await armarPdfFicha({ ficha: f, obraNombre: obra.nombre, firma: { ...firma, imagenData }, onPaso: setPaso });
      setPaso("Guardando la firma…");
      const imagen = await uploadFileInforme(new File([b64ToBlob(imagenData, "image/png")], "firma.png", { type: "image/png" }), obra.id);
      const pdf = await uploadFileInforme(new File([blob], nombrePdfFicha(f, obra.nombre, true), { type: "application/pdf" }), obra.id);
      const r = await firmarFicha(id, { ...firma, imagen: { url: imagen.url, path: imagen.path } }, { url: pdf.url, path: pdf.path, name: pdf.name, size: pdf.size });
      if (!r?.length) {
        await Promise.all([deleteFileAvance(imagen.path), deleteFileAvance(pdf.path)]).catch(() => {});
        throw new Error("Esta ficha ya fue firmada desde otro teléfono. Cerrala y volvé a abrirla.");
      }
      borrarBorrador(id); setFicha(r[0]); onCambio?.();
      setPaso("Enviando el mail…");
      try {
        const envio = await apiFetch("/api/enviar-ficha-tecnica", { method: "POST", body: JSON.stringify({ fichaId: id, para: email || "" }) });
        avisar(`Ficha firmada. El PDF se envió a ${envio.destinos} destinatario${envio.destinos === 1 ? "" : "s"}.`, { tipo: "ok" });
      } catch (e) { avisar(`La ficha quedó firmada, pero el mail no salió: ${e.message}. Podés reenviarla con "Enviar por mail".`, { tipo: "aviso" }); }
      return true;
    } catch (e) { avisar("No se pudo firmar: " + e.message, { tipo: "error" }); return false; }
    finally { setPaso(null); }
  }

  async function eliminar() {
    if (!await confirmar(firmada ? "¿Borrar esta ficha FIRMADA? Se borran también el PDF y la firma. No se puede deshacer." : "¿Borrar esta ficha? No se puede deshacer.", { boton: "Borrar" })) return;
    setPaso("Borrando…");
    try { await borrarFicha(ficha); borrarBorrador(id); onCambio?.(); setPaso(null); onClose(); avisar("Ficha borrada."); }
    catch (e) { setPaso(null); avisar("No se pudo borrar: " + e.message, { tipo: "error" }); }
  }

  function cerrar() {
    if (ocupado) return false;
    if (cambios && !firmada) {
      confirmar("Hay cambios sin guardar. Quedan guardados en este teléfono hasta que vuelvas a abrir la ficha. ¿Cerrar igual?", { boton: "Cerrar", peligro: false }).then(si => { if (si) onClose(); });
      return false;
    }
    onClose();
  }

  const estiloCampo = bloqueado ? { ...inp, background: "#fff", border: "1px solid #F1F5F9", paddingLeft: 0, paddingRight: 0 } : inp;
  const campo = (k, label, ph, extra = {}) => (
    <div key={k}>
      <label style={lbl}>{label}</label>
      {extra.multi
        ? <textarea value={datos[k] || ""} onChange={e => set(k, e.target.value)} placeholder={bloqueado ? "—" : ph} readOnly={bloqueado} style={{ ...estiloCampo, minHeight: bloqueado ? 0 : 96, resize: bloqueado ? "none" : "vertical", fieldSizing: "content" }} />
        : <input type={extra.type || "text"} inputMode={extra.inputMode} value={datos[k] || ""} onChange={e => set(k, e.target.value)} placeholder={bloqueado ? "—" : ph} readOnly={bloqueado} style={estiloCampo} />}
    </div>
  );
  const esAdmin = sesion?.rol === "admin";
  const fotos = archivos.filter(esImagen);
  const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 };

  return (
    <div onClick={e => e.target === e.currentTarget && cerrar()} className="modal-fondo" style={{ ...fondoModal, zIndex: 700 }}>
      <CerrarConAtras onClose={cerrar} />
      <div className="modal-caja" style={{ ...cajaModal, maxWidth: 860 }}>
        <Encabezado arriba={`Ficha técnica N° ${ficha ? numeroFicha(ficha) : "…"}`} titulo={ficha ? tituloFicha({ ...ficha, datos: datos || ficha.datos }) : "Cargando…"}
          abajo={!ficha ? null : firmada ? <><Icono n="bloqueado" /> Firmada: ya no se puede cambiar</> : !puedeEditar ? "Solo lectura" : cambios ? "Cambios sin guardar" : <><Icono n="check" /> Guardada</>} onCerrar={cerrar} />

        {!datos ? <div style={{ padding: "70px 20px", textAlign: "center", color: "#94A3B8", fontSize: 14 }}>Cargando ficha…</div> : (
          <div style={{ padding: "22px clamp(16px,4vw,32px) 8px" }}>
            {firmada && (
              <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 12, padding: 14, marginBottom: 24, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                {ficha.firma?.imagen?.url && <img src={ficha.firma.imagen.url} alt="Firma" style={{ height: 54, maxWidth: 150, objectFit: "contain", background: "#fff", borderRadius: 8, border: "1px solid #D1FAE5", padding: 4 }} />}
                <div style={{ flex: 1, minWidth: 180, fontSize: 13, color: "#065F46", lineHeight: 1.5 }}>
                  <b>Aprobada por {ficha.firma?.nombre}</b>{ficha.firma?.cargo ? ` (${ficha.firma.cargo})` : ""}<br />
                  {fmtDateTimeAixa(ficha.firmado_en)}{ficha.firma?.tomada_por ? ` · registró ${ficha.firma.tomada_por}` : ""}
                </div>
              </div>
            )}

            <Seccion n="1" titulo="Cliente y proyecto">
              <div style={grid2}>
                {campo("cliente", "Cliente", "Nombre y apellido o empresa")}
                {campo("ambiente", "Ambiente / espacio", ficha.alcance === "obra" ? "Toda la obra" : "Ej: Cocina")}
                {campo("telefono", "Teléfono", "11 1234-5678", { type: "tel", inputMode: "tel" })}
                {campo("tipoMueble", "Tipo de mueble", "Ej: Bajo mesada y alacenas")}
                {campo("correo", "Correo", "cliente@mail.com", { type: "email", inputMode: "email" })}
                {campo("direccionObra", "Dirección de obra", "Calle, número, piso")}
                {campo("direccion", "Dirección del cliente", "Si es otra que la de la obra")}
                <div><label style={lbl}>Fecha</label><input type="date" value={datos.fecha || ""} onChange={e => set("fecha", e.target.value)} readOnly={bloqueado} style={estiloCampo} /></div>
                {campo("responsable", "Responsable de proyecto (Grupo Aixa)", "Nombre y apellido")}
              </div>
            </Seccion>

            <Seccion n="2" titulo="Dimensiones de referencia (mm)">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
                {[["ancho", "Ancho máximo"], ["alto", "Alto máximo"], ["profundidad", "Profundidad total"], ["zocalo", "Zócalo / retiro"]].map(([k, l]) => (
                  <div key={k}>
                    <label style={lbl}>{l}</label>
                    <div style={{ position: "relative" }}>
                      <input inputMode="decimal" value={datos.dimensiones?.[k] || ""} onChange={e => setDim(k, e.target.value)} placeholder={bloqueado ? "—" : "0"} readOnly={bloqueado} style={{ ...estiloCampo, paddingRight: 40 }} />
                      <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#94A3B8", pointerEvents: "none" }}>mm</span>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: GRIS, fontStyle: "italic", margin: "10px 0 0" }}>{NOTA_MEDIDAS}</p>
            </Seccion>

            <Seccion n="3" titulo="Placas, materiales y acabados">
              <datalist id="ficha-marcas">{sug.marcas.map(v => <option key={v} value={v} />)}</datalist>
              <datalist id="ficha-colores">{sug.colores.map(v => <option key={v} value={v} />)}</datalist>
              <datalist id="ficha-espesores">{sug.espesores.map(v => <option key={v} value={v} />)}</datalist>
              {(datos.materiales || []).map(m => {
                const esTapacanto = /tapacanto/i.test(m.componente);
                const propio = !COMPONENTES.includes(m.componente);
                return (
                  <div key={m.id} style={{ border: `1px solid ${BORDE}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      {propio && !bloqueado
                        ? <input value={m.componente} onChange={e => setMat(m.id, "componente", e.target.value)} placeholder="Nombre del componente (ej: Estantes)" style={{ ...inp, padding: "8px 10px", fontWeight: 700, flex: 1 }} />
                        : <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: AZUL }}>{m.componente}</div>}
                      {!bloqueado && <button onClick={() => { setDatos(x => ({ ...x, materiales: x.materiales.filter(y => y.id !== m.id) })); setCambios(true); }} aria-label="Quitar componente" title="Quitar (no lleva)" style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: 6 }}><Icono n="cerrar" /></button>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(125px,1fr))", gap: 10 }}>
                      <div><label style={lbl}>Marca / línea / catálogo</label><input list="ficha-marcas" value={m.marca} onChange={e => setMat(m.id, "marca", e.target.value)} placeholder={bloqueado ? "—" : "Ej: Egger, Faplac…"} readOnly={bloqueado} style={estiloCampo} /></div>
                      <div><label style={lbl}>Color / código</label><input list="ficha-colores" value={m.color} onChange={e => setMat(m.id, "color", e.target.value)} placeholder={bloqueado ? "—" : "Ej: Roble Kendal H3170"} readOnly={bloqueado} style={estiloCampo} /></div>
                      <div><label style={lbl}>Espesor / tipo</label>
                        {esTapacanto
                          ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(bloqueado ? ESPESORES_TAPACANTO.filter(o => o === m.espesor) : ESPESORES_TAPACANTO).map(o => <button key={o} disabled={bloqueado} onClick={() => setMat(m.id, "espesor", m.espesor === o ? "" : o)} style={{ ...chip(m.espesor === o), cursor: bloqueado ? "default" : "pointer", flex: bloqueado ? "0 0 auto" : 1, justifyContent: "center" }}>{o}</button>)}{bloqueado && !m.espesor && <span style={{ fontSize: 13, color: "#94A3B8" }}>—</span>}</div>
                          : <input list="ficha-espesores" value={m.espesor} onChange={e => setMat(m.id, "espesor", e.target.value)} placeholder={bloqueado ? "—" : "Ej: 18 mm"} readOnly={bloqueado} style={estiloCampo} />}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!bloqueado && <button onClick={() => { setDatos(x => ({ ...x, materiales: [...(x.materiales || []), { id: uid(), componente: "", marca: "", color: "", espesor: "" }] })); setCambios(true); }} style={{ ...boton("#F1F5F9", AZUL, `1px dashed #CBD5E1`), width: "100%" }}><Icono n="mas" /> Agregar componente</button>}
            </Seccion>

            <Seccion n="4" titulo="Sistemas de apertura y herrajes">
              {HERRAJES.map(h => (
                <div key={h.key} style={{ marginBottom: 18 }}>
                  <label style={lbl}>{h.label}</label>
                  <Opciones opciones={h.opciones} valor={datos[h.key]} otro={datos[`${h.key}Otro`]} bloqueado={bloqueado} onCambio={v => set(h.key, v)} onOtro={v => set(`${h.key}Otro`, v)} />
                </div>
              ))}
            </Seccion>

            <Seccion n="5" titulo="Iluminación LED y herrajes extra">
              <div style={{ marginBottom: 18 }}>
                <label style={lbl}>{LED.label}</label>
                <Opciones opciones={LED.opciones} exclusiva="No incluye" valor={datos.led} otro={datos.ledOtro} bloqueado={bloqueado} onCambio={v => set("led", v)} onOtro={v => set("ledOtro", v)} />
              </div>
              {campo("herrajeExtra", "Herraje extra / detalle a tener en cuenta", "Ej: cesto extraíble, esquinero mágico, organizador de cubiertos…", { multi: true })}
            </Seccion>

            <Seccion titulo="Notas complementarias e integración">
              {campo("notas", "Notas", "Marcas y modelos de electrodomésticos empotrados, anafe, campana, cañerías existentes, mochetas o vigas a respetar…", { multi: true })}
            </Seccion>

            <Seccion titulo="Fotos, muestras y croquis">
              {!bloqueado && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <button onClick={() => camaraRef.current?.click()} style={boton(AZUL)}><Icono n="camara" /> Sacar foto</button>
                  <button onClick={() => galeriaRef.current?.click()} style={boton("#F1F5F9", AZUL, `1px solid ${BORDE}`)}><Icono n="imagen" /> Elegir</button>
                  <input ref={camaraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { agregarArchivos(e.target.files); e.target.value = ""; }} />
                  <input ref={galeriaRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={e => { agregarArchivos(e.target.files); e.target.value = ""; }} />
                </div>
              )}
              {!fotos.length && <p style={{ fontSize: 13, color: GRIS, margin: 0 }}>{bloqueado ? "Sin fotos." : "La muestra de color elegida, el croquis en papel, la pared con caños o vigas… Van en el PDF."}</p>}
              {fotos.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(104px,1fr))", gap: 8 }}>
                  {fotos.map(f => (
                    <div key={f.path || f.tmp} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: `1px solid ${BORDE}`, background: "#F1F5F9" }}>
                      <img src={f.url || f.previa || f.b64} alt={f.name} onClick={() => f.url && window.open(f.url, "_blank")} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: f.subiendo ? .45 : 1, cursor: f.url ? "zoom-in" : "default" }} />
                      {f.subiendo && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: AZUL }}>Subiendo…</div>}
                      {!f.subiendo && !f.path && <div style={{ position: "absolute", left: 4, bottom: 4, fontSize: 10, fontWeight: 700, background: "#FEF3C7", color: "#92400E", borderRadius: 6, padding: "2px 6px" }}>Sin subir</div>}
                      {!bloqueado && !f.subiendo && <button onClick={() => { setArchivos(a => a.filter(x => (x.path || x.tmp) !== (f.path || f.tmp))); setCambios(true); }} aria-label="Quitar foto" style={{ position: "absolute", top: 4, right: 4, width: 30, height: 30, borderRadius: 15, border: "none", background: "rgba(15,23,42,.65)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icono n="cerrar" tam={14} /></button>}
                    </div>
                  ))}
                </div>
              )}
            </Seccion>

            {puedeEditar && (!firmada || esAdmin) && (
              <div style={{ textAlign: "center", margin: "-6px 0 20px" }}>
                <button onClick={eliminar} disabled={ocupado} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 8 }}><Icono n="basura" /> Borrar ficha</button>
              </div>
            )}
          </div>
        )}

        {datos && (
          <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: `1px solid ${BORDE}`, padding: "12px clamp(16px,4vw,32px)", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {paso && <div style={{ width: "100%", fontSize: 12, fontWeight: 600, color: "#2563EB" }}>{paso}</div>}
            {!bloqueado && <button onClick={guardar} disabled={ocupado || !cambios} style={{ ...boton(cambios ? VERDE : "#94A3B8"), flex: "1 1 120px", cursor: ocupado || !cambios ? "not-allowed" : "pointer" }}><Icono n="guardar" /> {guardando ? "Guardando…" : cambios ? "Guardar" : "Guardada"}</button>}
            <button onClick={verPdf} disabled={ocupado} style={{ ...boton("#EFF6FF", "#1D4ED8", "1px solid #BFDBFE"), flex: "1 1 120px" }}><Icono n="documento" /> {firmada ? "PDF firmado" : "Ver PDF"}</button>
            {!bloqueado && <button onClick={() => setFirmando(true)} disabled={ocupado || archivos.some(a => a.subiendo)} style={{ ...boton(NARANJA), flex: "1 1 160px" }}><Icono n="editar" /> Firmar</button>}
            {firmada && puedeEditar && <button onClick={() => onNuevaVersion(ficha)} disabled={ocupado} style={{ ...boton(AZUL), flex: "1 1 150px" }}><Icono n="recargar" /> Nueva versión</button>}
            {firmada && (
              <EnviarPorMail deshabilitado={ocupado} estiloBoton={{ ...boton("#0F766E"), flex: "1 1 140px" }}
                enviar={para => apiFetch("/api/enviar-ficha-tecnica", { method: "POST", body: JSON.stringify({ fichaId: id, para }) })} />
            )}
          </div>
        )}
      </div>

      {firmando && <ModalFirma titulo={`${obra.nombre} · ${tituloFicha({ ...ficha, datos })}`} etiqueta={`Conformidad técnica · Ficha N° ${numeroFicha(ficha)}`} cargos={CARGOS_FICHA}
        declaracion={<><b>Conformidad técnica y revisión de diseño.</b> {TEXTO_CONFORMIDAD}<div style={{ marginTop: 8, color: GRIS, fontSize: 13 }}>Si quieren revisarla antes en limpio, volvé atrás y tocá “Ver PDF”.</div></>}
        nota="Al firmar, la ficha queda cerrada. Si después hay cambios se hace una nueva versión. Es una firma electrónica de conformidad, no una firma digital con certificado."
        ocupado={ocupado} paso={paso} onClose={() => setFirmando(false)} onFirmar={async d => { if (await firmar(d)) setFirmando(false); }} />}
    </div>
  );
}
