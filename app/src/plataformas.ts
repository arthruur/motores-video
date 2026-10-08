// Perfis de exportação. Limites com a fonte em docs/plataformas.md: eles mudam, confira antes de confiar.
// Todos usam 1080x1920, H.264 + AAC, 30 fps e a mesma faixa segura (a interseção), então um único render serve a todos.

export type Plataforma = {
  id: string;
  nome: string;
  maxDur: number;         // s; acima disso o vídeo é dividido em partes (dividir) ou cortado
  dividir: boolean;
  recomendado?: number;   // s; acima disso só avisa
  bitrate?: number;       // bps; quando definido, recomprime para um arquivo menor
  confirmado: boolean;    // limite visto em fonte oficial?
};

export const PLATAFORMAS: Plataforma[] = [
  { id: 'tiktok', nome: 'TikTok', maxDur: 600, dividir: false, confirmado: false },
  { id: 'reels', nome: 'Reels', maxDur: 900, dividir: false, recomendado: 180, confirmado: false },
  { id: 'shorts', nome: 'Shorts', maxDur: 180, dividir: false, confirmado: true },
  { id: 'kwai', nome: 'Kwai', maxDur: 60, dividir: false, confirmado: false },
  { id: 'whatsapp', nome: 'Status do WhatsApp', maxDur: 60, dividir: true, confirmado: false }, // o WhatsApp recomprime sozinho
];
