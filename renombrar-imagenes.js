/**
 * renombrar-imagenes.js
 * ─────────────────────────────────────────────────────────────
 * Renombra y copia todas las imágenes del catálogo a /img/
 * con el formato P001.jpg, P002.jpg, etc.
 *
 * USO:
 *   node renombrar-imagenes.js          → SIMULACIÓN (solo muestra el plan)
 *   node renombrar-imagenes.js --apply  → APLICA los cambios reales
 * ─────────────────────────────────────────────────────────────
 */

const fs   = require('fs');
const path = require('path');

const DRY_RUN = !process.argv.includes('--apply');
const BASE    = __dirname;
const SRC     = path.join(BASE, 'imagenes');
const DEST    = path.join(BASE, 'img');

// ── PRODUCTOS POR CATEGORÍA (en el mismo orden que el JSON) ──────────────────
const MAPA = {
  ROPA: [
    'P001','P002','P003','P004','P005','P006','P007','P008','P009','P010',
    'P011','P012','P013','P014','P015','P016','P017','P018','P019','P020',
    'P021','P023','P024','P025','P027','P028','P029','P031','P032','P033'
  ],
  LIMPIEZA: [
    'P034','P035','P036','P037','P038','P039','P040','P041','P042','P043',
    'P044','P045','P046','P047','P048','P049','P050','P051','P052','P053',
    'P054','P055','P056','P057','P058','P059','P060','P061','P062','P063',
    'P064','P065','P066','P067','P068','P069','P070','P071','P072','P073',
    'P074','P075','P076','P077','P078','P079','P080','P081'
  ],
  COCINA: [
    'P082','P083','P084','P085','P086','P087','P088','P089','P090','P091',
    'P092','P093','P094','P095','P096','P097','P098','P099','P100','P101',
    'P102','P103'
  ],
  AROMA: [
    'P104','P105','P106','P107','P108','P109','P110','P111','P112','P113',
    'P114','P115','P116','P117','P118','P119','P120','P121'
  ],
  AEROSOL: [
    'P122','P123','P124','P125','P126','P127','P128'
  ],
  'BAÑO': [
    'P129','P130','P131','P132','P133','P134','P135','P136','P137','P138',
    'P139','P140','P141','P142','P143','P144','P145','P146','P147','P148',
    'P149','P150','P151','P152','P153','P154','P155','P156','P157','P158',
    'P159','P160','P161','P162','P163','P164','P165','P166','P167','P168'
  ]
};

// ── HELPERS ──────────────────────────────────────────────────────────────────

/** Extrae los segundos del día desde nombre de archivo: 20260326_160041.jpg */
function toSec(filename) {
  const m = filename.match(/_(\d{2})(\d{2})(\d{2})\./);
  if (!m) return 0;
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}

/**
 * Estrategia A — STRIDE: toma cada <stride> imagen (ej: stride=2 → 0,2,4,6…)
 * Ideal cuando sabemos exactamente cuántas fotos hay por producto.
 */
function porStride(archivos, stride) {
  return archivos
    .filter((_, i) => i % stride === 0)
    .map((principal, i) => ({
      principal,
      extra: archivos[i * stride + 1] ?? null
    }));
}

/**
 * Estrategia B — GAP: agrupa por proximidad de tiempo.
 * Si dos imágenes consecutivas tienen ≤ gapSec → par (mismo producto).
 */
function agrupar(archivos, gapSec) {
  const grupos = [];
  let i = 0;
  while (i < archivos.length) {
    const actual    = archivos[i];
    const siguiente = archivos[i + 1];
    if (siguiente && Math.abs(toSec(siguiente) - toSec(actual)) <= gapSec) {
      grupos.push({ principal: actual, extra: siguiente });
      i += 2;
    } else {
      grupos.push({ principal: actual, extra: null });
      i++;
    }
  }
  return grupos;
}

/**
 * Busca el umbral de tiempo (gap) que produce EXACTAMENTE n grupos.
 * Si no lo encuentra, devuelve los primeros n archivos como fallback seguro.
 */
function mejorGap(archivos, n) {
  const umbrales = [5,10,15,20,25,30,40,50,60,75,90,120,180,300,600];
  for (const gap of umbrales) {
    const g = agrupar(archivos, gap);
    if (g.length === n) return { gap, grupos: g, metodo: `gap=${gap}s` };
    if (g.length < n) break;
  }
  // Fallback: tomar los primeros N archivos, 1:1 (extras al final se descartan)
  const grupos = archivos.slice(0, n).map(f => ({ principal: f, extra: null }));
  return { gap: null, grupos, metodo: 'primeros-N (extras al final descartados)' };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

if (DRY_RUN) {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  MODO SIMULACIÓN — no se copian archivos todavía    ║');
  console.log('║  Usa --apply para ejecutar de verdad                ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
} else {
  if (!fs.existsSync(DEST)) fs.mkdirSync(DEST);
  console.log('🚀 APLICANDO cambios reales...\n');
}

const heicPendientes = [];
const jsonUpdates    = [];
let totalOK = 0, totalWarn = 0;

for (const [categoria, productos] of Object.entries(MAPA)) {
  const carpeta = path.join(SRC, categoria);

  if (!fs.existsSync(carpeta)) {
    console.log(`⚠️  Carpeta no encontrada: imagenes/${categoria}\n`);
    totalWarn++;
    continue;
  }

  // Listar y ordenar por nombre (= orden cronológico)
  const archivos = fs.readdirSync(carpeta)
    .filter(f => /\.(jpg|jpeg|heic|png)$/i.test(f))
    .sort();

  const n     = productos.length;
  const ratio = archivos.length / n;

  // Elegir estrategia: stride exacto si ratio es entero ≥2 (ej: 60img/30prod=2)
  let metodo, grupos;
  if (Number.isInteger(ratio) && ratio >= 2) {
    grupos = porStride(archivos, ratio);
    metodo = `stride=${ratio} (${ratio} fotos/producto)`;
  } else {
    const r = mejorGap(archivos, n);
    grupos  = r.grupos;
    metodo  = r.metodo;
  }

  const match = grupos.length === n ? '✅' : '⚠️ ';
  console.log(`\n┌─ ${categoria} ${'─'.repeat(Math.max(0, 40 - categoria.length))}`);
  console.log(`│  📷 ${archivos.length} imgs → ${grupos.length} grupos [${metodo}] → ${n} productos ${match}`);

  if (grupos.length !== n) {
    console.log(`│  ⚠️  DESBALANCE: ${grupos.length} grupos vs ${n} productos`);
    totalWarn++;
  }

  const limite = Math.min(grupos.length, n);

  for (let i = 0; i < limite; i++) {
    const pid      = productos[i];
    const { principal, extra } = grupos[i];
    const extOrig  = path.extname(principal).toLowerCase();
    const esHEIC   = extOrig === '.heic';
    const destExt  = '.jpg';   // siempre guardamos como .jpg en el JSON
    const destName = `${pid}${destExt}`;
    const srcPath  = path.join(carpeta, principal);
    const destPath = path.join(DEST, destName);

    const lineaExtra = extra ? ` │ descarta: ${extra}` : '';
    const heicBadge  = esHEIC ? ' ⚠️HEIC' : '';
    console.log(`│  ${pid} ← ${principal}${lineaExtra}${heicBadge}`);

    if (!DRY_RUN) {
      fs.copyFileSync(srcPath, destPath);
    }

    if (esHEIC) heicPendientes.push({ pid, src: srcPath, dest: destPath });
    jsonUpdates.push({ pid, imagen: `img/${destName}` });
    totalOK++;
  }

  // Imágenes sobrantes (sin producto asignado)
  if (grupos.length > n) {
    const sobrantes = grupos.slice(n).map(g => g.principal).join(', ');
    console.log(`│  ⚠️  Sin producto para: ${sobrantes}`);
    totalWarn++;
  }

  console.log(`└${'─'.repeat(50)}`);
}

// ── ACTUALIZAR productos.json ─────────────────────────────────────────────────
if (!DRY_RUN) {
  const jsonPath  = path.join(BASE, 'productos.json');
  const productos = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  for (const { pid, imagen } of jsonUpdates) {
    const prod = productos.find(p => p.id === pid);
    if (prod) prod.imagen = imagen;
  }
  fs.writeFileSync(jsonPath, JSON.stringify(productos, null, 2) + '\n', 'utf8');
  console.log(`\n✅ productos.json actualizado (${jsonUpdates.length} entradas)`);
}

// ── RESUMEN FINAL ─────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log(`  Productos mapeados : ${totalOK}`);
console.log(`  Advertencias       : ${totalWarn}`);

if (heicPendientes.length > 0) {
  console.log(`\n  ⚠️  ARCHIVOS HEIC (${heicPendientes.length}) — no se muestran en Chrome:`);
  heicPendientes.forEach(h => console.log(`      ${h.pid}`));
  console.log('\n  👉 Ejecuta después: node convertir-heic.js');
}

if (DRY_RUN) {
  console.log('\n  ℹ️  Esto fue una SIMULACIÓN.');
  console.log('  Para aplicar de verdad ejecuta:');
  console.log('  node renombrar-imagenes.js --apply');
}
console.log('══════════════════════════════════════════════════════\n');
