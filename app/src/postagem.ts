// Sugestões para postar: o texto de cada rede montado a partir do que a Prensa já sabe do vídeo (a fala transcrita,
// o gancho, a fonte e os créditos). Roda no aparelho, sem IA e sem rede: só regras, cada uma com a evidência ao lado
// (ver docs/postagem.md, mesmas marcas de docs/receitas.md: [forte], [plataforma], [fraca]).
//
// A regra de ouro é a das receitas: nada aqui inventa. A primeira linha sai do gancho ou de uma frase da própria
// fala, as hashtags saem das palavras que a pessoa disse, e a fonte vai sempre junto.
import type { Palavra } from './legenda';
import { ganchosDaFala } from './receitas';

export type Campo = { rotulo: string; texto: string; limite?: number };
export type Sugestao = { rede: string; campos: Campo[]; dicas: string[] };

export type DadosDoVideo = {
  gancho: string;
  palavras: Palavra[];
  fonte: string;
  creditoBaixo: string;
  origem: string;
  musica: string;
  hashtagsFixas: string[]; // as da pessoa (ex.: #mangaio #serrinha), sempre primeiro
};

// palavras que não dizem o assunto (artigos, preposições, verbos de ligação, muletas da fala)
const VAZIAS = new Set(`a o as os um uma uns umas de do da dos das em no na nos nas por pelo pela para pra pro com sem
sob sobre entre até e ou mas que se porque quando como onde nem já não sim muito muita muitos muitas mais menos bem
mal tão também só isso isto esse essa esses essas este esta aquele aquela aquilo ele ela eles elas eu você vocês nós
gente meu minha seu sua nosso nossa dele dela ser sou é são era foi foram está estão estava estar ter tem têm tinha
vai vão ir fazer faz fez pode podem coisa coisas tipo então né aí lá aqui agora hoje ainda sempre nunca cada todo
toda todos todas outro outra outros outras mesmo mesma porque pois assim depois antes aquilo ali qual quais quem
olha bom bem acho sabe vez vezes ano anos dia dias tudo nada algo alguém tava tô ta há houve sendo sido quase
nunca bastante pouco pouca demais realmente sério verdade jeito parte caso forma lado vídeo vídeos falar disse diz`.split(/\s+/));
const GENERICAS = new Set(['reels', 'explore', 'fyp', 'foryou', 'paravoce', 'viral', 'shorts', 'tiktok']);

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const limpa = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** #palavra: sem espaço nem pontuação (as redes cortam a hashtag no primeiro sinal) */
export function hashtag(s: string): string {
  const t = s.replace(/^#/, '').replace(/[^\p{L}\p{N}_]/gu, '');
  return t ? `#${t}` : '';
}

/** as palavras de assunto mais repetidas na fala, viradas hashtag (só o que a pessoa disse) */
export function hashtagsDaFala(palavras: Palavra[], max: number): string[] {
  const conta = new Map<string, { n: number; forma: string; primeira: number }>();
  palavras.forEach((w, i) => {
    const k = limpa(w.texto);
    if (k.length < 4 || /^\d+$/.test(k) || VAZIAS.has(k) || VAZIAS.has(semAcento(k))) return;
    const c = conta.get(semAcento(k));
    if (c) c.n++; else conta.set(semAcento(k), { n: 1, forma: k, primeira: i });
  });
  return [...conta.values()]
    .sort((a, b) => b.n - a.n || a.primeira - b.primeira) // empate: a que apareceu antes (o assunto costuma vir no começo)
    // poucas e boas: depois da mais forte, só entra palavra que a pessoa repetiu (uma palavra dita uma vez raramente é o assunto)
    .filter((c, i) => i === 0 || c.n >= 2)
    .slice(0, max)
    .map((c) => hashtag(c.forma));
}

const corta = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);

function creditos(d: DadosDoVideo): string[] {
  const l: string[] = [];
  if (d.fonte) l.push(`Fonte: ${d.fonte}`);
  if (d.origem) l.push(`Original: ${d.origem}`);
  if (d.creditoBaixo) l.push(`Vídeo de baixo: ${d.creditoBaixo}`);
  if (d.musica) l.push(`Música: ${d.musica}`);
  return l;
}

function juntarHashtags(d: DadosDoVideo, max: number): string[] {
  const fixas = d.hashtagsFixas.map(hashtag).filter((h) => h && !GENERICAS.has(limpa(h)));
  const daFala = hashtagsDaFala(d.palavras, max);
  const vistas = new Set<string>();
  return [...fixas, ...daFala].filter((h) => {
    const k = semAcento(h.toLowerCase());
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  }).slice(0, max);
}

export function sugerirPostagens(d: DadosDoVideo): Sugestao[] {
  const frases = d.palavras.length ? ganchosDaFala(d.palavras, 2) : [];
  const gancho = d.gancho.includes('___') ? '' : d.gancho.trim();
  const abre = gancho || frases[0] || '';
  // uma segunda frase da fala, diferente da primeira linha, para dar o assunto em palavras que a busca lê
  const assunto = frases.find((f) => f !== abre && !abre.includes(f.replace(/…$/, ''))) ?? '';
  const cred = creditos(d);

  const shortsTags = juntarHashtags(d, 3);
  const reelsTags = juntarHashtags(d, 5);
  const tiktokTags = juntarHashtags(d, 4);

  return [
    {
      rede: 'Shorts',
      campos: [
        { rotulo: 'Título', texto: corta(abre, 100), limite: 100 },
        { rotulo: 'Descrição', texto: [assunto, ...cred, '', shortsTags.join(' ')].filter((l, i, a) => l || (i > 0 && a[i - 1])).join('\n').trim(), limite: 5000 },
      ],
      dicas: [
        'Título: até 100 caracteres. Vai o gancho, que é a promessa que o vídeo cumpre.',
        'Até 3 hashtags: as 3 primeiras da descrição aparecem acima do título. Com mais de 60, o YouTube ignora todas. [plataforma]',
        'Hashtag que não tem a ver com o vídeo é tratada como enganosa pelo YouTube. [plataforma]',
      ],
    },
    {
      rede: 'Reels',
      campos: [
        { rotulo: 'Legenda', texto: [corta(abre, 125), assunto, '', ...cred, '', reelsTags.join(' ')].filter((l, i, a) => l || (i > 0 && a[i - 1])).join('\n').trim(), limite: 2200 },
        { rotulo: 'Chamada (opcional)', texto: 'Manda pra alguém que precisa ver isso.' },
      ],
      dicas: [
        'Primeira linha com o assunto: só uns 125 caracteres aparecem antes do "mais". [fraca]',
        'No máximo 5 hashtags, específicas. O Instagram limitou a 5 em dez/2025 e pede para evitar genéricas como #reels e #explore. [plataforma]',
        'Envios por DM em relação ao alcance estão entre os sinais mais importantes, segundo Adam Mosseri (chefe do Instagram). Por isso a chamada sugerida é para mandar, e só use se o vídeo merecer. [plataforma]',
      ],
    },
    {
      rede: 'TikTok',
      campos: [
        { rotulo: 'Legenda', texto: [corta([abre, assunto].filter(Boolean).join(' '), 150), ...cred, tiktokTags.join(' ')].filter(Boolean).join('\n'), limite: 2200 },
      ],
      dicas: [
        'Legenda curta, com as palavras do assunto escritas: a busca do TikTok lê a legenda, não o texto queimado no vídeo. [fraca]',
        'Poucas hashtags específicas. Não há estudo mostrando que mais hashtags trazem mais alcance. [fraca]',
        'O limite oficial não foi confirmado (fala-se em 2.200 e em 4.000 caracteres). A Prensa conta até 2.200 para ficar no seguro.',
      ],
    },
    {
      rede: 'Kwai e Status',
      campos: [{ rotulo: 'Legenda', texto: [corta(abre, 120), ...cred.slice(0, 1)].filter(Boolean).join('\n') }],
      dicas: ['Limites não confirmados em fonte oficial: legenda curta e a fonte.'],
    },
  ];
}
