# Hablando con Datos — Sitio corporativo

Sitio web de **Hablando con Datos**, consultora mexicana (desde 2011) en sistemas de gestión y capacitación para la industria automotriz y manufacturera: Core Tools (AMEF, APQP, MSA, SPC, PPAP), Six Sigma, ISO 9001/14001/45001/50001, IATF 16949.

Sitio estático, sin build. HTML + CSS + JavaScript vanilla en un solo `index.html`. Rápido, accesible y con SEO listo.

## Estructura

```
index.html            Página completa (hero, microdiagnóstico, catálogo, software, contacto)
assets/logo.jpg       Logo de la empresa
assets/aiag-member.png  Sello Miembro AIAG
vercel.json           Cabeceras y configuración de Vercel
```

## Funciones incluidas

- **Hero** con visual animado nodos de datos → estructura automotriz.
- **Microdiagnóstico** interactivo (sliders → puntaje y nivel de madurez con recomendación).
- **Catálogo de cursos** filtrable (Core Tools / Six Sigma / ISO-IATF).
- **Módulo de software** con enlace directo a la plataforma: https://hcd-certificados.vercel.app/
- **WhatsApp flotante** y SEO (meta tags, Open Graph, datos estructurados schema.org).

## Ejecutar localmente

Al ser estático, basta un servidor de archivos:

```bash
# opción 1
npx serve .
# opción 2
python3 -m http.server 5173
```

Abre http://localhost:5173 (o el puerto que indique).

## Publicar en GitHub

```bash
git init
git add .
git commit -m "Sitio Hablando con Datos"
git branch -M main
git remote add origin https://github.com/USUARIO/hablando-con-datos.git
git push -u origin main
```

## Desplegar en Vercel

1. Entra a https://vercel.com → **Add New… → Project**.
2. Importa el repositorio de GitHub.
3. Framework Preset: **Other** (no requiere build). Output: raíz del repo.
4. **Deploy**. Cada `git push` a `main` re-despliega automáticamente.

## Conectar dominio de Neubox

1. En Vercel → proyecto → **Settings → Domains** → agrega `hablandocondatos.com` y `www.hablandocondatos.com`.
2. En el panel de **Neubox** (Zona DNS del dominio):
   - Registro **A** de `@` → `76.76.21.21`
   - Registro **CNAME** de `www` → `cname.vercel-dns.com`
3. Espera la propagación DNS (minutos a 24 h). Vercel emite el SSL automáticamente.

## Editar contenido

- **Cursos**: edita el arreglo `courses` en el `<script>` de `index.html`.
- **Microdiagnóstico**: edita el arreglo `dims`.
- **WhatsApp**: reemplaza `522223549353` por el número destino en los enlaces `wa.me`.

## Pendiente (próximas iteraciones)

Calendario de cursos con agendado de lugar, cotizador de servicios en tiempo real, organigrama drag-and-drop, buscador de candidatos, y páginas Nosotros / Blog.
