// Página pública de acceso: el alumno busca su nombre y entra al portal con ID y contraseña ya escritos.
// La lista trae solo nombres; las credenciales se piden de una en una, cuando el alumno confirma.

const PORTAL = 'https://certificados.hablandocondatos.com/estudiante/acceso';
const $ = (s) => document.querySelector(s);

const slug = (location.pathname.split('/').filter(Boolean).pop() || '').toLowerCase();
const claveCodigo = `hcd_codigo_${slug}`;
let codigo = '';
let alumnos = [];
let elegido = null;
let datosCreds = null;

try { codigo = sessionStorage.getItem(claveCodigo) || ''; } catch { /* sin almacenamiento */ }

const normalizar = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

async function pedir(extra = '') {
  const r = await fetch(`/api/acceso?g=${encodeURIComponent(slug)}${extra}`, {
    headers: codigo ? { 'x-codigo': codigo } : {},
    cache: 'no-store',
  });
  let datos = null;
  try { datos = await r.json(); } catch { /* sin cuerpo */ }
  return { ok: r.ok, estado: r.status, datos };
}

function mostrarEstado(texto) {
  const e = $('#estado');
  e.hidden = !texto;
  e.textContent = texto || '';
}

function mostrarEncabezado(d) {
  $('#empresa').textContent = d.empresa;
  document.title = `Acceso · ${d.empresa} · Hablando con Datos`;
  const m = $('#modalidad');
  m.hidden = !d.modalidad;
  m.textContent = d.modalidad || '';
}

function pintarLista() {
  const q = normalizar($('#buscar').value.trim());
  const visibles = alumnos.filter((a) => normalizar(a.nombre).includes(q));
  $('#nombres').replaceChildren(...visibles.map((a) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'nombre';
    const ini = document.createElement('span');
    ini.className = 'nombre__inicial';
    ini.textContent = a.nombre.trim().charAt(0).toUpperCase();
    ini.setAttribute('aria-hidden', 'true');
    const txt = document.createElement('span');
    txt.className = 'nombre__texto';
    txt.textContent = a.nombre;
    const fl = document.createElement('span');
    fl.className = 'nombre__flecha';
    fl.textContent = '›';
    fl.setAttribute('aria-hidden', 'true');
    boton.append(ini, txt, fl);
    boton.addEventListener('click', () => abrirHoja(a));
    const li = document.createElement('li');
    li.append(boton);
    return li;
  }));
  $('#conteo').textContent = `${visibles.length} de ${alumnos.length} alumnos`;
  $('#sin-resultados').hidden = visibles.length > 0;
}

function mostrarLista(d) {
  alumnos = [...d.estudiantes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  $('#vista-codigo').hidden = true;
  $('#vista-lista').hidden = false;
  mostrarEstado('');
  if (!alumnos.length) mostrarEstado('Este grupo todavía no tiene alumnos. Pide ayuda a tu instructor.');
  pintarLista();
}

async function cargar() {
  mostrarEstado('Cargando…');
  if (!slug || slug === 'acceso') return mostrarEstado('Este enlace está incompleto. Pide el enlace correcto a tu instructor.');
  let r;
  try { r = await pedir(); } catch { return mostrarEstado('No pudimos conectarnos. Revisa tu internet e intenta de nuevo.'); }
  if (r.estado === 404) return mostrarEstado('Este enlace ya no está activo. Pide el enlace actualizado a tu instructor.');
  if (r.estado === 401) {
    codigo = '';
    try { sessionStorage.removeItem(claveCodigo); } catch { /* ok */ }
    return pedirCodigo('Ese código no es correcto. Revísalo e intenta de nuevo.', r.datos);
  }
  if (!r.ok) return mostrarEstado('Algo salió mal de nuestro lado. Intenta de nuevo en un momento.');
  mostrarEncabezado(r.datos);
  if (r.datos.requierePin && !r.datos.estudiantes) return pedirCodigo('', r.datos);
  mostrarLista(r.datos);
}

function pedirCodigo(error, datos) {
  if (datos?.empresa) mostrarEncabezado(datos);
  mostrarEstado('');
  $('#vista-lista').hidden = true;
  $('#vista-codigo').hidden = false;
  const e = $('#codigo-error');
  e.hidden = !error;
  e.textContent = error || '';
  $('#codigo').focus();
}

/* ── confirmación y salto al portal ── */

function abrirHoja(a) {
  elegido = a;
  datosCreds = null;
  $('#hoja-titulo').textContent = `¿Eres ${a.nombre}?`;
  $('#hoja-id').textContent = a.usuario ? `ID de acceso: ${a.usuario}` : '';
  $('#hoja-datos').hidden = true;
  $('#hoja-estado').hidden = true;
  $('#btn-si').disabled = false;
  $('#btn-datos').textContent = 'Mostrar mis datos';
  $('#hoja').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#btn-si').focus();
}

function cerrarHoja() {
  $('#hoja').hidden = true;
  document.body.style.overflow = '';
  elegido = null;
  datosCreds = null;
}

async function traerCredenciales() {
  if (datosCreds) return datosCreds;
  const r = await pedir(`&e=${encodeURIComponent(elegido.id)}`);
  if (r.estado === 401) { cerrarHoja(); await cargar(); return null; }
  if (!r.ok) throw new Error('sin_datos');
  datosCreds = r.datos;
  return datosCreds;
}

function avisoHoja(texto) {
  const e = $('#hoja-estado');
  e.hidden = !texto;
  e.textContent = texto || '';
}

async function irAlPortal() {
  const boton = $('#btn-si');
  boton.disabled = true;
  avisoHoja('Preparando tu acceso…');
  try {
    const d = await traerCredenciales();
    if (!d) return;
    // Los datos van en el fragmento (#): no viajan por la red ni quedan en registros del servidor.
    const destino = `${PORTAL}#u=${encodeURIComponent(d.usuario)}&p=${encodeURIComponent(d.clave)}`;
    avisoHoja('Abriendo el portal…');
    window.location.assign(destino);
    setTimeout(() => { boton.disabled = false; avisoHoja('Si el portal no se abrió, toca el botón otra vez o muestra tus datos.'); }, 5000);
  } catch {
    boton.disabled = false;
    avisoHoja('No pudimos preparar tu acceso. Intenta de nuevo.');
  }
}

async function alternarDatos() {
  const caja = $('#hoja-datos');
  if (!caja.hidden) { caja.hidden = true; $('#btn-datos').textContent = 'Mostrar mis datos'; return; }
  try {
    const d = await traerCredenciales();
    if (!d) return;
    $('#datos-usuario').textContent = d.usuario;
    $('#datos-clave').textContent = d.clave;
    caja.hidden = false;
    $('#btn-datos').textContent = 'Ocultar mis datos';
  } catch {
    avisoHoja('No pudimos traer tus datos. Intenta de nuevo.');
  }
}

$('#buscar').addEventListener('input', pintarLista);
$('#btn-si').addEventListener('click', irAlPortal);
$('#btn-datos').addEventListener('click', alternarDatos);
document.querySelectorAll('[data-cerrar]').forEach((e) => e.addEventListener('click', cerrarHoja));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#hoja').hidden) cerrarHoja(); });
$('#form-codigo').addEventListener('submit', (e) => {
  e.preventDefault();
  codigo = $('#codigo').value.trim();
  try { sessionStorage.setItem(claveCodigo, codigo); } catch { /* ok */ }
  cargar();
});

cargar();
