import crypto from 'node:crypto';

function scoreModel(model, summary, request, stack) {
  let score = 0;

  score += summary.healthScore || 0;

  const pricingClass = model.pricing?.class || 'unknown';
  if (pricingClass === 'free') score += 18;
  else if (pricingClass === 'cheap') score += 10;
  else if (pricingClass === 'premium') score -= 25;

  const speedTier = model.speedTier || 'medium';
  if (request.speedSensitivity === 'high') {
    if (speedTier === 'fast') score += 12;
    if (speedTier === 'slow') score -= 10;
  }

  const reasoning = model.capabilities?.reasoning || false;
  if (request.reasoningDepth === 'high') {
    if (reasoning === 'high' || reasoning === true) score += 15;
    else if (reasoning === 'medium') score += 7;
    else score -= 15;
  }

  const coding = model.capabilities?.coding || false;
  if (request.taskType?.includes('coding')) {
    if (coding === 'high' || coding === true) score += 15;
    else if (coding === 'medium') score += 6;
    else score -= 12;
  }

  const longWriting = model.capabilities?.longWriting || false;
  if (request.outputLength === 'long') {
    if (longWriting === true || longWriting === 'high') score += 10;
    else if (longWriting === 'medium') score += 5;
    else score -= 10;
  }

  if ((summary.routingStatus || 'active') === 'disabled') score -= 1000;
  if (summary.routingStatus === 'retired') score -= 1000;
  if (summary.routingStatus === 'cooldown') score -= 80;
  if (summary.routingStatus === 'degraded') score -= 25;

  if (stack.models.indexOf(model.id) !== -1) {
    score += Math.max(15 - stack.models.indexOf(model.id) * 3, 0);
  }

  return score;
}

function classifyError(error) {
  const code = error?.code || 'unknown_error';
  if (code === 'missing_api_key') return { outcome: 'retryable_error', retryable: false, errorCode: code };
  if (error?.httpStatus === 429) return { outcome: 'rate_limited', retryable: true, errorCode: code };
  if ([408, 500, 502, 503, 504].includes(error?.httpStatus)) return { outcome: 'retryable_error', retryable: true, errorCode: code };
  if (code === 'model_unavailable') return { outcome: 'unavailable', retryable: true, errorCode: code };
  return { outcome: 'retryable_error', retryable: Boolean(error?.retryable), errorCode: code };
}

export class RouterService {
  constructor({ registry, telemetry, providerAdapters, config, mockMode = true, alertService = null }) {
    this.registry = registry;
    this.telemetry = telemetry;
    this.providerAdapters = providerAdapters;
    this.config = config;
    this.mockMode = mockMode;
    this.alertService = alertService;
  }

  getRankedCandidates(request) {
    const stackId = this.registry.resolveStackId(request.taskType, request.profileId, request.overrides);
    const stack = this.registry.getStack(stackId);
    if (!stack) throw new Error(`Unknown stack: ${stackId}`);

    const candidates = stack.models
      .map((id) => this.registry.getModel(id))
      .filter(Boolean)
      .map((model) => {
        const summary = this.telemetry.getModelSummary(model.id, model, stack.premiumPolicy || 'never');
        return {
          model,
          summary,
          score: scoreModel(model, summary, request, stack),
        };
      })
      .filter(({ model, summary }) => {
        if (model.modality !== request.modality) return false;
        if ((summary.routingStatus === 'disabled' || summary.routingStatus === 'retired') && !request.overrides?.forceModelId) return false;
        if (request.premiumPolicy === 'never' && model.pricing?.class === 'premium') return false;
        if ((stack.premiumPolicy || 'never') === 'never' && model.pricing?.class === 'premium') return false;
        if (request.costCeilingUsd != null && model.pricing?.class === 'premium' && request.costCeilingUsd < 0.1) return false;
        if (request.overrides?.forceModelId && request.overrides.forceModelId !== model.id) return false;
        return model.policy?.enabled !== false;
      })
      .sort((a, b) => b.score - a.score);

    return { stackId, stack, candidates };
  }

  async route(request) {
    const requestId = crypto.randomUUID();
    const { stackId, stack, candidates } = this.getRankedCandidates(request);
    const maxAttempts = Math.min(request.overrides?.maxAttempts || this.config.policy?.defaultMaxAttempts || 3, candidates.length || 0);
    const history = [];

    if (!candidates.length) {
      return {
        ok: false,
        requestId,
        stackId,
        error: 'No eligible models available',
        history,
      };
    }

    for (let index = 0; index < candidates.length && history.length < maxAttempts; index += 1) {
      const { model } = candidates[index];
      const attemptNumber = history.length + 1;
      const wasFallback = attemptNumber > 1;

      if (request.dryRun) {
        const responseText = `[dry-run] would route to ${model.id}`;
        this.telemetry.recordAttempt({
          requestId,
          stackId,
          model,
          attemptNumber,
          outcome: 'success',
          latencyMs: 1,
          isMock: true,
          wasFallback,
          requestSummary: request,
          responseSummary: { text: responseText },
        });
        history.push({ modelId: model.id, outcome: 'success', mock: true });
        return {
          ok: true,
          requestId,
          stackId,
          selectedModelId: model.id,
          responseText,
          history,
          mock: true,
        };
      }

      const simulatedFailure = request.simulate?.failModels?.includes(model.id);
      const isMock = request.mockMode ?? this.mockMode;
      const started = Date.now();

      if (simulatedFailure) {
        const latencyMs = Date.now() - started;
        this.telemetry.recordAttempt({
          requestId,
          stackId,
          model,
          attemptNumber,
          outcome: 'retryable_error',
          errorCode: 'simulated_failure',
          latencyMs,
          isMock: true,
          wasFallback,
          requestSummary: request,
          responseSummary: { simulated: true },
        });
        history.push({ modelId: model.id, outcome: 'retryable_error', errorCode: 'simulated_failure', mock: true });
        await this.maybeAlert({ requestId, stackId, modelId: model.id, outcome: 'retryable_error', errorCode: 'simulated_failure', taskType: request.taskType });
        continue;
      }

      try {
        let responseText;
        let latencyMs;

        if (isMock) {
          latencyMs = 80 + index * 40;
          responseText = `Mock response from ${model.id} for task ${request.taskType}`;
        } else {
          const adapter = this.providerAdapters[model.provider];
          if (!adapter) {
            const error = new Error(`No provider adapter for ${model.provider}`);
            error.code = 'missing_provider_adapter';
            throw error;
          }
          const result = await adapter.chat({
            model,
            prompt: request.payload?.prompt || 'Hello from the model router MVP.',
            maxTokens: request.payload?.maxTokens || 300,
            temperature: request.payload?.temperature || 0.2,
          });
          responseText = result.text;
          latencyMs = result.latencyMs;
        }

        this.telemetry.recordAttempt({
          requestId,
          stackId,
          model,
          attemptNumber,
          outcome: 'success',
          latencyMs,
          isMock,
          wasFallback,
          requestSummary: request,
          responseSummary: { textPreview: responseText.slice(0, 200) },
        });
        history.push({ modelId: model.id, outcome: 'success', latencyMs, mock: isMock });
        return {
          ok: true,
          requestId,
          stackId,
          selectedModelId: model.id,
          responseText,
          history,
          mock: isMock,
        };
      } catch (error) {
        const latencyMs = error.latencyMs || (Date.now() - started);
        const classification = classifyError(error);
        this.telemetry.recordAttempt({
          requestId,
          stackId,
          model,
          attemptNumber,
          outcome: classification.outcome,
          errorCode: classification.errorCode,
          latencyMs,
          isMock: false,
          wasFallback,
          requestSummary: request,
          responseSummary: { message: error.message },
        });
        history.push({ modelId: model.id, outcome: classification.outcome, errorCode: classification.errorCode, latencyMs });
        await this.maybeAlert({ requestId, stackId, modelId: model.id, outcome: classification.outcome, errorCode: classification.errorCode, taskType: request.taskType });
        if (!classification.retryable) {
          return {
            ok: false,
            requestId,
            stackId,
            error: error.message,
            history,
          };
        }
      }
    }

    return {
      ok: false,
      requestId,
      stackId,
      error: 'All eligible models failed',
      history,
    };
  }

  async maybeAlert(payload) {
    if (!this.alertService) return;
    try {
      await this.alertService.sendRoutingError(payload);
    } catch (error) {
      // Avoid breaking routing flow if alert transport fails.
      console.error('Alert delivery failed:', error.message);
    }
  }
}
