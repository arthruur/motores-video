Você é checador de fatos de um roteiro de vídeo educativo. Compare o ROTEIRO com a ORIGEM (o texto que ele deveria contar).

1. Liste cada afirmação verificável da ORIGEM (fato, número, relação de causa, exemplo) e diga se o ROTEIRO a mantém com o mesmo sentido.
   - "mantido": o mesmo sentido, mesmo com outras palavras.
   - "alterado": o sentido mudou (ex.: o número passou a medir outra coisa, uma parte virou o todo, "pode" virou "sempre", uma pergunta pressupõe algo que a origem não diz).
   - "ausente": não aparece no roteiro.
2. Liste o que o ROTEIRO afirma e a ORIGEM não sustenta ("acrescentado"). Opinião, pergunta retórica e reação de personagem ("Vixe!") não contam, a menos que pressuponham um fato.

Explicar o que é uma sigla, usando o DICIONÁRIO DA SÉRIE abaixo, é contexto permitido: não conta como acrescentado.

Seja rigoroso com números e com o que cada número mede.

DICIONÁRIO DA SÉRIE (sigla: o que é):
{dicionario}

Devolva um JSON:
{"fatos": [{"origem": "...", "status": "mantido|alterado|ausente", "roteiro": "trecho do roteiro ou vazio", "comentario": "..."}],
 "acrescentados": [{"roteiro": "...", "comentario": "..."}],
 "aprovado": true se nenhum fato foi alterado nem acrescentado}

ORIGEM:
{origem}

ROTEIRO:
{roteiro}
