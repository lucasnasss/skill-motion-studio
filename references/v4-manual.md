# Produção por referência e por gravação

Para usar duas vistas ortogonais, acrescente `--side perfil.png`. A interseção das silhuetas delimita um volume possível. Alinhe os recortes pela altura do mesmo objeto. Concavidades invisíveis permanecem inferidas.

O comando `node scripts/platform.mjs projeto.json instagram-reels vertical.json` cria uma variante. As opções completas estão em assets/platforms.json. Revise o enquadramento após a troca de formato.

Use `python scripts/media_search.py "intitle:objeto filetype:bitmap" fontes.json` para obter candidatos com autoria e licença no Wikimedia Commons. Confira a adequação de cada arquivo ao roteiro antes de incorporar a mídia e copie a atribuição para o projeto.

O efeito holofote também aceita `keyframes` no formato `[[tempo,x,y], ...]` em segundos e coordenadas relativas. A posição interpola entre pontos definidos no projeto.

O adaptador experimental `scripts/ai_shape.py` requer instalação separada do módulo hy3dshape e pesos locais. A equipe do Hunyuan3D-2.1 informa 10 GB de VRAM para geometria e 29 GB no fluxo completo. Revise a licença comunitária da Tencent antes de habilitar esse motor. [Repositório e licença oficiais](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1)

Execute os comandos na pasta que contém o SKILL.md. Os módulos de imagem requerem Python e Pillow 10.1 ou superior. A produção de vídeo requer FFmpeg e FFprobe no PATH.

```powershell
python scripts/image_to_3d.py referencia.png pasta-nova --depth 0.24 --resolution 48 --video
python scripts/avatar_video.py avatar.png fala.wav apresentacao.mp4 --mouth 0.5 0.61
python scripts/video_effect.py checklist entrada.mp4 saida.mp4 efeito.json
node scripts/educational-video.mjs motion-request.json storyboard.json projeto.json
```

Para imagem em 3D, use um recorte transparente. O GLB representa um baixo-relevo da vista frontal, com espessura estimada. A saída contém três ângulos, metadados e, com a opção de vídeo, uma volta completa. A geometria lateral segue o contorno do recorte. Em uma ilustração celular, a cor frontal registra as estruturas desenhadas. A profundidade de cada organela exigiria outras referências ou modelagem. Entregue o GLB para inserção manual no PowerPoint e o MP4 para o gerador de apresentações.

Para avatar, escolha uma figura desenhada e calibre o centro da boca em coordenadas entre zero e um. A abertura acompanha a energia do áudio em intervalos de um quadro. A faixa de saída vem da gravação original. A escolha da posição é manual e a articulação é aproximada.

Para efeitos, crie um JSON com `labels` (lista de textos curtos), `position` ([x,y] relativos), `color`, `start`, `duration`, `intensity` e opcionalmente `font` (arquivo de fonte). O preset tela-dividida usa `image` (caminho local). Estão disponíveis documentario, orbita, linha-do-tempo, holofote, tela-dividida, vidro e checklist. Holofote usa posição fixa. Use o editor existente para cortes e legendas antes de aplicar o efeito.

Para aula, leia o objetivo, o conteúdo, os conhecimentos prévios e as restrições do pedido Edu Studio 1.0. Prepare um storyboard no formato nativo com um mecanismo ou comparação por cena. Revise as representações com relação ao conteúdo e às fontes do pedido. O adaptador associa público, objetivo e acessibilidade ao storyboard e valida o projeto. Em seguida use os comandos tts e pipeline existentes.
