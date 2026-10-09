"""Baixador e organizador em lote de vídeos do Twitter/X para a Prensa e acervo HF.

Baixa cada tweet, extrai metadados (autor, título, url original, duração),
converte para MP4 compatível e organiza em uma pasta de saída.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import yt_dlp

TWEETS = [
    "https://x.com/zanittei/status/2108650614733312491",
    "https://x.com/mamunias/status/2108633338755879180",
    "https://x.com/robertxyo/status/2108565340875608412",
    "https://x.com/jobecoffe/status/2108415891633475631",
    "https://x.com/yehsXX/status/2108480501464055850",
    "https://x.com/sacoritiba/status/2108396906053251492",
    "https://x.com/vaidesmaiar/status/2108667311901008173",
    "https://x.com/jobecoffe/status/2108634724004720864",
    "https://x.com/satanktaes/status/2108669002482401404",
    "https://x.com/tudokatysite/status/2108620789759320229",
    "https://x.com/JairBolsonano_/status/2108596287780376969",
    "https://x.com/gustavocagnotto/status/2108560401679925521",
    "https://x.com/mikemybro/status/2108535593718161700",
    "https://x.com/ervemore/status/2108661714501992654",
    "https://x.com/amorimbaiano/status/2108400730961006886",
    "https://x.com/Gerasoundz/status/2108580416810561928",
    "https://x.com/VoleifacomLula/status/2108618501166334418",
    "https://x.com/caiobrtb/status/2108572921811608047",
    "https://x.com/HelenaCarol_/status/2108563759296094633",
    "https://x.com/minyoongibe/status/2108563810881605825",
    "https://x.com/hooneck/status/2108580586558251426",
    "https://x.com/brentfxiyaz/status/2108532987578958230",
    "https://x.com/rapfalando/status/2108383813801832856",
    "https://x.com/ominlewa/status/2108644511224123640",
    "https://x.com/ikeufofinho/status/2108586923421741400",
    "https://x.com/ikeufofinho/status/2108587402570682815",
    "https://x.com/ikeufofinho/status/2108587476629553325",
    "https://x.com/ikeufofinho/status/2108587735124435426",
    "https://x.com/ikeufofinho/status/2108587865621811536",
    "https://x.com/ikeufofinho/status/2108588131607773662",
    "https://x.com/ikeufofinho/status/2108588564833259921",
    "https://x.com/ikeufofinho/status/2108588944778490141",
    "https://x.com/ikeufofinho/status/2108591106069807512",
    "https://x.com/ikeufofinho/status/2108591618445992427",
    "https://x.com/ikeufofinho/status/2108591982616379468",
    "https://x.com/ikeufofinho/status/2108592570670432678",
    "https://x.com/ikeufofinho/status/2108601192905359467",
    "https://x.com/ikeufofinho/status/2108601617134047649",
    "https://x.com/ikeufofinho/status/2108615142409986544",
    "https://x.com/ikeufofinho/status/2108628175102283955",
    "https://x.com/ikeufofinho/status/2108644141668430097",
]


def limpar_slug(texto: str) -> str:
    texto = re.sub(r"[^\w\s-]", "", texto, flags=re.UNICODE).strip().lower()
    return re.sub(r"[-\s]+", "-", texto)[:50] or "video"


def baixar_todos(pasta_saida: Path):
    pasta_saida.mkdir(parents=True, exist_ok=True)
    tweets_unicos = list(dict.fromkeys([t.split("?")[0].strip() for t in TWEETS if t.strip()]))

    print(f"Total de tweets únicos para baixar: {len(tweets_unicos)}")
    metadados = []

    for i, url in enumerate(tweets_unicos, 1):
        print(f"\n[{i}/{len(tweets_unicos)}] Baixando: {url}")
        
        # Extrai id do tweet
        match = re.search(r"/status/(\d+)", url)
        tweet_id = match.group(1) if match else str(i)

        ja_existe = list(pasta_saida.glob(f"tweet_{tweet_id}_*.mp4"))
        if ja_existe:
            arq_path = ja_existe[0]
            print(f"  [CACHE] Ja existe: {arq_path.name}")
            metadados.append({
                "id": f"lula-viral-{tweet_id}",
                "tweet_id": tweet_id,
                "url": url,
                "titulo": f"Tweet {tweet_id}",
                "autor": f"@{url.split('/status/')[0].split('/')[-1]}",
                "duracao_s": 0,
                "arquivo": arq_path.name,
                "categoria": "lula-virais",
                "receita_sugerida": "Aventura do Mangaio",
            })
            continue

        opcoes = {
            "outtmpl": str(pasta_saida / f"tweet_{tweet_id}_%(id)s.%(ext)s"),
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "merge_output_format": "mp4",
            "format": "bv*[vcodec^=avc]+ba[ext=m4a]/b[vcodec^=avc]/bv*+ba/b",
            "socket_timeout": 30,
        }

        try:
            with yt_dlp.YoutubeDL(opcoes) as ydl:
                info = ydl.extract_info(url, download=True)
                if not info:
                    print("  -> Nenhum dado retornado.")
                    continue
                if info.get("_type") == "playlist" and info.get("entries"):
                    info = next(iter(info["entries"]))

                titulo = info.get("title") or info.get("fulltitle") or f"Tweet {tweet_id}"
                autor = info.get("uploader_id") or info.get("uploader") or ""
                duracao = info.get("duration") or 0

                # Acha o arquivo baixado
                candidatos = list(pasta_saida.glob(f"tweet_{tweet_id}_*.mp4"))
                if not candidatos:
                    # fallback procurando qualquer arquivo recente
                    candidatos = list(pasta_saida.glob("*.mp4"))
                
                arq_path = candidatos[-1] if candidatos else None
                nome_arq = arq_path.name if arq_path else ""

                item = {
                    "id": f"lula-viral-{tweet_id}",
                    "tweet_id": tweet_id,
                    "url": url,
                    "titulo": titulo,
                    "autor": f"@{autor.lstrip('@')}" if autor else "",
                    "duracao_s": round(duracao, 1),
                    "arquivo": nome_arq,
                    "categoria": "lula-virais",
                    "receita_sugerida": "Aventura do Mangaio",
                }
                metadados.append(item)
                print(f"  [OK] Baixado: {nome_arq} ({duracao:.1f}s) por {item['autor']}")
        except Exception as e:
            msg = str(e).split("\n")[0]
            print(f"  [ERRO] Falha ao baixar ({url}): {msg}")

    # Salva arquivo de metadados
    meta_json = pasta_saida / "metadados_lula_virais.json"
    meta_json.write_text(json.dumps(metadados, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n==========================================")
    print(f"Finalizado: {len(metadados)} videos baixados em '{pasta_saida}'")
    print(f"Metadados salvos em: {meta_json}")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    destino = Path(r"C:\LIA\motores-video\saida\lula-virais")
    if len(sys.argv) > 1:
        destino = Path(sys.argv[1])
    baixar_todos(destino)
