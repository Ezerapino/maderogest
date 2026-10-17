// Migración única: crea en Supabase Auth un usuario por cada fila de la tabla "usuarios",
// con la misma contraseña que tiene hoy, y guarda el vínculo en usuarios.auth_id.
// Se puede correr más de una vez: los que ya están migrados se saltean.
//
// Uso (necesita SUPABASE_SERVICE_ROLE_KEY en .env.local):
//   node --env-file=.env.local scripts/migrar-usuarios.mjs
import { createClient } from "@supabase/supabase-js";

const url = (process.env.VITE_SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url || !key) { console.error("Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local"); process.exit(1); }

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: usuarios, error } = await db.from("usuarios").select("*");
if (error) { console.error("No se pudo leer usuarios:", error.message); process.exit(1); }
if (usuarios.length && !("auth_id" in usuarios[0])) { console.error('Falta la columna auth_id. Corré primero el paso 1 del SQL (supabase/01-preparar-auth.sql).'); process.exit(1); }

// Usuarios que ya existen en Auth (por si se corre de nuevo)
const existentes = new Map();
for (let page = 1; ; page++) {
  const { data, error: e } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (e) { console.error(e.message); process.exit(1); }
  data.users.forEach(u => existentes.set(u.email.toLowerCase(), u));
  if (data.users.length < 1000) break;
}

let ok = 0, fallos = 0;
for (const u of usuarios) {
  const email = (u.email || "").trim().toLowerCase();
  const meta = { app_metadata: { rol: u.rol, usuario_id: u.id }, user_metadata: { nombre: u.nombre } };
  try {
    let authUser = existentes.get(email);
    if (authUser) {
      const upd = { ...meta, ...(u.password ? { password: u.password } : {}) };
      const { error: e } = await db.auth.admin.updateUserById(authUser.id, upd);
      if (e) throw e;
    } else {
      if (!u.password) throw new Error("no tiene contraseña cargada");
      const { data, error: e } = await db.auth.admin.createUser({ email, password: u.password, email_confirm: true, ...meta });
      if (e) throw e;
      authUser = data.user;
    }
    const { error: e2 } = await db.from("usuarios").update({ auth_id: authUser.id, email }).eq("id", u.id);
    if (e2) throw e2;
    console.log(`✓ ${u.nombre} <${email}> (${u.rol})`);
    ok++;
  } catch (e) {
    console.error(`✗ ${u.nombre} <${email}>: ${e.message}`);
    fallos++;
  }
}
console.log(`\n${ok} migrados, ${fallos} con error.`);
process.exit(fallos ? 1 : 0);
