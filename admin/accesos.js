// Pestaña "Accesos": grupos de alumnos (empresa + lista con ID y contraseña del portal).
// Cada cambio se guarda de inmediato con "Guardar grupo". Todo texto de datos entra con textContent.

const alumnoNuevoId = () => `a${[...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join('')}`;

export function hacerSlug(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

/**
 * Convierte texto pegado (de Excel o de un chat) en alumnos.
 * Una persona por línea: Nombre, ID y Contraseña separados por tabulador (Excel), punto y coma o coma.
 */
export function leerLista(texto) {
  const alumnos = [];
  const dudosas = [];
  for (const cruda of String(texto ?? '').split(/\r?\n/)) {
    const linea = cruda.trim();
    if (!linea) continue;
    const sep = linea.includes('\t') ? '\t' : linea.includes(';') ? ';' : ',';
    const celdas = linea.split(sep).map((c) => c.trim().replace(/^"|"$/g, '').trim());
    if (/^(nombre|alumno|estudiante)$/i.test(celdas[0]) && /^(id|usuario)/i.test(celdas[1] || '')) continue; // encabezado
    if (celdas.length < 3 || !celdas[0] || !celdas[1] || !celdas[2]) { dudosas.push(linea); continue; }
    alumnos.push({ id: alumnoNuevoId(), nombre: celdas[0], usuario: celdas[1], clave: celdas[2] });
  }
  return { alumnos, dudosas };
}

export function iniciarAccesos({ $, h, api, avisar, alSesionVencida }) {
  const E = { grupos: [], cargado: false, edicion: null, indice: -1, slugManual: false };
  const dlg = $('#dlg-grupo');
  const origen = () => window.location.origin;
  const enlace = (g) => `${origen()}/acceso/${g.slug}`;

  async function copiar(texto, aviso) {
    try {
      await navigator.clipboard.writeText(texto);
      avisar(aviso);
    } catch {
      avisar('No se pudo copiar automáticamente. Selecciónalo y cópialo a mano.', { tipo: 'error' });
    }
  }

  function mensajeGrupo(g) {
    const lineas = [
      `Hola, para entrar al portal de certificados de ${g.empresa}:`,
      `1. Abre ${enlace(g)}`,
      '2. Busca tu nombre y pulsa "Sí, soy yo".',
      '3. Se abrirá el portal con tu ID y contraseña ya escritos; solo pulsa Entrar.',
    ];
    if (g.pin) lineas.push(`Código del grupo: ${g.pin}`);
    return lineas.join('\n');
  }

  async function guardarTodo(grupos) {
    const r = await api('/api/admin/accesos', { metodo: 'PUT', cuerpo: { grupos } });
    if (r.estado === 401) { alSesionVencida(); return { ok: false, vencida: true }; }
    if (r.estado === 422) return { ok: false, errores: r.datos?.errores || ['Revisa los datos.'] };
    if (!r.ok) return { ok: false, errores: [r.datos?.mensaje || 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.'] };
    E.grupos = r.datos.grupos;
    return { ok: true };
  }

  /* ───── lista de grupos ───── */

  function tarjeta(g, i) {
    const chips = [
      g.modalidad && h('span', { class: 'chip' }, g.modalidad),
      h('span', { class: 'chip chip--gris' }, `${g.estudiantes.length} ${g.estudiantes.length === 1 ? 'alumno' : 'alumnos'}`),
      g.pin && h('span', { class: 'chip chip--gris' }, 'Con código'),
      g.activo === false && h('span', { class: 'chip chip--aviso' }, 'Apagado'),
    ];
    return h('li', { class: `curso grupo${g.activo === false ? ' oculto' : ''}` },
      h('div', { class: 'curso__cuerpo grupo__cuerpo' },
        h('h3', {}, g.empresa),
        h('div', { class: 'chips' }, chips),
        h('p', { class: 'suave grupo__enlace' }, enlace(g))),
      h('div', { class: 'curso__acciones' },
        h('button', { class: 'btn btn--chico', type: 'button', onclick: () => abrirEditor(i) }, 'Editar'),
        h('button', { class: 'btn btn--chico', type: 'button', onclick: () => copiar(enlace(g), 'Enlace copiado.') }, 'Copiar enlace'),
        h('button', { class: 'btn btn--chico', type: 'button', onclick: () => copiar(mensajeGrupo(g), 'Mensaje copiado. Pégalo en el grupo de WhatsApp.') }, 'Copiar mensaje'),
        h('button', { class: 'btn btn--chico', type: 'button', onclick: () => alternar(i) }, g.activo === false ? 'Encender' : 'Apagar'),
        h('button', { class: 'btn btn--chico btn--peligro', type: 'button', onclick: () => eliminar(i) }, 'Eliminar')));
  }

  function render() {
    $('#lista-grupos').replaceChildren(...E.grupos.map(tarjeta));
    $('#grupos-vacio').hidden = E.grupos.length > 0;
  }

  async function alternar(i) {
    const copia = E.grupos.map((g) => ({ ...g }));
    copia[i].activo = copia[i].activo === false;
    const r = await guardarTodo(copia);
    if (!r.ok) { if (!r.vencida) avisar(r.errores[0], { tipo: 'error' }); return; }
    render();
    avisar(copia[i].activo ? 'Grupo encendido: ya se puede entrar con su enlace.' : 'Grupo apagado: su enlace ya no muestra nada.');
  }

  async function eliminar(i) {
    const g = E.grupos[i];
    if (!window.confirm(`¿Eliminar el grupo "${g.empresa}" y sus ${g.estudiantes.length} alumnos? Esto no se puede deshacer.`)) return;
    const r = await guardarTodo(E.grupos.filter((_, k) => k !== i));
    if (!r.ok) { if (!r.vencida) avisar(r.errores[0], { tipo: 'error' }); return; }
    render();
    avisar('Grupo eliminado.');
  }

  /* ───── editor ───── */

  function pintarFilas() {
    const cuerpo = $('#tabla-alumnos');
    cuerpo.replaceChildren(...E.edicion.estudiantes.map((a, k) => {
      const campo = (clave, etiqueta, extra = {}) => h('input', {
        type: 'text', value: a[clave], 'aria-label': `${etiqueta} del alumno ${k + 1}`, autocomplete: 'off', spellcheck: 'false', ...extra,
        oninput: (e) => { a[clave] = e.target.value; actualizarConteo(); },
      });
      return h('tr', {},
        h('td', {}, campo('nombre', 'Nombre', { maxlength: '100', spellcheck: 'true' })),
        h('td', {}, campo('usuario', 'ID', { maxlength: '40' })),
        h('td', {}, campo('clave', 'Contraseña', { maxlength: '60' })),
        h('td', {}, h('button', { class: 'btn btn--texto btn--chico', type: 'button', 'aria-label': `Quitar a ${a.nombre || `alumno ${k + 1}`}`, onclick: () => { E.edicion.estudiantes.splice(k, 1); pintarFilas(); } }, 'Quitar')));
    }));
    actualizarConteo();
  }

  function actualizarConteo() {
    const n = E.edicion.estudiantes.length;
    $('#conteo-alumnos').textContent = n === 0 ? 'Aún no hay alumnos.' : `${n} ${n === 1 ? 'alumno' : 'alumnos'}`;
  }

  function mostrarError(lista) {
    const caja = $('#g-error');
    caja.hidden = !lista?.length;
    if (!lista?.length) return;
    caja.replaceChildren(h('strong', {}, 'Revisa esto antes de guardar:'), h('ul', {}, lista.slice(0, 6).map((e) => h('li', {}, e))));
  }

  function abrirEditor(i) {
    E.indice = i;
    const base = i >= 0 ? E.grupos[i] : { slug: '', empresa: '', modalidad: '', pin: '', activo: true, estudiantes: [] };
    E.edicion = { ...base, estudiantes: base.estudiantes.map((a) => ({ ...a })) };
    E.slugManual = i >= 0;
    $('#dlg-grupo-titulo').textContent = i >= 0 ? `Editar grupo: ${base.empresa}` : 'Agregar grupo';
    $('#g-empresa').value = E.edicion.empresa;
    $('#g-slug').value = E.edicion.slug;
    $('#g-modalidad').value = E.edicion.modalidad;
    $('#g-pin').value = E.edicion.pin;
    $('#g-activo').checked = E.edicion.activo !== false;
    $('#g-pegar').value = '';
    $('#g-pegar-aviso').hidden = true;
    mostrarError(null);
    pintarFilas();
    dlg.showModal();
    $('#g-empresa').focus();
  }

  function leerPegado(modo) {
    const { alumnos, dudosas } = leerLista($('#g-pegar').value);
    const aviso = $('#g-pegar-aviso');
    if (!alumnos.length) {
      aviso.hidden = false;
      aviso.textContent = 'No encontré alumnos. Cada línea necesita tres datos: Nombre, ID y Contraseña.';
      return;
    }
    if (modo === 'reemplazar') E.edicion.estudiantes = alumnos;
    else E.edicion.estudiantes.push(...alumnos);
    $('#g-pegar').value = '';
    pintarFilas();
    aviso.hidden = false;
    aviso.textContent = `Se ${modo === 'reemplazar' ? 'cargaron' : 'agregaron'} ${alumnos.length} alumnos.${dudosas.length ? ` Omití ${dudosas.length} línea(s) incompleta(s): ${dudosas.slice(0, 2).join(' | ')}` : ''}`;
  }

  async function guardarGrupo() {
    const g = {
      ...E.edicion,
      empresa: $('#g-empresa').value.trim(),
      slug: $('#g-slug').value.trim().toLowerCase(),
      modalidad: $('#g-modalidad').value,
      pin: $('#g-pin').value.trim(),
      activo: $('#g-activo').checked,
    };
    const copia = E.grupos.map((x) => ({ ...x }));
    if (E.indice >= 0) copia[E.indice] = g; else copia.push(g);
    const boton = $('#g-guardar');
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    const r = await guardarTodo(copia);
    boton.disabled = false;
    boton.textContent = 'Guardar grupo';
    if (!r.ok) { if (r.vencida) dlg.close(); else mostrarError(r.errores); return; }
    dlg.close();
    render();
    avisar(`Guardado. Ya pueden entrar en ${enlace(g)}`);
  }

  /* ───── eventos ───── */

  $('#btn-nuevo-grupo').addEventListener('click', () => abrirEditor(-1));
  $('#g-cancelar').addEventListener('click', () => dlg.close());
  $('#g-guardar').addEventListener('click', guardarGrupo);
  $('#form-grupo').addEventListener('submit', (e) => { e.preventDefault(); guardarGrupo(); });
  $('#g-empresa').addEventListener('input', (e) => { if (!E.slugManual) $('#g-slug').value = hacerSlug(e.target.value); });
  $('#g-slug').addEventListener('input', () => { E.slugManual = true; });
  $('#g-agregar').addEventListener('click', () => leerPegado('agregar'));
  $('#g-reemplazar').addEventListener('click', () => leerPegado('reemplazar'));
  $('#g-fila').addEventListener('click', () => {
    E.edicion.estudiantes.push({ id: alumnoNuevoId(), nombre: '', usuario: '', clave: '' });
    pintarFilas();
    const filas = $('#tabla-alumnos').querySelectorAll('tr');
    filas[filas.length - 1]?.querySelector('input')?.focus();
  });

  return {
    async cargar() {
      if (E.cargado) { render(); return; }
      const r = await api('/api/admin/accesos');
      if (r.estado === 401) { alSesionVencida(); return; }
      if (!r.ok) {
        const b = $('#accesos-bloqueo');
        b.hidden = false;
        b.textContent = r.datos?.error === 'sin_almacen'
          ? 'Falta conectar el almacenamiento de Vercel (Storage → Blob).'
          : 'No se pudo cargar la lista de grupos. Recarga la página e intenta de nuevo.';
        $('#btn-nuevo-grupo').disabled = true;
        return;
      }
      $('#accesos-bloqueo').hidden = true;
      $('#btn-nuevo-grupo').disabled = false;
      E.grupos = r.datos.grupos;
      E.cargado = true;
      render();
    },
    reiniciar() { E.cargado = false; E.grupos = []; },
  };
}
