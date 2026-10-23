import { claveCorrecta, configurado, crearCookieSesion, mismoOrigen } from '../_lib/auth.js';
import { esJson, leerJson, responder, soloMetodos } from '../_lib/http.js';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (!soloMetodos(req, res, ['POST'])) return;
  if (!configurado()) return responder(res, 503, { error: 'sin_configurar' });
  if (!mismoOrigen(req) || !esJson(req)) return responder(res, 403, { error: 'origen_no_permitido' });

  let cuerpo;
  try {
    cuerpo = await leerJson(req);
  } catch {
    return responder(res, 400, { error: 'cuerpo_invalido' });
  }

  if (!claveCorrecta(cuerpo?.clave)) {
    await espera(700); // frena los intentos repetidos
    return responder(res, 401, { error: 'clave_incorrecta' });
  }
  return responder(res, 200, { ok: true }, { 'Set-Cookie': crearCookieSesion(req) });
}
