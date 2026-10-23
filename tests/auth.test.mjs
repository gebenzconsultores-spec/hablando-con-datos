import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { borrarCookieSesion, claveCorrecta, configurado, crearCookieSesion, mismoOrigen, sesionValida } from '../api/_lib/auth.js';

const req = (cookie, extra = {}) => ({ headers: { cookie, ...extra } });
const valor = (setCookie) => setCookie.split(';')[0];

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'clave-de-prueba';
  delete process.env.ADMIN_SECRET;
  delete process.env.VERCEL;
});
afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_SECRET;
});

test('claveCorrecta compara la contraseña exacta', () => {
  assert.equal(claveCorrecta('clave-de-prueba'), true);
  assert.equal(claveCorrecta('Clave-de-prueba'), false);
  assert.equal(claveCorrecta(''), false);
  assert.equal(claveCorrecta(undefined), false);
});

test('sin ADMIN_PASSWORD nada entra', () => {
  delete process.env.ADMIN_PASSWORD;
  assert.equal(configurado(), false);
  assert.equal(claveCorrecta(''), false);
  assert.equal(claveCorrecta('algo'), false);
  assert.equal(sesionValida(req('hcd_admin=9999999999.x')), false);
});

test('la cookie emitida abre sesión', () => {
  const c = crearCookieSesion(req());
  assert.match(c, /HttpOnly/);
  assert.match(c, /SameSite=Strict/);
  assert.match(c, /Path=\/api/);
  assert.equal(sesionValida(req(valor(c))), true);
});

test('la cookie lleva Secure en producción y no en local', () => {
  assert.doesNotMatch(crearCookieSesion(req()), /Secure/);
  assert.match(crearCookieSesion(req(undefined, { 'x-forwarded-proto': 'https' })), /Secure/);
});

test('una cookie vencida, alterada o firmada con otra clave no sirve', () => {
  const ahora = Date.now();
  const c = valor(crearCookieSesion(req(), ahora));
  assert.equal(sesionValida(req(c), ahora + 13 * 3600 * 1000), false);
  const [nombre, resto] = c.split('=');
  const [expira, firma] = resto.split('.');
  assert.equal(sesionValida(req(`${nombre}=${Number(expira) + 99999}.${firma}`)), false);
  assert.equal(sesionValida(req(`${nombre}=${expira}.${firma.slice(0, -2)}AA`)), false);
  assert.equal(sesionValida(req(`${nombre}=${expira}`)), false);
  process.env.ADMIN_PASSWORD = 'otra-clave';
  assert.equal(sesionValida(req(c)), false);
});

test('ADMIN_SECRET cambia la llave de firma', () => {
  const c = valor(crearCookieSesion(req()));
  process.env.ADMIN_SECRET = 'otro-secreto';
  assert.equal(sesionValida(req(c)), false);
});

test('borrarCookieSesion expira la cookie', () => {
  assert.match(borrarCookieSesion(req()), /Max-Age=0/);
});

test('mismoOrigen acepta sin Origin y rechaza otro sitio', () => {
  assert.equal(mismoOrigen({ headers: { host: 'a.com' } }), true);
  assert.equal(mismoOrigen({ headers: { host: 'a.com', origin: 'https://a.com' } }), true);
  assert.equal(mismoOrigen({ headers: { host: 'a.com', origin: 'https://malo.com' } }), false);
  assert.equal(mismoOrigen({ headers: { host: 'a.com', origin: 'no-es-url' } }), false);
});
