// Obras Aceptadas: tipos de archivo

// ═══════════════════════════════════════════════════════════════════════════════
// OBRAS ACEPTADAS MODULE
// ═══════════════════════════════════════════════════════════════════════════════
export function getFileIconAceptada(type) {
  if (!type) return "📎";
  if (type.startsWith("image/")) return "🖼️";
  if (type.includes("pdf")) return "📄";
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return "📊";
  return "📎";
}
export function formatFileSizeAceptada(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}
export const IMG_RE_ACEPTADA = /\.(jpe?g|png|gif|webp|bmp)$/i;
export function esImagenAceptada(f) { return (f.type || "").startsWith("image/") || IMG_RE_ACEPTADA.test(f.name || ""); }
