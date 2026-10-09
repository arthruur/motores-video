# Guia de Curadoria e Contribuição para o Acervo da Prensa

A Prensa utiliza um **acervo de mídias livres** (vídeos de retenção para tela dividida e trilhas de fundo) servido pelo [Hugging Face Datasets](https://huggingface.co/datasets/arthruur/prensa-acervo).

Este guia orienta como a comunidade pode sugerir, enviar e revisar novos conteúdos para enriquecer a plataforma mantendo conformidade jurídica e padrão de qualidade.

---

## 1. O que buscamos (Critérios de Curadoria)

Para que um vídeo ou áudio possa entrar no acervo público da Prensa, ele deve cumprir 3 pilares:

### ✅ O que é bem-vindo:
1. **Vídeos de Retenção Visual (para tela dividida):**
   * Processos manuais e artesanais (cerâmica, marcenaria, pintura, restauro de objetos).
   * Experimentos científicos e texturas (areia cinética, mistura de tintas, fluidos, reações químicas).
   * Engenharia e maquinário (máquinas hidráulicas, linhas de produção mecânicas, engrenagens).
   * Natureza e planos aéreos (cachoeiras, ondas, timelapse de nuvens, vista de satélite/órbita).
   * Loops abstratos 3D ou cinéticos livres.
2. **Trilhas Sonoras (para edits de impacto / phonk):**
   * Batidas instrumentais (Phonk, Lo-Fi, Trap acústico, Synthwave) com direitos cedidos ou licenças abertas (CC-BY, CC0).
3. **Licenças válidas:** Domínio público, CC0, CC-BY (com autor identificável).

### ❌ O que NÃO pode entrar:
* **Rostos de pessoas sem consentimento explícito:** evita violação de direito de imagem e LGPD.
* **Marcas registradas e logotipos comerciais visíveis.**
* **Gameplays comerciais proprietárias** (Minecraft, Subway Surfers, GTA): as empresas detentoras dos direitos (Mojang, SYBO, Rockstar) proíbem a distribuição de acervos de terceiros por outros softwares.
* **Conteúdo violento, sensacionalista ou de baixa resolução (< 720p).**

---

## 2. Como Contribuir

Temos dois caminhos de contribuição:

### Opção A: Para quem não é desenvolvedor (Via Google Drive ou Sugestão de Link)
1. Faça upload dos seus vídeos/áudios na pasta colaborativa ou envie o link da fonte (Wikimedia Commons, Internet Archive, etc.).
2. Crie um arquivo de texto simples (`creditos.txt`) junto com o vídeo informando:
   * **Nome do vídeo / descrição**
   * **Quem criou / Autor original**
   * **Link da fonte e licença** (ex: CC-BY 4.0, Domínio Público)

### Opção B: Para Desenvolvedores e Revisores (Via Linha de Comando)

#### Passo 1: Baixar os vídeos do Drive para uma pasta local
Baixe os vídeos recebidos para uma pasta local (por exemplo, `meus_videos_drive/`).

#### Passo 2: Importar e normalizar automaticamente
Execute o importador da Prensa:
```bash
python ferramentas/acervo/importar_pasta.py meus_videos_drive/ --categoria arte --autor "Nome da Pessoa" --licenca "CC BY 4.0"
```
O script corta automaticamente os primeiros 15 segundos em **720×1280 (9:16, 30 fps, sem som)**, calcula o SHA-256 e registra em `app/public/acervo/acervo.json` com status `"revisado": false`.

#### Passo 3: Revisão Humana (Folha de Contato)
Gere a folha de contato para ver os quadros de todos os vídeos novos lado a lado:
```bash
python ferramentas/acervo/coletar.py --folha
```
Abra `app/public/acervo/folha.png`. Se o vídeo for adequado e cumprir os critérios:
```bash
python ferramentas/acervo/coletar.py --aprovar arte-01 arte-02
```
Se contiver marcas, rostos ou problemas:
```bash
python ferramentas/acervo/coletar.py --rejeitar arte-03
```

#### Passo 4: Publicar para todos os usuários no Hugging Face
Com um único comando, o novo acervo é sincronizado com o Hugging Face Datasets e passa a estar imediatamente disponível para quem abre a Prensa em qualquer lugar:
```bash
python ferramentas/acervo/huggingface.py --exportar pasta_hf/ --upload --repo arthruur/prensa-acervo
```
