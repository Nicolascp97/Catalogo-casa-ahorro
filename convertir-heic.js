/**
 * convertir-heic.js
 * Convierte todos los archivos .heic de /img/ a .jpg
 * Requiere: npm install heic-convert
 */
const fs   = require('fs');
const path = require('path');

async function main() {
  let convert;
  try {
    convert = require('heic-convert');
  } catch {
    console.error('❌ Módulo no encontrado. Ejecuta primero:');
    console.error('   npm install heic-convert');
    process.exit(1);
  }

  const imgDir = path.join(__dirname, 'img');
  const heics  = fs.readdirSync(imgDir).filter(f => f.toLowerCase().endsWith('.heic'));

  if (heics.length === 0) {
    console.log('✅ No hay archivos HEIC en /img/ — nada que convertir.');
    return;
  }

  console.log(`🔄 Convirtiendo ${heics.length} archivos HEIC → JPG...\n`);

  for (const file of heics) {
    const srcPath  = path.join(imgDir, file);
    const destPath = path.join(imgDir, file.replace(/\.heic$/i, '.jpg'));
    try {
      const input  = fs.readFileSync(srcPath);
      const output = await convert({ buffer: input, format: 'JPEG', quality: 0.90 });
      fs.writeFileSync(destPath, Buffer.from(output));
      fs.unlinkSync(srcPath); // elimina el .heic original
      console.log(`  ✅ ${file} → ${path.basename(destPath)}`);
    } catch (e) {
      console.log(`  ⚠️  ${file} — error: ${e.message}`);
    }
  }
  console.log('\n✅ Conversión completa.');
}

main();
