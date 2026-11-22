# Direção visual e controle de qualidade

Leia este guia ao criar ou revisar qualquer projeto. Para vídeos científicos e de dados, aplique também a seção de precisão.

## Hierarquia e margem segura

- Use `video.safeMarginPct` entre 0,06 e 0,10. Nenhum texto essencial ou rótulo de gráfico deve cruzar essa região.
- Em 1080p, título deve normalmente ter 64–120 px, corpo 34–56 px e legenda 30–44 px. Em 9:16, prefira blocos curtos, 48–92 px e no máximo 6–10 palavras por linha.
- Mantenha contraste mínimo aproximado de 4,5:1 para texto comum e 3:1 para texto grande. Não dependa apenas da cor para comunicar categorias.
- Uma cena deve ter um foco principal. Limite fontes a uma família ou a um par coerente; o runtime usa fontes de sistema por padrão para funcionar offline.

## Temas

| Tema | Uso | Características |
|---|---|---|
| `minimal` | abertura, institucional, social | fundo limpo, alto contraste, poucos elementos, movimentos amplos |
| `scientific` | biologia, física, mecanismos | azul profundo, ciano/verde, rótulos precisos, movimento causal |
| `editorial` | explicação, dados, relatório | contraste preto/creme, tipografia grande, grades e destaques |
| `modern` | tecnologia e produto | gradientes contidos, cards, roxo/azul, profundidade leve |
| `flat` | educação introdutória | formas simples, cores sólidas, ícones vetoriais |
| `infographic` | processos e métricas | rótulos, conectores, números e gráficos priorizados |

Uma paleta fornecida no projeto substitui os tokens do tema. Use no máximo uma cor primária, uma secundária, um acento e neutros por cena.

## Movimento informativo

- Entrada indica ordem de leitura; atraso de 0,08–0,25 s entre itens relacionados costuma bastar.
- `slide-*` comunica direção ou sequência; `zoom` destaca escala; `draw` revela linhas, setas e relações; `fade` é neutro.
- Use 0,35–0,8 s para entradas comuns e 0,45–1 s para transições de cena. Evite combinar mais de dois tipos de movimento simultâneos.
- Respeite continuidade espacial: um objeto que representa a mesma entidade não deve trocar de lado ou cor sem explicação.
- Reserve os últimos 10–15% da cena para estabilização ou saída; evite cortar texto ainda em movimento.

## Gráficos e diagramas

- Eixos devem ter unidade, escala e origem coerentes. Valores negativos precisam de linha de base apropriada.
- Não use área ou volume para comparar valores lineares. Em roscas, limite categorias e mostre total ou percentuais quando esses números forem fornecidos.
- Não suavize, extrapole ou complete dados sem autorização. Preserve a ordem temporal quando houver tempo.
- Em diagramas, setas indicam direção; linhas sem seta indicam associação. Rótulos devem descrever a relação quando ela não for óbvia.

## Precisão científica

- Separe escala didática de escala física. Se a representação não estiver em escala, deixe isso claro no texto ou relatório.
- Para membrana plasmática: mostre bicamada fosfolipídica; difusão simples ocorre a favor do gradiente sem proteína; difusão facilitada usa canal ou transportador e não consome ATP diretamente; osmose é movimento de água; transporte ativo pode ocorrer contra o gradiente e requer energia direta ou indiretamente.
- Não transforme uma analogia em mecanismo literal. Peça fonte ou marque incerteza quando o pedido inclui números, resultados ou afirmações contestáveis.

## Inspeção de quadros

Revise primeiro, meio e fim de cada cena. Verifique:

- nenhum quadro vazio inesperado;
- texto integral, sem clipping ou sobreposição;
- margem segura, contraste e legibilidade em tela pequena;
- eixos, legendas, unidades e setas corretos;
- imagem sem distorção e asset com licença registrada;
- posição coerente entre quadros adjacentes;
- captions sem cobrir o foco visual.

Depois do render, o relatório FFprobe deve confirmar MP4/H.264, `yuv420p`, resolução, FPS, duração e tamanho não vazio. Diferença de até um frame na duração é aceitável.

