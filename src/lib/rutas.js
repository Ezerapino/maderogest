// Direcciones: cada pantalla tiene su link; "atrás" y recargar funcionan
import { useState, useEffect } from "react";
import { historialEnVentana } from "./atras.js";

// ─── DIRECCIONES (cada pantalla tiene su link; "atrás" y recargar funcionan) ──
export const RUTAS_PESTANAS = { entregas: "entregas", aceptadas: "aceptadas", avance: "produccion", avance_obra: "avance-obra", cobros: "cobros", materiales: "materiales", mantenimiento: "mantenimiento", historial: "historial" };
const PESTANAS_RUTAS = Object.fromEntries(Object.entries(RUTAS_PESTANAS).map(([t, r]) => [r, t]));
// Link a la ficha: /obra/<id>/<nombre-legible> (el nombre es solo para que el link se entienda)
export const linkFicha = p => `/obra/${encodeURIComponent(p.id)}/${(p.nombre || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

function leerRuta() {
  const [primera = "", segunda] = window.location.pathname.split("/").filter(Boolean);
  if (primera === "obra" && segunda) return { pestana: "entregas", fichaId: decodeURIComponent(segunda) };
  return { pestana: PESTANAS_RUTAS[primera] || null, fichaId: null };
}
export function navegar(ruta, { reemplazar = false } = {}) {
  if (window.location.pathname === ruta) return;
  // Si hay una ventana abierta, su paso del historial se reemplaza (así "atrás" no vuelve a una ventana ya cerrada)
  // "desde" recuerda de qué pantalla se vino, para que "Volver" use el historial en vez de apilar otro paso
  window.history[reemplazar || historialEnVentana() ? "replaceState" : "pushState"]({ desde: window.location.pathname }, "", ruta);
  window.dispatchEvent(new Event("cambio-de-ruta"));
}
// Botón "Volver": si se llegó desde esa pantalla, es lo mismo que "atrás" (y queda donde estaba); si no, va a ella
export function volver(a) {
  if (window.history.state?.desde === a) window.history.back();
  else navegar(a);
}
export function useRuta() {
  const [ruta, setRuta] = useState(leerRuta);
  useEffect(() => {
    let ultima = window.location.pathname;
    const posiciones = {};   // hasta dónde se había bajado en cada pantalla
    const actualizar = e => {
      // Abrir o cerrar una ventana cambia el historial sin cambiar la dirección: ahí no se toca nada
      if (window.location.pathname === ultima) return;
      posiciones[ultima] = window.scrollY;
      ultima = window.location.pathname;
      setRuta(leerRuta());
      // Con "atrás"/"adelante" se vuelve a la misma altura de la lista; a una pantalla nueva se entra desde arriba
      const y = e.type === "popstate" ? posiciones[ultima] || 0 : 0;
      setTimeout(() => window.scrollTo(0, y), 0);
    };
    window.addEventListener("popstate", actualizar);
    window.addEventListener("cambio-de-ruta", actualizar);
    return () => { window.removeEventListener("popstate", actualizar); window.removeEventListener("cambio-de-ruta", actualizar); };
  }, []);
  return ruta;
}
