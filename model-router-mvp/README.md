# Model Router MVP

Local model-routing app with stack-based routing, fallback, telemetry, maintenance review, and Discord webhook alert support.

## Features

- Named stacks for routing by purpose
- Ordered fallback across models
- Local SQLite telemetry
- Weekly maintenance review script
- Local web UI
- Mock mode for safe testing
- Optional OpenRouter live calls
- Discord webhook alerts for routing errors

## Run locally

```bash
cd /home/roshan/.openclaw/workspace-nova/model-router-mvp
npm install
cp .env.example .env
node src/server.js
```

App URL:
- `http://192.168.1.250:4010`

## Env vars

- `PORT=4010`
- `OPENROUTER_API_KEY=...`
- `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- `OPENROUTER_HTTP_REFERER=http://localhost:4010`
- `OPENROUTER_APP_TITLE=Model Router MVP`
- `MOCK_MODE=true`
- `APP_BASE_URL=http://192.168.1.250:4010`
- `DISCORD_WEBHOOK_URL=`

## Useful endpoints

- `GET /api/health`
- `GET /api/stacks`
- `GET /api/models`
- `GET /api/attempts`
- `GET /api/maintenance/latest`
- `POST /api/route`
- `POST /api/maintenance/run`
- `POST /api/alerts/test`

## Startup on boot

A helper script is included:

```bash
sudo bash /home/roshan/.openclaw/workspace-nova/model-router-mvp/scripts/install-startup.sh
```

This installs a systemd service named `model-router-mvp.service`.

## Discord alerts

Create a Discord channel, create a webhook for that channel, then set:

```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Then restart the service/app. Error attempts and the test endpoint will send alerts there.
