"""Baixador da Prensa: recebe um link (X, Instagram, TikTok, YouTube...) e devolve o vídeo em MP4.

O navegador não pode baixar vídeo dessas redes direto (CORS), então este serviço pequeno faz só isso, com o
yt-dlp. Tudo o resto (legenda, receita, render) continua no aparelho de quem usa a Prensa. Não guarda nada:
o arquivo é apagado assim que a resposta termina.

  uvicorn app:app --port 7860          # local
  POST /baixar  {"url": "https://..."}  -> video/mp4, com X-Titulo, X-Autor, X-Origem, X-Plataforma
"""
from __future__ import annotations

import os
import shutil
import tempfile
import time
import urllib.parse
from collections import defaultdict, deque

import yt_dlp
from fastapi import FastAPI, HTTPException, Request, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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

app = FastAPI(title="Prensa · baixador")
app.add_middleware(CORSMiddleware, allow_origins=ORIGENS, allow_methods=["GET", "POST"], allow_headers=["*"],
                   expose_headers=["X-Titulo", "X-Autor", "X-Origem", "X-Plataforma", "Content-Length"])
pedidos: dict[str, deque] = defaultdict(deque)


class Pedido(BaseModel):
    url: str


def limite(ip: str) -> None:
    agora, fila = time.time(), pedidos[ip]
    while fila and agora - fila[0] > 3600:
        fila.popleft()
    if len(fila) >= POR_HORA:
        raise HTTPException(429, "Muitos pedidos nesta hora. Tente de novo daqui a pouco.")
    fila.append(agora)


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
    limite(request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0])
    pasta = tempfile.mkdtemp(prefix="prensa-")
    opcoes = {
        "outtmpl": os.path.join(pasta, "video.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
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
        msg = str(e).split("\n")[0].replace("ERROR: ", "")
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
            # nas redes de @ (X, TikTok, Instagram) o crédito é o @, não o nome de exibição
            "X-Autor": cabecalho(
                info.get("uploader_id") if info.get("extractor_key") in ("Twitter", "TikTok", "Instagram") and info.get("uploader_id")
                else info.get("uploader") or info.get("channel") or info.get("uploader_id")),
            "X-Origem": cabecalho(info.get("webpage_url") or url),
            "X-Plataforma": cabecalho(info.get("extractor_key")),
        },
        background=BackgroundTask(shutil.rmtree, pasta, ignore_errors=True),
    )


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
    limite(request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0])
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
    limite(request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0])
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
