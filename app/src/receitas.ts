// Receitas: combinações prontas de formato, gancho e legenda. Base e fontes em docs/receitas.md.
import type { EstiloGancho, Layout } from './formatos';
import type { EstiloLegenda, Palavra } from './legenda';

export type Receita = {
  id: string;
  nome: string;
  para: string;   // uma linha: para que serve
  dica: string;   // o que a evidência diz, em uma frase
  layout: Layout;
  gancho: EstiloGancho;
  legenda: EstiloLegenda;
  gerador: string | null;
  modelos: string[]; // ganchos com lacuna ("___"): a lacuna se preenche com o que o vídeo diz
};

export const RECEITAS: Receita[] = [
  {
    id: 'direto', nome: 'Corte direto', para: 'Fala, dica, opinião',
    dica: 'Comece na frase mais forte e corte o "oi, gente": os 3 primeiros segundos decidem.',
    layout: 'cheio', gancho: 'titulo', legenda: 'bloco', gerador: null,
    modelos: ['O que quase ninguém percebe sobre ___', 'Isso aqui explica por que ___', 'A parte de ___ que ninguém explica direito', 'Ninguém te conta que ___'],
  },
  {
    id: 'sabia', nome: 'Você sabia?', para: 'Curiosidade, explicação',
    dica: 'Curiosidade nasce de uma lacuna pequena, que o próprio vídeo fecha.',
    layout: 'cheio', gancho: 'voce-sabia', legenda: 'bloco', gerador: null,
    modelos: ['que ___', 'por que ___?', 'o que acontece quando ___'],
  },
  {
    id: 'lista', nome: 'Dica rápida', para: '"3 erros", "5 passos"',
    dica: 'Número no gancho promete algo contável. Cumpra a conta no vídeo.',
    layout: 'cheio', gancho: 'lista', legenda: 'palavra', gerador: null,
    modelos: ['___ erros comuns em ___', '___ coisas que eu queria saber antes de ___', 'O passo a passo de ___ em ___ etapas', 'Em ___ segundos: como ___'],
  },
  {
    id: 'resposta', nome: 'Pergunta e resposta', para: 'Responder uma dúvida',
    dica: 'A pergunta no topo e o vídeo como resposta: a promessa se cumpre na hora. Use perguntas de verdade, do seu público.',
    layout: 'cheio', gancho: 'pergunta', legenda: 'bloco', gerador: null,
    modelos: ['Por que ___?', 'Como ___?', 'Vale a pena ___?', 'O que acontece se ___?'],
  },
  {
    id: 'duplo', nome: 'Estímulo duplo', para: 'Podcast, história longa',
    dica: 'Tela dividida não atrapalha a compreensão, mas também não prova que retém mais. Evite em política e em vídeo para crianças.',
    layout: 'dividida', gancho: 'voce-sabia', legenda: 'bloco', gerador: 'bolinhas',
    modelos: ['que ___', 'o que acontece de verdade quando ___', 'por que ___?'],
  },
  {
    id: 'mito', nome: 'Mito ou fato', para: 'Ciência, checagem, educação',
    dica: 'Contrarie a crença com fato, e mostre a fonte. Indignação contra ideia, nunca contra pessoa.',
    layout: 'cheio', gancho: 'manchete', legenda: 'bloco', gerador: null,
    modelos: ['___ não funciona do jeito que te contaram', 'Parece certo, mas ___ é um erro', 'O mito de ___ e o que os dados mostram'],
  },
  {
    id: 'frase', nome: 'Frase de impacto', para: 'Trecho marcante de palestra',
    dica: 'Curto (10 a 20 s) e feito para rever. A própria frase é o gancho.',
    layout: 'cheio', gancho: 'titulo', legenda: 'palavra', gerador: null,
    modelos: [],
  },
  {
    id: 'civico', nome: 'Cívico', para: 'Política, mandato, jornalismo',
    dica: 'Modo seguro: só ganchos tirados da fala, legenda clássica, sem tela dividida. Não corte a fala de um jeito que mude o sentido.',
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
