import { useState, useEffect } from "react";
import { Avisos } from "./components/Avisos.jsx";
import { Login } from "./components/Login.jsx";
import { cerrarSesion, getMateriales, getObras, getProyectos, getSesion, patchEntregas, supabase, upsertProyecto, vinculoEntregas } from "./lib/datos.js";
import { LOGO_AIXA, diasRestantes, uid } from "./lib/formato.js";
import { EMAIL_HISTORIAL } from "./lib/historial.js";
import { alertasMateriales } from "./lib/materiales.js";
import { RUTAS_PESTANAS, navegar, useRuta } from "./lib/rutas.js";
import { ObrasAceptadasModule } from "./modulos/Aceptadas.jsx";
import { ConfigWhatsApp, GestionUsuarios } from "./modulos/Administracion.jsx";
import { AvanceObraModule } from "./modulos/AvanceObra.jsx";
import { CobrosModule } from "./modulos/Cobros.jsx";
import { EntregasModule } from "./modulos/Entregas.jsx";
import { HistorialModule } from "./modulos/Historial.jsx";
import { MaterialesModule } from "./modulos/Materiales.jsx";
import { AvanceModule } from "./modulos/Produccion.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  return <><Aplicacion /><Avisos /></>;
}

function Aplicacion() {
  const [sesion, setSesion] = useState(null);
  const [obras, setObras] = useState([]); // entregas (incluidas las archivadas)
  const [proyectos, setProyectos] = useState([]); // obras que agrupan entregas
  const [cargando, setCargando] = useState(true);
  const ruta = useRuta();
  const [showUsuarios, setShowUsuarios] = useState(false);
  const [showWA, setShowWA] = useState(false);

  async function recargarObras() {
    try {
      let [ob, pr] = await Promise.all([getObras(), getProyectos()]);
      ob = ob || []; pr = pr || [];
      // Entregas sin obra (por ejemplo, cargadas antes de este cambio): se les crea su obra
      const sueltas = ob.filter(o => !o.proyecto_id || !pr.some(p => p.id === o.proyecto_id));
      if (sueltas.length) {
        for (const o of sueltas) {
          const p = { id: uid(), nombre: o.nombre, lugar: o.lugar || "", creado_por: o.creado_por || null, creado_en: o.creado_en || new Date().toISOString(), archivada: !!o.archivada };
          await upsertProyecto(p);
          await patchEntregas(`id=eq.${o.id}`, { proyecto_id: p.id });
        }
        [ob, pr] = await Promise.all([getObras(), getProyectos()]);
      }
      setObras(ob || []); setProyectos(pr || []);
    } catch (e) { console.error("Error cargando obras:", e); }
  }

  useEffect(() => {
    (async () => {
      try {
        const s = await getSesion();
        if (s) { setSesion(s); await recargarObras(); }
      } catch (e) { console.error("Error iniciando la sesión:", e); }
      setCargando(false);
    })();
    // Si la sesión vence o se cierra en otra pestaña, volver al login
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => { if (evento === "SIGNED_OUT") setSesion(null); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const [matAlertCount, setMatAlertCount] = useState(0);
  // Recalcula el contador de alertas de materiales al entrar y al cambiar de pestaña
  useEffect(() => {
    if (!sesion || sesion.rol === "arquitecto" || sesion.rol === "finanzas") return;
    const { activas, archivadas } = vinculoEntregas(obras);
    getMateriales().then(ls => setMatAlertCount(alertasMateriales((ls || []).filter(l => !archivadas.has(l.obra_id)), activas).length)).catch(() => {});
  }, [sesion, obras, ruta]);

  function handleLogin(u) { setSesion(u); recargarObras(); }
  async function handleLogout() { await cerrarSesion(); setSesion(null); setObras([]); setProyectos([]); }
  const entregasActivas = obras.filter(o => !o.archivada);

  const isAdmin = sesion?.rol === "admin";
  const isFinanzas = sesion?.rol === "finanzas";
  const isArquitecto = sesion?.rol === "arquitecto";
  const canSeeCobros = isAdmin || isFinanzas;
  const canSeeAvanceProduccion = !isArquitecto && !isFinanzas;
  const canSeeAvanceObra = !isFinanzas;
  const canSeeMateriales = !isArquitecto && !isFinanzas;
  const canSeeHistorial = sesion?.email?.toLowerCase() === EMAIL_HISTORIAL;

  // La pestaña sale de la dirección; si el rol no la puede ver (o la dirección es "/"), va a su pantalla de inicio
  const puedeVer = { entregas: true, aceptadas: true, avance: canSeeAvanceProduccion, avance_obra: canSeeAvanceObra, cobros: canSeeCobros, materiales: canSeeMateriales, historial: canSeeHistorial };
  const activeTab = ruta.pestana && puedeVer[ruta.pestana] ? ruta.pestana : isFinanzas ? "cobros" : "entregas";
  const setActiveTab = t => navegar(`/${RUTAS_PESTANAS[t]}`);
  useEffect(() => {
    if (!sesion) return;
    if (!ruta.fichaId && ruta.pestana !== activeTab) navegar(`/${RUTAS_PESTANAS[activeTab]}`, { reemplazar: true });
    if (!ruta.fichaId) document.title = activeTab === "entregas" ? "MaderoGest" : `${{ aceptadas: "Obras Aceptadas", avance: "Producción", avance_obra: "Avance de Obra", cobros: "Cobros", materiales: "Materiales", historial: "Historial" }[activeTab]} · MaderoGest`;
  }, [sesion, ruta, activeTab]);
  const activas = entregasActivas.filter(o => o.estado !== "terminado");
  const urgentes = activas.filter(o => { const d = diasRestantes(o.fecha); return d >= 0 && d <= 7; });
  const proximas = activas.filter(o => { const d = diasRestantes(o.fecha); return d > 7 && d <= 21; });
  const alertCount = urgentes.length + proximas.length;

  if (cargando) return (
    <div style={{ minHeight:"100vh", background:"#F4F6F9", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
      <img src={LOGO_AIXA} alt="Aixa" style={{ height:56, borderRadius:6, opacity:0.7 }} />
      <div style={{ fontFamily:"'Inter', sans-serif", color:"#94A3B8", fontSize:13 }}>Cargando...</div>
    </div>
  );
  if (!sesion) return <Login onLogin={handleLogin} />;

  return (
    <div style={{ minHeight:"100vh", background:"#F4F6F9", fontFamily:"'Inter', sans-serif", color:"#1A2B4A" }}>

      {/* HEADER */}
      <header className="app-encabezado" style={{ position:"sticky", top:0, zIndex:100, background:"#ffffff", borderBottom:"1px solid #E8ECF0", padding:"0 24px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <img src={LOGO_AIXA} alt="Obras Grupo Aixa S.A." style={{ height:40, borderRadius:6 }} />

          {/* TABS (en el celular pasan a una barra fija abajo, ver index.css) */}
          <nav className="app-tabs" style={{ display:"flex", gap:2, background:"#F1F5F9", borderRadius:10, padding:3 }}>
            {[
              { id:"entregas",    icono:"📦", nombre:"Entregas",             corto:"Entregas",   ver:true },
              { id:"aceptadas",   icono:"🗂️", nombre:"Obras Aceptadas",      corto:"Aceptadas",  ver:true },
              { id:"avance",      icono:"🏗", nombre:"Avance de Producción", corto:"Producción", ver:canSeeAvanceProduccion },
              { id:"avance_obra", icono:"🏠", nombre:"Avance de Obra",       corto:"Obra",       ver:canSeeAvanceObra },
              { id:"cobros",      icono:"💰", nombre:"Cobros",               corto:"Cobros",     ver:canSeeCobros, color:"#7C3AED" },
              { id:"materiales",  icono:"🪵", nombre:"Materiales",           corto:"Materiales", ver:canSeeMateriales, color:"#0F766E", alertas:matAlertCount },
            ].filter(t => t.ver).map(t => {
              const activa = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={activa ? "app-tab activa" : "app-tab"} aria-current={activa ? "page" : undefined}
                  style={{ "--tab-color": t.color || "#1A2B4A", position:"relative", padding:"7px 18px", borderRadius:8, border:"none", background: activa ? (t.color || "#1A2B4A") : "transparent", color: activa ? "#ffffff" : "#64748B", fontFamily:"'Sora', sans-serif", fontSize:12, fontWeight: activa ? 700 : 500, cursor:"pointer", transition:"all 0.15s", letterSpacing:0.3 }}>
                  <span className="app-tab-icono">{t.icono}</span> <span className="app-tab-nombre">{t.nombre}</span><span className="app-tab-corto">{t.corto}</span>
                  {t.alertas > 0 && (
                    <span className="app-tab-alerta" title={`${t.alertas} obra(s) con entrega próxima y materiales faltantes`}
                      style={{ marginLeft:6, background:"#DC2626", color:"#fff", borderRadius:99, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{t.alertas}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {canSeeHistorial && (
            <button onClick={() => setActiveTab("historial")} className="btn-icon" title="Historial de modificaciones"
              style={{ background: activeTab === "historial" ? "#1A2B4A" : "transparent", border:"1px solid #E8ECF0", borderRadius:8, width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:16 }}>🕑</button>
          )}

          {/* WhatsApp */}
          <button onClick={() => setShowWA(true)} className="btn-icon" title="WhatsApp"
            style={{ position:"relative", background:"transparent", border:"1px solid #E8ECF0", borderRadius:8, width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            {alertCount > 0 && <div style={{ position:"absolute", top:6, right:6, background:"#22C55E", borderRadius:"50%", width:7, height:7 }} />}
          </button>

          <div style={{ width:1, height:24, background:"#E8ECF0", margin:"0 4px" }} />

          {/* User */}
          <div onClick={isAdmin ? () => setShowUsuarios(true) : undefined}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 12px 6px 8px", background:"#F8FAFC", border:"1px solid #E8ECF0", borderRadius:8, cursor: isAdmin ? "pointer" : "default" }}>
            <div style={{ width:26, height:26, borderRadius:6, background: isAdmin ? "#1A2B4A" : isFinanzas ? "#7C3AED" : isArquitecto ? "#B45309" : "#0F766E", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span className="solo-escritorio" style={{ fontSize:13, color:"#1A2B4A", fontWeight:500 }}>{sesion.nombre.split(" ")[0]}</span>
            {isAdmin && <span className="solo-escritorio" style={{ fontSize:10, color:"#1A2B4A", background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:4, padding:"1px 6px", fontWeight:600 }}>ADMIN</span>}
            {isFinanzas && <span className="solo-escritorio" style={{ fontSize:10, color:"#7C3AED", background:"#F5F3FF", border:"1px solid #DDD6FE", borderRadius:4, padding:"1px 6px", fontWeight:600 }}>FINANZAS</span>}
            {isArquitecto && <span className="solo-escritorio" style={{ fontSize:10, color:"#92400E", background:"#FEF3C7", border:"1px solid #FDE68A", borderRadius:4, padding:"1px 6px", fontWeight:600 }}>ARQUITECTO</span>}
          </div>

          <button onClick={handleLogout}
            style={{ background:"transparent", border:"1px solid #E8ECF0", borderRadius:8, padding:"7px 14px", color:"#64748B", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            Salir
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="app-main" style={{ maxWidth:1200, margin:"0 auto", padding:"28px 24px 100px" }}>
        {activeTab === "entregas" && <EntregasModule sesion={sesion} obras={obras} proyectos={proyectos} recargarObras={recargarObras} />}
        {activeTab === "aceptadas" && <ObrasAceptadasModule sesion={sesion} proyectos={proyectos} recargarObras={recargarObras} />}
        {activeTab === "avance" && canSeeAvanceProduccion && <AvanceModule sesion={sesion} entregas={obras} />}
        {activeTab === "avance_obra" && canSeeAvanceObra && <AvanceObraModule sesion={sesion} entregas={obras} />}
        {activeTab === "cobros" && canSeeCobros && <CobrosModule entregas={obras} />}
        {activeTab === "materiales" && canSeeMateriales && <MaterialesModule sesion={sesion} entregas={obras} />}
        {activeTab === "historial" && canSeeHistorial && <HistorialModule />}
      </main>

      {/* MODALES GLOBALES */}
      {showUsuarios && isAdmin && <GestionUsuarios onClose={() => setShowUsuarios(false)} />}
      {showWA && <ConfigWhatsApp obras={entregasActivas} onClose={() => setShowWA(false)} />}
    </div>
  );
}
