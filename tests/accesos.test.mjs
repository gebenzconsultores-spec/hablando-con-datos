import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import accesosAdmin from '../api/admin/accesos.js';
import login from '../api/admin/login.js';
import acceso from '../api/acceso.js';
import { hacerSlug, validarAccesos } from '../api/_lib/validarAccesos.js';
import { llamar } from './ayudas.mjs';

const alumno = (n, extra = {}) => ({ id: `a-${n}-abcd`, nombre: `Alumno ${n}`, usuario: `ALU-000${n}`, clave: `HCD-${n}${n}${n}${n}`, ...extra });
const grupo = (extra = {}) => ({ slug: 'novares', empresa: 'Novares', modalidad: 'Presencial', pin: '', activo: true, estudiantes: [alumno(1), alumno(2)], ...extra });

let carpeta;
let cookie;
before(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'hcd-acc-'));
  process.env.HCD_STORE_DIR = carpeta;
  process.env.ADMIN_PASSWORD = 'clave-de-prueba';
  const r = await llamar(login, 'POST', { cuerpo: { clave: 'clave-de-prueba' } });
  cookie = String(r.headers['set-cookie']).split(';')[0];
});
after(async () => {
  delete process.env.HCD_STORE_DIR;
  delete process.env.ADMIN_PASSWORD;
  await rm(carpeta, { recursive: true, force: true });
});

test('hacerSlug quita acentos y símbolos', () => {
  assert.equal(hacerSlug('Novares Querétaro, S.A.'), 'novares-queretaro-s-a');
  assert.equal(hacerSlug('  La Morena '), 'la-morena');
});

test('validación: acepta un grupo correcto y limpia espacios', () => {
  const r = validarAccesos([grupo({ empresa: '  Novares   Puebla ' })]);
  assert.equal(r.ok, true);
  assert.equal(r.grupos[0].empresa, 'Novares Puebla');
});

test('validación: rechaza dirección repetida, reservada o inválida', () => {
  assert.equal(validarAccesos([grupo(), grupo()]).ok, false);
  assert.equal(validarAccesos([grupo({ slug: 'admin' })]).ok, false);
  assert.equal(validarAccesos([grupo({ slug: 'Con Espacios' })]).ok, false);
});

test('validación: exige nombre, ID y contraseña de cada alumno e ids únicos', () => {
  assert.equal(validarAccesos([grupo({ estudiantes: [alumno(1, { clave: '' })] })]).ok, false);
  assert.equal(validarAccesos([grupo({ estudiantes: [alumno(1, { usuario: '' })] })]).ok, false);
  assert.equal(validarAccesos([grupo({ estudiantes: [alumno(1, { nombre: '' })] })]).ok, false);
  assert.equal(validarAccesos([grupo({ estudiantes: [alumno(1), alumno(1)] })]).ok, false);
});

test('validación: el código del grupo es opcional pero, si existe, 4 a 12 letras o números', () => {
  assert.equal(validarAccesos([grupo({ pin: 'ab' })]).ok, false);
  assert.equal(validarAccesos([grupo({ pin: 'no valido!' })]).ok, false);
  assert.equal(validarAccesos([grupo({ pin: 'Curso26' })]).ok, true);
});

test('admin: exige sesión y mismo origen', async () => {
  assert.equal((await llamar(accesosAdmin, 'GET')).statusCode, 401);
  assert.equal((await llamar(accesosAdmin, 'PUT', { cookie, cuerpo: { grupos: [] }, origen: 'https://malo.com' })).statusCode, 403);
});

test('público: sin nada guardado responde 404', async () => {
  assert.equal((await llamar(acceso, 'GET', { url: '/api/acceso?g=novares' })).statusCode, 404);
});

test('admin guarda y la página pública muestra nombres sin contraseñas', async () => {
  const g = await llamar(accesosAdmin, 'PUT', { cookie, cuerpo: { grupos: [grupo()] } });
  assert.equal(g.statusCode, 200);
  const lista = await llamar(acceso, 'GET', { url: '/api/acceso?g=novares' });
  assert.equal(lista.statusCode, 200);
  assert.equal(lista.json.empresa, 'Novares');
  assert.equal(lista.json.estudiantes.length, 2);
  assert.ok(!JSON.stringify(lista.json).includes('HCD-1111'), 'la lista nunca debe traer contraseñas');
  assert.equal(lista.headers['cache-control'], 'no-store');
});

test('público: un alumno recibe su ID y contraseña', async () => {
  const r = await llamar(acceso, 'GET', { url: '/api/acceso?g=novares&e=a-1-abcd' });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.json, { nombre: 'Alumno 1', usuario: 'ALU-0001', clave: 'HCD-1111' });
  assert.equal((await llamar(acceso, 'GET', { url: '/api/acceso?g=novares&e=no-existe' })).statusCode, 404);
});

test('grupo con código: sin código no hay nombres ni contraseñas', async () => {
  await llamar(accesosAdmin, 'PUT', { cookie, cuerpo: { grupos: [grupo({ pin: 'Curso26' })] } });
  const sin = await llamar(acceso, 'GET', { url: '/api/acceso?g=novares' });
  assert.equal(sin.json.requierePin, true);
  assert.equal(sin.json.estudiantes, undefined);
  const mal = await llamar(acceso, 'GET', { url: '/api/acceso?g=novares&e=a-1-abcd', cabeceras: { 'x-codigo': 'otro' } });
  assert.equal(mal.statusCode, 401);
  const bien = await llamar(acceso, 'GET', { url: '/api/acceso?g=novares&e=a-1-abcd', cabeceras: { 'x-codigo': 'Curso26' } });
  assert.equal(bien.statusCode, 200);
  assert.equal(bien.json.clave, 'HCD-1111');
  const lista = await llamar(acceso, 'GET', { url: '/api/acceso?g=novares', cabeceras: { 'x-codigo': 'Curso26' } });
  assert.equal(lista.json.estudiantes.length, 2);
});

test('grupo desactivado deja de responder', async () => {
  await llamar(accesosAdmin, 'PUT', { cookie, cuerpo: { grupos: [grupo({ activo: false })] } });
  assert.equal((await llamar(acceso, 'GET', { url: '/api/acceso?g=novares' })).statusCode, 404);
});

test('la API pública solo responde GET y pide el grupo', async () => {
  assert.equal((await llamar(acceso, 'POST', { url: '/api/acceso?g=novares' })).statusCode, 405);
  assert.equal((await llamar(acceso, 'GET', { url: '/api/acceso' })).statusCode, 400);
});

test('leerLista: acepta Excel (tabulador), punto y coma y omite encabezado y líneas incompletas', async () => {
  const { leerLista } = await import('../admin/accesos.js');
  const r = leerLista('Nombre\tID\tContraseña\nAna López\tALU-0132\tHCD-1234\nLuis Pérez;ALU-0133;HCD-5678\n\nSolo nombre\n');
  assert.equal(r.alumnos.length, 2);
  assert.deepEqual([r.alumnos[0].nombre, r.alumnos[0].usuario, r.alumnos[0].clave], ['Ana López', 'ALU-0132', 'HCD-1234']);
  assert.equal(r.alumnos[1].nombre, 'Luis Pérez');
  assert.deepEqual(r.dudosas, ['Solo nombre']);
  assert.notEqual(r.alumnos[0].id, r.alumnos[1].id);
});
