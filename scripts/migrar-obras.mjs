// Migración única a "obras con entregas" (después de correr supabase/03-obras-y-archivo.sql).
//   node --env-file=.env.local scripts/migrar-obras.mjs            -> muestra lo que haría
//   node --env-file=.env.local scripts/migrar-obras.mjs --aplicar  -> guarda un backup en backups/ y lo hace
// Deja solo las entregas de los últimos 3 meses (o sin entregar), agrupa las entregas de la misma obra,
// vincula todas las pestañas con su entrega y borra los registros sueltos de entregas que ya no existen.
import { mkdirSync, writeFileSync } from "node:fs";

const URL = process.env.VITE_SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APLICAR = process.argv.includes("--aplicar");
const CORTE = "2026-07-19"; // 3 meses antes del 19/10/2026

// Decisiones revisadas a mano (ver el listado de vinculación)
const DUPLICADAS = ["mueh39ixnqy6"]; // BBVA Av. Corrientes 25/09 guardada dos veces
const AVANCE_PRODUCCION = { // avance_obras.id -> entrega
  "535de6fc-965c-44a8-99e6-65cd4579a08a": "mv8hkg5f6dtj", "cc1f63cd-fead-4c05-8a7e-fe2d1f4a053d": "mv8hmmdtuvs1",
  "b02a7818-5399-4b22-a587-cdad3c6c05ef": "mo8qav3p7zav", "5db1b773-7381-4df0-8633-0538454f3d85": "mo8lm1ghrs00",
  "cd70557f-e57c-461b-b5ee-5c632f113a1d": "mv9si6d6qr5l", "31f2d069-82c1-4456-a507-6a610922c89c": "mv8hs9wg5qj3",
  "24ba4049-375c-40ef-bb02-abc0a8e40b8b": "mta61kvonb63", "12a015e7-13f7-4446-82b6-063f9eb29ec8": "muygcf05jsd3",
  "d7213551-a76e-402c-8e96-3141c32cbda3": "mta66ijv4q5w",
};
const AVANCE_OBRA = { // obras_avance.id -> entrega
  "78ade314-d73f-4b3c-a870-673d89d48ea2": "muygf682rnqw", "7fbfb6ca-035c-4181-b2b4-9761841b52f9": "muvjj4hgsfeg",
  "d6bfe1c2-1393-4c47-a8b9-b74727d8015a": "mv8hkg5f6dtj", "ed1f959b-b6f1-4286-ab74-79cc771572eb": "mumwd63mkrfd",
};
const ACEPTADAS = { "09988c1f-b628-4596-aa32-b67a1b8e73cd": "mv9si6d6qr5l" }; // obras_aceptadas.id -> una entrega de la obra

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" };
async function api(path, opts = {}) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { ...opts, headers: { ...H, ...opts.headers } });
  if (!r.ok) throw new Error(`${opts.method || "GET"} ${path}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const leer = t => api(`${t}?select=*`, { headers: { Prefer: "" } });
const enLista = ids => `in.(${ids.map(i => `"${i}"`).join(",")})`;
async function borrar(tabla, campo, ids) {
  if (!ids.length) return;
  console.log(`  borrar ${tabla} (${ids.length})`);
  if (APLICAR) for (let i = 0; i < ids.length; i += 50) await api(`${tabla}?${campo}=${enLista(ids.slice(i, i + 50))}`, { method: "DELETE" });
}
async function patch(tabla, filtro, datos) { if (APLICAR) await api(`${tabla}?${filtro}`, { method: "PATCH", body: JSON.stringify(datos) }); }

const tablas = ["obras", "proyectos", "cobros", "materiales", "agregados", "historial", "avance_obras", "obras_avance", "avance_dias", "informes_finales", "obras_aceptadas"];
const d = {};
for (const t of tablas) {
  try { d[t] = await leer(t); }
  catch (e) { if (APLICAR) throw e; d[t] = []; console.log(`(no se pudo leer ${t}: ¿falta correr el SQL 03?)`); }
}
if (APLICAR) {
  mkdirSync("backups", { recursive: true });
  const f = `backups/backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(f, JSON.stringify(d));
  console.log("Backup:", f);
}

// 1) Qué entregas quedan
const reciente = o => (o.fecha && o.fecha >= CORTE) || (!o.fecha && (o.creado_en || "") >= CORTE) || o.estado !== "terminado";
const quedan = d.obras.filter(o => reciente(o) && !DUPLICADAS.includes(o.id));
const ids = new Set(quedan.map(o => o.id));
console.log(`Entregas: quedan ${quedan.length}, se borran ${d.obras.length - quedan.length}`);
for (const o of d.obras.filter(o => !ids.has(o.id))) console.log(`  - ${o.nombre} (${o.fecha || "sin fecha"})`);

// 2) Borrar lo que no queda o no tiene entrega
await borrar("cobros", "id", d.cobros.filter(c => !ids.has(c.obra_id)).map(c => c.id));
await borrar("materiales", "id", d.materiales.filter(m => !ids.has(m.obra_id)).map(m => m.id));
await borrar("agregados", "id", d.agregados.filter(a => !ids.has(a.obra_id)).map(a => a.id));
await borrar("avance_obras", "id", d.avance_obras.filter(a => !ids.has(AVANCE_PRODUCCION[a.id])).map(a => a.id));
const avanceQueda = new Set(d.obras_avance.filter(a => ids.has(AVANCE_OBRA[a.id])).map(a => a.id));
await borrar("avance_dias", "id", d.avance_dias.filter(x => !avanceQueda.has(x.obra_id)).map(x => x.id));
await borrar("informes_finales", "id", d.informes_finales.filter(x => !avanceQueda.has(x.obra_id)).map(x => x.id));
await borrar("obras_avance", "id", d.obras_avance.filter(a => !avanceQueda.has(a.id)).map(a => a.id));
await borrar("obras", "id", d.obras.filter(o => !ids.has(o.id)).map(o => o.id));

// 3) Agrupar entregas en obras
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\bav\b/g, "avenida").replace(/\s+/g, " ").trim();
const base = s => norm(s).replace(/\b(1er|2da|2do|3er|3ra|4ta|primera|segunda|tercera|entrega|viaje)\b/g, " ").replace(/\s+/g, " ").trim();
const grupos = new Map();
for (const o of quedan) grupos.set(base(o.nombre), [...(grupos.get(base(o.nombre)) || []), o]);
const masComun = xs => { const c = new Map(); for (const x of xs) c.set(x, (c.get(x) || 0) + 1); return [...c].sort((a, b) => b[1] - a[1])[0][0]; };
const lugarDe = os => os.map(o => (o.lugar || "").trim()).filter(l => l && l !== "-").sort((a, b) => b.length - a.length)[0] || "";
const proyectoDeEntrega = {};
let n = 0;
for (const os of grupos.values()) {
  const id = `p${Date.now().toString(36)}${(n++).toString(36).padStart(3, "0")}`;
  const nombre = masComun(os.map(o => o.nombre.trim().replace(/\s+/g, " ")));
  const lugar = lugarDe(os);
  const orden = [...os].sort((a, b) => (a.fecha || a.creado_en || "").localeCompare(b.fecha || b.creado_en || ""));
  console.log(`Obra "${nombre}" (${lugar}): ${orden.length} entrega(s)`);
  if (APLICAR) await api("proyectos", { method: "POST", body: JSON.stringify({ id, nombre, lugar, creado_en: orden[0].creado_en || new Date().toISOString() }) });
  for (const [i, o] of orden.entries()) {
    const etiqueta = orden.length > 1 ? `${i + 1}ª entrega` : null;
    const nombreEntrega = etiqueta ? `${nombre} - ${etiqueta}` : nombre;
    proyectoDeEntrega[o.id] = id;
    console.log(`    ${o.fecha || "sin fecha"} -> ${nombreEntrega}`);
    await patch("obras", `id=eq.${o.id}`, { proyecto_id: id, etiqueta, nombre: nombreEntrega, lugar });
    await patch("cobros", `obra_id=eq.${o.id}`, { obra_nombre: nombreEntrega, obra_lugar: lugar });
    await patch("materiales", `obra_id=eq.${o.id}`, { obra_nombre: nombreEntrega, obra_lugar: lugar });
    for (const [aid, eid] of Object.entries(AVANCE_PRODUCCION)) if (eid === o.id) await patch("avance_obras", `id=eq.${aid}`, { obra_id: o.id, name: nombreEntrega, client: lugar, due_date: o.fecha || null });
    for (const [aid, eid] of Object.entries(AVANCE_OBRA)) if (eid === o.id) await patch("obras_avance", `id=eq.${aid}`, { obra_id: o.id, nombre: nombreEntrega, direccion: lugar, fecha_entrega: o.fecha || null });
  }
}
for (const [aid, eid] of Object.entries(ACEPTADAS)) await patch("obras_aceptadas", `id=eq.${aid}`, { proyecto_id: proyectoDeEntrega[eid] });
console.log(APLICAR ? "Listo." : "\n(Solo vista previa. Para aplicarlo: --aplicar)");
