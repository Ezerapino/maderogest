// Informe final de obra (Avance de Obra): datos, fotos desde el celular, pendientes para tildar,
// conformidad firmada en pantalla, PDF y envío por mail. Pensado primero para el celular.
import { useEffect, useRef, useState } from "react";
import { EnviarPorMail } from "../components/comunes.jsx";
import { Icono } from "../components/Icono.jsx";
import { CerrarConAtras } from "../lib/atras.js";
import { avisar, confirmar } from "../lib/avisos.js";
import { apiFetch, b64ToBlob, deleteFileAvance, firmarInformeFinal, getInformeFinal, guardarPendientesInforme, reabrirInformeFinal, uploadFileInforme, upsertInformeFinal } from "../lib/datos.js";
import { fmtDateTimeAixa, uid } from "../lib/formato.js";
import { armarPdfInforme, nombrePdfInforme } from "../lib/informePdf.js";

const AZUL = "#1A2B4A", NARANJA = "#ff6b35", VERDE = "#059669", GRIS = "#64748B", BORDE = "#E2E8F0";
const esImagen = f => (f?.type || "").startsWith("image/") || /\.(jpe?g|png|gif|webp|heic)$/i.test(f?.name || "");
const CARGOS = ["Encargado de obra", "Arquitecto", "Cliente"];

const inp = { width: "100%", padding: "12px 14px", background: "#F8FAFC", border: `1.5px solid ${BORDE}`, borderRadius: 10, color: AZUL, fontFamily: "'Inter',sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box" };
const lbl = { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, color: GRIS, marginBottom: 6 };
const boton = (fondo, color = "#fff", borde = "none") => ({ padding: "12px 16px", minHeight: 46, border: borde, borderRadius: 10, background: fondo, color, fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 });

// Los "faltantes" que se escribían como texto pasan a ser una lista (una línea = un pendiente)
function pendientesDesdeTexto(texto) {
  return String(texto || "").split(/\r?\n/).map(l => l.replace(/^\s*([-•*·]|\d+[.)])\s*/, "").trim()).filter(Boolean).map(texto => ({ id: uid(), texto, resuelto: null }));
}
const claveBorrador = id => `maderogest-informe-borrador-${id}`;
function leerBorrador(id) { try { return JSON.parse(localStorage.getItem(claveBorrador(id)) || "null"); } catch { return null; } }
function guardarBorrador(id, b) { try { localStorage.setItem(claveBorrador(id), JSON.stringify({ ...b, t: Date.now() })); } catch { /* sin espacio o bloqueado: no es grave */ } }
function borrarBorrador(id) { try { localStorage.removeItem(claveBorrador(id)); } catch { /* nada */ } }
const leerComoB64 = file => new Promise(resolve => { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = () => resolve(null); r.readAsDataURL(file); });

function Seccion({ titulo, extra, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 700, color: AZUL, margin: 0, paddingBottom: 6, borderBottom: `3px solid ${NARANJA}` }}>{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function InformeFinal({ obra, sesion, puedeEditar, onClose, onSave }) {
  const formVacio = {
    nombreObra: obra?.nombre || "", cliente: "", direccion: obra?.direccion || "", fecha: new Date().toISOString().slice(0, 10),
    etapa: "", estudioArquitecto: "", responsableEstudio: "", responsableEmpresa: "", operarios: "", informe: "", faltantes: "", informacionDestacada: "",
  };
  const [form, setForm] = useState(formVacio);
  const [archivos, setArchivos] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [informe, setInforme] = useState(null);       // la fila guardada
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState(false);
  const [paso, setPaso] = useState(null);             // texto de lo que se está haciendo (PDF, firma, mail)
  const [nuevoPendiente, setNuevoPendiente] = useState("");
  const [firmando, setFirmando] = useState(false);
  const camaraRef = useRef(null), galeriaRef = useRef(null);

  const firmado = !!informe?.firmado_en;
  const bloqueado = firmado || !puedeEditar;
  const ocupado = guardando || !!paso;
  const esAdmin = sesion?.rol === "admin";

  async function cargar(conBorrador = true) {
    setCargando(true);
    try {
      const inf = await getInformeFinal(obra.id);
      let f = { ...formVacio, ...(inf?.datos || {}) }, arch = inf?.archivos || [];
      let pend = inf?.pendientes?.length ? inf.pendientes : pendientesDesdeTexto(f.faltantes);
      const b = conBorrador && !inf?.firmado_en ? leerBorrador(obra.id) : null;
      const guardadoEn = Date.parse(inf?.updated_at || inf?.created_at || 0) || 0;
      if (b && b.t > guardadoEn) {
        f = { ...f, ...b.form }; pend = b.pendientes || pend; arch = b.archivos || arch;
        setCambios(true);
        avisar("Recuperamos lo que habías cargado sin guardar.", { deshacer: () => { borrarBorrador(obra.id); setCambios(false); cargar(false); } });
      } else { if (b) borrarBorrador(obra.id); setCambios(false); }
      setInforme(inf); setForm(f); setArchivos(arch); setPendientes(pend);
    } catch (e) { avisar("No se pudo leer el informe: " + e.message, { tipo: "error" }); }
    setCargando(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, []);

  // Borrador en el teléfono: si se corta la señal o se cierra sin guardar, no se pierde lo escrito
  useEffect(() => {
    if (!cambios || firmado || cargando) return;
    const t = setTimeout(() => guardarBorrador(obra.id, { form, pendientes, archivos: archivos.filter(a => a.path) }), 600);
    return () => clearTimeout(t);
  }, [form, pendientes, archivos, cambios, firmado, cargando, obra.id]);

  const cambiar = (k, v) => { setForm(x => ({ ...x, [k]: v })); setCambios(true); };

  // ── Fotos y archivos: se achican y se suben apenas se eligen; sin señal quedan en el teléfono hasta guardar
  async function agregarArchivos(lista) {
    const files = Array.from(lista || []);
    let sinSenal = false;
    await Promise.all(files.map(async file => {
      const tmp = uid();
      setArchivos(a => [...a, { tmp, name: file.name, type: file.type, size: file.size, previa: URL.createObjectURL(file), subiendo: true }]);
      try {
        const subido = await uploadFileInforme(file, obra.id);
        setArchivos(a => a.map(x => x.tmp === tmp ? subido : x));
      } catch {
        sinSenal = true;
        const b64 = await leerComoB64(file);
        setArchivos(a => a.map(x => x.tmp === tmp ? { tmp, name: file.name, type: file.type, size: file.size, b64 } : x));
      }
    }));
    setCambios(true);
    if (sinSenal) avisar("Algunas fotos no se pudieron subir (¿sin señal?). Quedan en el teléfono y se suben al guardar: no cierres sin guardar.", { tipo: "aviso" });
  }
  const quitarArchivo = clave => { setArchivos(a => a.filter(x => (x.path || x.tmp) !== clave)); setCambios(true); };

  // ── Pendientes
  function agregarPendiente() {
    const texto = nuevoPendiente.trim();
    if (!texto) return;
    setPendientes(p => [...p, { id: uid(), texto, resuelto: null }]); setNuevoPendiente(""); setCambios(true);
  }
  async function alternarResuelto(id) {
    const antes = pendientes;
    const nuevos = pendientes.map(p => p.id !== id ? p : { ...p, resuelto: p.resuelto ? null : { fecha: new Date().toISOString(), por: sesion?.nombre || "" } });
    setPendientes(nuevos);
    if (!firmado) { setCambios(true); return; }
    // Firmado: lo único que se puede cambiar; se guarda en el momento
    try { await guardarPendientesInforme(informe.id, nuevos); onSave?.(); }
    catch (e) { setPendientes(antes); avisar("No se pudo guardar el pendiente: " + e.message, { tipo: "error" }); }
  }

  // ── Guardar
  async function guardar() {
    setGuardando(true);
    try {
      const guardados = [];
      for (const f of archivos) {
        if (f.subiendo) throw new Error("Esperá a que terminen de subir las fotos.");
        if (f.path) { guardados.push({ name: f.name, type: f.type, size: f.size, url: f.url, path: f.path }); continue; }
        if (f.b64) {
          try { guardados.push(await uploadFileInforme(new File([b64ToBlob(f.b64, f.type)], f.name, { type: f.type }), obra.id)); }
          catch { throw new Error(`No se pudo subir "${f.name}". Revisá la conexión y probá de nuevo (lo cargado queda guardado en el teléfono).`); }
        }
      }
      const datos = { ...form, faltantes: pendientes.filter(p => !p.resuelto).map(p => `- ${p.texto}`).join("\n") };
      await upsertInformeFinal(obra.id, datos, guardados, informe?.id, pendientes);
      // Archivos que se quitaron del informe: se borran del almacenamiento
      for (const viejo of (informe?.archivos || []).filter(v => v.path && !guardados.some(g => g.path === v.path))) await deleteFileAvance(viejo.path).catch(() => {});
      const guardado = await getInformeFinal(obra.id);
      setInforme(guardado); setArchivos(guardado?.archivos || guardados); setPendientes(guardado?.pendientes || pendientes);
      setCambios(false); borrarBorrador(obra.id); onSave?.();
      return guardado;
    } catch (e) { avisar("No se pudo guardar: " + e.message, { tipo: "error" }); return null; }
    finally { setGuardando(false); }
  }

  // ── PDF (vista previa, o el firmado tal como se firmó)
  async function verPdf() {
    if (firmado && informe.pdf?.url) { window.open(informe.pdf.url, "_blank"); return; }
    const win = window.open("", "_blank");   // se abre antes de armarlo para que el navegador no la bloquee
    win?.document.write(`<body style="font-family:Arial;padding:40px;color:#64748B">Armando el PDF…</body>`);
    setPaso("Armando el PDF…");
    try {
      const blob = await armarPdfInforme({ form, pendientes, archivos, onPaso: setPaso });
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else { const a = document.createElement("a"); a.href = url; a.download = nombrePdfInforme(form, false); a.click(); }
    } catch (e) { win?.close(); avisar("No se pudo armar el PDF: " + e.message, { tipo: "error" }); }
    setPaso(null);
  }

  // ── Firmar: guarda, arma el PDF con la firma, lo guarda (queda cerrado) y lo manda por mail
  async function firmar({ nombre, cargo, email, imagenData }) {
    let inf = informe;
    if (cambios || !inf) { inf = await guardar(); if (!inf) return false; }
    try {
      const fecha = new Date().toISOString();
      const firma = { nombre, cargo, email: email || null, fecha, tomada_por: sesion?.nombre || "" };
      setPaso("Armando el PDF firmado…");
      const blob = await armarPdfInforme({ form, pendientes, archivos: inf.archivos || archivos, firma: { ...firma, imagenData }, onPaso: setPaso });
      setPaso("Guardando la firma…");
      const imagen = await uploadFileInforme(new File([b64ToBlob(imagenData, "image/png")], "firma.png", { type: "image/png" }), obra.id);
      const pdf = await uploadFileInforme(new File([blob], nombrePdfInforme(form, true), { type: "application/pdf" }), obra.id);
      const r = await firmarInformeFinal(inf.id, { ...firma, imagen: { url: imagen.url, path: imagen.path } }, { url: pdf.url, path: pdf.path, name: pdf.name, size: pdf.size });
      if (!r?.length) {
        await Promise.all([deleteFileAvance(imagen.path), deleteFileAvance(pdf.path)]).catch(() => {});
        throw new Error("Otra persona ya firmó este informe. Cerralo y volvé a abrirlo para verlo.");
      }
      borrarBorrador(obra.id);
      setInforme(r[0]); onSave?.();
      setPaso("Enviando el mail…");
      try {
        const envio = await apiFetch("/api/enviar-informe-final", { method: "POST", body: JSON.stringify({ obraAvanceId: obra.id, para: email || "" }) });
        avisar(`Informe firmado. El PDF se envió a ${envio.destinos} destinatario${envio.destinos === 1 ? "" : "s"}.`, { tipo: "ok" });
      } catch (e) { avisar(`El informe quedó firmado, pero el mail no salió: ${e.message}. Podés reenviarlo con "Enviar por mail".`, { tipo: "aviso" }); }
      return true;
    } catch (e) { avisar("No se pudo firmar: " + e.message, { tipo: "error" }); return false; }
    finally { setPaso(null); }
  }

  async function reabrir() {
    if (!await confirmar("¿Reabrir el informe? Se borran la firma y el PDF firmado, y hay que volver a hacerlo firmar. Los pendientes resueltos se mantienen.", { boton: "Reabrir" })) return;
    setPaso("Reabriendo…");
    try { await reabrirInformeFinal(informe); await cargar(false); onSave?.(); avisar("Informe reabierto: ya se puede editar."); }
    catch (e) { avisar("No se pudo reabrir: " + e.message, { tipo: "error" }); }
    setPaso(null);
  }

  // Tiene que responder en el momento (para "atrás"): si hay que preguntar, queda abierta y cierra después del sí
  function cerrar() {
    if (ocupado) return false;
    if (cambios && !firmado) {
      confirmar("Hay cambios sin guardar. Quedan guardados en este teléfono hasta que vuelvas a abrir el informe. ¿Cerrar igual?", { boton: "Cerrar", peligro: false })
        .then(si => { if (si) onClose(); });
      return false;
    }
    onClose();
  }

  const fotos = archivos.filter(esImagen), otros = archivos.filter(a => !esImagen(a));
  const abiertos = pendientes.filter(p => !p.resuelto).length;
  const estiloCampo = bloqueado ? { ...inp, background: "#fff", border: "1px solid #F1F5F9", paddingLeft: 0, paddingRight: 0 } : inp;
  const campoTexto = (key, label, ph, multi) => (
    <div key={key}>
      <label style={lbl}>{label}</label>
      {multi
        ? <textarea value={form[key] || ""} onChange={e => cambiar(key, e.target.value)} placeholder={bloqueado ? "—" : ph} readOnly={bloqueado} style={{ ...estiloCampo, minHeight: bloqueado ? 0 : 110, resize: bloqueado ? "none" : "vertical", fieldSizing: "content" }} />
        : <input value={form[key] || ""} onChange={e => cambiar(key, e.target.value)} placeholder={bloqueado ? "—" : ph} readOnly={bloqueado} style={estiloCampo} />}
    </div>
  );

  return (
    <div onClick={e => e.target === e.currentTarget && cerrar()} className="modal-fondo" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.75)", zIndex: 700, overflowY: "auto", padding: "20px 16px", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <CerrarConAtras onClose={cerrar} />
      <div className="modal-caja" style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 860, boxShadow: "0 24px 60px rgba(0,0,0,.25)", overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* Encabezado */}
        <div style={{ background: AZUL, color: "#fff", padding: "18px clamp(16px,4vw,32px)", display: "flex", alignItems: "flex-start", gap: 12, borderBottom: `3px solid ${NARANJA}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", opacity: .7 }}>Informe final de obra</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{form.nombreObra || obra.nombre}</div>
            <div style={{ fontSize: 12, opacity: .8, marginTop: 4 }}>
              {cargando ? "Cargando…" : firmado ? <><Icono n="bloqueado" /> Firmado: ya no se puede cambiar</> : cambios ? "Cambios sin guardar" : informe ? <><Icono n="check" /> Guardado</> : "Nuevo, todavía sin guardar"}
            </div>
          </div>
          <button onClick={cerrar} aria-label="Cerrar" style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 10, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", flexShrink: 0 }}><Icono n="cerrar" /></button>
        </div>

        {cargando ? <div style={{ padding: "70px 20px", textAlign: "center", color: "#94A3B8", fontSize: 14 }}>Cargando informe…</div> : (
          <div style={{ padding: "22px clamp(16px,4vw,32px) 8px" }}>

            {firmado && (
              <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 12, padding: 14, marginBottom: 24, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                {informe.firma?.imagen?.url && <img src={informe.firma.imagen.url} alt="Firma" style={{ height: 54, maxWidth: 150, objectFit: "contain", background: "#fff", borderRadius: 8, border: "1px solid #D1FAE5", padding: 4 }} />}
                <div style={{ flex: 1, minWidth: 180, fontSize: 13, color: "#065F46", lineHeight: 1.5 }}>
                  <b>Conformidad firmada por {informe.firma?.nombre}</b>{informe.firma?.cargo ? ` (${informe.firma.cargo})` : ""}<br />
                  {fmtDateTimeAixa(informe.firmado_en)}{informe.firma?.tomada_por ? ` · registró ${informe.firma.tomada_por}` : ""}
                </div>
                {esAdmin && <button onClick={reabrir} disabled={ocupado} style={{ ...boton("#fff", "#B45309", "1px solid #FCD34D"), minHeight: 38, padding: "8px 12px", fontSize: 12 }}><Icono n="deshacer" /> Reabrir</button>}
              </div>
            )}

            <Seccion titulo="Información general">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                {campoTexto("nombreObra", "Obra", "Ej: Remodelación cocina")}
                {campoTexto("cliente", "Cliente", "Nombre del cliente")}
                {campoTexto("direccion", "Dirección", "Dirección completa")}
                <div><label style={lbl}>Fecha del informe</label><input type="date" value={form.fecha || ""} onChange={e => cambiar("fecha", e.target.value)} readOnly={bloqueado} style={estiloCampo} /></div>
                {campoTexto("etapa", "Etapa", "Ej: Terminaciones, final…")}
                {campoTexto("estudioArquitecto", "Estudio / arquitecto a cargo", "Nombre del estudio")}
              </div>
            </Seccion>

            <Seccion titulo="Personal responsable">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 14 }}>
                {campoTexto("responsableEstudio", "Responsable (estudio / arquitecto)", "Nombre y apellido")}
                {campoTexto("responsableEmpresa", "Responsable (Grupo Aixa)", "Nombre y apellido")}
              </div>
              {campoTexto("operarios", "Operarios / instaladores", "Uno por línea o separados por comas", true)}
            </Seccion>

            <Seccion titulo="Fotos" extra={<span style={{ fontSize: 12, color: GRIS }}>{fotos.length || "Sin"} foto{fotos.length === 1 ? "" : "s"}</span>}>
              {!bloqueado && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <button onClick={() => camaraRef.current?.click()} style={boton(AZUL)}><Icono n="camara" /> Sacar foto</button>
                  <button onClick={() => galeriaRef.current?.click()} style={boton("#F1F5F9", AZUL, `1px solid ${BORDE}`)}><Icono n="imagen" /> Elegir archivos</button>
                  <input ref={camaraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { agregarArchivos(e.target.files); e.target.value = ""; }} />
                  <input ref={galeriaRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" style={{ display: "none" }} onChange={e => { agregarArchivos(e.target.files); e.target.value = ""; }} />
                </div>
              )}
              {fotos.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(104px,1fr))", gap: 8 }}>
                  {fotos.map(f => (
                    <div key={f.path || f.tmp} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: `1px solid ${BORDE}`, background: "#F1F5F9" }}>
                      <img src={f.url || f.previa || f.b64} alt={f.name} onClick={() => f.url && window.open(f.url, "_blank")} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: f.subiendo ? .45 : 1, cursor: f.url ? "zoom-in" : "default" }} />
                      {f.subiendo && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: AZUL }}>Subiendo…</div>}
                      {!f.subiendo && !f.path && <div style={{ position: "absolute", left: 4, bottom: 4, fontSize: 10, fontWeight: 700, background: "#FEF3C7", color: "#92400E", borderRadius: 6, padding: "2px 6px" }}>Sin subir</div>}
                      {!bloqueado && !f.subiendo && <button onClick={() => quitarArchivo(f.path || f.tmp)} aria-label="Quitar foto" style={{ position: "absolute", top: 4, right: 4, width: 30, height: 30, borderRadius: 15, border: "none", background: "rgba(15,23,42,.65)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icono n="cerrar" tam={14} /></button>}
                    </div>
                  ))}
                </div>
              )}
              {otros.length > 0 && <div style={{ marginTop: 12 }}>{otros.map(f => (
                <div key={f.path || f.tmp} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${BORDE}`, borderRadius: 10, marginBottom: 6 }}>
                  <Icono n="documento" color={GRIS} />
                  <a href={f.url || undefined} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, fontSize: 13, color: AZUL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}{f.subiendo ? " · subiendo…" : !f.path ? " · sin subir" : ""}</a>
                  {!bloqueado && !f.subiendo && <button onClick={() => quitarArchivo(f.path || f.tmp)} aria-label="Quitar archivo" style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: 6 }}><Icono n="cerrar" /></button>}
                </div>))}</div>}
            </Seccion>

            <Seccion titulo="Trabajo realizado">
              {campoTexto("informe", "Detalle del trabajo", "Qué se instaló, observaciones, aclaraciones…", true)}
            </Seccion>

            <Seccion titulo="Pendientes" extra={pendientes.length > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: abiertos ? "#B45309" : VERDE }}>{abiertos ? `${abiertos} abierto${abiertos === 1 ? "" : "s"}` : "Todos resueltos"}</span>}>
              {pendientes.length === 0 && <p style={{ fontSize: 13, color: GRIS, margin: "0 0 12px" }}>{bloqueado ? "Sin pendientes: la obra se entregó completa." : "Remates, faltantes o detalles a resolver. Si no queda nada, dejalo vacío."}</p>}
              {pendientes.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: `1px solid ${p.resuelto ? "#A7F3D0" : BORDE}`, background: p.resuelto ? "#F0FDF4" : "#fff", borderRadius: 10, marginBottom: 6 }}>
                  <button onClick={() => puedeEditar && alternarResuelto(p.id)} disabled={!puedeEditar} aria-label={p.resuelto ? "Marcar como abierto" : "Marcar como resuelto"}
                    style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, border: `2px solid ${p.resuelto ? VERDE : "#CBD5E1"}`, background: p.resuelto ? VERDE : "#fff", color: "#fff", cursor: puedeEditar ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {p.resuelto && <Icono n="check" tam={16} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: AZUL, textDecoration: p.resuelto ? "line-through" : "none", wordBreak: "break-word" }}>{p.texto}</div>
                    {p.resuelto && <div style={{ fontSize: 11, color: VERDE, marginTop: 2 }}>Resuelto {fmtDateTimeAixa(p.resuelto.fecha)}{p.resuelto.por ? ` · ${p.resuelto.por}` : ""}</div>}
                  </div>
                  {!bloqueado && <button onClick={() => { setPendientes(x => x.filter(y => y.id !== p.id)); setCambios(true); }} aria-label="Quitar pendiente" style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: 6 }}><Icono n="cerrar" /></button>}
                </div>
              ))}
              {!bloqueado && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input value={nuevoPendiente} onChange={e => setNuevoPendiente(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregarPendiente(); } }} placeholder="Ej: falta remate zócalo cocina" style={{ ...inp, flex: 1 }} />
                  <button onClick={agregarPendiente} disabled={!nuevoPendiente.trim()} style={{ ...boton(AZUL), opacity: nuevoPendiente.trim() ? 1 : .5, flexShrink: 0 }}><Icono n="mas" /> Agregar</button>
                </div>
              )}
              {firmado && puedeEditar && abiertos > 0 && <p style={{ fontSize: 12, color: GRIS, margin: "8px 0 0" }}>Tocá el casillero cuando se resuelva un pendiente. El PDF firmado no cambia; queda registrado acá.</p>}
            </Seccion>

            <Seccion titulo="Información a destacar">
              {campoTexto("informacionDestacada", "Información relevante", "Observaciones especiales, cuidados, garantía…", true)}
            </Seccion>
          </div>
        )}

        {/* Botones fijos abajo (a mano del pulgar en el celular) */}
        {!cargando && (
          <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: `1px solid ${BORDE}`, padding: "12px clamp(16px,4vw,32px)", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {paso && <div style={{ width: "100%", fontSize: 12, fontWeight: 600, color: "#2563EB" }}>{paso}</div>}
            {!bloqueado && <button onClick={guardar} disabled={ocupado || !cambios} style={{ ...boton(cambios ? VERDE : "#94A3B8"), flex: "1 1 120px", cursor: ocupado || !cambios ? "not-allowed" : "pointer" }}><Icono n="guardar" /> {guardando ? "Guardando…" : cambios ? "Guardar" : "Guardado"}</button>}
            <button onClick={verPdf} disabled={ocupado} style={{ ...boton("#EFF6FF", "#1D4ED8", "1px solid #BFDBFE"), flex: "1 1 120px" }}><Icono n="documento" /> {firmado ? "PDF firmado" : "Ver PDF"}</button>
            {!bloqueado && <button onClick={() => setFirmando(true)} disabled={ocupado || archivos.some(a => a.subiendo)} style={{ ...boton(NARANJA), flex: "1 1 160px" }}><Icono n="editar" /> Firmar</button>}
            {informe && (
              <EnviarPorMail deshabilitado={cambios || ocupado} motivo="Guardá el informe antes de enviarlo"
                estiloBoton={{ ...boton("#0F766E"), flex: "1 1 140px" }}
                enviar={para => apiFetch("/api/enviar-informe-final", { method: "POST", body: JSON.stringify({ obraAvanceId: obra.id, para }) })} />
            )}
          </div>
        )}
      </div>

      {firmando && <ModalFirma obra={form.nombreObra || obra.nombre} pendientes={pendientes.filter(p => !p.resuelto)} ocupado={ocupado} paso={paso}
        onClose={() => setFirmando(false)} onFirmar={async datos => { if (await firmar(datos)) setFirmando(false); }} />}
    </div>
  );
}

// ─── Pantalla para que firme el encargado / arquitecto / cliente ─────────────────
function ModalFirma({ obra, pendientes, ocupado, paso, onClose, onFirmar }) {
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState(CARGOS[0]);
  const [otroCargo, setOtroCargo] = useState("");
  const [email, setEmail] = useState("");
  const [hayFirma, setHayFirma] = useState(false);
  const padRef = useRef(null);
  const cargoFinal = cargo === "Otro" ? otroCargo.trim() : cargo;
  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const listo = nombre.trim() && cargoFinal && hayFirma && emailOk && !ocupado;

  const cerrar = () => { if (ocupado) return false; onClose(); };
  return (
    <div className="modal-fondo modal-centrado" style={{ position: "fixed", inset: 0, zIndex: 900, background: "#fff", overflowY: "auto" }}>
      <CerrarConAtras onClose={cerrar} />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px calc(24px + env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: GRIS }}>Conformidad de entrega</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 19, fontWeight: 800, color: AZUL }}>{obra}</div>
          </div>
          <button onClick={cerrar} disabled={ocupado} aria-label="Volver" style={{ width: 42, height: 42, borderRadius: 10, border: `1px solid ${BORDE}`, background: "#F8FAFC", color: AZUL, cursor: "pointer", flexShrink: 0 }}><Icono n="cerrar" /></button>
        </div>

        <div style={{ background: "#F8FAFC", border: `1px solid ${BORDE}`, borderRadius: 12, padding: 14, fontSize: 14, color: AZUL, lineHeight: 1.5, marginBottom: 18 }}>
          Recibo conforme los trabajos descriptos en el informe{pendientes.length ? ", con estos pendientes:" : ", sin pendientes."}
          {pendientes.length > 0 && <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "#B45309" }}>{pendientes.map(p => <li key={p.id}>{p.texto}</li>)}</ul>}
        </div>

        <label style={lbl}>Nombre y apellido de quien firma</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" autoComplete="off" style={{ ...inp, marginBottom: 14 }} />

        <label style={lbl}>Cargo</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: cargo === "Otro" ? 8 : 14 }}>
          {[...CARGOS, "Otro"].map(c => (
            <button key={c} onClick={() => setCargo(c)} style={{ padding: "10px 14px", minHeight: 42, borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${cargo === c ? AZUL : BORDE}`, background: cargo === c ? AZUL : "#fff", color: cargo === c ? "#fff" : AZUL }}>{c}</button>
          ))}
        </div>
        {cargo === "Otro" && <input value={otroCargo} onChange={e => setOtroCargo(e.target.value)} placeholder="Ej: Jefe de mantenimiento" style={{ ...inp, marginBottom: 14 }} />}

        <label style={lbl}>Email para mandarle el PDF (opcional)</label>
        <input type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="encargado@empresa.com" autoComplete="off" style={{ ...inp, borderColor: emailOk ? BORDE : "#FCA5A5", marginBottom: 4 }} />
        <div style={{ fontSize: 12, color: emailOk ? GRIS : "#DC2626", marginBottom: 16 }}>{emailOk ? "También le llega a la lista de avisos de MaderoGest (los mismos de las alertas)." : "Revisá el email."}</div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={lbl}>Firma</label>
          {hayFirma && <button onClick={() => { padRef.current?.borrar(); setHayFirma(false); }} disabled={ocupado} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "4px 0" }}>Borrar y repetir</button>}
        </div>
        <PadFirma ref={padRef} onCambio={setHayFirma} />

        {paso && <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: "#2563EB" }}>{paso}</div>}
        <button onClick={() => onFirmar({ nombre: nombre.trim(), cargo: cargoFinal, email: email.trim(), imagenData: padRef.current.imagen() })} disabled={!listo}
          style={{ ...boton(listo ? NARANJA : "#CBD5E1"), width: "100%", marginTop: 16, minHeight: 52, fontSize: 15, cursor: listo ? "pointer" : "not-allowed" }}>
          <Icono n="check" /> {ocupado ? "Firmando…" : "Firmar y enviar PDF"}
        </button>
        <p style={{ fontSize: 11.5, color: "#94A3B8", textAlign: "center", lineHeight: 1.5, marginTop: 10 }}>Al firmar, el informe queda cerrado y no se puede cambiar. Es una firma electrónica de conformidad, no una firma digital con certificado.</p>
      </div>
    </div>
  );
}

// Lienzo para firmar con el dedo o el mouse. ref: { imagen() → dataURL PNG recortado, borrar() }
function PadFirma({ ref, onCambio }) {
  const canvasRef = useRef(null);
  const trazos = useRef(0);
  const ultimo = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    const ajustar = () => {
      // Al cambiar de tamaño (girar el teléfono) se pierde lo dibujado: se borra para no deformar la firma
      const r = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
      if (c.width === Math.round(w * r) && c.height === Math.round(h * r)) return;
      c.width = Math.round(w * r); c.height = Math.round(h * r);
      const ctx = c.getContext("2d");
      ctx.scale(r, r); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0F172A"; ctx.lineWidth = 2.4;
      if (trazos.current) { trazos.current = 0; onCambio(false); }
    };
    ajustar();
    const obs = new ResizeObserver(ajustar); obs.observe(c);
    return () => obs.disconnect();
  }, [onCambio]);

  useEffect(() => {
    if (!ref) return;
    ref.current = {
      borrar: () => { const c = canvasRef.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); trazos.current = 0; },
      imagen: () => {
        // Se recorta lo dibujado (con un margen) para que la firma no quede chiquita en el PDF
        const c = canvasRef.current, ctx = c.getContext("2d");
        const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
        let x0 = width, y0 = height, x1 = -1, y1 = -1;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 < 0) return c.toDataURL("image/png");
        const m = 12, sx = Math.max(0, x0 - m), sy = Math.max(0, y0 - m), sw = Math.min(width, x1 + m) - sx, sh = Math.min(height, y1 + m) - sy;
        const out = document.createElement("canvas"); out.width = sw; out.height = sh;
        out.getContext("2d").drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
        return out.toDataURL("image/png");
      },
    };
  });

  const punto = e => { const r = canvasRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const bajar = e => { e.preventDefault(); canvasRef.current.setPointerCapture(e.pointerId); ultimo.current = punto(e); const ctx = canvasRef.current.getContext("2d"); ctx.beginPath(); ctx.arc(ultimo.current.x, ultimo.current.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = "#0F172A"; ctx.fill(); };
  const mover = e => {
    if (!ultimo.current) return;
    e.preventDefault();
    const p = punto(e), ctx = canvasRef.current.getContext("2d");
    ctx.beginPath(); ctx.moveTo(ultimo.current.x, ultimo.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ultimo.current = p;
  };
  const subir = () => { if (!ultimo.current) return; ultimo.current = null; trazos.current++; if (trazos.current === 1) onCambio(true); };

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} onPointerDown={bajar} onPointerMove={mover} onPointerUp={subir} onPointerCancel={subir} onPointerLeave={subir}
        style={{ width: "100%", height: "min(46vh, 260px)", display: "block", touchAction: "none", background: "#fff", border: `2px dashed #CBD5E1`, borderRadius: 12, cursor: "crosshair" }} />
      <div style={{ position: "absolute", left: 16, right: 16, bottom: 34, borderBottom: "1px solid #E2E8F0", pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: 16, bottom: 12, fontSize: 11, color: "#94A3B8", pointerEvents: "none" }}>Firmá acá con el dedo</div>
    </div>
  );
}
