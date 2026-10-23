// Generador de imágenes para redes sociales y estados de WhatsApp.
// Dibuja en un <canvas> con la identidad del sitio (azul marino, rojo, Archivo / IBM Plex) y devuelve
// los textos listos para pegar. Todo ocurre en el navegador; nada se sube a ningún lado.

import { MESES, cuandoCorto, cuandoLargo, dd, partes, tieneRango } from '/admin/fechas.js';

export const WHATSAPP = 'https://wa.me/522223549353';
export const TELEFONO = '222 354 9353';
export const SITIO = 'hablandocondatos.com';

export const FORMATOS = {
  cuadrado: { w: 1080, h: 1080, segura: [0, 0], nombre: 'Cuadrada', medida: '1080 × 1080', uso: 'Facebook, LinkedIn e Instagram' },
  vertical: { w: 1080, h: 1350, segura: [0, 0], nombre: 'Vertical', medida: '1080 × 1350', uso: 'Instagram y Facebook' },
  // En historias y estados, la app tapa arriba y abajo: dejamos esa franja libre de texto.
  historia: { w: 1080, h: 1920, segura: [250, 250], nombre: 'Historia o estado', medida: '1080 × 1920', uso: 'Estados de WhatsApp e historias' },
};

export const TEMAS = {
  oscuro: { nombre: 'Oscuro', fondo: '#070F22', texto: '#FFFFFF', suave: '#C9D3E6', acento: '#D2321A', azul: '#7FA6FF', linea: 'rgba(255,255,255,0.22)', panel: 'rgba(255,255,255,0.06)' },
  claro: { nombre: 'Claro', fondo: '#F2F3F5', texto: '#070F22', suave: '#4A5878', acento: '#D2321A', azul: '#1747B0', linea: '#C5CEDD', panel: '#FFFFFF' },
};

const DISPLAY = '"Archivo", "Arial Black", Arial, sans-serif';
const TEXTO = '"IBM Plex Sans", Arial, sans-serif';
const MONO = '"IBM Plex Mono", "Courier New", monospace';

/* ───────────── recursos ───────────── */

let fuentesListas = null;
export function cargarFuentes() {
  fuentesListas ??= Promise.race([
    Promise.all([
      document.fonts.load('800 100px Archivo', 'Áéñ0123456789'),
      document.fonts.load('700 100px Archivo', 'Áéñ0123456789'),
      document.fonts.load('600 40px "IBM Plex Sans"', 'Áéñ0123'),
      document.fonts.load('500 30px "IBM Plex Mono"', 'Áéñ0123'),
    ]),
    new Promise((ok) => setTimeout(ok, 3000)),
  ]).catch(() => {});
  return fuentesListas;
}

const imagenes = new Map();
function cargarImagen(src) {
  if (!imagenes.has(src)) {
    imagenes.set(src, new Promise((ok) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ok(null);
      i.src = src;
    }));
  }
  return imagenes.get(src);
}

/* ───────────── utilidades de dibujo ───────────── */

const fuente = (ctx, peso, tam, familia) => { ctx.font = `${peso} ${tam}px ${familia}`; };
const espaciado = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; };
const ancho = (ctx, t) => ctx.measureText(t).width;

function reiniciar(ctx) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  espaciado(ctx, 0);
}

function envolver(ctx, texto, maxW) {
  const lineas = [];
  let actual = '';
  for (const palabra of texto.split(' ')) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (!actual || ancho(ctx, prueba) <= maxW) actual = prueba;
    else { lineas.push(actual); actual = palabra; }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Busca el tamaño de letra más grande con el que el texto cabe en maxLineas. */
function ajustar(ctx, texto, { maxW, maxLineas, max, min, peso, familia, esp = 0 }) {
  for (let t = max; t >= min; t -= 2) {
    fuente(ctx, peso, t, familia);
    espaciado(ctx, esp * t);
    const l = envolver(ctx, texto, maxW);
    if (l.length <= maxLineas && l.every((x) => ancho(ctx, x) <= maxW)) return { tam: t, lineas: l };
  }
  fuente(ctx, peso, min, familia);
  espaciado(ctx, esp * min);
  let l = envolver(ctx, texto, maxW);
  if (l.length > maxLineas) {
    l = l.slice(0, maxLineas);
    l[maxLineas - 1] = `${l[maxLineas - 1].replace(/\s*\S*$/, '')}…`;
  }
  return { tam: min, lineas: l };
}

const caja = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

function hash(texto) {
  let h = 2166136261;
  for (const c of String(texto)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function azar(semilla) {
  let s = semilla | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ───────────── piezas ───────────── */

/** Logo, nombre y, si se pide, la categoría del curso. Devuelve la y donde termina. */
function cabecera(ctx, { W, M, y, tema, logo, etiqueta }) {
  const D = 92;
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(M + D / 2, y + D / 2, D / 2, 0, Math.PI * 2);
  ctx.fill();
  if (logo) {
    ctx.clip();
    const caja_ = D * 1.2;
    const e = Math.min(caja_ / logo.width, caja_ / logo.height);
    ctx.drawImage(logo, M + D / 2 - (logo.width * e) / 2, y + D / 2 - (logo.height * e) / 2, logo.width * e, logo.height * e);
  }
  ctx.restore();
  if (!logo) {
    fuente(ctx, 800, 34, DISPLAY);
    ctx.fillStyle = '#070F22';
    ctx.textAlign = 'center';
    ctx.fillText('HCD', M + D / 2, y + D / 2 + 12);
  }
  reiniciar(ctx);
  fuente(ctx, 700, 38, DISPLAY);
  espaciado(ctx, -0.8);
  ctx.fillStyle = tema.texto;
  ctx.fillText('Hablando con Datos', M + D + 24, y + D / 2 + 13);
  reiniciar(ctx);
  if (etiqueta) {
    fuente(ctx, 500, 24, MONO);
    espaciado(ctx, 1.6);
    const t = etiqueta.toUpperCase();
    const w = ancho(ctx, t) + 44;
    const x = W - M - w;
    caja(ctx, x, y + D / 2 - 27, w, 54, 27);
    ctx.lineWidth = 2;
    ctx.strokeStyle = tema.linea;
    ctx.stroke();
    ctx.fillStyle = tema.suave;
    ctx.fillText(t, x + 22, y + D / 2 + 8);
    reiniciar(ctx);
  }
  return y + D;
}

/** Número del día enorme, con mes y día de la semana al lado. Devuelve la y del borde inferior. */
function bloqueFecha(ctx, { W, M, y, tema, curso, fd }) {
  const a = partes(curso.inicio);
  const rango = tieneRango(curso);
  const b = rango ? partes(curso.fin) : null;
  const dia = rango ? `${dd(a.d)}–${dd(b.d)}` : dd(a.d);
  const mes = (rango && b.m !== a.m ? `${MESES[a.m - 1]} – ${MESES[b.m - 1]}` : MESES[a.m - 1]).toUpperCase();
  const sub = rango ? `${a.diaCorto} a ${b.diaCorto} · ${b.y}` : `${a.dia} · ${a.y}`;
  const maxW = W - 2 * M;

  const medir = (t) => {
    fuente(ctx, 800, t, DISPLAY);
    espaciado(ctx, -0.04 * t);
    const wDia = ancho(ctx, dia);
    const tMes = Math.round(t * 0.25);
    fuente(ctx, 700, tMes, DISPLAY);
    espaciado(ctx, -0.01 * tMes);
    return { wDia, tMes, cabe: wDia + t * 0.1 + ancho(ctx, mes) <= maxW };
  };
  let tam = fd;
  let m = medir(tam);
  while (!m.cabe && tam > 130) {
    tam -= 6;
    m = medir(tam);
  }
  const { wDia, tMes } = m;
  fuente(ctx, 800, tam, DISPLAY);
  espaciado(ctx, -0.04 * tam);
  const alto = ctx.measureText('0').actualBoundingBoxAscent;
  ctx.fillStyle = tema.texto;
  ctx.fillText(dia, M, y + alto);

  const xLado = M + wDia + tam * 0.1;
  fuente(ctx, 700, tMes, DISPLAY);
  espaciado(ctx, -0.01 * tMes);
  ctx.fillStyle = tema.acento;
  ctx.fillText(mes, xLado, y + tMes * 0.78);
  reiniciar(ctx);
  fuente(ctx, 500, Math.max(24, Math.round(tam * 0.085)), MONO);
  espaciado(ctx, 1);
  ctx.fillStyle = tema.suave;
  ctx.fillText(sub, xLado, y + alto);
  reiniciar(ctx);
  return y + alto;
}

/** Pastillas con modalidad, horario y cupo. Devuelve la y donde terminan. */
function pastillas(ctx, { M, y, maxW, tema, curso }) {
  const items = [{ t: curso.modalidad || 'Online en vivo', punto: true }];
  if (curso.horario) items.push({ t: curso.horario });
  items.push({ t: curso.cupo || 'Cupo limitado', resalta: curso.cupo && curso.cupo !== 'Cupo limitado' });
  const h = 60;
  let x = M;
  let fila = y;
  fuente(ctx, 600, 28, TEXTO);
  for (const it of items) {
    const w = ancho(ctx, it.t) + 48 + (it.punto ? 26 : 0);
    if (x + w > M + maxW && x > M) { x = M; fila += h + 14; }
    caja(ctx, x, fila, w, h, h / 2);
    ctx.fillStyle = tema.panel;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = it.resalta ? tema.acento : tema.linea;
    ctx.stroke();
    let tx = x + 24;
    if (it.punto) {
      ctx.fillStyle = tema.acento;
      ctx.beginPath();
      ctx.arc(x + 30, fila + h / 2, 7, 0, Math.PI * 2);
      ctx.fill();
      tx += 26;
    }
    ctx.fillStyle = it.resalta ? tema.acento : tema.texto;
    ctx.fillText(it.t, tx, fila + h / 2 + 10);
    x += w + 14;
  }
  return fila + h;
}

/** Carta de control: puntos dispersos a la izquierda que se estabilizan dentro de los límites. */
function cartaControl(ctx, { x, y, w, h, tema, clave }) {
  const rnd = azar(hash(clave));
  const n = 32;
  const cy = y + h / 2;
  const u = h * 0.2; // 1 σ en píxeles; los límites están a ±2 σ
  ctx.save();
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.strokeStyle = tema.linea;
  for (const dy of [-2 * u, 2 * u]) { ctx.beginPath(); ctx.moveTo(x, cy + dy); ctx.lineTo(x + w, cy + dy); ctx.stroke(); }
  ctx.setLineDash([]);
  ctx.strokeStyle = tema.azul;
  ctx.globalAlpha = 0.45;
  ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.stroke();
  ctx.globalAlpha = 1;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const sigma = 0.3 + 1.7 * Math.exp(-i / 9);
    const v = Math.max(-h / 2 + 12, Math.min(h / 2 - 12, (rnd() + rnd() + rnd() - 1.5) * 2 * sigma * u));
    pts.push({ px: x + 10 + (i * (w - 20)) / (n - 1), py: cy + v, fuera: Math.abs(v) > 2 * u });
  }
  ctx.strokeStyle = tema.texto;
  ctx.globalAlpha = 0.25;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.px, p.py) : ctx.moveTo(p.px, p.py)));
  ctx.stroke();
  ctx.globalAlpha = 1;
  for (const p of pts) {
    ctx.fillStyle = p.fuera ? tema.acento : tema.azul;
    ctx.beginPath();
    ctx.arc(p.px, p.py, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Bloque rojo de llamada a la acción y dirección del sitio. Ocupa 184 px de alto. */
function llamada(ctx, { W, M, y, tema }) {
  const w = W - 2 * M;
  caja(ctx, M, y, w, 132, 22);
  ctx.fillStyle = tema.acento;
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  fuente(ctx, 700, 46, DISPLAY);
  espaciado(ctx, -0.9);
  ctx.fillText('Reserva tu lugar', M + 38, y + 62);
  reiniciar(ctx);
  fuente(ctx, 500, 27, TEXTO);
  ctx.fillText('por WhatsApp', M + 38, y + 100);
  fuente(ctx, 700, 46, DISPLAY);
  espaciado(ctx, -0.9);
  ctx.textAlign = 'right';
  ctx.fillText(TELEFONO, M + w - 38, y + 82);
  reiniciar(ctx);
  fuente(ctx, 500, 28, MONO);
  ctx.fillStyle = tema.suave;
  ctx.fillText(SITIO, M, y + 132 + 46);
  reiniciar(ctx);
}

/* ───────────── composiciones ───────────── */

function componerCurso(ctx, { F, tema, curso, logo }) {
  const { w: W, h: H, segura } = F;
  const M = 76;
  const arriba = M + segura[0];
  const ctaY = H - M - segura[1] - 184;
  const fin = ctaY - 28;

  let y = cabecera(ctx, { W, M, y: arriba, tema, logo, etiqueta: curso.categoria }) + 52;

  // Presupuesto vertical: la fecha y el título se achican hasta que todo cabe.
  const pastillasAlto = 60 + 40;
  const disponible = fin - y - pastillasAlto;
  const maxLineas = H <= 1080 ? 3 : 4;
  let fd = H >= 1900 ? 400 : H >= 1350 ? 330 : 270;
  let titulo;
  for (let paso = 0; paso < 40; paso += 1) {
    titulo = ajustar(ctx, curso.titulo, { maxW: W - 2 * M, maxLineas, max: H <= 1080 ? 82 : 92, min: 50, peso: 700, familia: DISPLAY, esp: -0.02 });
    fuente(ctx, 800, fd, DISPLAY);
    const altoFecha = ctx.measureText('0').actualBoundingBoxAscent + 44;
    const altoTitulo = titulo.lineas.length * titulo.tam * 1.06 + 36;
    if (altoFecha + altoTitulo <= disponible || fd <= 150) break;
    fd -= 10;
  }
  reiniciar(ctx);

  y = bloqueFecha(ctx, { W, M, y, tema, curso, fd }) + 44;

  ctx.fillStyle = tema.linea;
  ctx.fillRect(M, y, W - 2 * M, 2);
  y += 40;

  ctx.fillStyle = tema.texto;
  fuente(ctx, 700, titulo.tam, DISPLAY);
  espaciado(ctx, -0.02 * titulo.tam);
  titulo.lineas.forEach((l, i) => ctx.fillText(l, M, y + titulo.tam * 0.82 + i * titulo.tam * 1.06));
  reiniciar(ctx);
  y += titulo.lineas.length * titulo.tam * 1.06 + 36;

  y = pastillas(ctx, { M, y, maxW: W - 2 * M, tema, curso }) + 40;

  const hCarta = Math.min(260, fin - y);
  if (hCarta >= 150) cartaControl(ctx, { x: M, y: fin - hCarta, w: W - 2 * M, h: hCarta, tema, clave: curso.id || curso.titulo });

  llamada(ctx, { W, M, y: ctaY, tema });
}

function componerAgenda(ctx, { F, tema, cursos, logo }) {
  const { w: W, h: H, segura } = F;
  const M = 76;
  const arriba = M + segura[0];
  const ctaY = H - M - segura[1] - 184;
  const fin = ctaY - 28;

  let y = cabecera(ctx, { W, M, y: arriba, tema, logo }) + 60;

  const t = ajustar(ctx, 'Próximos cursos', { maxW: W - 2 * M, maxLineas: 1, max: H >= 1900 ? 130 : 112, min: 70, peso: 800, familia: DISPLAY, esp: -0.03 });
  ctx.fillStyle = tema.texto;
  ctx.fillText(t.lineas[0], M, y + t.tam * 0.8);
  reiniciar(ctx);
  y += t.tam * 0.8 + 38;
  fuente(ctx, 500, 30, TEXTO);
  ctx.fillStyle = tema.suave;
  ctx.fillText('En vivo y con cupo limitado. Reserva por WhatsApp.', M, y);
  y += 44;

  const n = Math.max(1, cursos.length);
  const alto = Math.min(176, (fin - y) / n);
  const colFecha = 210;
  cursos.forEach((c, i) => {
    const top = y + i * alto;
    ctx.fillStyle = tema.linea;
    ctx.fillRect(M, top, W - 2 * M, 2);
    const a = partes(c.inicio);
    const rango = tieneRango(c);
    const b = rango ? partes(c.fin) : null;
    const dia = rango ? `${dd(a.d)}–${dd(b.d)}` : dd(a.d);
    const tamDia = Math.min(rango ? 62 : 84, alto * 0.5);
    fuente(ctx, 800, tamDia, DISPLAY);
    espaciado(ctx, -0.03 * tamDia);
    ctx.fillStyle = tema.texto;
    const altoDia = ctx.measureText('0').actualBoundingBoxAscent;
    const baseDia = top + (alto - altoDia - 30) / 2 + altoDia;
    ctx.fillText(dia, M, baseDia);
    reiniciar(ctx);
    fuente(ctx, 500, 24, MONO);
    espaciado(ctx, 1.6);
    ctx.fillStyle = tema.acento;
    const mes = (rango && b.m !== a.m ? `${MESES[a.m - 1].slice(0, 3)}–${MESES[b.m - 1].slice(0, 3)}` : MESES[a.m - 1].slice(0, 3)).toUpperCase();
    ctx.fillText(mes, M, baseDia + 32);
    reiniciar(ctx);

    const lado = ajustar(ctx, c.titulo, { maxW: W - 2 * M - colFecha, maxLineas: 2, max: Math.min(44, Math.floor(alto * 0.34)), min: Math.min(28, Math.floor(alto * 0.34)), peso: 700, familia: DISPLAY, esp: -0.015 });
    const altoLado = lado.lineas.length * lado.tam * 1.08 + 34;
    const arribaLado = top + (alto - altoLado) / 2;
    ctx.fillStyle = tema.texto;
    lado.lineas.forEach((l, k) => ctx.fillText(l, M + colFecha, arribaLado + lado.tam * 0.82 + k * lado.tam * 1.08));
    reiniciar(ctx);
    fuente(ctx, 500, 22, MONO);
    espaciado(ctx, 1.2);
    ctx.fillStyle = tema.suave;
    ctx.fillText(`${c.categoria.toUpperCase()}  ·  ${(c.modalidad || 'Online en vivo').toUpperCase()}`, M + colFecha, arribaLado + lado.lineas.length * lado.tam * 1.08 + 24);
    reiniciar(ctx);
  });

  llamada(ctx, { W, M, y: ctaY, tema });
}

/**
 * Dibuja la imagen en el canvas.
 * opciones: { tipo: 'curso' | 'agenda', curso, cursos, formato, tema }
 */
export async function dibujar(canvas, { tipo, curso, cursos, formato, tema }) {
  const F = FORMATOS[formato] || FORMATOS.cuadrado;
  const T = TEMAS[tema] || TEMAS.oscuro;
  await cargarFuentes();
  const logo = await cargarImagen('/assets/logo-hcd.png');
  canvas.width = F.w;
  canvas.height = F.h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = T.fondo;
  ctx.fillRect(0, 0, F.w, F.h);
  reiniciar(ctx);
  if (tipo === 'agenda') componerAgenda(ctx, { F, tema: T, cursos, logo });
  else componerCurso(ctx, { F, tema: T, curso, logo });
}

/* ───────────── textos para publicar ───────────── */

const ETIQUETAS = {
  'Core Tools': '#CoreTools #AMEF #SPC #APQP #IATF16949',
  'Lean Six Sigma': '#LeanSixSigma #MejoraContinua #Lean #Manufactura',
  'Sistemas de Gestión': '#ISO9001 #SistemasDeGestión #Auditoría #Calidad',
  'Estadística y Software': '#Estadística #Minitab #AnálisisDeDatos #Calidad',
  'Gestión de RH': '#CapacitaciónIndustrial #RecursosHumanos #Industria',
};

const enlaceReserva = (c) => `${WHATSAPP}?text=${encodeURIComponent(`Hola, quiero reservar mi lugar en ${c.titulo} (${cuandoCorto(c)}).`)}`;
const enlaceAgenda = () => `${WHATSAPP}?text=${encodeURIComponent('Hola, quiero información de los próximos cursos.')}`;

export function textoRedes({ tipo, curso, cursos }) {
  if (tipo === 'agenda') {
    return [
      'Próximos cursos de Hablando con Datos',
      '',
      ...cursos.map((c) => `📅 ${cuandoCorto(c)}: ${c.titulo}`),
      '',
      `💻 En vivo y con cupo limitado.`,
      `Reserva tu lugar por WhatsApp: ${TELEFONO}`,
      `Más información: ${SITIO}`,
      '',
      '#Calidad #Capacitación #IATF16949 #ISO9001 #CoreTools',
    ].join('\n');
  }
  const c = curso;
  return [
    c.titulo,
    '',
    `📅 ${cuandoLargo(c)}`,
    c.horario ? `🕘 ${c.horario}` : null,
    `💻 ${c.modalidad || 'Online en vivo'} · ${c.cupo || 'Cupo limitado'}`,
    '',
    `Reserva tu lugar por WhatsApp: ${TELEFONO}`,
    `Más información: ${SITIO}`,
    '',
    `${ETIQUETAS[c.categoria] || '#Calidad #Capacitación'} #HablandoConDatos`,
  ].filter((l) => l !== null).join('\n');
}

export function textoWhatsApp({ tipo, curso, cursos }) {
  if (tipo === 'agenda') {
    return [
      '*Próximos cursos de Hablando con Datos*',
      '',
      ...cursos.map((c) => `📅 ${cuandoCorto(c)}: ${c.titulo}`),
      '',
      'Reserva tu lugar aquí 👇',
      enlaceAgenda(),
    ].join('\n');
  }
  const c = curso;
  return [
    `*${c.titulo}*`,
    `📅 ${cuandoLargo(c)}`,
    c.horario ? `🕘 ${c.horario}` : null,
    `💻 ${c.modalidad || 'Online en vivo'} · ${c.cupo || 'Cupo limitado'}`,
    '',
    'Reserva tu lugar aquí 👇',
    enlaceReserva(c),
  ].filter((l) => l !== null).join('\n');
}

export function nombreArchivo({ tipo, curso, formato }) {
  const base = tipo === 'agenda'
    ? 'agenda-cursos'
    : `${curso.inicio}-${curso.titulo}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `hcd-${base}-${formato}.png`;
}
