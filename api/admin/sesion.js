import { borrarCookieSesion, configurado, mismoOrigen, sesionValida } from '../_lib/auth.js';
import { responder, soloMetodos } from '../_lib/http.js';

// GET: ¿hay una sesión abierta?   DELETE: cerrar sesión.
export default async function handler(req, res) {
  if (!soloMetodos(req, res, ['GET', 'DELETE'])) return;
  if (req.method === 'DELETE') {
    if (!mismoOrigen(req)) return responder(res, 403, { error: 'origen_no_permitido' });
    return responder(res, 200, { ok: true }, { 'Set-Cookie': borrarCookieSesion(req) });
  }
  return responder(res, 200, { configurado: configurado(), autenticado: sesionValida(req) });
}
