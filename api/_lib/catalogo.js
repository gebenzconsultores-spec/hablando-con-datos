// Valores permitidos en el panel. Si agregas una categoría nueva, agrégala aquí
// y también en el mapa IMG de armarCursos() dentro de index.html.

export const CATEGORIAS = [
  'Core Tools',
  'Lean Six Sigma',
  'Sistemas de Gestión',
  'Estadística y Software',
  'Gestión de RH',
];

export const MODALIDADES = ['Online en vivo', 'Presencial', 'Híbrido'];

export const CUPOS = ['Cupo limitado', 'Últimos lugares', 'Lista de espera'];

// Fotos que ya existen en /assets y que el calendario puede mostrar al pasar el mouse.
export const IMAGENES = [
  { archivo: 'assets/4hcd.jpg', nombre: 'Línea de ensamble automotriz' },
  { archivo: 'assets/5hcd.jpg', nombre: 'Vehículo en vista explosionada' },
  { archivo: 'assets/2hcd.jpg', nombre: 'Planta industrial' },
  { archivo: 'assets/ihcd.jpg', nombre: 'Robot en línea de producción' },
  { archivo: 'assets/3hcd.jpg', nombre: 'Automóvil en taller' },
  { archivo: 'assets/6hcd.jpg', nombre: 'Casco de seguridad' },
  { archivo: 'assets/7hcd.jpg', nombre: 'Prueba de vehículo en laboratorio' },
  { archivo: 'assets/campo-1.jpg', nombre: 'Capacitación en sala' },
  { archivo: 'assets/campo-2.jpg', nombre: 'Recorrido en planta' },
  { archivo: 'assets/campo-3.jpg', nombre: 'Taller práctico' },
  { archivo: 'assets/campo-4.jpg', nombre: 'Grupo de capacitación' },
];

export const MAX_CURSOS = 80;
