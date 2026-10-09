"""Gerador de Títulos, Hooks e Metadados para vídeos usando Qwen 2.5 local na GPU (RTX 2060).

Projetado para receber a transcrição de um vídeo e gerar:
1. Ganchos (hooks) fortes para os primeiros 3 segundos.
2. Títulos chamativos e virais (Shorts / Reels / TikTok).
3. Descrição curta + Hashtags otimizadas.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any

# Adiciona DLLs CUDA do PyTorch se no Windows
try:
    import torch
    torch_lib = os.path.join(os.path.dirname(torch.__file__), "lib")
    if os.path.exists(torch_lib) and hasattr(os, "add_dll_directory"):
        os.add_dll_directory(torch_lib)
except Exception:
    pass

_modelo_global = None
_tokenizer_global = None
MODELO_ID = os.environ.get("QWEN_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")


def obter_modelo_e_tokenizer():
    global _modelo_global, _tokenizer_global
    if _modelo_global is not None and _tokenizer_global is not None:
        return _modelo_global, _tokenizer_global

    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32

    print(f"[*] Carregando LLM '{MODELO_ID}' no dispositivo '{device}'...")
    tokenizer = AutoTokenizer.from_pretrained(MODELO_ID)
    model = AutoModelForCausalLM.from_pretrained(
        MODELO_ID,
        torch_dtype=dtype,
        device_map="auto" if device == "cuda" else None,
    )
    if device == "cpu":
        model = model.to("cpu")

    _modelo_global = model
    _tokenizer_global = tokenizer
    print(f"[OK] LLM Qwen carregado com sucesso.")
    return _modelo_global, _tokenizer_global


PROMPT_SISTEMA = """Você é um especialista em roteiro, engajamento e viralização de vídeos curtos (YouTube Shorts, Instagram Reels e TikTok).
Sua missão é ler a transcrição falada de um vídeo e gerar ideias virais em Português do Brasil.
Retorne EXCLUSIVAMENTE um objeto JSON válido, sem texto antes ou depois, no formato:
{
  "hook": "Uma frase de alto impacto e curiosidade para os primeiros 3 segundos na tela",
  "titulos": [
    "Opção de título 1 curto e viral",
    "Opção de título 2 com pergunta provocativa",
    "Opção de título 3 direto ao ponto"
  ],
  "descricao": "Uma descrição de 2 linhas cativante para o post",
  "hashtags": "#Shorts #Viral #Brasil"
}"""


def gerar_titulos_e_hooks(transcricao: str, contexto: str = "") -> dict[str, Any]:
    """Recebe o texto transcrito e retorna dict com hooks, títulos e hashtags."""
    if not transcricao.strip():
        return {
            "hook": "Assista até o final!",
            "titulos": ["Momento imperdível", "Você não vai acreditar nisso", "Veja o que aconteceu"],
            "descricao": "Confira esse momento incrível!",
            "hashtags": "#Shorts #Viral",
        }

    model, tokenizer = obter_modelo_e_tokenizer()

    conteudo_usuario = f"Transcrição do vídeo:\n\"\"\"{transcricao.strip()[:1500]}\"\"\""
    if contexto:
        conteudo_usuario += f"\nContexto adicional/Personagem: {contexto}"

    mensagens = [
        {"role": "system", "content": PROMPT_SISTEMA},
        {"role": "user", "content": conteudo_usuario},
    ]

    texto_input = tokenizer.apply_chat_template(
        mensagens,
        tokenize=False,
        add_generation_prompt=True,
    )

    import torch
    inputs = tokenizer([texto_input], return_tensors="pt").to(model.device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=350,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
        )

    # Extrai somente a resposta gerada
    prompt_len = inputs.input_ids.shape[1]
    resposta = tokenizer.decode(outputs[0][prompt_len:], skip_special_tokens=True).strip()

    # Tenta parsing de JSON
    try:
        # Se veio cercado de ```json ... ```
        m = re.search(r"\{.*\}", resposta, re.DOTALL)
        if m:
            return json.loads(m.group(0))
        return json.loads(resposta)
    except Exception:
        # Fallback se a saída não for JSON estrito
        linhas = [l.strip("-* \t") for l in resposta.split("\n") if l.strip()]
        return {
            "hook": linhas[0] if linhas else "Veja isso!",
            "titulos": linhas[1:4] if len(linhas) > 1 else [resposta[:50]],
            "descricao": resposta[:140],
            "hashtags": "#Shorts #Viral",
            "resposta_bruta": resposta,
        }
