import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

function collectText(payloads) {
  if (!Array.isArray(payloads)) return '';
  return payloads
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim();
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
          const text = collectText(result?.payloads);
          return {
            text: text || 'Wrap-up completed with no text output. RESET_SAFE: NO'
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
