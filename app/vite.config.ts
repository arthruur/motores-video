import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

// COOP/COEP liberam o SharedArrayBuffer: o Whisper roda em várias threads de WASM.
// Sem esses cabeçalhos (ex.: GitHub Pages) tudo funciona, só que mais devagar.
const isolamento = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  base: './',
  // HTTPS também no desenvolvimento: fora do localhost (ex.: o celular abrindo https://IP-do-PC:5173) o navegador
  // só libera WebCodecs, threads e service worker em conexão segura. O certificado é gerado na hora:
  // na 1ª vez o celular avisa que ele não é confiável; é só seguir ("Avançado" → "Continuar").
  plugins: [basicSsl()],
  server: { headers: isolamento, host: true },
  preview: { headers: isolamento, host: true },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers', '@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  build: {
    target: 'es2022',
    // fontes embutidas no CSS: no Space do HF todo binário vira um redirecionamento para o CDN, e o WebKit
    // (Safari e Chrome no iPhone) recusa a fonte vinda de lá por causa do Cross-Origin-Resource-Policy
    assetsInlineLimit: (arquivo) => (/\.(woff2?|ttf)$/.test(arquivo) ? true : undefined),
  },
});
