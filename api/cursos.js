import { responder, soloMetodos } from './_lib/http.js';
import { leerCursos } from './_lib/store.js';

// Lista pública de cursos para el calendario del sitio. Solo expone lo necesario.
const publico = (c) => ({
  id: c.id,
  titulo: c.titulo,
  categoria: c.categoria,
  inicio: c.inicio,
  fin: c.fin || '',
  horario: c.horario || '',
  modalidad: c.modalidad,
  cupo: c.cupo,
  imagen: c.imagen || '',
});

export default async function handler(req, res) {
  if (!soloMetodos(req, res, ['GET'])) return;
  try {
    const datos = await leerCursos();
    if (!datos || !Array.isArray(datos.cursos)) {
      // Aún no se publica nada desde el panel: el sitio usa /cursos.json.
      return responder(res, 200, { publicado: false, cursos: [] }, { 'Cache-Control': 'public, max-age=0, s-maxage=30' });
    }
    const cursos = datos.cursos.filter((c) => c.visible !== false).map(publico);
    return responder(
      res,
      200,
      { publicado: true, actualizado: datos.actualizado, cursos },
      { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300' },
    );
  } catch (e) {
    console.error('[api/cursos]', e?.message || e);
    return responder(res, 503, { error: 'no_disponible' });
  }
}
