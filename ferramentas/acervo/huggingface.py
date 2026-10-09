"""Gerador de Dataset Card e sincronizador do Acervo da Prensa para o Hugging Face Datasets.

Permite transformar o acervo local de clipes de retenção (e trilhas de áudio)
em um repositório público no Hugging Face Datasets, com CORS liberado para o app web.

Uso:
  python ferramentas/acervo/huggingface.py --card           # gera o README.md formatado com frontmatter HF
  python ferramentas/acervo/huggingface.py --exportar pasta # organiza acervo.json, clipes e README na pasta de saída
  python ferramentas/acervo/huggingface.py --upload --repo usuario/prensa-acervo # publica no Hugging Face (requer huggingface_hub)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ACERVO_DIR = RAIZ / "app" / "public" / "acervo"
ACERVO_JSON = ACERVO_DIR / "acervo.json"


def carregar_acervo(caminho: Path = ACERVO_JSON) -> dict:
    if not caminho.exists():
        sys.exit(f"Arquivo de acervo não encontrado: {caminho}")
    return json.loads(caminho.read_text("utf-8"))


def gerar_card_hf(acervo: dict, repo_nome: str = "prensa-acervo") -> str:
    """Gera o README.md com YAML frontmatter exigido pelo Hugging Face Datasets."""
    clipes = [c for c in acervo.get("clipes", []) if c.get("revisado")]
    
    # Coleta de licenças únicas
    licencas = set()
    for c in clipes:
        lic = c.get("licenca", "").lower()
        if "cc0" in lic or "public domain" in lic:
            licencas.add("cc0-1.0")
        elif "cc by 3.0" in lic:
            licencas.add("cc-by-3.0")
        elif "cc by 4.0" in lic or "cc-by-4.0" in lic:
            licencas.add("cc-by-4.0")
        elif "cc by-sa" in lic:
            licencas.add("cc-by-sa-4.0")
    
    licencas_yaml = "\n".join(f"- {l}" for l in sorted(licencas)) if licencas else "- cc-by-4.0"

    linhas = [
        "---",
        "annotations_creators:",
        "- expert-generated",
        "language_creators:",
        "- found",
        "language:",
        "- pt",
        "- en",
        "license:",
        licencas_yaml,
        "multilinguality:",
        "- multilingual",
        "size_categories:",
        "- n<1K",
        "source_datasets:",
        "- wikimedia-commons",
        "task_categories:",
        "- video-to-video",
        "pretty_name: Prensa Acervo de Retenção",
        "tags:",
        "- video",
        "- retention",
        "- open-source",
        "- reels",
        "- creative-commons",
        "---",
        "",
        "# Acervo da Prensa (Vídeos de Retenção Livres)",
        "",
        "Este dataset reúne clipes curtos de 15 segundos em formato vertical (720×1280, 9:16, sem áudio),",
        "coletados do **Wikimedia Commons** com licenças livres e **revisados manualmente por humanos**.",
        "",
        "É utilizado pela ferramenta de código aberto [Prensa](https://github.com/arthruur/motores-video)",
        "para composição de tela dividida em vídeos verticais (TikTok, Reels, Shorts), sem risco de",
        "violação de direitos autorais de gameplays proprietárias.",
        "",
        "## Estrutura do Dataset",
        "",
        "- `acervo.json`: Manifesto com créditos, licenças, URLs originais e hashes SHA-256.",
        "- `clipes/*.mp4`: Arquivos de vídeo prontos em H.264 30 fps sem áudio.",
        "",
        "## Clipes Aprovados",
        "",
        "| ID | Categoria | Título | Autor / Crédito | Licença |",
        "|---|---|---|---|---|",
    ]

    for c in clipes:
        tit = c.get("titulo", "").replace("|", "-")
        cred = c.get("credito", "").replace("|", "-")
        linhas.append(f"| `{c['id']}` | {c.get('categoria', '')} | {tit} | {cred} | [{c.get('licenca', '')}]({c.get('licenca_url', '')}) |")

    linhas.extend([
        "",
        "## Como Consumir via Web (CORS liberado)",
        "",
        "O Hugging Face disponibiliza os arquivos com cabeçalhos CORS liberados por padrão:",
        "",
        "```javascript",
            f"const RES_URL = 'https://huggingface.co/datasets/{repo_nome}/resolve/main';",
        "const manifesto = await (await fetch(`${RES_URL}/acervo.json`)).json();",
        "const videoBlob = await (await fetch(`${RES_URL}/clipes/areia-01.mp4`)).blob();",
        "```",
        "",
        "## Política de Direitos e Isenção",
        "",
        "Todos os arquivos mantêm os créditos do autor original conforme a licença declarada.",
        "A revisão humana filtra conteúdos inadequados, marcas registradas ou rostos de pessoas.",
        "Consulte a documentação completa no repositório [motores-video](https://github.com/arthruur/motores-video).",
        ""
    ])

    return "\n".join(linhas)


def exportar_para_pasta(saida_dir: Path, repo_nome: str = "prensa-acervo") -> None:
    saida_dir.mkdir(parents=True, exist_ok=True)
    clipes_dir = saida_dir / "clipes"
    clipes_dir.mkdir(parents=True, exist_ok=True)

    acervo = carregar_acervo()
    # Grava README.md
    readme_hf = gerar_card_hf(acervo, repo_nome)
    (saida_dir / "README.md").write_text(readme_hf, encoding="utf-8")

    # Grava acervo.json
    (saida_dir / "acervo.json").write_text(json.dumps(acervo, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # Copia clipes existentes
    copiados = 0
    for c in acervo.get("clipes", []):
        origem = ACERVO_DIR / c["arquivo"]
        if origem.exists():
            destino = clipes_dir / c["arquivo"]
            destino.write_bytes(origem.read_bytes())
            copiados += 1

    print(f"Exportação concluída em: {saida_dir}")
    print(f"- README.md gerado com metadados HF")
    print(f"- acervo.json copiado")
    print(f"- {copiados} clipes de vídeo copiados para {clipes_dir}")


def upload_huggingface(repo_id: str, pasta_local: Path) -> None:
    try:
        from huggingface_hub import HfApi
    except ImportError:
        sys.exit(
            "Erro: 'huggingface_hub' não está instalado.\n"
            "Instale com: pip install huggingface_hub\n"
            "E autentique com: huggingface-cli login"
        )
    api = HfApi()
    print(f"Enviando conteúdo de {pasta_local} para o Hugging Face Dataset: {repo_id}...")
    api.create_repo(repo_id=repo_id, repo_type="dataset", exist_ok=True)
    api.upload_folder(
        folder_path=str(pasta_local),
        repo_id=repo_id,
        repo_type="dataset",
    )
    print(f"Upload concluído com sucesso: https://huggingface.co/datasets/{repo_id}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--card", action="store_true", help="imprime o README.md (dataset card) no terminal")
    ap.add_argument("--exportar", type=Path, metavar="PASTA", help="prepara uma pasta para sincronização com o HF")
    ap.add_argument("--upload", action="store_true", help="faz upload para o Hugging Face")
    ap.add_argument("--repo", default="arthruur/prensa-acervo", help="nome do repositório no HF (ex: usuario/prensa-acervo)")
    args = ap.parse_args()

    acervo = carregar_acervo()

    if args.card:
        print(gerar_card_hf(acervo, args.repo))
    elif args.exportar:
        exportar_para_pasta(args.exportar, args.repo)
        if args.upload:
            upload_huggingface(args.repo, args.exportar)
    elif args.upload:
        # Se não especificou pasta, cria temporária ou usa ACERVO_DIR
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            exportar_para_pasta(tmp_path, args.repo)
            upload_huggingface(args.repo, tmp_path)
    else:
        ap.print_help()


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
