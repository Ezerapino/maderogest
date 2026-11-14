// Avisos y confirmaciones (reemplazan alert y confirm del navegador)
import { uid } from "./formato.js";

// ─── AVISOS Y CONFIRMACIONES (reemplazan alert y confirm del navegador) ──────
// avisar() muestra un aviso abajo que se cierra solo; con `deshacer` suma un botón para revertir.
// confirmar() abre una ventana propia y devuelve una promesa con true/false.
let mostrarAviso = null;
let pedirConfirmacion = null;
export function avisar(texto, { tipo = "info", deshacer } = {}) {
  if (mostrarAviso) mostrarAviso({ id: uid(), texto, tipo, deshacer });
  else window.alert(texto);
}
export function confirmar(texto, { boton = "Eliminar", peligro = true } = {}) {
  if (!pedirConfirmacion) return Promise.resolve(window.confirm(texto));
  return new Promise(resolver => pedirConfirmacion({ texto, boton, peligro, resolver }));
}
// elegir() pregunta entre varias opciones [{ valor, texto }] y devuelve el valor elegido, o null si se cancela
export function elegir(texto, opciones) {
  if (!pedirConfirmacion) return Promise.resolve(null);
  return new Promise(resolver => pedirConfirmacion({ texto, opciones, resolver: v => resolver(v === false ? null : v) }));
}
// El componente Avisos se anota acá al montarse (y se borra al desmontarse)
export function registrarAvisos(mostrar, pedir) { mostrarAviso = mostrar; pedirConfirmacion = pedir; }
