// Fechas en español para el panel. Todas las fechas viajan como texto AAAA-MM-DD, sin horas,
// para que no cambien por zona horaria.

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MESES_CORTO = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export const dd = (n) => String(n).padStart(2, '0');

/** Fecha de hoy en la Ciudad de México, como AAAA-MM-DD. */
export const hoyMX = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

export function partes(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, dia: DIAS[dia], diaCorto: DIAS_CORTO[dia] };
}

export const tieneRango = (c) => Boolean(c.fin) && c.fin > c.inicio;

/** "miércoles 4 de noviembre de 2026" o "del 21 al 22 de octubre de 2026". */
export function cuandoLargo(c) {
  const a = partes(c.inicio);
  if (!tieneRango(c)) return `${a.dia} ${a.d} de ${MESES[a.m - 1]} de ${a.y}`;
  const b = partes(c.fin);
  if (a.m === b.m) return `del ${a.d} al ${b.d} de ${MESES[a.m - 1]} de ${a.y}`;
  return `del ${a.d} de ${MESES[a.m - 1]} al ${b.d} de ${MESES[b.m - 1]} de ${b.y}`;
}

/** "4 de noviembre" o "21 al 22 de octubre", sin año ni día de la semana. */
export function cuandoCorto(c) {
  const a = partes(c.inicio);
  if (!tieneRango(c)) return `${a.d} de ${MESES[a.m - 1]}`;
  const b = partes(c.fin);
  return a.m === b.m ? `${a.d} al ${b.d} de ${MESES[a.m - 1]}` : `${a.d} de ${MESES[a.m - 1]} al ${b.d} de ${MESES[b.m - 1]}`;
}

export const esPasado = (c, hoy = hoyMX()) => (c.fin || c.inicio) < hoy;
