import express from 'express';
import path from 'node:path';
import { createAppServices } from './app.js';
import { normalizeRequest } from './routing/request-normalizer.js';

const services = createAppServices();
const app = express();
const port = Number(process.env.PORT || 4010);

app.use(express.json());
app.use(express.static(path.join(services.rootDir, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'model-router-mvp' });
});

app.get('/api/stacks', (_req, res) => {
  const stacks = Object.entries(services.registry.stacks).map(([stackId, stack]) => ({
    stackId,
    modality: stack.modality,
    minHealthyModels: stack.minHealthyModels,
    premiumPolicy: stack.premiumPolicy,
    models: stack.models.map((modelId) => {
      const model = services.registry.getModel(modelId);
      const summary = services.telemetry.getModelSummary(modelId, model, stack.premiumPolicy || 'never');
      return {
        modelId,
        pricingClass: model?.pricing?.class || 'unknown',
        healthScore: summary.healthScore,
        routingStatus: summary.routingStatus,
      };
    }),
  }));
  res.json({ stacks });
});

app.get('/api/models', (_req, res) => {
  const models = services.registry.getAllModels().map((model) => ({
    ...model,
    health: services.telemetry.getModelSummary(model.id, model),
  }));
  res.json({ models });
});

app.get('/api/attempts', (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  res.json({ attempts: services.telemetry.getRecentAttempts(limit) });
});

app.get('/api/maintenance/latest', (_req, res) => {
  res.json({ report: services.telemetry.getLatestMaintenanceReport() });
});

app.post('/api/route', async (req, res) => {
  try {
    const request = normalizeRequest(req.body || {});
    const result = await services.router.route(request);
    res.status(result.ok ? 200 : 422).json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/maintenance/run', (_req, res) => {
  try {
    const summary = services.maintenance.runWeeklyReview();
    res.json({ ok: true, summary });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/alerts/test', async (_req, res) => {
  try {
    await services.alertService.sendTestAlert();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(services.rootDir, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Model Router MVP listening on http://0.0.0.0:${port}`);
});
