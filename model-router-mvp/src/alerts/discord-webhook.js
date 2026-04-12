export async function sendDiscordWebhookAlert({ webhookUrl, title, description, fields = [], color = 0xff4d4f }) {
  if (!webhookUrl) {
    const error = new Error('DISCORD_WEBHOOK_URL is not configured');
    error.code = 'missing_discord_webhook';
    throw error;
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'Model Router Alerts',
      embeds: [
        {
          title,
          description,
          color,
          fields: fields.map((field) => ({
            name: String(field.name).slice(0, 256),
            value: String(field.value).slice(0, 1024),
            inline: Boolean(field.inline),
          })),
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = new Error(`Discord webhook failed: HTTP ${response.status} ${text}`);
    error.code = `discord_http_${response.status}`;
    throw error;
  }
}
