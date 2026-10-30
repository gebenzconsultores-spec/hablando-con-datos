import { mismoOrigen, sesionValida } from '../_lib/auth.js';
import { esJson, leerJson, responder, soloMetodos } from '../_lib/http.js';
import { ErrorAlmacen, guardarAccesos, leerAccesos } from '../_lib/store.js';
import { MODALIDADES_GRUPO, validarAccesos } from '../_lib/validarAccesos.js';

function errorDeAlmacen(res, e) {
  console.error('[api/admin/accesos]', e?.message || e);
  if (e instanceof ErrorAlmacen) return responder(res, 503, { error: e.codigo, mensaje: e.message });
  return responder(res, 500, { error: 'error_interno' });
}

// GET: todos los grupos (con contraseñas, solo para quien administra).   PUT: reemplaza y guarda.
export default async function handler(req, res) {
  if (!soloMetodos(req, res, ['GET', 'PUT'])) return;
  if (!sesionValida(req)) return responder(res, 401, { error: 'sin_sesion' });

  if (req.method === 'GET') {
    try {
      const datos = await leerAccesos();
      return responder(res, 200, { actualizado: datos?.actualizado ?? null, grupos: datos?.grupos ?? [], modalidades: MODALIDADES_GRUPO });
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
  const r = validarAccesos(cuerpo?.grupos);
  if (!r.ok) return responder(res, 422, { error: 'datos_invalidos', errores: r.errores });
  try {
    const actualizado = await guardarAccesos(r.grupos);
    return responder(res, 200, { ok: true, actualizado, grupos: r.grupos });
  } catch (e) {
    return errorDeAlmacen(res, e);
  }
}
