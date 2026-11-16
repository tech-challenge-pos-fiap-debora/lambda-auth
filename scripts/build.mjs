import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

execSync(
  'npx esbuild src/handler.ts --bundle --platform=node --target=node20 --format=cjs --outfile=dist/handler.js --external:@aws-sdk/*',
  { cwd: root, stdio: 'inherit' },
);

// Precisa existir antes de qualquer passo que possa falhar: o package.json da raiz
// tem "type":"module" e, sem este arquivo, o Node trata handler.js como ESM e o
// export CJS some — a Lambda falha com "Unable to import module 'handler'".
writeFileSync(
  join(dist, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2),
);

console.log('Build concluído em dist/');
