import fs from 'node:fs/promises';
import path from 'node:path';

const factoryDir = path.resolve('plugins/command-factory');
const templatesDir = path.join(factoryDir, 'templates');

function readFlag(args, name, fallback = '') {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function toPluginId(commandName) {
  return `${commandName}-command`;
}

function toPackageName(commandName) {
  return `@loopingpixels/openclaw-${commandName}-command`;
}

function escapeJsonString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function promptToJsArray(promptText) {
  return promptText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `'${line.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)
    .join(',\n          ');
}

async function loadTemplate(name) {
  return fs.readFile(path.join(templatesDir, name), 'utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const commandName = args[0]?.trim();

  if (!commandName) {
    console.error('Usage: node plugins/command-factory/create-command.mjs <command-name> --title <title> --description <plugin-description> --command-description <command-description> --prompt-file <file>');
    process.exit(1);
  }

  const title = readFlag(args, '--title', `${commandName} Command`);
  const pluginDescription = readFlag(args, '--description', `Adds a /${commandName} command`);
  const commandDescription = readFlag(args, '--command-description', `Run the /${commandName} workflow.`);
  const promptFile = readFlag(args, '--prompt-file');
  const emptyResponse = readFlag(args, '--empty-response', `${title} completed with no text output.`);
  const errorPrefix = readFlag(args, '--error-prefix', `${title} failed: `);

  if (!promptFile) {
    console.error('Missing required --prompt-file <file>');
    process.exit(1);
  }

  const promptText = await fs.readFile(path.resolve(promptFile), 'utf8');
  const replacements = {
    '{{PLUGIN_ID}}': toPluginId(commandName),
    '{{PLUGIN_TITLE}}': escapeJsonString(title),
    '{{PLUGIN_DESCRIPTION}}': escapeJsonString(pluginDescription),
    '{{COMMAND_NAME}}': commandName,
    '{{COMMAND_DESCRIPTION}}': escapeJsonString(commandDescription),
    '{{PACKAGE_NAME}}': toPackageName(commandName),
    '{{PROMPT_LINES}}': promptToJsArray(promptText),
    '{{EMPTY_RESPONSE}}': escapeJsonString(emptyResponse),
    '{{ERROR_PREFIX}}': escapeJsonString(errorPrefix),
  };

  const outDir = path.resolve('plugins', commandName);
  await fs.mkdir(outDir, { recursive: true });

  for (const [templateName, outputName] of [
    ['openclaw.plugin.json.tpl', 'openclaw.plugin.json'],
    ['package.json.tpl', 'package.json'],
    ['slash-command.js.tpl', 'index.js'],
  ]) {
    let content = await loadTemplate(templateName);
    for (const [key, value] of Object.entries(replacements)) {
      content = content.split(key).join(value);
    }
    await fs.writeFile(path.join(outDir, outputName), content, 'utf8');
  }

  console.log(`Generated plugin in ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
