import { mkdir, copyFile, writeFile } from 'node:fs/promises';

await mkdir('dist/api', { recursive: true });
await mkdir('dist/assets/vendor', { recursive: true });

const threeUrl = 'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js';
const threeResponse = await fetch(threeUrl);
if (!threeResponse.ok) throw new Error(`Failed to fetch Three.js: ${threeResponse.status}`);
const threeSource = await threeResponse.text();
if (!threeSource.includes('THREE')) throw new Error('Downloaded Three.js bundle is invalid');

await Promise.all([
  copyFile('api/state.js', 'dist/api/state.js'),
  copyFile('api/gemini.js', 'dist/api/gemini.js'),
  copyFile('api/worker.js', 'dist/api/worker.js'),
  copyFile('vercel.json', 'dist/vercel.json'),
  writeFile('dist/assets/vendor/three.min.js', threeSource, 'utf8')
]);
console.log('Prepared dist API functions, bundled Three.js, and deployment config.');
