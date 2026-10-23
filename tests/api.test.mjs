import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import cursosAdmin from '../api/admin/cursos.js';
import login from '../api/admin/login.js';
import sesion from '../api/admin/sesion.js';
import cursosPublico from '../api/cursos.js';
import { cursoBase, llamar } from './ayudas.mjs';

let carpeta;
let cookie;

before(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'hcd-'));
  process.env.HCD_STORE_DIR = carpeta;
  process.env.ADMIN_PASSWORD = 'clave-de-prueba';
  delete process.env.BLOB_READ_WRITE_TOKEN;
});
after(async () => {
  delete process.env.HCD_STORE_DIR;
  delete process.env.ADMIN_PASSWORD;
  await rm(carpeta, { recursive: true, force: true });
});

test('antes de publicar, la API pública avisa que no hay lista del panel', async () => {
  const r = await llamar(cursosPublico, 'GET');
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.json, { publicado: false, cursos: [] });
});

test('la API pública solo responde GET', async () => {
  const r = await llamar(cursosPublico, 'POST');
  assert.equal(r.statusCode, 405);
});

test('login con clave incorrecta devuelve 401 y no da cookie', async () => {
  const r = await llamar(login, 'POST', { cuerpo: { clave: 'mal' } });
  assert.equal(r.statusCode, 401);
  assert.equal(r.headers['set-cookie'], undefined);
});

test('login exige JSON y mismo origen', async () => {
  assert.equal((await llamar(login, 'POST', { cuerpo: 'clave=x', tipo: 'text/plain' })).statusCode, 403);
  assert.equal((await llamar(login, 'POST', { cuerpo: { clave: 'clave-de-prueba' }, origen: 'https://malo.com' })).statusCode, 403);
});

test('login correcto entrega la cookie de sesión', async () => {
  const r = await llamar(login, 'POST', { cuerpo: { clave: 'clave-de-prueba' } });
  assert.equal(r.statusCode, 200);
  cookie = r.headers['set-cookie'].split(';')[0];
  assert.ok(cookie.startsWith('hcd_admin='));
  const s = await llamar(sesion, 'GET', { cookie });
  assert.deepEqual(s.json, { configurado: true, autenticado: true });
});

test('sin sesión no se puede leer ni escribir', async () => {
  assert.equal((await llamar(cursosAdmin, 'GET')).statusCode, 401);
  assert.equal((await llamar(cursosAdmin, 'PUT', { cuerpo: { cursos: [] } })).statusCode, 401);
});

test('GET del panel devuelve el catálogo y null mientras no se publique', async () => {
  const r = await llamar(cursosAdmin, 'GET', { cookie });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json.publicado, false);
  assert.equal(r.json.cursos, null);
  assert.ok(r.json.catalogo.categorias.includes('Core Tools'));
});

test('PUT rechaza datos inválidos con la lista de errores', async () => {
  const r = await llamar(cursosAdmin, 'PUT', { cookie, cuerpo: { cursos: [cursoBase({ titulo: 'ab', inicio: '2026-02-30' })] } });
  assert.equal(r.statusCode, 422);
  assert.equal(r.json.errores.length, 2);
});

test('PUT desde otro origen o sin JSON se rechaza', async () => {
  assert.equal((await llamar(cursosAdmin, 'PUT', { cookie, cuerpo: { cursos: [] }, origen: 'https://malo.com' })).statusCode, 403);
  assert.equal((await llamar(cursosAdmin, 'PUT', { cookie, cuerpo: 'x', tipo: 'text/plain' })).statusCode, 403);
});

test('publicar guarda la lista y la API pública oculta los cursos no visibles', async () => {
  const lista = [
    cursoBase({ titulo: 'TISAX', categoria: 'Sistemas de Gestión', inicio: '2026-11-11', horario: '9:00 a 13:00 h' }),
    cursoBase({ titulo: 'Borrador interno', inicio: '2026-11-12', visible: false }),
    cursoBase({ titulo: 'Plan de control', inicio: '2026-11-18', fin: '2026-11-19', imagen: 'assets/4hcd.jpg' }),
  ];
  const put = await llamar(cursosAdmin, 'PUT', { cookie, cuerpo: { cursos: lista } });
  assert.equal(put.statusCode, 200);
  assert.equal(put.json.cursos.length, 3);

  const pub = await llamar(cursosPublico, 'GET');
  assert.equal(pub.json.publicado, true);
  assert.deepEqual(pub.json.cursos.map((c) => c.titulo), ['TISAX', 'Plan de control']);
  assert.equal('visible' in pub.json.cursos[0], false);
  assert.match(pub.headers['cache-control'], /s-maxage=30/);

  const admin = await llamar(cursosAdmin, 'GET', { cookie });
  assert.equal(admin.json.cursos.length, 3, 'el panel sí ve los ocultos');
});

test('publicar una lista vacía es válido (el calendario queda vacío a propósito)', async () => {
  const put = await llamar(cursosAdmin, 'PUT', { cookie, cuerpo: { cursos: [] } });
  assert.equal(put.statusCode, 200);
  const pub = await llamar(cursosPublico, 'GET');
  assert.deepEqual(pub.json.cursos, []);
  assert.equal(pub.json.publicado, true);
});

test('cerrar sesión borra la cookie', async () => {
  const r = await llamar(sesion, 'DELETE', { cookie });
  assert.equal(r.statusCode, 200);
  assert.match(r.headers['set-cookie'], /Max-Age=0/);
});

test('sin almacenamiento configurado, el panel avisa claro y la API pública no se cae', async () => {
  delete process.env.HCD_STORE_DIR;
  const admin = await llamar(cursosAdmin, 'GET', { cookie });
  assert.equal(admin.statusCode, 503);
  assert.equal(admin.json.error, 'sin_almacen');
  const pub = await llamar(cursosPublico, 'GET');
  assert.equal(pub.statusCode, 503);
  process.env.HCD_STORE_DIR = carpeta;
});

test('sin ADMIN_PASSWORD el login responde 503', async () => {
  const guardada = process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_PASSWORD;
  const r = await llamar(login, 'POST', { cuerpo: { clave: 'x' } });
  assert.equal(r.statusCode, 503);
  process.env.ADMIN_PASSWORD = guardada;
});
