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
  'npx esbuild src/handler.ts --bundle --platform=node --target=node20 --format=cjs --outfile=dist/handler.js --external:@aws-sdk/* --external:pg',
  { cwd: root, stdio: 'inherit' },
);

execSync(
  'curl -fsSL -o dist/certs/rds-combined-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem',
  { cwd: root, stdio: 'inherit' },
);

writeFileSync(
  join(dist, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2),
);

console.log('Build concluído em dist/');
