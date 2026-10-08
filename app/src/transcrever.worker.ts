// Whisper no próprio aparelho (transformers.js, WASM). Na 1ª vez baixa o modelo (77 MB) e guarda no cache do navegador.
import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

const MODELO = 'onnx-community/whisper-base_timestamped';
// 8 bits: 77 MB (contra 206 MB do fp32 + q4) e, no teste, transcrição até melhor
const DTYPE = { encoder_model: 'q8', decoder_model_merged: 'q8' } as const;
let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function carregar(): Promise<AutomaticSpeechRecognitionPipeline> {
  const progresso = (p: { status: string; progress?: number; file?: string }) => {
    if (p.status === 'progress' && p.file?.endsWith('.onnx')) self.postMessage({ tipo: 'baixando', progresso: (p.progress ?? 0) / 100 });
  };
  return pipeline('automatic-speech-recognition', MODELO, { device: 'wasm', dtype: DTYPE, progress_callback: progresso }) as Promise<AutomaticSpeechRecognitionPipeline>;
}

self.onmessage = async (e: MessageEvent<{ audio: Float32Array; idioma: string }>) => {
  try {
    asr ??= carregar();
    const modelo = await asr;
    self.postMessage({ tipo: 'ouvindo' });
    const out = await modelo(e.data.audio, { return_timestamps: 'word', language: e.data.idioma, task: 'transcribe', chunk_length_s: 30 });
    type Pedaco = { text: string; timestamp: [number | null, number | null] };
    const chunks = ((Array.isArray(out) ? out[0] : out) as { chunks?: Pedaco[] }).chunks ?? [];
    const palavras = chunks
      .map((c: Pedaco) => ({ texto: c.text.trim(), inicio: c.timestamp[0] ?? 0, fim: c.timestamp[1] ?? (c.timestamp[0] ?? 0) + 0.3 }))
      .filter((w: { texto: string }) => w.texto);
    self.postMessage({ tipo: 'pronto', palavras });
  } catch (err) {
    asr = null;
    self.postMessage({ tipo: 'erro', mensagem: String((err as Error)?.message ?? err) });
  }
};
