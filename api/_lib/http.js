/** Respuesta JSON sin caché. Usa solo la API estándar de Node, igual que en Vercel y en las pruebas. */
export function responder(res, estado, cuerpo, extra = {}) {
  res.statusCode = estado;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  res.end(JSON.stringify(cuerpo));
}

export function soloMetodos(req, res, permitidos) {
  if (permitidos.includes(req.method)) return true;
  responder(res, 405, { error: 'metodo_no_permitido' }, { Allow: permitidos.join(', ') });
  return false;
}

/** Vercel ya convierte el JSON en objeto; si no lo hizo, lo leemos del flujo. */
export async function leerJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const partes = [];
  let total = 0;
  for await (const parte of req) {
    total += parte.length;
    if (total > 1_000_000) throw new Error('cuerpo_muy_grande');
    partes.push(parte);
  }
  return partes.length ? JSON.parse(Buffer.concat(partes).toString('utf8')) : {};
}

export const esJson = (req) => String(req.headers?.['content-type'] || '').toLowerCase().startsWith('application/json');
