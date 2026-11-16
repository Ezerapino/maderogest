// PDF del informe final de obra (A4), armado en el navegador con jsPDF.
// El mismo archivo sirve de vista previa, de documento firmado (se guarda en la base) y de adjunto del mail.
import { formatDate, LOGO_AIXA } from "./formato.js";

const AZUL = [26, 43, 74], NARANJA = [255, 107, 53], GRIS = [100, 116, 139], GRIS_CLARO = [226, 232, 240], TEXTO = [30, 41, 59], VERDE = [5, 150, 105];
const MARGEN = 16, ANCHO = 210, ALTO = 297, UTIL = ANCHO - MARGEN * 2, PIE = 14;
const esImagen = f => (f?.type || "").startsWith("image/") || /\.(jpe?g|png|gif|webp|heic)$/i.test(f?.name || "");

// Foto achicada para el PDF (lado mayor 1400 px, JPG): así el PDF de una obra con muchas fotos no pasa de unos pocos MB
async function fotoParaPdf(src, ladoMax = 1400, formato = "image/jpeg") {
  try {
    const blob = src.startsWith("data:") ? await (await fetch(src)).blob() : await (await fetch(src, { cache: "no-store" })).blob();
    const img = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
    const ctx = c.getContext("2d");
    if (formato === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    img.close?.();
    return { data: c.toDataURL(formato, 0.74), w: c.width, h: c.height };
  } catch (e) { console.error("No se pudo agregar una foto al PDF:", e); return null; }
}

const fechaHora = iso => new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " h";

/**
 * form: los datos del informe · pendientes: [{texto, resuelto}] · archivos: [{name,type,url|b64}]
 * firma (opcional): {nombre, cargo, fecha, imagenData (dataURL) | imagen.url, tomada_por}
 * Devuelve un Blob application/pdf.
 */
export async function armarPdfInforme({ form, pendientes = [], archivos = [], firma = null, onPaso }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  let y = 0;

  const nuevaPagina = () => { doc.addPage(); y = MARGEN; };
  const lugar = alto => { if (y + alto > ALTO - MARGEN - PIE) nuevaPagina(); };
  const color = c => doc.setTextColor(...c);

  // ── Encabezado
  doc.setFillColor(...AZUL); doc.rect(0, 0, ANCHO, 38, "F");
  doc.setFillColor(...NARANJA); doc.rect(0, 38, ANCHO, 1.4, "F");
  const logo = await fotoParaPdf(LOGO_AIXA, 400, "image/png");
  if (logo) { const h = 16, w = Math.min(40, h * logo.w / logo.h); doc.setFillColor(255, 255, 255); doc.roundedRect(MARGEN - 2, 11 - 2, w + 4, h + 4, 1.5, 1.5, "F"); doc.addImage(logo.data, "PNG", MARGEN, 11, w, h); }
  const xt = logo ? MARGEN + 50 : MARGEN;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); color([203, 213, 225]);
  doc.text("OBRAS GRUPO AIXA S.A.", xt, 15);
  doc.setFont("helvetica", "bold"); doc.setFontSize(19); color([255, 255, 255]);
  doc.text("Informe final de obra", xt, 24);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  doc.text(doc.splitTextToSize(form.nombreObra || "", ANCHO - xt - MARGEN)[0] || "", xt, 31);
  y = 50;

  // ── Utilidades de contenido
  // "despues": lo que tiene que entrar debajo del título en la misma página (para que no quede solo al pie)
  const titulo = (t, despues = 12) => {
    lugar(9 + despues);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); color(AZUL);
    doc.text(t, MARGEN, y);
    doc.setDrawColor(...NARANJA); doc.setLineWidth(0.7); doc.line(MARGEN, y + 2, MARGEN + doc.getTextWidth(t), y + 2);
    y += 9;
  };
  const parrafo = (texto, { tam = 10, ancho = UTIL, x = MARGEN, c = TEXTO } = {}) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(tam); color(c);
    const alto = tam * 0.42;
    for (const linea of doc.splitTextToSize(String(texto), ancho)) { lugar(alto + 1); doc.text(linea, x, y); y += alto; }
  };
  // Pares etiqueta / valor en dos columnas
  const grilla = pares => {
    const llenos = pares.filter(([, v]) => v);
    const colW = (UTIL - 8) / 2;
    for (let i = 0; i < llenos.length; i += 2) {
      const fila = llenos.slice(i, i + 2).map(([l, v]) => ({ l, lineas: (doc.setFontSize(10), doc.splitTextToSize(String(v), colW)) }));
      const alto = 5 + Math.max(...fila.map(f => f.lineas.length)) * 4.3 + 3;
      lugar(alto);
      fila.forEach((f, j) => {
        const x = MARGEN + j * (colW + 8);
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); color(GRIS); doc.text(f.l.toUpperCase(), x, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); color(TEXTO); doc.text(f.lineas, x, y + 4.8);
      });
      y += alto;
    }
    y += 2;
  };

  titulo("Información general");
  grilla([["Obra", form.nombreObra], ["Cliente", form.cliente], ["Dirección", form.direccion], ["Fecha del informe", form.fecha ? formatDate(form.fecha) : ""],
    ["Etapa", form.etapa], ["Estudio / arquitecto a cargo", form.estudioArquitecto]]);

  if (form.responsableEstudio || form.responsableEmpresa || form.operarios) {
    titulo("Personal responsable");
    grilla([["Responsable (estudio / arquitecto)", form.responsableEstudio], ["Responsable (Grupo Aixa)", form.responsableEmpresa], ["Operarios", form.operarios]]);
  }
  if (form.informe) { titulo("Trabajo realizado"); parrafo(form.informe); y += 5; }

  const abiertos = pendientes.filter(p => !p.resuelto).length;
  titulo(`Pendientes a resolver${pendientes.length ? ` (${abiertos ? `${abiertos} abierto${abiertos === 1 ? "" : "s"}` : "todos resueltos"})` : ""}`);
  if (!pendientes.length) { parrafo("Sin pendientes: la obra se entrega completa.", { c: VERDE }); y += 4; }
  for (const p of pendientes) {
    doc.setFontSize(10);
    const lineas = doc.splitTextToSize(p.texto, UTIL - 9);
    lugar(lineas.length * 4.3 + 2.5);
    doc.setDrawColor(...(p.resuelto ? VERDE : GRIS)); doc.setLineWidth(0.4); doc.rect(MARGEN, y - 3.3, 3.8, 3.8);
    if (p.resuelto) { doc.setDrawColor(...VERDE); doc.setLineWidth(0.6); doc.line(MARGEN + 0.8, y - 1.5, MARGEN + 1.7, y - 0.4); doc.line(MARGEN + 1.7, y - 0.4, MARGEN + 3.2, y - 2.8); }
    doc.setFont("helvetica", "normal"); color(TEXTO); doc.text(lineas, MARGEN + 7, y);
    y += lineas.length * 4.3 + 2.5;
  }
  if (pendientes.length) y += 3;

  if (form.informacionDestacada) { titulo("Información a destacar"); parrafo(form.informacionDestacada); y += 5; }

  // ── Fotos: dos por fila
  const fotos = archivos.filter(esImagen);
  if (fotos.length) {
    titulo(`Fotos (${fotos.length})`, 76);
    const colW = (UTIL - 6) / 2, altoMax = 70;
    let fila = [];
    const volcarFila = () => {
      if (!fila.length) return;
      const alto = Math.max(...fila.map(f => f.h)) + 6;
      lugar(alto);
      fila.forEach((f, j) => {
        const x = MARGEN + j * (colW + 6) + (colW - f.w) / 2;
        doc.addImage(f.data, "JPEG", x, y, f.w, f.h);
        doc.setDrawColor(...GRIS_CLARO); doc.setLineWidth(0.2); doc.rect(x, y, f.w, f.h);
      });
      y += alto; fila = [];
    };
    for (let i = 0; i < fotos.length; i++) {
      onPaso?.(`Agregando fotos al PDF (${i + 1} de ${fotos.length})…`);
      const img = await fotoParaPdf(fotos[i].b64 || fotos[i].url);
      if (!img) continue;
      let w = colW, h = w * img.h / img.w;
      if (h > altoMax) { h = altoMax; w = h * img.w / img.h; }
      fila.push({ data: img.data, w, h });
      if (fila.length === 2) volcarFila();
    }
    volcarFila();
    y += 2;
  }
  const otros = archivos.filter(f => !esImagen(f) && f.url);
  if (otros.length) {
    titulo(`Otros archivos (${otros.length})`);
    for (const f of otros) { lugar(6); doc.setFont("helvetica", "normal"); doc.setFontSize(10); color([37, 99, 235]); doc.textWithLink(f.name, MARGEN, y, { url: f.url }); y += 5.5; }
    y += 3;
  }

  // ── Conformidad
  titulo("Conformidad", 62);
  parrafo("Quien firma recibió los trabajos descriptos en este informe, con los pendientes indicados arriba.", { tam: 9.5, c: GRIS });
  y += 4;
  const cajaY = y, cajaH = 46;
  doc.setDrawColor(...GRIS_CLARO); doc.setLineWidth(0.3); doc.roundedRect(MARGEN, cajaY, UTIL, cajaH, 2, 2);
  if (firma) {
    const img = firma.imagenData ? await fotoParaPdf(firma.imagenData, 900, "image/png") : firma.imagen?.url ? await fotoParaPdf(firma.imagen.url, 900, "image/png") : null;
    if (img) { const h = 28, w = Math.min(80, h * img.w / img.h); doc.addImage(img.data, "PNG", MARGEN + 6, cajaY + 4, w, h); }
    doc.setDrawColor(...GRIS); doc.line(MARGEN + 6, cajaY + 34, MARGEN + 90, cajaY + 34);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); color(TEXTO); doc.text(firma.nombre || "", MARGEN + 6, cajaY + 39);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); color(GRIS); doc.text(firma.cargo || "", MARGEN + 6, cajaY + 43.5);
    const xd = MARGEN + 100;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text("FIRMADO EL", xd, cajaY + 10);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); color(TEXTO); doc.text(fechaHora(firma.fecha), xd, cajaY + 15);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); color(GRIS); doc.text("REGISTRADO POR", xd, cajaY + 24);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); color(TEXTO); doc.text(doc.splitTextToSize(`${firma.tomada_por || ""} (Grupo Aixa) en MaderoGest`, UTIL - 104), xd, cajaY + 29);
  } else {
    doc.setFont("helvetica", "italic"); doc.setFontSize(10); color(GRIS);
    doc.text("Vista previa: el informe todavía no está firmado.", ANCHO / 2, cajaY + cajaH / 2, { align: "center" });
  }
  y = cajaY + cajaH + 4;

  // ── Pie en todas las páginas
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GRIS_CLARO); doc.setLineWidth(0.3); doc.line(MARGEN, ALTO - 12, ANCHO - MARGEN, ALTO - 12);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); color(GRIS);
    doc.text(`Informe final · ${form.nombreObra || ""}`.slice(0, 90), MARGEN, ALTO - 7.5);
    doc.text(`Página ${i} de ${total}`, ANCHO - MARGEN, ALTO - 7.5, { align: "right" });
  }
  return doc.output("blob");
}

// Nombre de archivo legible: "Informe final - Casa Pérez - 16-11-2026.pdf"
export function nombrePdfInforme(form, firmado) {
  const limpio = String(form.nombreObra || "obra").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60);
  const f = (form.fecha ? formatDate(form.fecha) : "").replace(/\//g, "-");
  return `Informe final - ${limpio}${f ? ` - ${f}` : ""}${firmado ? " (firmado)" : ""}.pdf`;
}
