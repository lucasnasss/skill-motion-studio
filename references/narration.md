# Narração natural

## Invariante de sincronização

A cena segue o WAV medido; o WAV nunca é acelerado para seguir a cena. O pipeline usa `playbackRate: 1`, intermediário mono WAV PCM S16LE a 48 kHz e uma única normalização `loudnorm` por padrão. Se `--target-duration` for menor que a fala, o comando interrompe e pede revisão do roteiro.

Fluxo: roteiro → normalização de pronúncia → síntese → PCM/QA → duração real → timeline/captions → render → `audio-compare`.

## Provedores

- `onecore`: fallback local do Windows. Funciona sem download, mas a naturalidade depende das vozes instaladas. O padrão agora é velocidade moderada, nunca o antigo 1,08 fixo.
- `kokoro`: local/open-weight. O adaptador usa Kokoro 0.9.4, voz pt-BR `pf_dora` por padrão e aceita `pm_alex`/`pm_santa`. Requer Python 3.10–3.13, `kokoro`, `soundfile` e `espeak-ng`; configure `KOKORO_PYTHON` quando estiver em ambiente separado.
- `elevenlabs`: premium. Usa `eleven_multilingual_v2`, que suporta português do Brasil, e converte uma única resposta MP3 para PCM. Defina `ELEVENLABS_API_KEY` somente no ambiente e informe `--voice`; a chave nunca entra em JSON ou logs.

Referências oficiais: [ElevenLabs TTS API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert/), [idiomas ElevenLabs](https://elevenlabs.io/docs/help-center/other/what-languages-do-you-support), [Kokoro](https://github.com/hexgrad/kokoro), [vozes Kokoro](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md).

## Presets e comandos

Presets: `educational`, `documentary`, `social` e `institutional`. Cada um mantém velocidade entre 0,94 e 1,03; parâmetros de expressividade são usados quando o provedor oferece suporte.

```powershell
node scripts/motion-studio.mjs tts-preview --text "A fotossíntese transforma energia luminosa." --provider onecore --preset educational
node scripts/motion-studio.mjs tts-compare --text "Texto de teste." --candidates "onecore:Microsoft Maria,kokoro:pf_dora"
node scripts/motion-studio.mjs tts projeto.json --out projeto-com-voz.json --provider kokoro --voice pf_dora --preset educational --preserve-source
node scripts/motion-studio.mjs audio-compare projeto-com-voz.json output/final.mp4
```

Use `--save-default` para guardar provedor/voz/preset em `.motion-studio/tts.json`; nenhuma chave é persistida. Use `--pronunciation dicionario.json` para substituições específicas, por exemplo `{"ATP":"A T P"}`.

## Critérios de QA

`audio-inspect` mede duração, PCM, clipping, pico/RMS, saltos adjacentes e silêncios. Silêncios internos são relatados, não removidos automaticamente: podem representar pontuação ou intenção. `audio-compare` reprova corte de fonte, clipping ou `playbackRate` diferente de 1.

Métricas técnicas não confirmam naturalidade, pronúncia ou emoção. Sempre ofereça os WAVs/MP4s ao usuário e peça avaliação auditiva antes da publicação.
