// Direcciones: cada pantalla tiene su link; "atrás" y recargar funcionan
import { useState, useEffect } from "react";

// ─── DIRECCIONES (cada pantalla tiene su link; "atrás" y recargar funcionan) ──
export const RUTAS_PESTANAS = { entregas: "entregas", aceptadas: "aceptadas", avance: "produccion", avance_obra: "avance-obra", cobros: "cobros", materiales: "materiales", historial: "historial" };
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
  window.history[reemplazar ? "replaceState" : "pushState"](null, "", ruta);
  window.dispatchEvent(new Event("cambio-de-ruta"));
}
export function useRuta() {
  const [ruta, setRuta] = useState(leerRuta);
  useEffect(() => {
    const actualizar = () => { setRuta(leerRuta()); window.scrollTo(0, 0); };
    window.addEventListener("popstate", actualizar);
    window.addEventListener("cambio-de-ruta", actualizar);
    return () => { window.removeEventListener("popstate", actualizar); window.removeEventListener("cambio-de-ruta", actualizar); };
  }, []);
  return ruta;
}
