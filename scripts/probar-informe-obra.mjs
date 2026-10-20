// Prueba local (sin Claude ni mails): muestra los datos que se le mandan a Claude para una obra.
//   node --env-file=.env.local scripts/probar-informe-obra.mjs "CRIBA EZEIZA"
import { adminClient } from "../api/_lib.js";
import { datosDeLaObra, htmlInforme } from "../api/informe-obra.js";

const db = adminClient();
const buscado = (process.argv[2] || "").toLowerCase();
const { data: proyectos } = await db.from("proyectos").select("id, nombre");
const p = proyectos.find(x => x.nombre.toLowerCase().includes(buscado));
if (!p) { console.log("No encontré la obra. Obras:", proyectos.map(x => x.nombre).join(", ")); process.exit(1); }
const { proyecto, ...datos } = await datosDeLaObra(db, p.id, true);
const json = JSON.stringify(datos, null, 1);
console.log(json.slice(0, 4000));
console.log(`\n${proyecto.nombre}: ${json.length} caracteres de datos`);
console.log(htmlInforme(proyecto.nombre, { estado_titulo: "Prueba", semaforo: "amarillo", resumen: "<b>escapado</b>", fechas_clave: [], entregas: [], produccion: [], demoras: ["x"], faltantes: [], adicionales: [], cobros: "", proximos_pasos: [] }).length > 0 ? "HTML ok" : "HTML vacío");
