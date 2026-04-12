#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/roshan/.openclaw/workspace-nova/model-router-mvp"
SERVICE_NAME="model-router-mvp.service"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}"

cat > "$SERVICE_PATH" <<'EOF'
[Unit]
Description=Model Router MVP
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/roshan/.openclaw/workspace-nova/model-router-mvp
ExecStart=/usr/bin/node /home/roshan/.openclaw/workspace-nova/model-router-mvp/src/server.js
Restart=always
RestartSec=5
User=roshan
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager
