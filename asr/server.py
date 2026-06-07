import os
import tempfile
import threading
import time
from pathlib import Path

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile


MODEL_NAME = os.getenv("QWEN_ASR_MODEL", "Qwen/Qwen3-ASR-1.7B")
DEVICE_MAP = os.getenv("QWEN_ASR_DEVICE_MAP", "cuda:0")
DTYPE = os.getenv("QWEN_ASR_DTYPE", "float16")
MAX_BATCH_SIZE = int(os.getenv("QWEN_ASR_MAX_BATCH_SIZE", "1"))
MAX_NEW_TOKENS = int(os.getenv("QWEN_ASR_MAX_NEW_TOKENS", "256"))
REQUIRE_CUDA = os.getenv("QWEN_ASR_REQUIRE_CUDA", "true").lower() != "false"
UPLOAD_TMP_DIR = Path(os.getenv("QWEN_ASR_UPLOAD_TMP_DIR", "/tmp/ai-recorder-qwen-asr"))

app = FastAPI(title="ai-recorder Qwen3 ASR", version="1.0.0")
_model = None
_model_lock = threading.Lock()


def _torch_dtype():
  value = DTYPE.lower()
  if value in ("fp16", "float16", "half"):
    return torch.float16
  if value in ("bf16", "bfloat16"):
    return torch.bfloat16
  if value in ("fp32", "float32"):
    return torch.float32
  raise ValueError(f"unsupported QWEN_ASR_DTYPE={DTYPE}")


def _load_model():
  global _model
  if _model is not None:
    return _model
  with _model_lock:
    if _model is not None:
      return _model
    if REQUIRE_CUDA and not torch.cuda.is_available():
      raise RuntimeError("CUDA is not available for Qwen3-ASR")
    from qwen_asr import Qwen3ASRModel

    kwargs = {
      "dtype": _torch_dtype(),
      "device_map": DEVICE_MAP,
      "max_inference_batch_size": MAX_BATCH_SIZE,
      "max_new_tokens": MAX_NEW_TOKENS,
    }
    if DEVICE_MAP == "cpu":
      kwargs["dtype"] = torch.float32
    _model = Qwen3ASRModel.from_pretrained(MODEL_NAME, **kwargs)
    return _model


@app.get("/health")
def health():
  cuda_available = torch.cuda.is_available()
  gpu_name = torch.cuda.get_device_name(0) if cuda_available else ""
  return {
    "ok": True,
    "loaded": _model is not None,
    "model": MODEL_NAME,
    "cudaAvailable": cuda_available,
    "gpuName": gpu_name,
  }


@app.post("/load")
def load():
  started = time.time()
  _load_model()
  return {
    "ok": True,
    "model": MODEL_NAME,
    "elapsedMs": int((time.time() - started) * 1000),
  }


@app.post("/v1/audio/transcriptions")
async def transcriptions(
  file: UploadFile = File(...),
  model: str = Form(default=MODEL_NAME),
  language: str = Form(default=""),
  response_format: str = Form(default="json"),
):
  if model and model != MODEL_NAME:
    raise HTTPException(status_code=400, detail=f"model must be {MODEL_NAME}")
  suffix = Path(file.filename or "audio.wav").suffix or ".wav"
  UPLOAD_TMP_DIR.mkdir(parents=True, exist_ok=True)
  with tempfile.NamedTemporaryFile(dir=UPLOAD_TMP_DIR, suffix=suffix, delete=False) as handle:
    tmp_path = Path(handle.name)
    while True:
      chunk = await file.read(1024 * 1024)
      if not chunk:
        break
      handle.write(chunk)

  started = time.time()
  try:
    asr = _load_model()
    results = asr.transcribe(
      audio=str(tmp_path),
      language=language.strip() or None,
    )
    first = results[0] if results else None
    text = (getattr(first, "text", "") or "").strip()
    detected_language = getattr(first, "language", "") if first else ""
  except Exception as exc:
    raise HTTPException(status_code=502, detail=str(exc)) from exc
  finally:
    try:
      tmp_path.unlink(missing_ok=True)
    except Exception:
      pass

  if not text:
    raise HTTPException(status_code=502, detail="Qwen3-ASR did not return text")

  return {
    "text": text,
    "language": detected_language,
    "model": MODEL_NAME,
    "provider": "qwen3-asr",
    "elapsedMs": int((time.time() - started) * 1000),
    "responseFormat": response_format,
  }
