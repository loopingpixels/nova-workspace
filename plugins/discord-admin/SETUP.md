Discord Admin plugin scaffold.

Required env vars:
- DISCORD_ADMIN_BOT_TOKEN=...  (preferred, dedicated admin bot)
- DISCORD_GUILD_ID=...

Fallback env var supported:
- DISCORD_BOT_TOKEN=...

What this plugin can do once loaded:
- /discord-create-alert-channel <guildId> <channel-name>
- /discord-send-webhook-test <webhookUrl>

Notes:
- The bot must be invited to the server.
- Required Discord permissions:
  - View Channels
  - Send Messages
  - Manage Channels
  - Manage Webhooks
  - Read Message History

After adding env vars and loading the plugin, restart the OpenClaw gateway.
