import { mkdir, copyFile } from 'node:fs/promises';

await mkdir('dist/api', { recursive: true });
await mkdir('dist/assets/vendor', { recursive: true });
await Promise.all([
  copyFile('api/state.js', 'dist/api/state.js'),
  copyFile('api/gemini.js', 'dist/api/gemini.js'),
  copyFile('api/worker.js', 'dist/api/worker.js'),
  copyFile('vercel.json', 'dist/vercel.json'),
  copyFile('node_modules/three/build/three.min.js', 'dist/assets/vendor/three.min.js')
]);
console.log('Prepared dist API functions, local Three.js, and deployment config.');
