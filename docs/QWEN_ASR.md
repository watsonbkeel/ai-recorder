# Qwen3-ASR Local Service

This project uses a local Qwen3-ASR service for mini program voice-to-text.

## Model

- Default model: `Qwen/Qwen3-ASR-1.7B`
- Runtime endpoint: `http://127.0.0.1:3102`
- Transcription endpoint: `POST /v1/audio/transcriptions`
- Backend integration: `server/src/services/ai.service.js`

The service is intentionally separate from the Node backend. It keeps GPU memory, model weights, and Python dependencies outside the main app process.

## Start With Docker GPU

Build the service image:

```bash
docker build -t ai-recorder-qwen-asr:latest ./asr
```

Start it with the NVIDIA runtime:

```bash
mkdir -p /root/ai-recorder-models/qwen-asr
docker run --rm --gpus all --name ai-recorder-asr \
  -p 127.0.0.1:3102:3102 \
  -v /root/ai-recorder-models/qwen-asr:/root/.cache/huggingface \
  -e HF_HOME=/root/.cache/huggingface \
  -e QWEN_ASR_MODEL=Qwen/Qwen3-ASR-1.7B \
  -e QWEN_ASR_DTYPE=float16 \
  -e QWEN_ASR_MAX_BATCH_SIZE=1 \
  -e QWEN_ASR_MAX_NEW_TOKENS=256 \
  ai-recorder-qwen-asr:latest
```

Warm-load the model:

```bash
curl -sS -X POST http://127.0.0.1:3102/load
```

Check health:

```bash
curl -sS http://127.0.0.1:3102/health
```

## Node Backend Environment

Set these values in local `server/.env` only:

```env
ASR_PROVIDER=local
LOCAL_ASR_BASE_URL="http://127.0.0.1:3102"
LOCAL_ASR_MODEL="Qwen/Qwen3-ASR-1.7B"
LOCAL_ASR_LANGUAGE=""
LOCAL_ASR_TIMEOUT_MS=180000
ASR_FALLBACK_OPENAI=false
OPENAI_ADVANCED_MODEL="gpt-5.5"
```

`ASR_FALLBACK_OPENAI=true` allows the old OpenAI-compatible audio transcription route to be used when the local ASR service is down. Keep it `false` when you want all voice transcription to use the local model.

## API Shape

The Qwen ASR service accepts an OpenAI-like multipart request:

```bash
curl -sS -X POST http://127.0.0.1:3102/v1/audio/transcriptions \
  -F "file=@/path/to/audio.mp3" \
  -F "model=Qwen/Qwen3-ASR-1.7B" \
  -F "response_format=json"
```

Response:

```json
{
  "text": "转写后的文字",
  "language": "Chinese",
  "model": "Qwen/Qwen3-ASR-1.7B",
  "provider": "qwen3-asr",
  "elapsedMs": 1234
}
```

## 3060 6GB Notes

The default service settings are conservative for a 6GB RTX 3060:

- `QWEN_ASR_DTYPE=float16`
- `QWEN_ASR_MAX_BATCH_SIZE=1`
- `QWEN_ASR_MAX_NEW_TOKENS=256`

If the model still runs out of memory, reduce `QWEN_ASR_MAX_NEW_TOKENS` first. Do not enable forced alignment on this 6GB target unless memory has been verified.
