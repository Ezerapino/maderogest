// Obras Aceptadas: tipos de archivo

// ═══════════════════════════════════════════════════════════════════════════════
// OBRAS ACEPTADAS MODULE
// ═══════════════════════════════════════════════════════════════════════════════
export function getFileIconAceptada(type) {
  // Nombre del ícono (components/Icono.jsx) según el tipo de archivo
  if (!type) return "clip";
  if (type.startsWith("image/")) return "imagen";
  if (type.includes("pdf")) return "documento";
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return "grafico";
  return "clip";
}
export function formatFileSizeAceptada(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}
export const IMG_RE_ACEPTADA = /\.(jpe?g|png|gif|webp|bmp)$/i;
export function esImagenAceptada(f) { return (f.type || "").startsWith("image/") || IMG_RE_ACEPTADA.test(f.name || ""); }
