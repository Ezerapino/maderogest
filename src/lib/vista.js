// Vista tarjetas / tabla de cada pestaña
import { useState } from "react";

// Recuerda en este navegador qué vista eligió cada uno para cada pestaña
export function useVista(clave, inicial = "tarjetas") {
  const [vista, setVista] = useState(() => { try { return localStorage.getItem(`vista-${clave}`) || inicial; } catch { return inicial; } });
  const cambiar = v => { setVista(v); try { localStorage.setItem(`vista-${clave}`, v); } catch { /* sin almacenamiento: queda solo en esta visita */ } };
  return [vista, cambiar];
}
