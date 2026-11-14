// Mantenimiento planta: cuándo una tarea está atrasada
import { diasHastaFecha, hoyLocal } from "./formato.js";

// Una tarea sin hacer se marca en rojo cuando pasaron más de estos días desde que se pidió
export const DIAS_ALERTA_MANTENIMIENTO = 5;

export { hoyLocal };
export const diasDesdeSolicitud = t => -(diasHastaFecha(t.fecha_solicitud) ?? 0);
export const tareaAtrasada = t => !t.realizada && diasDesdeSolicitud(t) > DIAS_ALERTA_MANTENIMIENTO;
// Quiénes ven la pestaña (la base aplica la misma regla, ver supabase/07-mantenimiento-roles.sql)
export const puedeVerMantenimiento = rol => rol === "admin" || rol === "operario";
