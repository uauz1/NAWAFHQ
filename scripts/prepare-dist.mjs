import { mkdir, copyFile } from 'node:fs/promises';

await mkdir('dist/api', { recursive: true });
await Promise.all([
  copyFile('api/state.js', 'dist/api/state.js'),
  copyFile('api/gemini.js', 'dist/api/gemini.js'),
  copyFile('api/worker.js', 'dist/api/worker.js'),
  copyFile('vercel.json', 'dist/vercel.json')
]);
console.log('Prepared dist API functions and cron config.');
