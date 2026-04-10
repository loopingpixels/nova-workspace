# Command Factory

Reusable OpenClaw slash-command scaffold for quick custom command setup.

## Goal

Let Nova spin up new slash commands fast with a consistent structure.

## How it works

- `templates/slash-command.js.tpl` contains the plugin implementation template.
- `templates/openclaw.plugin.json.tpl` contains plugin metadata template.
- `templates/package.json.tpl` contains package metadata template.
- `create-command.mjs` generates a ready-to-use plugin under `plugins/<command-name>/`.

## Example

```bash
node plugins/command-factory/create-command.mjs mayleo \
  --title "Mayleo Command" \
  --description "Write and publish a Mayleo Tales post from a short description and attached images" \
  --command-description "Write and publish a Mayleo Tales post from the given description." \
  --prompt-file plugins/command-factory/examples/mayleo-prompt.txt
```

## Notes

- Generated commands default to the Nova agent/workspace/auth context.
- Prompt text is embedded into the generated command.
- After generation, restart the gateway so the new plugin is picked up.
