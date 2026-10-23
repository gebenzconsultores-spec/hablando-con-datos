import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_CURSOS } from '../api/_lib/catalogo.js';
import { fechaValida, normalizarCurso, validarLista } from '../api/_lib/validar.js';
import { cursoBase } from './ayudas.mjs';

test('fechaValida acepta fechas reales y rechaza imposibles', () => {
  assert.equal(fechaValida('2026-11-18'), true);
  assert.equal(fechaValida('2028-02-29'), true);
  assert.equal(fechaValida('2026-02-30'), false);
  assert.equal(fechaValida('2026-13-01'), false);
  assert.equal(fechaValida('18/11/2026'), false);
  assert.equal(fechaValida(20261118), false);
});

test('un curso válido recibe valores por omisión', () => {
  const { errores, curso } = normalizarCurso(cursoBase());
  assert.deepEqual(errores, []);
  assert.equal(curso.modalidad, 'Online en vivo');
  assert.equal(curso.cupo, 'Cupo limitado');
  assert.equal(curso.visible, true);
  assert.equal(curso.fin, '');
});

test('limpia espacios y caracteres de control del nombre', () => {
  const { curso, errores } = normalizarCurso(cursoBase({ titulo: '  Plan\u0000   de \n control  ' }));
  assert.deepEqual(errores, []);
  assert.equal(curso.titulo, 'Plan de control');
});

test('rechaza nombre corto o largo, categoría desconocida y fecha inválida', () => {
  assert.equal(normalizarCurso(cursoBase({ titulo: 'ab' })).errores.length, 1);
  assert.equal(normalizarCurso(cursoBase({ titulo: 'x'.repeat(121) })).errores.length, 1);
  assert.equal(normalizarCurso(cursoBase({ categoria: 'Otra' })).errores.length, 1);
  assert.equal(normalizarCurso(cursoBase({ inicio: '2026-02-30' })).errores.length, 1);
});

test('fecha de fin: posterior al inicio, máximo 31 días; si es igual se descarta', () => {
  assert.deepEqual(normalizarCurso(cursoBase({ fin: '2026-11-19' })).errores, []);
  assert.equal(normalizarCurso(cursoBase({ fin: '2026-11-17' })).errores.length, 1);
  assert.equal(normalizarCurso(cursoBase({ fin: '2026-12-30' })).errores.length, 1);
  assert.equal(normalizarCurso(cursoBase({ fin: '2026-11-18' })).curso.fin, '');
});

test('solo acepta imágenes de /assets', () => {
  assert.deepEqual(normalizarCurso(cursoBase({ imagen: 'assets/4hcd.jpg' })).errores, []);
  for (const mala of ['../secreto.jpg', 'https://x.com/a.jpg', 'assets/../a.jpg', 'assets/a.svg', '/assets/a.jpg']) {
    assert.equal(normalizarCurso(cursoBase({ imagen: mala })).errores.length, 1, mala);
  }
});

test('modalidad y cupo fuera de la lista se rechazan', () => {
  assert.equal(normalizarCurso(cursoBase({ modalidad: 'Marte' })).errores.length, 1);
  assert.equal(normalizarCurso(cursoBase({ cupo: 'Gratis' })).errores.length, 1);
});

test('visible solo es falso cuando se pide explícitamente', () => {
  assert.equal(normalizarCurso(cursoBase({ visible: false })).curso.visible, false);
  assert.equal(normalizarCurso(cursoBase({ visible: 'no' })).curso.visible, true);
});

test('validarLista asigna ids, evita repetidos y ordena por fecha', () => {
  const r = validarLista([
    cursoBase({ id: 'a1', titulo: 'Segundo', inicio: '2026-12-01' }),
    cursoBase({ id: 'a1', titulo: 'Primero', inicio: '2026-11-01' }),
    cursoBase({ titulo: 'Tercero', inicio: '2026-12-15' }),
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.cursos.map((c) => c.titulo), ['Primero', 'Segundo', 'Tercero']);
  assert.equal(new Set(r.cursos.map((c) => c.id)).size, 3);
  assert.ok(r.cursos.every((c) => /^[A-Za-z0-9_-]{1,40}$/.test(c.id)));
});

test('validarLista reúne todos los errores y rechaza entradas que no son lista', () => {
  const r = validarLista([cursoBase({ titulo: 'ab' }), cursoBase({ categoria: 'X' })]);
  assert.equal(r.ok, false);
  assert.equal(r.errores.length, 2);
  assert.equal(validarLista('hola').ok, false);
  assert.equal(validarLista(Array.from({ length: MAX_CURSOS + 1 }, () => cursoBase())).ok, false);
  assert.equal(validarLista([]).ok, true);
});

test('ignora campos desconocidos', () => {
  const { curso } = normalizarCurso(cursoBase({ admin: true, __proto__: { x: 1 } }));
  assert.equal('admin' in curso, false);
});
