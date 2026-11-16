// Ficha técnica de desarrollo de mobiliario: campos, opciones y PDF (A4, con el mismo orden que la ficha en papel).
import { formatDate, LOGO_AIXA, uid } from "./formato.js";

export const COMPONENTES = ["Estructura interna (cuerpo)", "Frentes (puertas / cajones)", "Laterales vistos", "Tapacantos (bordes)", "Fondos", "Mesada / tapa superior"];
export const ESPESORES_TAPACANTO = ["0.4 mm", "1 mm", "2 mm"];
export const HERRAJES = [
  { key: "correderas", label: "Tipo de correderas", opciones: ["Económicas / blancas", "Telescópicas estándar", "Cierre suave", "Ocultas", "Push to open", "Laterales box"] },
  { key: "bisagras", label: "Tipo de bisagras", opciones: ["Estándar / resorte", "Cierre suave (pistón)", "Apertura 165°", "Push / expulsión", "N/A corredizo"] },
  { key: "tiradores", label: "Tiradores / manijas", opciones: ["Perfil Gola", "Perfil J / integrado", "Tirador aplicado", "Uñero calado", "Sistema push"] },
];
export const LED = { key: "led", label: "Iluminación LED", opciones: ["No incluye", "LED cálido", "LED frío"] };
export const CARGOS_FICHA = ["Cliente", "Arquitecto de la obra", "Encargado de obra"];
export const TEXTO_CONFORMIDAD = "Con la firma de este documento, el cliente valida y aprueba expresamente la totalidad de las especificaciones detalladas en esta ficha. Se deja constancia de que los tonos de catálogo y muestras físicas pueden presentar variaciones menores según el tipo y la incidencia de luz real en el ambiente final.";
export const NOTA_MEDIDAS = "Todas las medidas finales se rectificarán estrictamente en obra por el equipo técnico antes de la fabricación.";

export const materialesVacios = () => COMPONENTES.map(componente => ({ id: uid(), componente, marca: "", color: "", espesor: "" }));

// Ficha nueva: los datos del cliente se copian de la última ficha de la obra (si hay)
export function fichaVacia({ obra, previa, sesion, alcance, ambiente }) {
  const p = previa?.datos || {};
  return {
    fecha: new Date().toISOString().slice(0, 10),
    cliente: p.cliente || "", telefono: p.telefono || "", correo: p.correo || "", direccion: p.direccion || "",
    direccionObra: p.direccionObra || obra?.direccion || "",
    ambiente: alcance === "obra" ? "Toda la obra" : (ambiente || ""), tipoMueble: "",
    dimensiones: { ancho: "", alto: "", profundidad: "", zocalo: "" },
    materiales: materialesVacios(),
    correderas: [], correderasOtro: "", bisagras: [], bisagrasOtro: "", tiradores: [], tiradoresOtro: "", led: [], ledOtro: "",
    herrajeExtra: "", notas: "", responsable: sesion?.nombre || "",
  };
}

export const numeroFicha = f => `${String(f?.numero ?? "").padStart(4, "0")}${f?.revision > 1 ? ` · Rev. ${f.revision}` : ""}`;
export const tituloFicha = f => f?.datos?.ambiente || (f?.alcance === "obra" ? "Toda la obra" : "Sin nombre");
export function nombrePdfFicha(ficha, obraNombre, firmado) {
  const limpio = s => String(s || "").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 50);
  return `Ficha tecnica ${numeroFicha(ficha).replace(" · ", " ")} - ${limpio(obraNombre)} - ${limpio(tituloFicha(ficha))}${firmado ? " (firmada)" : ""}.pdf`;
}
// Qué quedó marcado en una fila de opciones (con "Especificar")
export const elegidos = (d, key) => [...(d[key] || []), d[`${key}Otro`]?.trim()].filter(Boolean);

// ─── PDF ─────────────────────────────────────────────────────────────────────
const NEGRO = [17, 24, 39], GRIS = [100, 116, 139], LINEA = [203, 213, 225], TEXTO = [30, 41, 59], FONDO = [248, 250, 252], NARANJA = [255, 107, 53];
const M = 12, ANCHO = 210, ALTO = 297, UTIL = ANCHO - M * 2, PIE = 12;
const esImagen = f => (f?.type || "").startsWith("image/") || /\.(jpe?g|png|gif|webp|heic)$/i.test(f?.name || "");
const fechaHora = iso => new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " h";

async function imagenParaPdf(src, ladoMax = 1400, formato = "image/jpeg") {
  try {
    const blob = await (await fetch(src, src.startsWith("data:") ? undefined : { cache: "no-store" })).blob();
    const img = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const k = Math.min(1, ladoMax / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const ctx = c.getContext("2d");
    if (formato === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0, c.width, c.height); img.close?.();
    return { data: c.toDataURL(formato, 0.74), w: c.width, h: c.height };
  } catch (e) { console.error("No se pudo agregar una imagen al PDF:", e); return null; }
}

/** ficha: la fila (numero, revision, datos, archivos) · obraNombre · firma opcional {nombre, cargo, fecha, imagenData | imagen.url, tomada_por} */
export async function armarPdfFicha({ ficha, obraNombre, firma = null, onPaso }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const d = ficha.datos || {};
  let y = 0;
  const color = c => doc.setTextColor(...c);
  const fuente = (estilo, tam) => { doc.setFont("helvetica", estilo); doc.setFontSize(tam); };
  const lugar = alto => { if (y + alto > ALTO - M - PIE) { doc.addPage(); y = M; } };
  const lineas = (t, ancho, tam = 9) => { fuente("normal", tam); return doc.splitTextToSize(String(t || ""), ancho); };

  // ── Encabezado (barra negra como la ficha en papel)
  doc.setFillColor(...NEGRO); doc.rect(0, 0, ANCHO, 26, "F");
  doc.setFillColor(...NARANJA); doc.rect(0, 26, ANCHO, 1.2, "F");
  const logo = await imagenParaPdf(LOGO_AIXA, 400, "image/png");
  if (logo) { const h = 13, w = Math.min(34, h * logo.w / logo.h); doc.setFillColor(255, 255, 255); doc.roundedRect(M - 1.5, 6.5 - 1.5, w + 3, h + 3, 1.2, 1.2, "F"); doc.addImage(logo.data, "PNG", M, 6.5, w, h); }
  fuente("bold", 13.5); color([255, 255, 255]); doc.text("FICHA TÉCNICA DE DESARROLLO DE MOBILIARIO", ANCHO / 2 + 12, 12.5, { align: "center" });
  fuente("italic", 8.5); color([203, 213, 225]); doc.text("Especificaciones de Diseño, Materiales y Componentes Estructurales", ANCHO / 2 + 12, 18.5, { align: "center" });
  y = 35;
  fuente("bold", 9.5); color(NEGRO); doc.text("FICHA N°:", M, y);
  fuente("normal", 9.5); doc.text(numeroFicha(ficha), M + 19, y);
  fuente("bold", 9.5); doc.text("FECHA:", ANCHO - M - 33, y);
  fuente("normal", 9.5); doc.text(d.fecha ? formatDate(d.fecha) : "", ANCHO - M, y, { align: "right" });
  y += 5.5;
  fuente("bold", 9.5); doc.text("OBRA:", M, y);
  fuente("normal", 9.5); doc.text(lineas(obraNombre, UTIL - 19, 9.5)[0] || "", M + 19, y);
  y += 5;

  // ── Utilidades: barra de sección y filas tipo tabla
  const barra = (t, despues = 14) => {
    lugar(7 + despues);
    doc.setFillColor(...NEGRO); doc.rect(M, y, UTIL, 6.2, "F");
    fuente("bold", 9); color([255, 255, 255]); doc.text(t, M + 2.5, y + 4.3);
    y += 6.2;
  };
  const celda = (x, w, h, { fondo } = {}) => { if (fondo) { doc.setFillColor(...fondo); doc.rect(x, y, w, h, "F"); } doc.setDrawColor(...LINEA); doc.setLineWidth(0.2); doc.rect(x, y, w, h); };
  // Fila con pares [etiqueta, valor] en columnas iguales
  const filaPares = (pares, anchoEtq) => {
    const colW = UTIL / pares.length, vw = colW - anchoEtq - 3;
    const ls = pares.map(([, v]) => lineas(v, vw));
    const le = pares.map(([e]) => lineas(e, anchoEtq - 3, 8.5));
    const h = Math.max(6.4, ...ls.map(l => l.length * 3.8 + 2.6), ...le.map(l => l.length * 3.5 + 2.8));
    lugar(h);
    pares.forEach((_, i) => {
      const x = M + i * colW;
      celda(x, anchoEtq, h, { fondo: FONDO }); celda(x + anchoEtq, colW - anchoEtq, h);
      fuente("bold", 8.5); color(NEGRO); doc.text(le[i], x + 1.8, y + 4.2, { lineHeightFactor: 1.18 });
      fuente("normal", 9); color(TEXTO); doc.text(ls[i], x + anchoEtq + 1.8, y + 4.2);
    });
    y += h;
  };
  // Casillero marcado o no
  const casilla = (x, yy, marcado) => {
    doc.setDrawColor(...(marcado ? NEGRO : GRIS)); doc.setLineWidth(0.3);
    if (marcado) { doc.setFillColor(...NEGRO); doc.rect(x, yy - 2.7, 3, 3, "FD"); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.5); doc.line(x + 0.6, yy - 1.3, x + 1.3, yy - 0.5); doc.line(x + 1.3, yy - 0.5, x + 2.5, yy - 2.1); }
    else doc.rect(x, yy - 2.7, 3, 3);
  };
  // Fila de opciones: etiqueta + casilleros (+ "Especificar: ...")
  const filaOpciones = (etq, opciones, marcadas, otro, anchoEtq = 46) => {
    const x0 = M + anchoEtq + 2, xmax = M + UTIL - 2;
    const items = [...opciones.map(o => ({ t: o, m: marcadas.includes(o) })), { t: `Especificar: ${otro || ""}`, m: !!otro, otro: true }];
    // se calcula el alto acomodando las opciones en renglones
    fuente("normal", 8.5);
    const pos = []; let x = x0, r = 0;
    for (const it of items) {
      const w = 4.2 + doc.getTextWidth(it.t) + 4;
      if (x + w > xmax && x > x0) { x = x0; r++; }
      pos.push({ ...it, x, r }); x += w;
    }
    const h = Math.max(6.4, (r + 1) * 4.6 + 2);
    lugar(h);
    celda(M, anchoEtq, h, { fondo: FONDO }); celda(M + anchoEtq, UTIL - anchoEtq, h);
    fuente("bold", 8.5); color(NEGRO); doc.text(lineas(etq, anchoEtq - 3, 8.5), M + 1.8, y + 4.2);
    for (const p of pos) {
      const yy = y + 4.4 + p.r * 4.6;
      casilla(p.x, yy, p.m);
      fuente(p.m ? "bold" : "normal", 8.5); color(p.m ? NEGRO : GRIS); doc.text(p.t, p.x + 4.2, yy);
    }
    y += h;
  };

  // 1. Cliente y proyecto
  barra("1. INFORMACIÓN DEL CLIENTE Y PROYECTO");
  filaPares([["Cliente:", d.cliente], ["Ambiente / Espacio:", d.ambiente]], 30);
  filaPares([["Teléfono:", d.telefono], ["Tipo de mueble:", d.tipoMueble]], 30);
  filaPares([["Correo:", d.correo], ["Dirección de obra:", d.direccionObra]], 30);
  filaPares([["Dirección:", d.direccion], ["Responsable:", d.responsable]], 30);
  y += 3;

  // 2. Dimensiones
  const dim = d.dimensiones || {};
  const mm = v => (String(v || "").trim() ? `${String(v).trim()}${/\d$/.test(String(v).trim()) ? " mm" : ""}` : "");
  barra("2. DIMENSIONES PRELIMINARES DE REFERENCIA (mm)");
  filaPares([["Ancho máximo:", mm(dim.ancho)], ["Alto máximo:", mm(dim.alto)], ["Profundidad total:", mm(dim.profundidad)], ["Zócalo / retiro:", mm(dim.zocalo)]], 26);
  y += 3.5; fuente("italic", 7.5); color(GRIS); doc.text(`* Nota: ${NOTA_MEDIDAS}`, M, y); y += 4;

  // 3. Placas y materiales
  barra("3. DEFINICIÓN DE PLACAS, MATERIALES Y ACABADOS", 20);
  const cols = [{ t: "Componente del mueble", w: 52 }, { t: "Marca / Línea / Catálogo", w: 60 }, { t: "Color / Código fijo", w: 46 }, { t: "Espesor / Tipo", w: UTIL - 158 }];
  const filaTabla = (valores, { encabezado } = {}) => {
    const ls = valores.map((v, i) => lineas(v, cols[i].w - 3.6, encabezado ? 8.5 : 9));
    const h = Math.max(encabezado ? 6.2 : 6.8, ...ls.map(l => l.length * 3.8 + 2.8));
    lugar(h);
    let x = M;
    cols.forEach((c, i) => {
      celda(x, c.w, h, { fondo: encabezado || i === 0 ? FONDO : null });
      fuente(encabezado || i === 0 ? "bold" : "normal", encabezado ? 8.5 : 9); color(encabezado || i === 0 ? NEGRO : TEXTO);
      doc.text(ls[i], encabezado ? x + c.w / 2 : x + 1.8, y + 4.3, encabezado ? { align: "center" } : undefined);
      x += c.w;
    });
    y += h;
  };
  filaTabla(cols.map(c => c.t), { encabezado: true });
  for (const m of d.materiales || []) filaTabla([m.componente, m.marca, m.color, m.espesor]);
  y += 5;

  // 4. Herrajes
  barra("4. SISTEMAS DE APERTURA Y HERRAJES");
  for (const h of HERRAJES) filaOpciones(`${h.label}:`, h.opciones, d[h.key] || [], d[`${h.key}Otro`]?.trim());
  y += 5;

  // 5. LED y herrajes extra
  barra("5. ILUMINACIÓN LED Y HERRAJES EXTRA");
  filaOpciones(`${LED.label}:`, LED.opciones, d.led || [], d.ledOtro?.trim());
  {
    const ls = lineas(d.herrajeExtra || "", UTIL - 50);
    const h = Math.max(10, ls.length * 3.8 + 3);
    lugar(h);
    celda(M, 46, h, { fondo: FONDO }); celda(M + 46, UTIL - 46, h);
    fuente("bold", 8.5); color(NEGRO); doc.text(["Herraje extra /", "Detalle a tener en cuenta:"], M + 1.8, y + 4.2);
    fuente("normal", 9); color(TEXTO); doc.text(ls, M + 48, y + 4.2);
    y += h;
  }
  y += 6;

  // Notas complementarias
  {
    const ls = lineas(d.notas || "", UTIL - 5);
    lugar(16);
    fuente("bold", 9); color(NEGRO); doc.text("NOTAS COMPLEMENTARIAS Y ESPECIFICACIONES DE INTEGRACIÓN", M, y); y += 2;
    const h = Math.max(18, ls.length * 3.8 + 9);
    // si es muy largo se reparte en varias páginas, renglón por renglón
    if (y + h > ALTO - M - PIE) {
      y += 2;
      fuente("italic", 7.5); color(GRIS); doc.text("(Electrodomésticos empotrados, anafe, campana, cañerías, mochetas o vigas a respetar)", M, y + 1); y += 5;
      for (const l of ls) { lugar(4.5); fuente("normal", 9); color(TEXTO); doc.text(l, M + 2, y); y += 3.8; }
    } else {
      celda(M, UTIL, h);
      fuente("italic", 7.5); color(GRIS); doc.text("(Electrodomésticos empotrados, anafe, campana, cañerías, mochetas o vigas a respetar en el diseño final)", M + 2, y + 3.8);
      fuente("normal", 9); color(TEXTO); doc.text(ls, M + 2, y + 8.5);
      y += h;
    }
  }
  y += 6;

  // Conformidad y firmas (en la primera página cuando entra, como la ficha en papel)
  const fotos = (ficha.archivos || []).filter(esImagen);
  const ls = lineas(`CONFORMIDAD TÉCNICA Y REVISIÓN DE DISEÑO: ${TEXTO_CONFORMIDAD}${fotos.length ? ` Forman parte de esta ficha las ${fotos.length === 1 ? "foto" : `${fotos.length} fotos`} del anexo.` : ""}`, UTIL, 8);
  lugar(ls.length * 3.4 + 50);
  fuente("italic", 8); color(GRIS); doc.text(ls, M, y); y += ls.length * 3.4 + 4;
  const yf = y, colF = (UTIL - 16) / 2, xDer = M + colF + 16;
  if (firma) {
    const img = firma.imagenData ? await imagenParaPdf(firma.imagenData, 900, "image/png") : firma.imagen?.url ? await imagenParaPdf(firma.imagen.url, 900, "image/png") : null;
    if (img) { const h = 22, w = Math.min(colF - 10, h * img.w / img.h); doc.addImage(img.data, "PNG", M + (colF - w) / 2, yf, w, h); }
  } else {
    fuente("italic", 9); color(GRIS); doc.text("Vista previa: todavía sin firmar", M + colF / 2, yf + 14, { align: "center" });
  }
  fuente("normal", 10); color(TEXTO); doc.text(lineas(d.responsable || "", colF, 10)[0] || "", xDer + colF / 2, yf + 20, { align: "center" });
  doc.setDrawColor(...NEGRO); doc.setLineWidth(0.3);
  doc.line(M, yf + 24, M + colF, yf + 24); doc.line(xDer, yf + 24, xDer + colF, yf + 24);
  fuente("bold", 8.5); color(NEGRO);
  doc.text("FIRMA Y ACLARACIÓN DEL CLIENTE", M + colF / 2, yf + 28.5, { align: "center" });
  doc.text("RESPONSABLE DE PROYECTO", xDer + colF / 2, yf + 28.5, { align: "center" });
  fuente("italic", 7.5); color(GRIS);
  doc.text("Aceptación de Diseño y Materiales", M + colF / 2, yf + 32.5, { align: "center" });
  doc.text("Gestión y Relevamiento Técnico · Grupo Aixa", xDer + colF / 2, yf + 32.5, { align: "center" });
  if (firma) {
    fuente("bold", 9.5); color(TEXTO); doc.text(`${firma.nombre || ""}${firma.cargo ? ` (${firma.cargo})` : ""}`, M + colF / 2, yf + 37.5, { align: "center" });
    fuente("normal", 8); color(GRIS); doc.text(`Firmado el ${fechaHora(firma.fecha)} en MaderoGest`, M + colF / 2, yf + 41.5, { align: "center" });
  }
  y = yf + 48;

  // Anexo: fotos, muestras y croquis, dos por fila
  if (fotos.length) {
    barra(`ANEXO: FOTOS, MUESTRAS Y CROQUIS (${fotos.length})`, 70);
    y += 3;
    const colW = (UTIL - 6) / 2, altoMax = 68;
    let fila = [];
    const volcar = () => {
      if (!fila.length) return;
      const h = Math.max(...fila.map(f => f.h)) + 5;
      lugar(h);
      fila.forEach((f, j) => { const x = M + j * (colW + 6) + (colW - f.w) / 2; doc.addImage(f.data, "JPEG", x, y, f.w, f.h); doc.setDrawColor(...LINEA); doc.setLineWidth(0.2); doc.rect(x, y, f.w, f.h); });
      y += h; fila = [];
    };
    for (let i = 0; i < fotos.length; i++) {
      onPaso?.(`Agregando fotos al PDF (${i + 1} de ${fotos.length})…`);
      const img = await imagenParaPdf(fotos[i].b64 || fotos[i].url);
      if (!img) continue;
      let w = colW, h = w * img.h / img.w;
      if (h > altoMax) { h = altoMax; w = h * img.w / img.h; }
      fila.push({ data: img.data, w, h });
      if (fila.length === 2) volcar();
    }
    volcar();
  }

  // Pie en todas las páginas
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINEA); doc.setLineWidth(0.3); doc.line(M, ALTO - 10, ANCHO - M, ALTO - 10);
    fuente("normal", 7.5); color(GRIS);
    doc.text(`Ficha técnica N° ${numeroFicha(ficha)} · ${obraNombre || ""} · ${tituloFicha(ficha)}`.slice(0, 110), M, ALTO - 6);
    doc.text(`Página ${i} de ${total}`, ANCHO - M, ALTO - 6, { align: "right" });
  }
  return doc.output("blob");
}
