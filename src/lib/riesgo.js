// Entregas en riesgo: una sola regla para la app (Entregas, Producción, ficha) y el mail de avisos.
// Sin imports, para poder usarla también desde las funciones del servidor (/api).
//
// Una entrega está en riesgo si no está entregada, faltan DIAS_RIESGO días o menos (o ya venció) y:
//  - la producción va por debajo de PROD_MINIMA_RIESGO %, o
//  - hay materiales sin pedir o sin recibir.
export const DIAS_RIESGO = 7;
export const PROD_MINIMA_RIESGO = 50;

const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

// dias: días hasta la entrega (negativo si venció). produccion: % (null si no tiene registro de producción).
export function evaluarRiesgo({ dias, estado, produccion, faltaPedir = 0, faltaRecibir = 0 }) {
  if (estado === "terminado" || dias == null || dias > DIAS_RIESGO) return null;
  const motivos = [];
  if (produccion != null && produccion < PROD_MINIMA_RIESGO) motivos.push(`producción al ${produccion}%`);
  if (faltaPedir) motivos.push(`${plural(faltaPedir, "material", "materiales")} sin pedir`);
  if (faltaRecibir) motivos.push(`${plural(faltaRecibir, "material", "materiales")} sin recibir`);
  if (!motivos.length) return null;
  const cuando = dias < 0 ? `vencida hace ${plural(-dias, "día", "días")}` : dias === 0 ? "se entrega hoy" : `faltan ${plural(dias, "día", "días")}`;
  return { dias, motivos, texto: `${cuando}: ${motivos.join(", ")}` };
}

// Porcentaje de producción a partir de las estaciones (igual que en la pestaña Producción)
export function porcentajeProduccion(stations) {
  const st = stations || [];
  return st.length ? Math.round(st.filter(s => s.status === "done").length / st.length * 100) : 0;
}

// Cuenta de materiales que faltan pedir / recibir de una lista
export function faltantesMateriales(items) {
  const it = items || [];
  return {
    faltaPedir: it.filter(i => !i.estado || i.estado === "pendiente").length,
    faltaRecibir: it.filter(i => i.estado === "pedido" || i.estado === "parcial").length,
  };
}

// { idEntrega: riesgo } para un conjunto de entregas. diasHasta(fecha) lo pasa quien llama (la app y el servidor
// calculan "hoy" distinto: el servidor usa la hora de Argentina).
export function riesgosDeEntregas(entregas, produccion = [], materiales = [], diasHasta) {
  const r = {};
  for (const e of entregas) {
    if (e.archivada || e.estado === "terminado" || !e.fecha) continue;
    const prod = produccion.find(p => p.obra_id === e.id);
    const mat = materiales.find(m => m.obra_id === e.id);
    const riesgo = evaluarRiesgo({
      dias: diasHasta(e.fecha), estado: e.estado,
      produccion: prod ? porcentajeProduccion(prod.stations) : null,
      ...faltantesMateriales(mat?.items),
    });
    if (riesgo) r[e.id] = riesgo;
  }
  return r;
}
