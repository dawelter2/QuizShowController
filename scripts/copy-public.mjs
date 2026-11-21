// Copia os assets estáticos de src/public para dist/public.
//
// O `tsc` compila apenas o TypeScript; sem esta etapa o `npm start`
// (`node dist/index.js`) não encontraria os HTML/CSS/JS servidos pelo Express.
import { cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src', 'public');
const target = join(root, 'dist', 'public');

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });

console.log(`[build] assets públicos copiados para ${target}`);
