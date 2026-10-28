// Pantalla de ingreso
import { useState } from "react";
import { perfilDeSesion, supabase } from "../lib/datos.js";
import { LOGO_AIXA } from "../lib/formato.js";

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleLogin() {
    if (!email || !pass) { setError("Completá email y contraseña."); return; }
    setCargando(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pass });
      if (authError) { setError(/invalid/i.test(authError.message) ? "Email o contraseña incorrectos." : authError.message); setCargando(false); return; }
      onLogin(await perfilDeSesion(data.session));
    } catch {
      setError("Error de conexión. Verificá tu internet.");
      setCargando(false);
    }
  }

  const inputStyle = { width:"100%", padding:"11px 14px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, color:"#1A2B4A", fontFamily:"'Inter', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box", transition:"border-color 0.15s" };

  return (
    <div style={{ minHeight:"100vh", background:"#F4F6F9", display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ marginBottom:36, textAlign:"center" }}>
          <img src={LOGO_AIXA} alt="Obras Grupo Aixa S.A." style={{ height:72, borderRadius:8, marginBottom:16 }} />
          <p style={{ fontSize:13, color:"#94A3B8", margin:0, letterSpacing:0.5 }}>Sistema integral de gestión de obras</p>
        </div>
        <div style={{ marginBottom:22 }}>
          <h1 style={{ fontFamily:"'Sora', sans-serif", fontSize:22, fontWeight:700, color:"#1A2B4A", margin:"0 0 4px" }}>Bienvenido</h1>
          <p style={{ fontSize:13, color:"#64748B", margin:0 }}>Ingresá tus credenciales para continuar</p>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Email</label>
          <input type="email" value={email} placeholder="tu@empresa.com"
            onChange={e => { setEmail(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={inputStyle} />
        </div>
        <div style={{ marginBottom:24 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 }}>Contraseña</label>
          <input type="password" value={pass} placeholder="••••••••"
            onChange={e => { setPass(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={inputStyle} />
        </div>
        {error && (
          <div style={{ padding:"10px 14px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#DC2626", fontSize:13, marginBottom:16 }}>{error}</div>
        )}
        <button onClick={handleLogin} disabled={cargando}
          style={{ width:"100%", padding:"12px", background: cargando ? "#94A3B8" : "#1A2B4A", border:"none", borderRadius:8, fontFamily:"'Inter', sans-serif", fontSize:14, fontWeight:600, color:"#ffffff", cursor: cargando ? "not-allowed" : "pointer", letterSpacing:0.3, transition:"background 0.2s" }}
          onMouseEnter={e => !cargando && (e.currentTarget.style.background="#2563EB")}
          onMouseLeave={e => !cargando && (e.currentTarget.style.background="#1A2B4A")}>
          {cargando ? "Verificando..." : "Iniciar sesión"}
        </button>
      </div>
    </div>
  );
}
