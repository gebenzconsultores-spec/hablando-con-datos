// Utilidades para probar los handlers sin servidor: un req y un res mínimos.
export function pedir(metodo, { cuerpo, cookie, origen, host = 'sitio.test', tipo = 'application/json' } = {}) {
  const headers = { host };
  if (cookie) headers.cookie = cookie;
  if (origen) headers.origin = origen;
  if (cuerpo !== undefined) headers['content-type'] = tipo;
  return { method: metodo, headers, body: cuerpo };
}

export function respuesta() {
  const r = {
    statusCode: 200,
    headers: {},
    texto: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(t = '') { this.texto = t; },
    get json() { return this.texto ? JSON.parse(this.texto) : null; },
  };
  return r;
}

export async function llamar(handler, metodo, opciones) {
  const res = respuesta();
  await handler(pedir(metodo, opciones), res);
  return res;
}

export const cursoBase = (extra = {}) => ({
  titulo: 'Plan de control',
  categoria: 'Core Tools',
  inicio: '2026-11-18',
  ...extra,
});
