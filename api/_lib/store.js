import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { get, put } from '@vercel/blob';

// La lista publicada vive como un solo archivo JSON en Vercel Blob.
// Para desarrollo local y pruebas se puede usar una carpeta con HCD_STORE_DIR (nunca en producción:
// el disco de Vercel se borra entre ejecuciones).

const RUTA = 'hcd/cursos.json';

export class ErrorAlmacen extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

const carpetaLocal = () => process.env.HCD_STORE_DIR || null;

function exigirAlmacen() {
  if (carpetaLocal()) return;
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    throw new ErrorAlmacen('sin_almacen', 'Falta conectar una tienda de Vercel Blob a este proyecto.');
  }
}

// Una tienda de Blob es privada o pública, y put/get deben coincidir. Probamos privada primero
// y recordamos la que funcione después de escribir.
let acceso = null;

async function conAcceso(operacion) {
  const orden = acceso ? [acceso] : ['private', 'public'];
  let primerError;
  for (const modo of orden) {
    try {
      const resultado = await operacion(modo);
      acceso = modo;
      return resultado;
    } catch (e) {
      primerError ??= e;
    }
  }
  throw primerError;
}

export async function leerCursos() {
  exigirAlmacen();
  const dir = carpetaLocal();
  if (dir) {
    try {
      return JSON.parse(await readFile(join(dir, 'cursos.json'), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }
  const modos = acceso ? [acceso] : ['private', 'public'];
  let ultimoError;
  let respondio = false; // algún intento terminó sin error (aunque el archivo no exista)
  for (const modo of modos) {
    try {
      const r = await get(RUTA, { access: modo, useCache: false });
      respondio = true;
      if (r?.stream) {
        acceso = modo;
        return JSON.parse(await new Response(r.stream).text());
      }
    } catch (e) {
      ultimoError = e;
    }
  }
  if (!respondio && ultimoError) throw ultimoError;
  return null; // todavía no se ha publicado nada
}

export async function guardarCursos(cursos) {
  exigirAlmacen();
  const actualizado = new Date().toISOString();
  const cuerpo = JSON.stringify({ version: 1, actualizado, cursos }, null, 2);
  const dir = carpetaLocal();
  if (dir) {
    await mkdir(dirname(join(dir, 'cursos.json')), { recursive: true });
    await writeFile(join(dir, 'cursos.json'), cuerpo, 'utf8');
    return actualizado;
  }
  const base = { contentType: 'application/json; charset=utf-8', addRandomSuffix: false };
  await conAcceso((modo) => put(RUTA, cuerpo, { ...base, access: modo, allowOverwrite: true, cacheControlMaxAge: 60 }));
  // Copia fechada de cada publicación, por si hay que volver atrás. Si falla, no importa.
  const sello = actualizado.replace(/[:.]/g, '-');
  put(`hcd/respaldos/cursos-${sello}.json`, cuerpo, { ...base, access: acceso, allowOverwrite: false }).catch(() => {});
  return actualizado;
}
