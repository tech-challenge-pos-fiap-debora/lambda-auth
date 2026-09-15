import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const certsDir = join(dist, 'certs');

rmSync(dist, { recursive: true, force: true });
mkdirSync(certsDir, { recursive: true });

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

try {
  execSync(
    'curl -fsSL -o dist/certs/rds-combined-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem',
    { cwd: root, stdio: 'inherit' },
  );
} catch {
  console.warn('Aviso: certificado RDS não baixado (PGSSL usa rejectUnauthorized: false)');
}

console.log('Build concluído em dist/');
