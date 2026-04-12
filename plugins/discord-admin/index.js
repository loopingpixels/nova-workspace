import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Client, GatewayIntentBits, ChannelType, PermissionsBitField } from "discord.js";

let clientPromise = null;

async function getClient() {
  if (clientPromise) return clientPromise;
  const token = process.env.DISCORD_ADMIN_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_ADMIN_BOT_TOKEN (or DISCORD_BOT_TOKEN) is not configured');

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  clientPromise = client.login(token).then(() => client);
  return clientPromise;
}

async function getGuild(guildId) {
  if (!guildId) throw new Error('guildId is required');
  const client = await getClient();
  const guild = await client.guilds.fetch(guildId);
  if (!guild) throw new Error(`Guild not found: ${guildId}`);
  return guild;
}

export default definePluginEntry({
  id: "discord-admin",
  name: "Discord Admin",
  description: "Discord channel and webhook management tools for Nova",
  register(api) {
    api.registerCommand({
      name: "discord-create-alert-channel",
      description: "Create a Discord text channel and webhook for alerts.",
      acceptsArgs: true,
      handler: async (args = '') => {
        try {
          const raw = String(args || '').trim();
          const [guildId, channelNameRaw] = raw.split(/\s+/, 2);
          const channelName = (channelNameRaw || 'model-router-alerts').trim().toLowerCase();
          const guild = await getGuild(guildId || process.env.DISCORD_GUILD_ID);

          const me = await guild.members.fetchMe();
          const perms = me.permissions;
          const missing = [];
          if (!perms.has(PermissionsBitField.Flags.ManageChannels)) missing.push('ManageChannels');
          if (!perms.has(PermissionsBitField.Flags.ManageWebhooks)) missing.push('ManageWebhooks');
          if (!perms.has(PermissionsBitField.Flags.ViewChannel)) missing.push('ViewChannel');

          if (missing.length) {
            return { text: `Missing Discord permissions: ${missing.join(', ')}` };
          }

          let channel = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === channelName);
          if (!channel) {
            channel = await guild.channels.create({
              name: channelName,
              type: ChannelType.GuildText,
              topic: 'Automatic alerts from the Model Router MVP',
              reason: 'Create alert channel for model-router-mvp',
            });
          }

          const webhook = await channel.createWebhook({
            name: 'Model Router Alerts',
            reason: 'Create webhook for model-router-mvp alerts',
          });

          return {
            text: [
              `Channel ready: #${channel.name}`,
              `Channel ID: ${channel.id}`,
              `Webhook URL: ${webhook.url}`
            ].join('\n')
          };
        } catch (error) {
          return { text: `discord-create-alert-channel failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    });

    api.registerCommand({
      name: "discord-send-webhook-test",
      description: "Send a test message to a Discord channel webhook URL.",
      acceptsArgs: true,
      handler: async (args = '') => {
        const webhookUrl = String(args || '').trim();
        if (!webhookUrl) return { text: 'Provide the webhook URL as the command argument.' };
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'Discord Admin Plugin',
              content: 'Test message from the Discord admin plugin.'
            })
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return { text: 'Webhook test sent successfully.' };
        } catch (error) {
          return { text: `discord-send-webhook-test failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    });
  },
});
