// Panel privado de cursos. Habla con /api/admin/* (sesión por cookie) y genera las imágenes en el navegador.
// Todo el texto que viene de datos se inserta con textContent, nunca con innerHTML.

import { FORMATOS, dibujar, nombreArchivo, textoRedes, textoWhatsApp } from '/admin/arte.js';
import { MESES_CORTO, cuandoCorto, dd, esPasado, partes, tieneRango } from '/admin/fechas.js';

const $ = (s, r = document) => r.querySelector(s);

function h(tag, attrs = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

/* ───────────── estado ───────────── */

const S = {
  cursos: [], // copia de trabajo
  base: '', // firma de lo último publicado, para saber si hay cambios sin publicar
  catalogo: null,
  publicado: false,
  actualizado: null,
  cargado: false,
  publicando: false,
  verPasados: false,
  dif: { tipo: 'curso', cursoId: null, n: 5, formato: 'cuadrado', tema: 'oscuro', destino: 'redes', textos: { redes: '', whatsapp: '' } },
};

const ordenar = (l) => [...l].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo, 'es'));
const firma = (l) => JSON.stringify(ordenar(l));
const hayCambios = () => firma(S.cursos) !== S.base;
const nuevoId = () => `c${[...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join('')}`;

/* ───────────── API ───────────── */

async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const r = await fetch(ruta, {
    method: metodo,
    credentials: 'same-origin',
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let datos = null;
  try { datos = await r.json(); } catch { /* sin cuerpo */ }
  return { ok: r.ok, estado: r.status, datos };
}

/* ───────────── avisos ───────────── */

function avisar(contenido, { tipo = 'ok', accion, ms = 6000 } = {}) {
  const caja = h('div', { class: `toast${tipo === 'error' ? ' toast--error' : ''}` }, h('div', {}, contenido));
  if (accion) caja.append(h('button', { type: 'button', onclick: () => { accion.fn(); caja.remove(); } }, accion.texto));
  $('#avisos').append(caja);
  setTimeout(() => caja.remove(), tipo === 'error' ? Math.max(ms, 9000) : ms);
}

/* ───────────── vistas ───────────── */

function mostrarLogin({ error, configurado = true } = {}) {
  $('#panel').hidden = true;
  $('#login').hidden = false;
  const aviso = $('#login-config');
  aviso.hidden = configurado;
  if (!configurado) {
    aviso.textContent = 'El panel todavía no tiene contraseña. En Vercel, agrega la variable ADMIN_PASSWORD (Settings → Environment Variables) y vuelve a desplegar.';
  }
  $('#clave').disabled = !configurado;
  $('#btn-entrar').disabled = !configurado;
  const e = $('#login-error');
  e.hidden = !error;
  e.textContent = error || '';
  if (configurado) $('#clave').focus();
}

function mostrarPanel() {
  $('#login').hidden = true;
  $('#panel').hidden = false;
}

function renderEstado() {
  const est = $('#estado');
  const cambios = hayCambios();
  est.className = `barra__estado${cambios ? ' pendiente' : S.publicado ? ' ok' : ''}`;
  if (cambios) est.textContent = 'Tienes cambios sin publicar.';
  else if (S.cargado && !S.publicado) est.textContent = 'Aún no has publicado desde el panel.';
  else if (S.actualizado) {
    const f = new Date(S.actualizado).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' });
    est.textContent = `Todo publicado. Última publicación: ${f}.`;
  } else est.textContent = '';
  const b = $('#btn-publicar');
  // Mientras el panel no haya publicado nunca, el botón queda activo para poder publicar la lista base.
  const primera = S.cargado && !S.publicado;
  b.disabled = !(cambios || primera) || S.publicando;
  b.textContent = S.publicando ? 'Publicando…' : 'Publicar cambios';
  $('#aviso-semilla').hidden = S.publicado || !S.cargado;
}

function fechaCurso(c) {
  const a = partes(c.inicio);
  if (!tieneRango(c)) return h('div', { class: 'curso__fecha' }, h('span', { class: 'curso__dia' }, dd(a.d)), h('span', { class: 'curso__mes' }, MESES_CORTO[a.m - 1]));
  const b = partes(c.fin);
  const mes = a.m === b.m ? MESES_CORTO[a.m - 1] : `${MESES_CORTO[a.m - 1]}–${MESES_CORTO[b.m - 1]}`;
  return h('div', { class: 'curso__fecha' }, h('span', { class: 'curso__dia rango' }, `${dd(a.d)}–${dd(b.d)}`), h('span', { class: 'curso__mes' }, mes));
}

function filaCurso(c) {
  const pasado = esPasado(c);
  const oculto = c.visible === false;
  const acc = [
    h('button', { class: 'btn btn--chico', type: 'button', 'aria-label': `Editar ${c.titulo}`, onclick: () => abrirEditor(c, false) }, 'Editar'),
    h('button', { class: 'btn btn--chico', type: 'button', 'aria-label': `Duplicar ${c.titulo}`, onclick: () => abrirEditor({ ...c, id: '' }, true) }, 'Duplicar'),
  ];
  if (!pasado) acc.push(h('button', { class: 'btn btn--chico', type: 'button', 'aria-label': `Crear imagen de ${c.titulo}`, onclick: () => irADifusion(c.id) }, 'Crear imagen'));
  acc.push(
    h('button', { class: 'btn btn--chico', type: 'button', 'aria-label': `${oculto ? 'Mostrar' : 'Ocultar'} ${c.titulo} en el sitio`, onclick: () => { c.visible = oculto; renderTodo(); } }, oculto ? 'Mostrar' : 'Ocultar'),
    h('button', { class: 'btn btn--chico btn--peligro', type: 'button', 'aria-label': `Eliminar ${c.titulo}`, onclick: () => eliminar(c) }, 'Eliminar'),
  );
  const chips = [h('span', { class: 'chip' }, c.categoria), h('span', { class: 'chip chip--gris' }, c.modalidad), h('span', { class: 'chip chip--gris' }, c.cupo)];
  if (c.horario) chips.push(h('span', { class: 'chip chip--gris' }, c.horario));
  if (oculto) chips.push(h('span', { class: 'chip chip--aviso' }, 'Oculto en el sitio'));
  if (pasado) chips.push(h('span', { class: 'chip chip--aviso' }, 'Ya pasó'));
  return h('li', { class: `curso${pasado ? ' pasado' : ''}${oculto ? ' oculto' : ''}` },
    fechaCurso(c),
    h('div', { class: 'curso__cuerpo' }, h('h3', {}, c.titulo), h('div', { class: 'chips' }, chips)),
    h('div', { class: 'curso__acciones' }, acc));
}

function renderLista() {
  const lista = $('#lista');
  const todos = ordenar(S.cursos);
  const proximos = todos.filter((c) => !esPasado(c));
  const pasados = todos.filter(esPasado).reverse();
  const visibles = S.verPasados ? [...proximos, ...pasados] : proximos;
  lista.replaceChildren(...visibles.map(filaCurso));
  $('#lista-vacia').hidden = proximos.length > 0 || !S.cargado;
  const hayPasados = pasados.length;
  $('#ver-pasados').closest('label').hidden = !hayPasados;
}

function renderTodo() {
  renderLista();
  renderEstado();
  renderDifusion();
}

/* ───────────── editar, duplicar, eliminar ───────────── */

const dlg = $('#dlg-curso');
const llenar = (sel, valores, etiqueta = (v) => v) => $(sel).replaceChildren(...valores.map((v) => h('option', { value: v }, etiqueta(v))));

function prepararFormulario() {
  llenar('#f-categoria', S.catalogo.categorias);
  llenar('#f-modalidad', S.catalogo.modalidades);
  llenar('#f-cupo', S.catalogo.cupos);
  $('#f-imagen').replaceChildren(
    h('option', { value: '' }, 'Automática según la categoría'),
    ...S.catalogo.imagenes.map((i) => h('option', { value: i.archivo }, i.nombre)),
  );
  const titulos = [...new Set(S.cursos.map((c) => c.titulo))];
  $('#sugerencias').replaceChildren(...titulos.map((t) => h('option', { value: t })));
}

function abrirEditor(curso, esNuevo) {
  if (!S.catalogo) return;
  $('#dlg-titulo').textContent = esNuevo ? 'Agregar curso' : 'Editar curso';
  $('#f-titulo').value = curso.titulo || '';
  $('#f-categoria').value = curso.categoria || S.catalogo.categorias[0];
  $('#f-inicio').value = curso.inicio || '';
  $('#f-fin').value = curso.fin || '';
  $('#f-horario').value = curso.horario || '';
  $('#f-modalidad').value = curso.modalidad || S.catalogo.modalidades[0];
  $('#f-cupo').value = curso.cupo || S.catalogo.cupos[0];
  $('#f-imagen').value = curso.imagen || '';
  $('#f-visible').checked = curso.visible !== false;
  $('#f-error').hidden = true;
  dlg.dataset.id = esNuevo ? '' : curso.id;
  dlg.showModal();
  $('#f-titulo').focus();
}

async function guardarDesdeFormulario(accion) {
  const titulo = $('#f-titulo').value.replace(/\s+/g, ' ').trim();
  const inicio = $('#f-inicio').value;
  const fin = $('#f-fin').value;
  const error = (t) => { const e = $('#f-error'); e.textContent = t; e.hidden = false; };
  if (titulo.length < 3) return error('Escribe el nombre del curso (mínimo 3 letras).');
  if (!inicio) return error('Elige la fecha de inicio.');
  if (fin && fin < inicio) return error('La fecha de fin no puede ser anterior al inicio.');
  const curso = {
    id: dlg.dataset.id || nuevoId(),
    titulo,
    categoria: $('#f-categoria').value,
    inicio,
    fin: fin && fin !== inicio ? fin : '',
    horario: $('#f-horario').value.replace(/\s+/g, ' ').trim(),
    modalidad: $('#f-modalidad').value,
    cupo: $('#f-cupo').value,
    imagen: $('#f-imagen').value,
    visible: $('#f-visible').checked,
  };
  const i = S.cursos.findIndex((c) => c.id === curso.id);
  if (i >= 0) S.cursos[i] = curso; else S.cursos.push(curso);
  dlg.close();
  renderTodo();
  if (accion === 'publicar') await publicar();
  else avisar('Curso guardado. Falta publicar los cambios para que el sitio los muestre.');
}

function eliminar(c) {
  const antes = S.cursos;
  S.cursos = S.cursos.filter((x) => x.id !== c.id);
  renderTodo();
  avisar(`Se quitó «${c.titulo}». Falta publicar los cambios.`, { accion: { texto: 'Deshacer', fn: () => { S.cursos = antes; renderTodo(); } }, ms: 9000 });
}

/* ───────────── publicar ───────────── */

async function publicar() {
  if (S.publicando) return false;
  S.publicando = true;
  renderEstado();
  let r;
  try {
    r = await api('/api/admin/cursos', { metodo: 'PUT', cuerpo: { cursos: S.cursos } });
  } catch {
    r = { ok: false, estado: 0, datos: null };
  }
  S.publicando = false;
  if (r.estado === 401) {
    renderEstado();
    mostrarLogin({ error: 'Tu sesión venció. Entra de nuevo; tus cambios siguen guardados en esta pantalla.' });
    return false;
  }
  if (r.estado === 422) {
    renderEstado();
    avisar(h('div', {}, 'Revisa esto antes de publicar:', h('ul', {}, (r.datos?.errores || []).slice(0, 4).map((e) => h('li', {}, e)))), { tipo: 'error' });
    return false;
  }
  if (!r.ok) {
    renderEstado();
    avisar(r.datos?.mensaje || 'No se pudo publicar. Revisa tu conexión e intenta de nuevo.', { tipo: 'error' });
    return false;
  }
  S.cursos = r.datos.cursos;
  S.base = firma(S.cursos);
  S.publicado = true;
  S.actualizado = r.datos.actualizado;
  renderTodo();
  avisar('Publicado. El calendario del sitio se actualiza en menos de un minuto.');
  return true;
}

/* ───────────── difusión ───────────── */

const proximos = () => ordenar(S.cursos).filter((c) => !esPasado(c));
const cursoElegido = () => proximos().find((c) => c.id === S.dif.cursoId) || proximos()[0] || null;

function renderFormatos() {
  const caja = $('#formatos');
  if (caja.childElementCount) return;
  for (const [clave, f] of Object.entries(FORMATOS)) {
    caja.append(h('label', { class: 'formato' },
      h('input', { type: 'radio', name: 'formato', value: clave, checked: clave === S.dif.formato }),
      h('span', {}, `${f.nombre} · ${f.medida}`, h('small', {}, f.uso))));
  }
}

let pintando = 0;
async function pintar() {
  const lista = proximos();
  $('#dif-vacio').hidden = lista.length > 0;
  $('#dif').hidden = lista.length === 0;
  if (!lista.length) return;
  const turno = ++pintando;
  const d = S.dif;
  const curso = cursoElegido();
  const cursos = lista.slice(0, d.n);
  await dibujar($('#lienzo'), { tipo: d.tipo, curso, cursos, formato: d.formato, tema: d.tema });
  if (turno !== pintando) return;
  $('#medida').textContent = `${FORMATOS[d.formato].medida} px · ${FORMATOS[d.formato].uso}`;
}

function textosBase() {
  const d = S.dif;
  const datos = { tipo: d.tipo, curso: cursoElegido(), cursos: proximos().slice(0, d.n) };
  return { redes: textoRedes(datos), whatsapp: textoWhatsApp(datos) };
}

function renderTexto(regenerar) {
  const d = S.dif;
  if (regenerar) d.textos = textosBase();
  $('#texto-pub').value = d.textos[d.destino];
  $('#ayuda-texto').textContent = d.destino === 'whatsapp'
    ? 'Sube la imagen como estado y pega este texto como pie de foto. El enlace abre un chat contigo con el mensaje listo.'
    : 'Pega este texto como descripción de la publicación junto con la imagen.';
}

function renderDifusion() {
  renderFormatos();
  const lista = proximos();
  const sel = $('#dif-curso');
  if (!lista.some((c) => c.id === S.dif.cursoId)) S.dif.cursoId = lista[0]?.id ?? null;
  sel.replaceChildren(...lista.map((c) => h('option', { value: c.id }, `${cuandoCorto(c)} · ${c.titulo}`)));
  sel.value = S.dif.cursoId ?? '';
  $('#campo-curso').hidden = S.dif.tipo !== 'curso';
  $('#campo-n').hidden = S.dif.tipo !== 'agenda';
  $('#dif-n').value = String(S.dif.n);
  if (!lista.length) { pintar(); return; }
  renderTexto(true);
  pintar();
}

function irADifusion(id) {
  S.dif.tipo = 'curso';
  S.dif.cursoId = id;
  document.querySelector('input[name="tipo"][value="curso"]').checked = true;
  cambiarPestana('difusion');
  renderDifusion();
}

async function descargar() {
  const lienzo = $('#lienzo');
  const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/png'));
  if (!blob) return avisar('No se pudo crear la imagen.', { tipo: 'error' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: nombreArchivo({ tipo: S.dif.tipo, curso: cursoElegido(), formato: S.dif.formato }) });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function compartir() {
  const blob = await new Promise((ok) => $('#lienzo').toBlob(ok, 'image/png'));
  const archivo = new File([blob], nombreArchivo({ tipo: S.dif.tipo, curso: cursoElegido(), formato: S.dif.formato }), { type: 'image/png' });
  try {
    await navigator.share({ files: [archivo], text: S.dif.textos[S.dif.destino] });
  } catch (e) {
    if (e?.name !== 'AbortError') avisar('Tu navegador no pudo abrir el menú de compartir. Usa Descargar imagen.', { tipo: 'error' });
  }
}

async function copiarTexto() {
  const ta = $('#texto-pub');
  try {
    await navigator.clipboard.writeText(ta.value);
  } catch {
    ta.select();
    document.execCommand('copy');
  }
  avisar('Texto copiado.', { ms: 2500 });
}

/* ───────────── pestañas ───────────── */

function cambiarPestana(cual) {
  for (const [id, vista] of [['calendario', 'vista-calendario'], ['difusion', 'vista-difusion']]) {
    const activa = id === cual;
    const p = $(`#pestana-${id}`);
    p.setAttribute('aria-selected', String(activa));
    p.tabIndex = activa ? 0 : -1;
    $(`#${vista}`).hidden = !activa;
  }
  if (cual === 'difusion') renderDifusion();
}

/* ───────────── arranque ───────────── */

async function abrirPanel() {
  mostrarPanel();
  if (S.cargado) { renderTodo(); return; } // sesión renovada: conservamos lo que había en pantalla
  const r = await api('/api/admin/cursos');
  if (r.estado === 401) return mostrarLogin();
  if (!r.ok) {
    renderEstado();
    const b = $('#bloqueo');
    b.hidden = false;
    b.textContent = r.datos?.error === 'sin_almacen'
      ? 'Falta conectar el almacenamiento. En Vercel: Storage → Create Database → Blob, y conéctalo a este proyecto. Después vuelve a desplegar.'
      : 'No se pudo cargar la lista de cursos. Recarga la página e intenta de nuevo.';
    $('#btn-nuevo').disabled = true;
    return;
  }
  $('#bloqueo').hidden = true;
  $('#btn-nuevo').disabled = false;
  S.catalogo = r.datos.catalogo;
  S.publicado = r.datos.publicado;
  S.actualizado = r.datos.actualizado;
  let lista = r.datos.cursos;
  if (lista === null) {
    // Todavía no se publica nada desde el panel: partimos de la lista base del repositorio.
    try { lista = (await (await fetch('/cursos.json')).json()).cursos || []; } catch { lista = []; }
    S.base = '';
  } else S.base = firma(lista);
  S.cursos = lista.map((c) => ({ ...c }));
  S.cargado = true;
  prepararFormulario();
  renderTodo();
}

async function iniciar() {
  let s;
  try { s = await api('/api/admin/sesion'); } catch { s = null; }
  if (!s?.ok) return mostrarLogin({ error: 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.' });
  if (!s.datos.configurado) return mostrarLogin({ configurado: false });
  if (!s.datos.autenticado) return mostrarLogin();
  await abrirPanel();
}

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const boton = $('#btn-entrar');
  boton.disabled = true;
  boton.textContent = 'Entrando…';
  let r;
  try { r = await api('/api/admin/login', { metodo: 'POST', cuerpo: { clave: $('#clave').value } }); } catch { r = { ok: false, estado: 0 }; }
  boton.disabled = false;
  boton.textContent = 'Entrar';
  if (r.ok) { $('#clave').value = ''; return abrirPanel(); }
  const msg = r.estado === 401 ? 'La contraseña no es correcta.' : r.estado === 503 ? 'El panel todavía no tiene contraseña configurada.' : 'No se pudo entrar. Intenta de nuevo.';
  mostrarLogin({ error: msg });
  $('#clave').select();
});

$('#btn-salir').addEventListener('click', async () => {
  if (hayCambios() && !window.confirm('Tienes cambios sin publicar. Si sales se pierden. ¿Salir de todos modos?')) return;
  await api('/api/admin/sesion', { metodo: 'DELETE' }).catch(() => {});
  S.cargado = false;
  S.cursos = [];
  mostrarLogin();
});

$('#btn-publicar').addEventListener('click', publicar);
$('#btn-nuevo').addEventListener('click', () => abrirEditor({}, true));
$('#ver-pasados').addEventListener('change', (e) => { S.verPasados = e.target.checked; renderLista(); });
$('#f-cancelar').addEventListener('click', () => dlg.close());
$('#form-curso').addEventListener('submit', (e) => { e.preventDefault(); guardarDesdeFormulario(e.submitter?.value || 'guardar'); });
$('#controles').addEventListener('submit', (e) => e.preventDefault());

for (const id of ['calendario', 'difusion']) $(`#pestana-${id}`).addEventListener('click', () => cambiarPestana(id));
$('.pestanas').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const sig = document.activeElement.id === 'pestana-calendario' ? 'difusion' : 'calendario';
  cambiarPestana(sig);
  $(`#pestana-${sig}`).focus();
});

$('#controles').addEventListener('change', (e) => {
  const d = S.dif;
  if (e.target.name === 'tipo') d.tipo = e.target.value;
  else if (e.target.name === 'formato') { d.formato = e.target.value; pintar(); return; }
  else if (e.target.name === 'tema') { d.tema = e.target.value; pintar(); return; }
  else if (e.target.id === 'dif-curso') d.cursoId = e.target.value;
  else if (e.target.id === 'dif-n') d.n = Number(e.target.value);
  renderDifusion();
});
document.querySelectorAll('input[name="destino"]').forEach((r) => r.addEventListener('change', () => { S.dif.destino = r.value; renderTexto(false); }));
$('#texto-pub').addEventListener('input', (e) => { S.dif.textos[S.dif.destino] = e.target.value; });
$('#btn-descargar').addEventListener('click', descargar);
$('#btn-copiar').addEventListener('click', copiarTexto);
$('#btn-compartir').addEventListener('click', compartir);
if (navigator.canShare?.({ files: [new File([''], 'a.png', { type: 'image/png' })] })) $('#btn-compartir').hidden = false;

window.addEventListener('beforeunload', (e) => { if (S.cargado && hayCambios() && S.publicado) { e.preventDefault(); e.returnValue = ''; } });

iniciar();
