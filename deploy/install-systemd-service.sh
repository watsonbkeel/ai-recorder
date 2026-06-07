#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="ai-recorder.service"
PROJECT_ROOT="/root/AI-voice-recorder/ai-recorder"
SERVER_DIR="$PROJECT_ROOT/server"
UNIT_SOURCE="$PROJECT_ROOT/deploy/$SERVICE_NAME"
UNIT_TARGET="/etc/systemd/system/$SERVICE_NAME"

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root: sudo bash deploy/install-systemd-service.sh" >&2
  exit 1
fi

if [ ! -f "$SERVER_DIR/.env" ]; then
  echo "Missing $SERVER_DIR/.env" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not available in PATH" >&2
  exit 1
fi

NPM_BIN="$(command -v npm)"
TMP_UNIT="$(mktemp)"
sed "s#ExecStart=/usr/local/bin/npm run start#ExecStart=$NPM_BIN run start#" "$UNIT_SOURCE" > "$TMP_UNIT"
install -m 0644 "$TMP_UNIT" "$UNIT_TARGET"
rm -f "$TMP_UNIT"

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

systemctl --no-pager --lines=20 status "$SERVICE_NAME"
curl -fsS http://127.0.0.1:3001/health
echo
