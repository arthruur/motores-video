"""Baixador da Prensa: recebe um link (X, Instagram, TikTok, YouTube...) e devolve o vídeo em MP4.

O navegador não pode baixar vídeo dessas redes direto (CORS), então este serviço pequeno faz só isso, com o
yt-dlp. Tudo o resto (legenda, receita, render) continua no aparelho de quem usa a Prensa. Não guarda nada:
o arquivo é apagado assim que a resposta termina.

  uvicorn app:app --port 7860          # local
  POST /baixar  {"url": "https://..."}  -> video/mp4, com X-Titulo, X-Autor, X-Origem, X-Plataforma
  GET /info?url=https://...              -> título, @, duração e plataforma de um link do TikTok ou do X (catálogo)
  GET /miniatura?url=https://...         -> a capa (jpeg/webp) desse link, para a busca do app
"""
from __future__ import annotations

import os
import re
import shutil
import tempfile
import time
import urllib.parse
import urllib.request
from collections import OrderedDict, defaultdict, deque

import yt_dlp
from fastapi import FastAPI, HTTPException, Request, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from starlette.background import BackgroundTask

try:
    from . import youtube
    from . import transcritor
    from . import gerador_titulos
except (ImportError, ValueError):
    import youtube
    import transcritor
    import gerador_titulos

ORIGENS = [o.strip() for o in os.environ.get(
    "ORIGENS", "https://arthruur-prensa.static.hf.space,https://localhost:5173,https://localhost:5179,http://localhost:5173,http://127.0.0.1:5173,https://127.0.0.1:5173").split(",") if o.strip()]
DUR_MAX = int(os.environ.get("DUR_MAX", 20 * 60))          # s: a Prensa usa no máximo 3 min de trecho
TAMANHO_MAX = int(os.environ.get("TAMANHO_MAX", 400 * 2**20))
POR_HORA = int(os.environ.get("POR_HORA", 30))             # pedidos por IP por hora
CAPAS_POR_HORA = int(os.environ.get("CAPAS_POR_HORA", 300))  # a busca pede uma capa por cartão que aparece
# só as redes que este servidor consegue baixar (YouTube e Instagram barram servidores de nuvem)
REDES_CAPA = re.compile(r"^https://(www\.|m\.|vm\.|vt\.)?(tiktok\.com|x\.com|twitter\.com)/", re.I)

app = FastAPI(title="Prensa · baixador")
app.add_middleware(CORSMiddleware, allow_origins=ORIGENS, allow_methods=["GET", "POST"], allow_headers=["*"],
                   expose_headers=["X-Titulo", "X-Autor", "X-Origem", "X-Plataforma", "Content-Length"])
pedidos: dict[str, deque] = defaultdict(deque)
pedidos_capa: dict[str, deque] = defaultdict(deque)
# url -> (quando, dados) e url -> (bytes, tipo); os 300 últimos de cada (~15 MB de capas). A capa do TikTok vem
# assinada e expira em poucas horas, por isso os dados valem 3 h e o app nunca guarda o link da capa.
fichas: OrderedDict[str, tuple[float, dict]] = OrderedDict()
capas: OrderedDict[str, tuple[bytes, str]] = OrderedDict()


class Pedido(BaseModel):
    url: str


def ip_de(request: Request) -> str:
    return request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0]


def limite(ip: str, filas: dict[str, deque] = pedidos, maximo: int = POR_HORA) -> None:
    agora, fila = time.time(), filas[ip]
    while fila and agora - fila[0] > 3600:
        fila.popleft()
    if len(fila) >= maximo:
        raise HTTPException(429, "Muitos pedidos nesta hora. Tente de novo daqui a pouco.")
    fila.append(agora)


def guardar(cache: OrderedDict, chave: str, valor) -> None:
    cache[chave] = valor
    cache.move_to_end(chave)
    while len(cache) > 300:
        cache.popitem(last=False)


def autor_de(info: dict) -> str:
    # nas redes de @ (X, TikTok, Instagram) o crédito é o @, não o nome de exibição
    if info.get("extractor_key") in ("Twitter", "TikTok", "Instagram") and info.get("uploader_id"):
        return info["uploader_id"]
    return info.get("uploader") or info.get("channel") or info.get("uploader_id") or ""


def erro_ytdlp(e: Exception) -> str:
    """a 1ª linha do erro do yt-dlp, sem cor de terminal nem o prefixo ERROR:"""
    return re.sub(r"\x1b\[[0-9;]*m", "", str(e)).split("\n")[0].replace("ERROR: ", "")


def cabecalho(v: str | None) -> str:
    return urllib.parse.quote((v or "")[:200])


@app.get("/")
def raiz():
    return {"ok": True, "servico": "Prensa · baixador", "yt_dlp": yt_dlp.version.__version__}


@app.post("/baixar")
def baixar(p: Pedido, request: Request):
    url = p.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "Isso não parece um link.")
    limite(ip_de(request))
    pasta = tempfile.mkdtemp(prefix="prensa-")
    opcoes = {
        "outtmpl": os.path.join(pasta, "video.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,  # a barra de progresso do yt-dlp só enchia o log do Render
        "merge_output_format": "mp4",
        "max_filesize": TAMANHO_MAX,
        "socket_timeout": 30,
    }
    try:
        with yt_dlp.YoutubeDL(opcoes) as ydl:
            info = ydl.extract_info(url, download=False)
            if info.get("_type") == "playlist" and info.get("entries"):
                info = next(iter(info["entries"]))
            if (info.get("duration") or 0) > DUR_MAX:
                raise HTTPException(413, f"Vídeo longo demais (mais de {DUR_MAX // 60} min).")
            # H.264 + AAC em MP4 primeiro (o navegador lê sem converter); vídeo longo vem em 720p para caber no celular
            h = 720 if (info.get("duration") or 0) > 180 else 1080
            ydl.params["format"] = (f"bv*[vcodec^=avc][height<={h}]+ba[ext=m4a]/b[vcodec^=avc][height<={h}]/"
                                    f"bv*[height<={h}]+ba/b[height<={h}]/b")
            ydl.format_selector = ydl.build_format_selector(ydl.params["format"])
            info = ydl.process_ie_result(info, download=True)
    except HTTPException:
        shutil.rmtree(pasta, ignore_errors=True)
        raise
    except Exception as e:  # noqa: BLE001 — o yt-dlp levanta muitos tipos; a mensagem dele é o que importa
        shutil.rmtree(pasta, ignore_errors=True)
        msg = erro_ytdlp(e)
        if any(k in msg for k in ("cookies", "Sign in", "login", "not a bot", "empty media")):
            # YouTube e Instagram costumam barrar servidores de nuvem: o caminho é enviar o arquivo
            raise HTTPException(422, "Essa rede não deixou baixar daqui. Salve o vídeo no aparelho e envie o arquivo.")
        if "Unsupported URL" in msg:
            raise HTTPException(422, "Esse link não tem um vídeo que eu consiga buscar.")
        raise HTTPException(422, f"Não consegui baixar esse link: {msg[:200]}")
    arquivos = [os.path.join(pasta, f) for f in os.listdir(pasta) if not f.endswith((".part", ".ytdl"))]
    if not arquivos:
        shutil.rmtree(pasta, ignore_errors=True)
        raise HTTPException(422, "O link não tinha vídeo.")
    arquivo = max(arquivos, key=os.path.getsize)
    return FileResponse(
        arquivo, media_type="video/mp4", filename="video.mp4",
        headers={
            "X-Titulo": cabecalho(info.get("title")),
            "X-Autor": cabecalho(autor_de(info)),
            "X-Origem": cabecalho(info.get("webpage_url") or url),
            "X-Plataforma": cabecalho(info.get("extractor_key")),
        },
        background=BackgroundTask(shutil.rmtree, pasta, ignore_errors=True),
    )


def ficha(url: str, request: Request) -> dict:
    """os dados públicos de um link do TikTok ou do X, sem baixar o vídeo"""
    url = url.strip()
    if not REDES_CAPA.match(url):
        raise HTTPException(400, "Só links do TikTok ou do X.")
    guardada = fichas.get(url)
    if guardada and time.time() - guardada[0] < 3 * 3600:
        return guardada[1]
    limite(ip_de(request), pedidos_capa, CAPAS_POR_HORA)
    try:
        with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "noplaylist": True, "socket_timeout": 20}) as ydl:
            info = ydl.extract_info(url, download=False, process=False)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(422, f"Não consegui ler esse link: {erro_ytdlp(e)[:150]}")
    capa = info.get("thumbnail") or next((t["url"] for t in reversed(info.get("thumbnails") or []) if t.get("url")), None)
    dados = {
        "url": info.get("webpage_url") or url,
        "titulo": info.get("title") or info.get("description") or "",
        "autor": autor_de(info),
        "plataforma": info.get("extractor_key") or "",
        "duracao": info.get("duration"),
        "_capa": capa if capa and capa.startswith("https://") else None,
    }
    guardar(fichas, url, (time.time(), dados))
    return dados


@app.get("/info")
def info_link(url: str, request: Request):
    d = ficha(url, request)
    return {k: v for k, v in d.items() if not k.startswith("_")} | {"tem_capa": bool(d["_capa"])}


@app.get("/miniatura")
def miniatura(url: str, request: Request):
    if url not in capas:
        capa = ficha(url, request)["_capa"]
        if not capa:
            raise HTTPException(404, "Esse vídeo não tem capa.")
        try:
            req = urllib.request.Request(capa, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                tipo = r.headers.get_content_type()
                dados = r.read(2 * 2**20 + 1)
        except Exception as e:  # noqa: BLE001
            fichas.pop(url, None)  # a capa assinada pode ter expirado: na próxima, lê o link de novo
            raise HTTPException(422, f"Não consegui a capa: {str(e)[:150]}")
        if not tipo.startswith("image/") or len(dados) > 2 * 2**20:
            raise HTTPException(422, "A capa não é uma imagem.")
        guardar(capas, url, (dados, tipo))
    dados, tipo = capas[url]
    # a Prensa roda isolada (COEP): imagem de outro domínio só entra com CORS ou com esta permissão
    return Response(dados, media_type=tipo, headers={"Cache-Control": "public, max-age=86400",
                                                    "Cross-Origin-Resource-Policy": "cross-origin"})


@app.get("/publicar/youtube/status")
def status_publicar_youtube():
    return youtube.status_youtube()


@app.post("/publicar/youtube")
async def publicar_youtube(
    request: Request,
    arquivo: UploadFile = File(...),
    titulo: str = Form("Vídeo da Prensa"),
    descricao: str = Form(""),
    hashtags: str = Form("Shorts"),
    privacidade: str = Form("private"),
):
    limite(ip_de(request))
    pasta = tempfile.mkdtemp(prefix="prensa-yt-")
    caminho = os.path.join(pasta, "video.mp4")
    try:
        conteudo = await arquivo.read()
        if len(conteudo) > TAMANHO_MAX:
            raise HTTPException(413, "Vídeo grande demais para envio.")
        with open(caminho, "wb") as f:
            f.write(conteudo)

        resultado = youtube.publicar_shorts(
            video_path=caminho,
            titulo=titulo,
            descricao=descricao,
            hashtags=hashtags,
            privacidade=privacidade,
        )
        return resultado
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        msg = str(e)
        raise HTTPException(500, f"Não foi possível publicar no YouTube: {msg}")
    finally:
        shutil.rmtree(pasta, ignore_errors=True)


@app.get("/transcrever/status")
def status_transcrever():
    import torch
    disponivel = torch.cuda.is_available()
    dispositivo = torch.cuda.get_device_name(0) if disponivel else "CPU"
    modelo = getattr(transcritor, "_modelo_nome", "small")
    return {
        "ok": True,
        "cuda": disponivel,
        "dispositivo": dispositivo,
        "modelo": modelo,
    }


@app.post("/transcrever")
async def transcrever(
    request: Request,
    audio: UploadFile = File(...),
    idioma: str = Form("pt"),
):
    limite(ip_de(request))
    try:
        conteudo = await audio.read()
        if not conteudo:
            raise HTTPException(400, "Arquivo de áudio vazio.")
        if len(conteudo) > TAMANHO_MAX:
            raise HTTPException(413, "Áudio grande demais.")
        
        palavras = transcritor.transcrever_audio_bytes(conteudo, idioma=idioma)
        return {"ok": True, "palavras": palavras}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Erro ao transcrever com GPU: {e}")


class PedidoTitulos(BaseModel):
    transcricao: str
    contexto: str = ""


@app.post("/gerar-titulos")
def rota_gerar_titulos(pedido: PedidoTitulos):
    try:
        resultado = gerador_titulos.gerar_titulos_e_hooks(
            transcricao=pedido.transcricao,
            contexto=pedido.contexto,
        )
        return {"ok": True, **resultado}
    except Exception as e:
        raise HTTPException(500, f"Erro ao gerar títulos com LLM: {e}")
