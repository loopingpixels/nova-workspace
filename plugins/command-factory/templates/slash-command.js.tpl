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
  id: "{{PLUGIN_ID}}",
  name: "{{PLUGIN_TITLE}}",
  description: "{{PLUGIN_DESCRIPTION}}",
  register(api) {
    api.registerCommand({
      name: "{{COMMAND_NAME}}",
      description: "{{COMMAND_DESCRIPTION}}",
      acceptsArgs: true,
      handler: async (args = '') => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), '{{COMMAND_NAME}}-'));
        const sessionId = `{{COMMAND_NAME}}-${Date.now()}`;
        const sessionFile = path.join(tmpDir, 'session.json');
        const userInput = typeof args === 'string' ? args.trim() : '';
        const prompt = [
          {{PROMPT_LINES}}
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
            runId: `{{COMMAND_NAME}}-${Date.now()}`,
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
            text: text || '{{EMPTY_RESPONSE}}'
          };
        } catch (error) {
          return {
            text: `{{ERROR_PREFIX}}${error instanceof Error ? error.message : String(error)}`
          };
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        }
      },
    });
  },
});
