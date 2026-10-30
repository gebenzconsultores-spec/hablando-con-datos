// Validación y limpieza de los grupos de acceso (empresa + alumnos con ID y contraseña).

export const MODALIDADES_GRUPO = ['', 'Presencial', 'Online', 'Mixto'];
export const MAX_GRUPOS = 60;
export const MAX_ALUMNOS = 300;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ID_ALUMNO = /^[A-Za-z0-9_-]{4,40}$/;
const SIN_CONTROL = /[\u0000-\u001f\u007f]/;
const RESERVADOS = new Set(['admin', 'api', 'assets', 'acceso']);

const texto = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** Quita acentos y deja solo letras, números y guiones: "Novares Querétaro" → "novares-queretaro". */
export function hacerSlug(texto_) {
  return String(texto_ ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export function validarAccesos(grupos) {
  const errores = [];
  if (!Array.isArray(grupos)) return { ok: false, errores: ['La lista de grupos no es válida.'] };
  if (grupos.length > MAX_GRUPOS) return { ok: false, errores: [`Máximo ${MAX_GRUPOS} grupos.`] };

  const slugs = new Set();
  const limpios = [];

  grupos.forEach((g, i) => {
    const etiqueta = texto(g?.empresa, 80) || `Grupo ${i + 1}`;
    const falla = (m) => errores.push(`${etiqueta}: ${m}`);
    const empresa = texto(g?.empresa, 80);
    const slug = typeof g?.slug === 'string' ? g.slug.trim().toLowerCase() : '';
    const modalidad = typeof g?.modalidad === 'string' ? g.modalidad.trim() : '';
    const pin = typeof g?.pin === 'string' ? g.pin.trim() : '';

    if (!empresa) falla('falta el nombre de la empresa.');
    if (!SLUG.test(slug) || slug.length < 2) falla('la dirección solo puede llevar letras sin acento, números y guiones (mínimo 2 caracteres).');
    else if (RESERVADOS.has(slug)) falla(`la dirección "${slug}" está reservada; usa otra.`);
    else if (slugs.has(slug)) falla(`la dirección "${slug}" ya la usa otro grupo.`);
    slugs.add(slug);
    if (!MODALIDADES_GRUPO.includes(modalidad)) falla('la modalidad no es válida.');
    if (pin && !/^[A-Za-z0-9]{4,12}$/.test(pin)) falla('el código del grupo debe tener de 4 a 12 letras o números.');

    const lista = Array.isArray(g?.estudiantes) ? g.estudiantes : [];
    if (lista.length > MAX_ALUMNOS) falla(`máximo ${MAX_ALUMNOS} alumnos por grupo.`);
    const ids = new Set();
    const estudiantes = [];
    lista.slice(0, MAX_ALUMNOS).forEach((a, k) => {
      const fila = `${etiqueta}, alumno ${k + 1}`;
      const nombre = texto(a?.nombre, 100);
      const usuario = typeof a?.usuario === 'string' ? a.usuario.trim().slice(0, 40) : '';
      const clave = typeof a?.clave === 'string' ? a.clave.trim().slice(0, 60) : '';
      const id = typeof a?.id === 'string' ? a.id.trim() : '';
      if (!nombre) errores.push(`${fila}: falta el nombre.`);
      if (!usuario) errores.push(`${fila} (${nombre || 'sin nombre'}): falta el ID de acceso.`);
      if (!clave) errores.push(`${fila} (${nombre || 'sin nombre'}): falta la contraseña.`);
      if (SIN_CONTROL.test(usuario) || SIN_CONTROL.test(clave)) errores.push(`${fila}: hay caracteres no permitidos en el ID o la contraseña.`);
      if (!ID_ALUMNO.test(id)) errores.push(`${fila}: identificador interno inválido.`);
      else if (ids.has(id)) errores.push(`${fila}: identificador repetido.`);
      ids.add(id);
      estudiantes.push({ id, nombre, usuario, clave });
    });

    limpios.push({ slug, empresa, modalidad, pin, activo: g?.activo !== false, estudiantes });
  });

  if (errores.length) return { ok: false, errores };
  return { ok: true, grupos: limpios };
}
