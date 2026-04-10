import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

function collectText(payloads) {
  if (!Array.isArray(payloads)) return '';

  const texts = [];
  for (const item of payloads) {
    if (typeof item?.text === 'string' && item.text.trim()) texts.push(item.text.trim());
    if (typeof item?.message === 'string' && item.message.trim()) texts.push(item.message.trim());
    if (typeof item?.content === 'string' && item.content.trim()) texts.push(item.content.trim());

    if (Array.isArray(item?.content)) {
      for (const part of item.content) {
        if (typeof part?.text === 'string' && part.text.trim()) texts.push(part.text.trim());
        if (typeof part?.value === 'string' && part.value.trim()) texts.push(part.value.trim());
        if (typeof part?.content === 'string' && part.content.trim()) texts.push(part.content.trim());
      }
    }
  }

  return texts.join('\n').trim();
}

export default definePluginEntry({
  id: "mayleo-command",
  name: "Mayleo Command",
  description: "Write and publish a Mayleo Tales post from a short description and attached images",
  register(api) {
    api.registerCommand({
      name: "mayleo",
      description: "Write and publish a Mayleo Tales post from the given description.",
      acceptsArgs: true,
      handler: async (args = '') => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mayleo-'));
        const sessionId = `mayleo-${Date.now()}`;
        const sessionFile = path.join(tmpDir, 'session.json');
        const userInput = typeof args === 'string' ? args.trim() : '';
        const prompt = [
          'Write and publish a Mayleo Tales blog post based on the user\'s description and any attached images from the triggering message.',
          'Use a cute, polished, warm, short human style.',
          'Choose sensible categories/tags using the Mayleo Tales label standard.',
          'If images are available, place them sensibly in the post.',
          'Publish by default instead of leaving a draft.',
          'Return the public post URL plus a short confirmation summary.',
          'If something required is missing, say exactly what is missing.'
        ].join(' ');

        try {
          const result = await api.runtime.agent.runEmbeddedPiAgent({
            sessionId,
            sessionFile,
            agentId: 'nova',
            agentDir: '/home/roshan/.openclaw/agents/nova/agent',
            workspaceDir: '/home/roshan/.openclaw/workspace-nova',
            config: api.config,
            prompt: `${prompt}\n\nUser input:\n${userInput || '(none provided)'}`,
            timeoutMs: 180000,
            runId: `mayleo-${Date.now()}`,
            provider: 'openai-codex',
            model: 'gpt-5.4',
            authProfileId: 'openai-codex:roshan2008web@gmail.com',
            authProfileIdSource: 'user',
            allowModelOverride: true,
            disableTools: false,
          });

          const text = [
            collectText(result?.payloads),
            typeof result?.text === 'string' ? result.text.trim() : '',
            typeof result?.message === 'string' ? result.message.trim() : ''
          ].filter(Boolean).join('\n').trim();

          return {
            text: text || 'Mayleo Command completed with no text output.'
          };
        } catch (error) {
          return {
            text: `Mayleo Command failed: ${error instanceof Error ? error.message : String(error)}`
          };
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        }
      },
    });
  },
});
