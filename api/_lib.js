// Shared helpers for the Vercel serverless functions in /api.
// Files starting with "_" are not exposed as routes by Vercel.
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

// Admin client: bypasses RLS. Only ever used server-side.
export function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel.");
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Validates the caller's Supabase session token and returns { id, email, rol, nombre }.
// Throws an error with .status = 401/403 when the caller is not allowed.
export async function getCaller(req, rolesPermitidos = null) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw httpError(401, "Falta iniciar sesión.");
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data?.user) throw httpError(401, "Sesión inválida o vencida. Volvé a iniciar sesión.");
  const u = data.user;
  const caller = { id: u.id, email: u.email, rol: u.app_metadata?.rol || null, nombre: u.user_metadata?.nombre || u.email, usuario_id: u.app_metadata?.usuario_id || null };
  if (rolesPermitidos && !rolesPermitidos.includes(caller.rol)) throw httpError(403, "No tenés permiso para esta acción.");
  return caller;
}

export function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

export function sendError(res, e) {
  const status = e.status || 500;
  if (status >= 500) console.error(e);
  res.status(status).json({ error: e.message || "Error interno" });
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
