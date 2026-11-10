// Mantenimiento planta: cuándo una tarea está atrasada
import { diasHastaFecha } from "./formato.js";

// Una tarea sin hacer se marca en rojo cuando pasaron más de estos días desde que se pidió
export const DIAS_ALERTA_MANTENIMIENTO = 5;

export function hoyLocal() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}
export const diasDesdeSolicitud = t => -(diasHastaFecha(t.fecha_solicitud) ?? 0);
export const tareaAtrasada = t => !t.realizada && diasDesdeSolicitud(t) > DIAS_ALERTA_MANTENIMIENTO;
