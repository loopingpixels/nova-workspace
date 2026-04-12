import { sendDiscordWebhookAlert } from './discord-webhook.js';

export class AlertService {
  constructor({ discordWebhookUrl, appBaseUrl }) {
    this.discordWebhookUrl = discordWebhookUrl;
    this.appBaseUrl = appBaseUrl;
  }

  async sendRoutingError({ requestId, stackId, modelId, outcome, errorCode, taskType }) {
    return sendDiscordWebhookAlert({
      webhookUrl: this.discordWebhookUrl,
      title: 'Model Router Error',
      description: `A routing attempt failed in the model router MVP.`,
      fields: [
        { name: 'Request ID', value: requestId || 'n/a' },
        { name: 'Task type', value: taskType || 'n/a', inline: true },
        { name: 'Stack', value: stackId || 'n/a', inline: true },
        { name: 'Model', value: modelId || 'n/a' },
        { name: 'Outcome', value: outcome || 'n/a', inline: true },
        { name: 'Error code', value: errorCode || 'n/a', inline: true },
        { name: 'Dashboard', value: this.appBaseUrl || 'n/a' },
      ],
      color: 0xe11d48,
    });
  }

  async sendTestAlert() {
    return sendDiscordWebhookAlert({
      webhookUrl: this.discordWebhookUrl,
      title: 'Model Router Test Alert',
      description: 'Test alert from the model-router-mvp webhook pipeline.',
      fields: [
        { name: 'Dashboard', value: this.appBaseUrl || 'n/a' },
      ],
      color: 0x2563eb,
    });
  }
}
