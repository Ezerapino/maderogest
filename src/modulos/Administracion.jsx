// Usuarios y WhatsApp
import { useState, useEffect } from "react";
import { avisar, confirmar } from "../lib/avisos.js";
import { crearUsuario, deleteUsuario, getUsuarios } from "../lib/datos.js";
import { diasRestantes } from "../lib/formato.js";
import { enviarWhatsApp } from "../lib/produccion.js";

// ─── GESTIÓN USUARIOS ─────────────────────────────────────────────────────────
export function GestionUsuarios({ onClose }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ nombre:"", email:"", password:"", rol:"operario" });
  const ROL_META = { admin: { label:"ADMIN", color:"#1A2B4A", bg:"#EFF6FF", border:"#DBEAFE" }, operario: { label:"OPERARIO", color:"#0F766E", bg:"#F0FDF4", border:"#BBF7D0" }, finanzas: { label:"FINANZAS", color:"#7C3AED", bg:"#F5F3FF", border:"#DDD6FE" }, arquitecto: { label:"ARQUITECTO", color:"#B45309", bg:"#FEF3C7", border:"#FDE68A" } };
  const [msg, setMsg] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { getUsuarios().then(u => u && setUsuarios(u)).catch(() => {}); }, []);

  async function agregar() {
    if (!form.nombre || !form.email || !form.password) { setMsg("⚠️ Completá todos los campos"); return; }
    if (usuarios.find(u => u.email.toLowerCase() === form.email.toLowerCase())) { setMsg("⚠️ Ya existe ese email"); return; }
    if (form.password.length < 6) { setMsg("⚠️ La contraseña debe tener al menos 6 caracteres"); return; }
    setGuardando(true);
    try {
      const nuevo = await crearUsuario(form);
      setUsuarios(u => [...u, nuevo]);
      setForm({ nombre:"", email:"", password:"", rol:"operario" });
      setMsg("✅ Usuario creado");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { setMsg(`⚠️ ${e.message}`); }
    setGuardando(false);
  }

  async function eliminar(id) {
    if (!await confirmar("¿Eliminar este usuario?")) return;
    try { await deleteUsuario(id); setUsuarios(u => u.filter(x => x.id !== id)); } catch (e) { avisar(e.message, { tipo: "error" }); }
  }

  const si = { width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:480, maxHeight:"88vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>Equipo</h2>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"16px 24px" }}>
          {usuarios.map(u => (
            <div key={u.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:10, marginBottom:8 }}>
              <div style={{ width:36, height:36, borderRadius:8, background: (ROL_META[u.rol]||ROL_META.operario).color, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:"#1A2B4A", fontSize:14, fontWeight:600 }}>{u.nombre}</div>
                <div style={{ color:"#94A3B8", fontSize:12 }}>{u.email}</div>
              </div>
              <span style={{ fontSize:10, fontWeight:700, color: (ROL_META[u.rol]||ROL_META.operario).color, background: (ROL_META[u.rol]||ROL_META.operario).bg, border:`1px solid ${(ROL_META[u.rol]||ROL_META.operario).border}`, borderRadius:4, padding:"2px 8px" }}>
                {(ROL_META[u.rol]||ROL_META.operario).label}
              </span>
              {u.id !== "admin" && <button onClick={() => eliminar(u.id)} style={{ background:"none", border:"none", color:"#CBD5E1", cursor:"pointer", fontSize:15, padding:0 }}
                onMouseEnter={e => e.currentTarget.style.color="#EF4444"} onMouseLeave={e => e.currentTarget.style.color="#CBD5E1"}>✕</button>}
            </div>
          ))}
          <div style={{ marginTop:20, paddingTop:20, borderTop:"1px solid #F1F5F9" }}>
            <h3 style={{ fontFamily:"'Sora', sans-serif", fontSize:14, fontWeight:700, color:"#1A2B4A", margin:"0 0 14px" }}>Agregar usuario</h3>
            {[{label:"Nombre",key:"nombre",ph:"Nombre completo"},{label:"Email",key:"email",ph:"email@empresa.com"},{label:"Contraseña",key:"password",ph:"Contraseña"}].map(f => (
              <div key={f.key} style={{ marginBottom:10 }}>
                <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:5 }}>{f.label}</label>
                <input style={si} placeholder={f.ph} value={form[f.key]} onChange={e => setForm(x => ({...x, [f.key]: e.target.value}))} />
              </div>
            ))}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:5 }}>Rol</label>
              <select value={form.rol} onChange={e => setForm(x => ({...x, rol: e.target.value}))} style={si}>
                <option value="operario">Operario</option>
                <option value="admin">Admin</option>
                <option value="finanzas">Finanzas</option>
                <option value="arquitecto">Arquitecto</option>
              </select>
            </div>
            {msg && <div style={{ padding:"9px 13px", borderRadius:8, background: msg.startsWith("✅") ? "#ECFDF5" : "#FEF2F2", border:`1px solid ${msg.startsWith("✅") ? "#A7F3D0" : "#FECACA"}`, color: msg.startsWith("✅") ? "#059669" : "#DC2626", fontSize:13, marginBottom:12 }}>{msg}</div>}
            <button onClick={agregar} disabled={guardando} style={{ width:"100%", padding:"11px", background: guardando ? "#94A3B8" : "#1A2B4A", border:"none", borderRadius:8, fontFamily:"'Inter', sans-serif", fontSize:14, fontWeight:600, color:"#ffffff", cursor: guardando ? "not-allowed" : "pointer" }}>
              {guardando ? "Guardando..." : "Agregar usuario"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── CONFIG WHATSAPP ──────────────────────────────────────────────────────────
export function ConfigWhatsApp({ obras, onClose }) {
  const [numero, setNumero] = useState(() => { try { return localStorage.getItem("mg_wa_numero") || ""; } catch { return ""; } });
  const [saved, setSaved] = useState(false);
  function guardar() { localStorage.setItem("mg_wa_numero", numero); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  const urgentes = obras.filter(o => o.estado !== "terminado" && diasRestantes(o.fecha) >= 0 && diasRestantes(o.fecha) <= 7).length;
  const proximas = obras.filter(o => o.estado !== "terminado" && diasRestantes(o.fecha) > 7 && diasRestantes(o.fecha) <= 21).length;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#ffffff", borderRadius:14, width:"100%", maxWidth:440, boxShadow:"0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:17, fontWeight:700, color:"#1A2B4A", margin:0 }}>Alertas WhatsApp</h2>
          <button onClick={onClose} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748B", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"20px 24px" }}>
          <div className="grid-form" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:14, textAlign:"center" }}>
              <div style={{ fontFamily:"'Sora', sans-serif", fontSize:28, fontWeight:800, color:"#DC2626" }}>{urgentes}</div>
              <div style={{ fontSize:11, color:"#EF4444", fontWeight:600, marginTop:4 }}>URGENTES</div>
            </div>
            <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:10, padding:14, textAlign:"center" }}>
              <div style={{ fontFamily:"'Sora', sans-serif", fontSize:28, fontWeight:800, color:"#D97706" }}>{proximas}</div>
              <div style={{ fontSize:11, color:"#F59E0B", fontWeight:600, marginTop:4 }}>PRÓXIMAS</div>
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Número de WhatsApp</label>
            <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="5491112345678"
              style={{ width:"100%", padding:"10px 13px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box" }} />
            <div style={{ fontSize:11, color:"#94A3B8", marginTop:5 }}>Código país + área + número, sin espacios ni +</div>
          </div>
          <button onClick={guardar} style={{ width:"100%", padding:"10px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color: saved ? "#059669" : "#475569", fontFamily:"'Inter', sans-serif", fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:10 }}>
            {saved ? "Número guardado" : "Guardar número"}
          </button>
          <button onClick={() => { enviarWhatsApp(obras, numero); onClose(); }} style={{ width:"100%", padding:"12px", background:"#25D366", border:"none", borderRadius:8, fontFamily:"'Inter', sans-serif", fontSize:14, fontWeight:700, color:"#fff", cursor:"pointer" }}>
            Enviar resumen ahora
          </button>
        </div>
      </div>
    </div>
  );
}
