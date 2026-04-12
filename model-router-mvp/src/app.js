import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './utils/load-env.js';
import { envBoolean } from './utils/env.js';
import { loadRouterConfig } from './registry/config-loader.js';
import { ModelRegistry } from './registry/model-registry.js';
import { createDatabase } from './db/database.js';
import { TelemetryStore } from './telemetry/telemetry-store.js';
import { OpenRouterAdapter } from './providers/openrouter-adapter.js';
import { RouterService } from './routing/router-service.js';
import { MaintenanceService } from './maintenance/maintenance-service.js';
import { AlertService } from './alerts/alert-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function createAppServices() {
  loadEnv(rootDir);
  const config = loadRouterConfig(path.join(rootDir, 'config', 'router-config.yaml'));
  const registry = new ModelRegistry(config);
  const db = createDatabase(rootDir);
  const telemetry = new TelemetryStore(db, config.policy || {});
  const openrouter = new OpenRouterAdapter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.OPENROUTER_BASE_URL || config.providers?.openrouter?.baseUrl,
    referer: process.env.OPENROUTER_HTTP_REFERER || `http://localhost:${process.env.PORT || 4010}`,
    appTitle: process.env.OPENROUTER_APP_TITLE || 'Model Router MVP',
  });
  const alertService = new AlertService({
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
    appBaseUrl: process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 4010}`,
  });
  const router = new RouterService({
    registry,
    telemetry,
    providerAdapters: { openrouter },
    config,
    mockMode: envBoolean('MOCK_MODE', true),
    alertService,
  });
  const maintenance = new MaintenanceService({ registry, telemetry, config });

  return { rootDir, config, registry, db, telemetry, router, maintenance, alertService };
}
