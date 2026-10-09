// Receitas: combinações prontas de formato, gancho e legenda. Base e fontes em docs/receitas.md.
import type { EstiloGancho, Layout } from './formatos';
import type { EstiloLegenda, Palavra } from './legenda';

export type Receita = {
  id: string;
  nome: string;
  para: string;   // uma linha: para que serve
  ideal: string;  // que vídeo de origem combina com a receita
  dica: string;   // uma dica prática, em uma frase
  layout: Layout;
  gancho: EstiloGancho;
  legenda: EstiloLegenda;
  gerador: string | null;
  modelos: string[]; // ganchos com lacuna ("___"): a lacuna se preenche com o que o vídeo diz
};

export const RECEITAS: Receita[] = [
  {
    id: 'mangaio', nome: 'Aventura do Mangaio', para: 'Fala com o cesto embaixo',
    ideal: 'Fala sobre feira, comida e quem produz: o Mangaio anda, pula e vende embaixo.',
    dica: 'Ponha o "Baião do Mangaio" no som: os pulos e as piruetas caem na batida.',
    layout: 'dividida', gancho: 'titulo', legenda: 'bloco', gerador: 'mangaio-aventura',
    modelos: ['Quem planta ___ mora mais perto do que você pensa', 'O caminho de ___ até a sua mesa', 'Ninguém te conta que ___'],
  },
  {
    id: 'direto', nome: 'Corte direto', para: 'Fala, dica, opinião',
    ideal: 'Alguém falando para a câmera: opinião, dica, explicação curta.',
    dica: 'Comece na frase mais forte e corte o "oi, gente": os 3 primeiros segundos decidem.',
    layout: 'cheio', gancho: 'titulo', legenda: 'bloco', gerador: null,
    modelos: ['O que quase ninguém percebe sobre ___', 'Isso aqui explica por que ___', 'A parte de ___ que ninguém explica direito', 'Ninguém te conta que ___'],
  },
  {
    id: 'sabia', nome: 'Você sabia?', para: 'Curiosidade, explicação',
    ideal: 'Explicação de um fato curioso: aula, divulgação científica, curiosidade.',
    dica: 'Uma pergunta pequena que o próprio vídeo responde prende mais que uma promessa grande.',
    layout: 'cheio', gancho: 'voce-sabia', legenda: 'bloco', gerador: null,
    modelos: ['que ___', 'por que ___?', 'o que acontece quando ___'],
  },
  {
    id: 'lista', nome: 'Dica rápida', para: '"3 erros", "5 passos"',
    ideal: 'Você contando passos, erros ou dicas em ordem (1, 2, 3...).',
    dica: 'Ponha o número no começo do gancho: ele aparece gigante.',
    layout: 'cheio', gancho: 'lista', legenda: 'palavra', gerador: null,
    modelos: ['3 erros comuns em ___', '5 coisas que eu queria saber antes de ___', 'O passo a passo de ___', 'Em 30 segundos: como ___'],
  },
  {
    id: 'resposta', nome: 'Pergunta e resposta', para: 'Responder uma dúvida',
    ideal: 'Você respondendo a pergunta de alguém (comentário, direct, plateia).',
    dica: 'Cole a pergunta como ela chegou: o vídeo é a resposta.',
    layout: 'cheio', gancho: 'pergunta', legenda: 'bloco', gerador: null,
    modelos: ['Por que ___?', 'Como ___?', 'Vale a pena ___?', 'O que acontece se ___?'],
  },
  {
    id: 'duplo', nome: 'Estímulo duplo', para: 'Podcast, história longa',
    ideal: 'Podcast, conversa longa ou história contada, com pouco movimento na imagem.',
    dica: 'Funciona melhor quando a imagem de cima é parada: a de baixo dá o movimento.',
    layout: 'dividida', gancho: 'voce-sabia', legenda: 'bloco', gerador: 'bolinhas',
    modelos: ['que ___', 'o que acontece de verdade quando ___', 'por que ___?'],
  },
  {
    id: 'mito', nome: 'Mito ou fato', para: 'Ciência, checagem, educação',
    ideal: 'Explicação que desmente uma crença comum.',
    dica: 'Diga o mito no gancho e o fato logo depois.',
    layout: 'cheio', gancho: 'manchete', legenda: 'bloco', gerador: null,
    modelos: ['___ não funciona do jeito que te contaram', 'Parece certo, mas ___ é um erro', 'O mito de ___'],
  },
  {
    id: 'frase', nome: 'Frase de impacto', para: 'Trecho marcante de palestra',
    ideal: 'Um trecho curto e marcante de palestra, aula ou entrevista (10 a 20 s).',
    dica: 'Curto e feito para rever: a própria frase é o gancho.',
    layout: 'cheio', gancho: 'titulo', legenda: 'palavra', gerador: null,
    modelos: [],
  },
  {
    id: 'civico', nome: 'Cívico', para: 'Política, mandato, jornalismo',
    ideal: 'Fala pública, mandato, entrevista ou cobertura jornalística.',
    dica: 'Gancho tirado da própria fala e legenda clássica, sem tela dividida.',
    layout: 'cheio', gancho: 'titulo', legenda: 'bloco', gerador: null,
    modelos: [],
  },
];

const FORTES = /\b(nunca|ninguém|todo mundo|verdade|segredo|erro|errado|mito|sempre|por que|porque|como|você|ninguem|maior|menor|único|primeir[oa]|import|precis|problema)\w*/giu;

/** frases da própria fala que dão bom gancho: curtas, com número, pergunta, "você", contraste */
export function ganchosDaFala(palavras: Palavra[], max = 3): string[] {
  const frases: string[] = [];
  let cur: string[] = [];
  for (const w of palavras) {
    cur.push(w.texto);
    if (/[.!?…]$/.test(w.texto)) { frases.push(cur.join(' ')); cur = []; }
  }
  if (cur.length) frases.push(cur.join(' '));
  const nota = (f: string, i: number) => {
    const n = f.split(/\s+/).length;
    let s = 0;
    if (/\?$/.test(f)) s += 3;
    if (/\d/.test(f)) s += 2;
    s += Math.min(3, (f.match(FORTES) ?? []).length);
    if (/\b(mas|só que|porém)\b/i.test(f)) s += 1;
    if (n >= 4 && n <= 12) s += 2; else if (n > 18) s -= 3;
    if (i < 3) s += 1; // o começo costuma apresentar o assunto
    return s;
  };
  return frases
    .map((f, i) => ({ f: f.replace(/^(então|bom|olha|gente|né|tipo|aí),?\s+/i, ''), s: nota(f, i) }))
    .filter((x) => x.f.length >= 12)
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((x) => (x.f.length > 80 ? `${x.f.slice(0, 77).replace(/\s+\S*$/, '')}…` : x.f));
}
