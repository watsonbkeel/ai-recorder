#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="ai-recorder-asr.service"
MODEL_CACHE_DIR="${MODEL_CACHE_DIR:-/root/ai-recorder-models/qwen-asr}"

mkdir -p "$MODEL_CACHE_DIR"

cd "$ROOT_DIR"
docker build -t ai-recorder-qwen-asr:latest ./asr

install -m 0644 "$ROOT_DIR/deploy/$SERVICE_NAME" "/etc/systemd/system/$SERVICE_NAME"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager
