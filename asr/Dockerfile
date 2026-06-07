FROM qwenllm/qwen3-asr:latest

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/requirements.txt

COPY server.py /app/server.py

ENV QWEN_ASR_MODEL=Qwen/Qwen3-ASR-1.7B
ENV QWEN_ASR_DEVICE_MAP=cuda:0
ENV QWEN_ASR_DTYPE=float16
ENV QWEN_ASR_MAX_BATCH_SIZE=1
ENV QWEN_ASR_MAX_NEW_TOKENS=256
ENV QWEN_ASR_REQUIRE_CUDA=true
ENV PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True

EXPOSE 3102

CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "3102"]
