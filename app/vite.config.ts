import { defineConfig } from 'vite';

// COOP/COEP liberam o SharedArrayBuffer: o Whisper roda em várias threads de WASM.
// Sem esses cabeçalhos (ex.: GitHub Pages) tudo funciona, só que mais devagar.
const isolamento = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  base: './',
  server: { headers: isolamento, host: true },
  preview: { headers: isolamento, host: true },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  build: { target: 'es2022' },
});
