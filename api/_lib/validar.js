import { randomUUID } from 'node:crypto';
import { CATEGORIAS, CUPOS, MAX_CURSOS, MODALIDADES } from './catalogo.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const IMAGEN = /^assets\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i;

export function fechaValida(v) {
  if (typeof v !== 'string' || !FECHA.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const limpiar = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const dias = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const nuevoId = () => `c${randomUUID().replace(/-/g, '').slice(0, 12)}`;

/** Valida un curso. Devuelve el curso limpio (solo campos conocidos) y los errores en español. */
export function normalizarCurso(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const errores = [];
  const titulo = limpiar(c.titulo);
  const nombre = titulo ? `«${titulo}»` : 'Un curso sin nombre';

  if (titulo.length < 3 || titulo.length > 120) errores.push(`${nombre}: el nombre debe tener entre 3 y 120 caracteres.`);

  const categoria = limpiar(c.categoria);
  if (!CATEGORIAS.includes(categoria)) errores.push(`${nombre}: elige una categoría de la lista.`);

  const inicio = limpiar(c.inicio);
  if (!fechaValida(inicio)) errores.push(`${nombre}: la fecha de inicio no es válida.`);

  let fin = limpiar(c.fin);
  if (fin) {
    if (!fechaValida(fin)) errores.push(`${nombre}: la fecha de fin no es válida.`);
    else if (fechaValida(inicio) && (fin < inicio || dias(inicio, fin) > 31)) {
      errores.push(`${nombre}: la fecha de fin debe ser posterior al inicio y dentro de los 31 días siguientes.`);
    } else if (fin === inicio) fin = '';
  }

  const horario = limpiar(c.horario);
  if (horario.length > 40) errores.push(`${nombre}: el horario no puede pasar de 40 caracteres.`);

  const modalidad = limpiar(c.modalidad) || MODALIDADES[0];
  if (!MODALIDADES.includes(modalidad)) errores.push(`${nombre}: elige una modalidad de la lista.`);

  const cupo = limpiar(c.cupo) || CUPOS[0];
  if (!CUPOS.includes(cupo)) errores.push(`${nombre}: elige un tipo de cupo de la lista.`);

  const imagen = limpiar(c.imagen);
  if (imagen && !IMAGEN.test(imagen)) errores.push(`${nombre}: la imagen no es válida.`);

  const id = typeof c.id === 'string' && ID.test(c.id) ? c.id : '';

  return {
    errores,
    curso: { id, titulo, categoria, inicio, fin, horario, modalidad, cupo, imagen, visible: c.visible !== false },
  };
}

/** Valida toda la lista que manda el panel. Asigna ids a los que no traen y evita ids repetidos. */
export function validarLista(lista) {
  if (!Array.isArray(lista)) return { ok: false, errores: ['La lista de cursos no es válida.'] };
  if (lista.length > MAX_CURSOS) return { ok: false, errores: [`Máximo ${MAX_CURSOS} cursos en la lista.`] };

  const errores = [];
  const cursos = [];
  const usados = new Set();
  for (const raw of lista) {
    const { curso, errores: e } = normalizarCurso(raw);
    errores.push(...e);
    if (!curso.id || usados.has(curso.id)) curso.id = nuevoId();
    usados.add(curso.id);
    cursos.push(curso);
  }
  if (errores.length) return { ok: false, errores };
  cursos.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo, 'es'));
  return { ok: true, cursos };
}
