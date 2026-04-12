import fs from 'node:fs';
import yaml from 'js-yaml';

export function loadRouterConfig(configPath) {
  return yaml.load(fs.readFileSync(configPath, 'utf8'));
}
