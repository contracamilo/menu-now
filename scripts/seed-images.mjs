// Sube las imágenes de la carta de referencia (supabase/seed-images) al bucket `images`
// del Supabase LOCAL. Solo para desarrollo: usa la clave de servicio que da `supabase status`.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const supabase = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const root = 'supabase/seed-images';
const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (types[extname(name).toLowerCase()]) yield path;
  }
}

let count = 0;
for (const file of walk(root)) {
  const objectPath = relative(root, file).split('\\').join('/');
  const { error } = await supabase.storage.from('images').upload(objectPath, readFileSync(file), {
    contentType: types[extname(file).toLowerCase()],
    cacheControl: '31536000',
    upsert: true,
  });
  if (error) throw new Error(`${objectPath}: ${error.message}`);
  count++;
}
console.log(`Subidas ${count} imágenes de ejemplo al bucket images.`);
