/**
 * optimizar-imagenes.js
 * ─────────────────────────────────────────────────────────────
 * Convierte y optimiza TODAS las imágenes para web:
 *   • HEIC  → JPG (elimina el .heic original)
 *   • JPG   → JPG optimizado (redimensiona + comprime)
 *
 * Resultado: imágenes livianas, carga rápida en celular.
 *
 * USO:
 *   node optimizar-imagenes.js              → procesa carpeta /imagenes/
 *   node optimizar-imagenes.js --img        → procesa carpeta /img/ (desplegada)
 *   node optimizar-imagenes.js --ambas      → procesa ambas carpetas
 * ─────────────────────────────────────────────────────────────
 */

const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');

const BASE   = __dirname;
const args   = process.argv.slice(2);
const carpetas = [];

if (args.includes('--img') || args.includes('--ambas')) {
  carpetas.push(path.join(BASE, 'img'));
}
if (!args.includes('--img') || args.includes('--ambas')) {
  carpetas.push(path.join(BASE, 'imagenes'));
}

// ── CONFIGURACIÓN ────────────────────────────────────────────
const CONFIG = {
  maxAncho:  1000,   // px máximo (mantiene proporción)
  maxAlto:   1000,   // px máximo
  calidad:   82,     // % calidad JPEG (82 = buena calidad / buen peso)
};

// ── HELPERS ──────────────────────────────────────────────────
function bytesAKB(b) { return (b / 1024).toFixed(0) + ' KB'; }

function archivosRecursivos(dir, ext = ['.jpg', '.jpeg', '.heic', '.png', '.webp']) {
  const resultado = [];
  if (!fs.existsSync(dir)) return resultado;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      resultado.push(...archivosRecursivos(fullPath, ext));
    } else if (ext.includes(path.extname(entry.name).toLowerCase())) {
      resultado.push(fullPath);
    }
  }
  return resultado;
}

// ── MAIN ─────────────────────────────────────────────────────
async function procesar(carpeta) {
  const archivos = archivosRecursivos(carpeta);
  let totalOrig  = 0, totalOpt = 0, convertidos = 0, errores = 0;

  console.log(`\n📁 ${carpeta}`);
  console.log(`   ${archivos.length} archivos encontrados\n`);

  for (const srcPath of archivos) {
    const ext      = path.extname(srcPath).toLowerCase();
    const esHEIC   = ext === '.heic';
    const destPath = esHEIC
      ? srcPath.replace(/\.heic$/i, '.jpg')
      : srcPath;                             // sobreescribe el mismo .jpg

    const tamOrig = fs.statSync(srcPath).size;

    try {
      await sharp(srcPath)
        .rotate()                            // corrige orientación EXIF
        .resize(CONFIG.maxAncho, CONFIG.maxAlto, {
          fit:         'inside',
          withoutEnlargement: true,          // no agranda imágenes pequeñas
        })
        .jpeg({ quality: CONFIG.calidad, mozjpeg: true })
        .toFile(destPath + '.tmp');          // escribe en temporal primero

      // Reemplaza el original con la versión optimizada
      if (esHEIC && srcPath !== destPath) {
        fs.unlinkSync(srcPath);              // borra el .heic
      }
      fs.renameSync(destPath + '.tmp', destPath);

      const tamOpt = fs.statSync(destPath).size;
      const ahorro = Math.round((1 - tamOpt / tamOrig) * 100);
      totalOrig   += tamOrig;
      totalOpt    += tamOpt;
      convertidos++;

      const etiqueta = esHEIC ? '🔄 HEIC→JPG' : '🗜️  JPG opt ';
      console.log(`  ${etiqueta}  ${path.relative(carpeta, destPath).padEnd(35)} ${bytesAKB(tamOrig).padStart(8)} → ${bytesAKB(tamOpt).padStart(8)}  (-${ahorro}%)`);

    } catch (e) {
      // Limpia temporal si existe
      if (fs.existsSync(destPath + '.tmp')) fs.unlinkSync(destPath + '.tmp');
      console.log(`  ⚠️  ERROR  ${path.relative(carpeta, srcPath)} → ${e.message}`);
      errores++;
    }
  }

  const ahorroTotal = Math.round((1 - totalOpt / totalOrig) * 100);
  console.log(`\n  ─────────────────────────────────────────────────────────`);
  console.log(`  ✅  ${convertidos} archivos procesados  |  ${errores} errores`);
  console.log(`  📦  ${bytesAKB(totalOrig)} originales  →  ${bytesAKB(totalOpt)} optimizados  (-${ahorroTotal}%)`);
}

(async () => {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║      OPTIMIZADOR DE IMÁGENES — Casa Ahorro Catálogo     ║');
  console.log(`║  Config: max ${CONFIG.maxAncho}×${CONFIG.maxAlto}px · calidad ${CONFIG.calidad}% · mozjpeg        ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  for (const carpeta of carpetas) {
    await procesar(carpeta);
  }

  console.log('\n\n🏁 Listo. Puedes volver a desplegar en Vercel.');
})();
