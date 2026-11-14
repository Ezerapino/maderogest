// Ventanas y paneles que se cierran con "atrás" (botón del celular, del navegador o del mouse) y con Escape.
// Cada ventana abierta suma un paso al historial del navegador con la misma dirección; "atrás" cierra la de
// más arriba en vez de salir de la pantalla. Si se cierra con su botón, se quita ese paso del historial.
import { useEffect, useRef } from "react";

const pila = [];        // ventanas abiertas, la última es la de arriba
let popsIgnorados = 0;  // "atrás" que hicimos nosotros al cerrar una ventana con su botón

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    if (popsIgnorados > 0) { popsIgnorados--; return; }
    const arriba = pila.pop();
    if (!arriba) return;
    // Si la ventana no se puede cerrar ahora (por ejemplo, está guardando), devuelve false y queda abierta
    if (arriba.cerrar() === false) { pila.push(arriba); window.history.pushState({ ...(window.history.state || {}), ventana: pila.length }, ""); }
  });
  window.addEventListener("keydown", e => {
    if (e.key !== "Escape" || !pila.length) return;
    e.preventDefault();
    window.history.back();   // pasa por popstate y cierra la de arriba
  });
}

// ¿El paso actual del historial es el de una ventana? (para que navegar() lo reemplace en vez de apilar)
export const historialEnVentana = () => !!window.history.state?.ventana;

// Usar en cada ventana: onClose se llama al apretar "atrás" o Escape (si devuelve false, no se cierra).
// Con activo=false no hace nada.
export function useCerrarConAtras(onClose, activo = true) {
  const ref = useRef(onClose);
  useEffect(() => { ref.current = onClose; });   // siempre la última versión de onClose
  useEffect(() => {
    if (!activo) return;
    const entrada = { cerrar: () => ref.current?.() };
    pila.push(entrada);
    // Si una ventana se cerró y esta se abrió en el mismo momento, se reusa el paso que dejó la anterior
    const reusar = (window.history.state?.ventana || 0) >= pila.length;
    window.history[reusar ? "replaceState" : "pushState"]({ ...(window.history.state || {}), ventana: pila.length }, "");
    return () => {
      const i = pila.indexOf(entrada);
      if (i < 0) return;               // se cerró con "atrás": su paso ya no está
      pila.splice(i, 1);
      ordenarHistorial();              // se cerró con su botón: quitar su paso del historial
    };
  }, [activo]);
}

// Deja el historial con tantos pasos de ventana como ventanas abiertas (se agrupan los cierres del mismo momento)
let ordenando = false;
function ordenarHistorial() {
  if (ordenando) return;
  ordenando = true;
  setTimeout(() => {
    ordenando = false;
    const sobran = (window.history.state?.ventana || 0) - pila.length;
    if (sobran > 0) { popsIgnorados++; window.history.go(-sobran); }
  }, 0);
}

// Lo mismo como componente, para ventanas escritas dentro de otro componente: {abierta && <CerrarConAtras onClose={...} />}
export function CerrarConAtras({ onClose }) {
  useCerrarConAtras(onClose);
  return null;
}
