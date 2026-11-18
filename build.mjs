import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');
const output = resolve('dist');
const staticFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'demo-state.js',
  'sw.js',
  'manifest.webmanifest',
  'icons'
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(staticFiles.map((file) => cp(resolve(root, file), resolve(output, file), { recursive: true })));

