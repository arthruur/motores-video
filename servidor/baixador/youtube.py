"""Publicador para YouTube Shorts da Prensa.

Usa YouTube Data API v3 com OAuth2.
Busca client_secret.json e token_youtube.json localmente ou no projeto social-agents.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]

PASTAS_BUSCA = [
    Path(__file__).parent,                          # servidor/baixador/
    Path(__file__).parent.parent.parent,             # raiz motores-video/
    Path(r"C:\LIA\social-agents"),                   # social-agents/
]


def encontrar_arquivo(nome: str, env_var: str | None = None) -> Path | None:
    if env_var and os.environ.get(env_var):
        p = Path(os.environ[env_var])
        if p.exists():
            return p

    for pasta in PASTAS_BUSCA:
        p = pasta / nome
        if p.exists():
            return p

    return None


def obter_caminho_token() -> Path:
    token = encontrar_arquivo("token_youtube.json", "YOUTUBE_TOKEN_PATH")
    if token:
        return token
    # Se não existe ainda, salva na pasta deste módulo
    return Path(__file__).parent / "token_youtube.json"


def obter_caminho_secret() -> Path | None:
    return encontrar_arquivo("client_secret.json", "YOUTUBE_CLIENT_SECRET")


def status_youtube() -> dict[str, Any]:
    secret = obter_caminho_secret()
    token = encontrar_arquivo("token_youtube.json", "YOUTUBE_TOKEN_PATH")
    return {
        "pronto": bool(token and token.exists()),
        "tem_secret": bool(secret and secret.exists()),
        "caminho_secret": str(secret) if secret else None,
        "caminho_token": str(token) if token else None,
    }


def obter_servico():
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    token_file = obter_caminho_token()
    secret_file = obter_caminho_secret()

    creds = None
    if token_file.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(token_file), YOUTUBE_SCOPES)
        except Exception:
            creds = None

    if creds and creds.expired and creds.refresh_token:
        try:
            from google.auth.transport.requests import Request
            creds.refresh(Request())
            with open(token_file, "w", encoding="utf-8") as f:
                f.write(creds.to_json())
        except Exception:
            creds = None

    if not creds or not creds.valid:
        if not secret_file or not secret_file.exists():
            raise FileNotFoundError(
                "Arquivo client_secret.json não encontrado. "
                "Baixe o arquivo de credenciais OAuth (Desktop) no Google Cloud Console e coloque na pasta."
            )
        flow = InstalledAppFlow.from_client_secrets_file(str(secret_file), YOUTUBE_SCOPES)
        creds = flow.run_local_server(port=0)
        with open(token_file, "w", encoding="utf-8") as f:
            f.write(creds.to_json())

    return build("youtube", "v3", credentials=creds)


def publicar_shorts(
    video_path: str | Path,
    titulo: str,
    descricao: str = "",
    hashtags: list[str] | str | None = None,
    privacidade: str = "private",
) -> dict[str, Any]:
    from googleapiclient.http import MediaFileUpload

    p = Path(video_path)
    if not p.exists():
        raise FileNotFoundError(f"Vídeo não encontrado em: {video_path}")

    # Lista de tags
    if isinstance(hashtags, str):
        tags_raw = [t.strip().lstrip("#") for t in hashtags.replace(";", ",").split(",") if t.strip()]
    elif isinstance(hashtags, list):
        tags_raw = [str(t).strip().lstrip("#") for t in hashtags if str(t).strip()]
    else:
        tags_raw = []

    if "Shorts" not in tags_raw:
        tags_raw.append("Shorts")

    tags_limpas = tags_raw[:15]

    titulo_final = f"{titulo.strip()} #Shorts"[:100]
    texto_tags = " ".join(f"#{t}" for t in tags_limpas)
    desc_final = f"{descricao.strip()}\n\n{texto_tags}".strip() if descricao.strip() else texto_tags

    privacidade_limpa = privacidade.lower()
    if privacidade_limpa not in ("private", "unlisted", "public"):
        privacidade_limpa = "private"

    body = {
        "snippet": {
            "title": titulo_final,
            "description": desc_final,
            "tags": tags_limpas,
            "categoryId": "25",  # Notícias / Educação / Geral
            "defaultLanguage": "pt",
        },
        "status": {
            "privacyStatus": privacidade_limpa,
            "selfDeclaredMadeForKids": False,
        },
    }

    youtube = obter_servico()
    media = MediaFileUpload(str(p), mimetype="video/mp4", resumable=True)

    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
    )

    response = None
    while response is None:
        _, response = request.next_chunk()

    video_id = response.get("id")
    return {
        "ok": True,
        "plataforma": "youtube_shorts",
        "id": video_id,
        "url": f"https://www.youtube.com/shorts/{video_id}",
        "privacidade": privacidade_limpa,
        "titulo": titulo_final,
    }
