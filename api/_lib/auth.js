import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'hcd_admin';
const VIGENCIA_SEG = 60 * 60 * 12; // la sesión dura 12 horas

export const configurado = () => Boolean(process.env.ADMIN_PASSWORD);

const sha = (txt) => createHash('sha256').update(String(txt ?? '')).digest();

// La llave que firma la sesión sale de ADMIN_SECRET (opcional) o, si no existe, de la contraseña.
const llave = () => sha(`hcd-admin|${process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || ''}`);
const firmar = (texto) => createHmac('sha256', llave()).update(texto).digest('base64url');

/** Compara en tiempo constante para que no se pueda adivinar la clave midiendo tiempos. */
export function claveCorrecta(intento) {
  if (!configurado()) return false;
  return timingSafeEqual(sha(intento), sha(process.env.ADMIN_PASSWORD));
}

const esHttps = (req) => req.headers?.['x-forwarded-proto'] === 'https' || Boolean(process.env.VERCEL);

function atributos(req, maxAge) {
  // Path=/api: el navegador solo manda la cookie a la API, nunca a las páginas públicas.
  return `Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${esHttps(req) ? '; Secure' : ''}`;
}

export function crearCookieSesion(req, ahora = Date.now()) {
  const expira = Math.floor(ahora / 1000) + VIGENCIA_SEG;
  return `${COOKIE}=${expira}.${firmar(String(expira))}; ${atributos(req, VIGENCIA_SEG)}`;
}

export const borrarCookieSesion = (req) => `${COOKIE}=; ${atributos(req, 0)}`;

export function sesionValida(req, ahora = Date.now()) {
  if (!configurado()) return false;
  const crudo = String(req.headers?.cookie || '')
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE}=`));
  if (!crudo) return false;
  const [expira, firma] = crudo.slice(COOKIE.length + 1).split('.');
  if (!/^\d{9,12}$/.test(expira || '') || !firma) return false;
  if (Number(expira) * 1000 < ahora) return false;
  const esperada = Buffer.from(firmar(expira));
  const recibida = Buffer.from(firma);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

/** Las peticiones que cambian algo solo se aceptan desde el mismo sitio. */
export function mismoOrigen(req) {
  const origen = req.headers?.origin;
  if (!origen) return true;
  try {
    return new URL(origen).host === req.headers.host;
  } catch {
    return false;
  }
}
