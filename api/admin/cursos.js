import { mismoOrigen, sesionValida } from '../_lib/auth.js';
import { CATEGORIAS, CUPOS, IMAGENES, MODALIDADES } from '../_lib/catalogo.js';
import { esJson, leerJson, responder, soloMetodos } from '../_lib/http.js';
import { ErrorAlmacen, guardarCursos, leerCursos } from '../_lib/store.js';
import { validarLista } from '../_lib/validar.js';

const catalogo = { categorias: CATEGORIAS, modalidades: MODALIDADES, cupos: CUPOS, imagenes: IMAGENES };

function errorDeAlmacen(res, e) {
  console.error('[api/admin/cursos]', e?.message || e);
  if (e instanceof ErrorAlmacen) return responder(res, 503, { error: e.codigo, mensaje: e.message });
  return responder(res, 500, { error: 'error_interno' });
}

// GET: lista completa (incluye cursos ocultos).   PUT: reemplaza la lista y la publica.
export default async function handler(req, res) {
  if (!soloMetodos(req, res, ['GET', 'PUT'])) return;
  if (!sesionValida(req)) return responder(res, 401, { error: 'sin_sesion' });

  if (req.method === 'GET') {
    try {
      const datos = await leerCursos();
      return responder(res, 200, {
        publicado: Boolean(datos),
        actualizado: datos?.actualizado ?? null,
        cursos: datos?.cursos ?? null,
        catalogo,
      });
    } catch (e) {
      return errorDeAlmacen(res, e);
    }
  }

  if (!mismoOrigen(req) || !esJson(req)) return responder(res, 403, { error: 'origen_no_permitido' });
  let cuerpo;
  try {
    cuerpo = await leerJson(req);
  } catch {
    return responder(res, 400, { error: 'cuerpo_invalido' });
  }
  const r = validarLista(cuerpo?.cursos);
  if (!r.ok) return responder(res, 422, { error: 'datos_invalidos', errores: r.errores });
  try {
    const actualizado = await guardarCursos(r.cursos);
    return responder(res, 200, { ok: true, actualizado, cursos: r.cursos });
  } catch (e) {
    return errorDeAlmacen(res, e);
  }
}
