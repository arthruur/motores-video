// Integração com o acervo de mídias livres: tenta a pasta local (mesma origem)
// e recorre ao Hugging Face Datasets para buscar clipes revisados com CORS liberado.
// Faz cache com CacheStorage para funcionar 100% offline após a 1ª escolha.

export type ClipeAcervo = {
  id: string;
  arquivo: string;
  titulo: string;
  credito: string;
  licenca: string;
  revisado: boolean;
  categoria?: string;
  sha256?: string;
  share_alike?: boolean;
};

export type CatalogoAcervo = {
  clipes: ClipeAcervo[];
};

// URL padrão do dataset no Hugging Face (pode ser sobrescrita)
export const HF_DATASET_URL = 'https://huggingface.co/datasets/arthruur/prensa-acervo/resolve/main';
const CACHE_NOME = 'prensa-acervo';
// servidor de páginas costuma devolver o index.html (200) para arquivo que não existe: só vale se for vídeo de verdade
const ehVideo = (r: Response) => r.ok && (r.headers.get('content-type') ?? '').startsWith('video/');

/** revisados primeiro; os não revisados vêm depois e a interface os mostra à parte, com a licença não confirmada */
const ordenar = (clipes: ClipeAcervo[]) => [...clipes.filter((c) => c.revisado), ...clipes.filter((c) => !c.revisado)];

/** Busca o manifesto acervo.json local ou remotamente no Hugging Face Datasets */
export async function carregarManifesto(): Promise<ClipeAcervo[]> {
  // 1. Tenta acervo local (distribuído junto com o build ou dev server)
  try {
    const rLocal = await fetch('./acervo/acervo.json');
    if (rLocal.ok) {
      const dados = (await rLocal.json()) as CatalogoAcervo;
      if (dados.clipes?.length) return ordenar(dados.clipes);
    }
  } catch {
    // continua para o remoto
  }

  // 2. Se local não existir, busca no Hugging Face Datasets
  try {
    const rRemoto = await fetch(`${HF_DATASET_URL}/acervo.json`, { mode: 'cors' });
    if (rRemoto.ok) {
      const dados = (await rRemoto.json()) as CatalogoAcervo;
      return ordenar(dados.clipes || []);
    }
  } catch {
    // sem rede e sem acervo local
  }

  return [];
}

/** Obtém o arquivo de vídeo (Blob) tentando local, cache offline e Hugging Face */
export async function baixarClipe(clipe: ClipeAcervo, onProgresso?: (msg: string) => void): Promise<Blob> {
  const cache = typeof caches !== 'undefined' ? await caches.open(CACHE_NOME) : null;
  const chaveCache = `./acervo/${clipe.arquivo}`;

  // 1. Checa no cache local do navegador (offline-first)
  if (cache) {
    const respCache = await cache.match(chaveCache);
    if (respCache && ehVideo(respCache)) return respCache.blob();
    if (respCache) await cache.delete(chaveCache); // entrada estragada de uma versão anterior
  }

  // 2. Tenta servidor local
  try {
    const respLocal = await fetch(chaveCache);
    if (ehVideo(respLocal)) {
      if (cache) await cache.put(chaveCache, respLocal.clone());
      return respLocal.blob();
    }
  } catch {
    // tenta remoto
  }

  // 3. Baixa do Hugging Face Datasets
  onProgresso?.('Baixando clipe do Hugging Face…');
  const urlsRemotas = [
    `${HF_DATASET_URL}/${clipe.arquivo}`,
    `${HF_DATASET_URL}/clipes/${clipe.arquivo}`,
  ];

  for (const url of urlsRemotas) {
    try {
      const respRemota = await fetch(url, { mode: 'cors' });
      if (ehVideo(respRemota)) {
        if (cache) await cache.put(chaveCache, respRemota.clone());
        return respRemota.blob();
      }
    } catch {
      // tenta próxima url
    }
  }

  throw new Error(`Não foi possível baixar o clipe ${clipe.id}. Verifique a conexão com a internet.`);
}

/** URL de onde o clipe pode ser lido (para a miniatura da galeria): a pasta local, se ele estiver lá, senão o dataset */
export async function urlDoClipe(clipe: ClipeAcervo): Promise<string | null> {
  const candidatos = [`./acervo/${clipe.arquivo}`, `${HF_DATASET_URL}/clipes/${clipe.arquivo}`, `${HF_DATASET_URL}/${clipe.arquivo}`];
  for (const url of candidatos) {
    try {
      const r = await fetch(url, { method: 'HEAD', mode: url.startsWith('http') ? 'cors' : 'same-origin' });
      if (ehVideo(r)) return url;
    } catch {
      // tenta a próxima
    }
  }
  return null;
}
