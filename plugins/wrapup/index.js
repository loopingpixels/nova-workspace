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

function collectDebug(result) {
  try {
    const parts = [];
    if (result?.status) parts.push(`status=${String(result.status)}`);
    if (result?.finishReason) parts.push(`finishReason=${String(result.finishReason)}`);
    if (typeof result?.message === 'string' && result.message.trim()) parts.push(`message=${result.message.trim()}`);
    if (typeof result?.text === 'string' && result.text.trim()) parts.push(`text=${result.text.trim()}`);
    if (result?.payloads) parts.push(`payloadCount=${Array.isArray(result.payloads) ? result.payloads.length : 'non-array'}`);
    return parts.join(' | ');
  } catch {
    return '';
  }
}

export default definePluginEntry({
  id: "wrapup-command",
  name: "Wrapup Command",
  description: "Adds a /wrapup command to prepare memory/workflow sync before reset",
  register(api) {
    api.registerCommand({
      name: "wrapup",
      description: "Run wrap-up sync and report whether reset is safe.",
      acceptsArgs: false,
      handler: async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-wrapup-'));
        const sessionId = `wrapup-${Date.now()}`;
        const sessionFile = path.join(tmpDir, 'session.json');
        const prompt = [
          'Read DAILY_SYNC_CHECKLIST.md and follow it exactly for the current workspace.',
          'Review recent session context and current workspace changes.',
          'Update durable memory/workflows when needed.',
          'Commit and push durable changes when needed.',
          'Return a short proof-based summary.',
          'End with one line exactly in this form: RESET_SAFE: YES or RESET_SAFE: NO.'
        ].join(' ');
        try {
          const result = await api.runtime.agent.runEmbeddedPiAgent({
            sessionId,
            sessionFile,
            agentId: 'nova',
            agentDir: '/home/roshan/.openclaw/agents/nova/agent',
            workspaceDir: '/home/roshan/.openclaw/workspace-nova',
            config: api.config,
            prompt,
            timeoutMs: 120000,
            runId: `wrapup-${Date.now()}`,
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

          if (text) {
            return { text };
          }

          const debug = collectDebug(result);
          return {
            text: `Wrap-up completed with no text output.${debug ? ` Debug: ${debug}` : ''}\nRESET_SAFE: NO`
          };
        } catch (error) {
          return {
            text: `Wrap-up failed: ${error instanceof Error ? error.message : String(error)}\nRESET_SAFE: NO`
          };
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        }
      },
    });
  },
});
