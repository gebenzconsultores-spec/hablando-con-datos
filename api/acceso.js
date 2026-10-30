import { createHash, timingSafeEqual } from 'node:crypto';
import { responder, soloMetodos } from './_lib/http.js';
import { leerAccesos } from './_lib/store.js';

// Página pública de acceso de un grupo.
//   GET /api/acceso?g=novares                 → empresa y nombres (nunca contraseñas)
//   GET /api/acceso?g=novares&e=<id alumno>   → ID y contraseña de ese alumno
// Si el grupo tiene código, hay que mandarlo en la cabecera x-codigo.

const SIN_CACHE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
const hash = (t) => createHash('sha256').update(String(t)).digest();
const iguales = (a, b) => timingSafeEqual(hash(a), hash(b));
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

function url(req) {
  try {
    return new URL(req.url, 'http://x');
  } catch {
    return new URL('http://x/');
  }
}

export default async function handler(req, res) {
  if (!soloMetodos(req, res, ['GET'])) return;
  const q = url(req).searchParams;
  const slug = (q.get('g') || '').toLowerCase().slice(0, 40);
  const alumnoId = (q.get('e') || '').slice(0, 40);
  if (!slug) return responder(res, 400, { error: 'falta_grupo' }, SIN_CACHE);

  let datos;
  try {
    datos = await leerAccesos();
  } catch (e) {
    console.error('[api/acceso]', e?.message || e);
    return responder(res, 503, { error: 'no_disponible' }, SIN_CACHE);
  }
  const grupo = datos?.grupos?.find((g) => g.slug === slug && g.activo !== false);
  if (!grupo) return responder(res, 404, { error: 'no_existe' }, SIN_CACHE);

  const cabecera = req.headers['x-codigo'];
  const codigo = typeof cabecera === 'string' ? cabecera.trim() : '';
  if (grupo.pin) {
    if (!codigo) return responder(res, 200, { empresa: grupo.empresa, modalidad: grupo.modalidad, requierePin: true }, SIN_CACHE);
    if (!iguales(codigo, grupo.pin)) {
      await pausa(700);
      return responder(res, 401, { error: 'codigo_incorrecto' }, SIN_CACHE);
    }
  }

  if (!alumnoId) {
    return responder(
      res,
      200,
      {
        empresa: grupo.empresa,
        modalidad: grupo.modalidad,
        requierePin: Boolean(grupo.pin),
        estudiantes: grupo.estudiantes.map((a) => ({ id: a.id, nombre: a.nombre, usuario: a.usuario })),
      },
      SIN_CACHE,
    );
  }

  const alumno = grupo.estudiantes.find((a) => a.id === alumnoId);
  if (!alumno) return responder(res, 404, { error: 'alumno_no_existe' }, SIN_CACHE);
  return responder(res, 200, { nombre: alumno.nombre, usuario: alumno.usuario, clave: alumno.clave }, SIN_CACHE);
}
