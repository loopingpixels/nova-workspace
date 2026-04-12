export class MaintenanceService {
  constructor({ registry, telemetry, config }) {
    this.registry = registry;
    this.telemetry = telemetry;
    this.config = config;
  }

  runWeeklyReview() {
    const summaries = this.telemetry.listModelSummaries(this.registry.getAllModels(), this.registry.stacks);
    const actions = [];

    for (const summary of summaries) {
      if (summary.routingStatus === 'disabled' && summary.disabledReason == null) {
        const reason = summary.pricingClass === 'premium' ? 'premium_in_free_stack' : 'health_threshold';
        this.telemetry.setLifecycle(summary.modelId, 'disabled', reason);
        actions.push({ type: 'disabled_model', modelId: summary.modelId, reason });
      }
    }

    const weakStacks = Object.entries(this.registry.stacks).map(([stackId, stack]) => {
      const healthy = stack.models.filter((modelId) => {
        const model = this.registry.getModel(modelId);
        const summary = this.telemetry.getModelSummary(modelId, model, stack.premiumPolicy || 'never');
        return ['active', 'degraded'].includes(summary.routingStatus);
      });
      return {
        stackId,
        minHealthyModels: stack.minHealthyModels || 3,
        healthyModels: healthy,
        isWeak: healthy.length < (stack.minHealthyModels || 3),
      };
    });

    const discoverySuggestions = [];
    for (const stack of weakStacks.filter((item) => item.isWeak)) {
      const candidates = this.suggestCandidateModels(stack.stackId);
      discoverySuggestions.push({ stackId: stack.stackId, candidates });
    }

    const summary = {
      createdAt: new Date().toISOString(),
      actions,
      weakStacks,
      discoverySuggestions,
    };

    this.telemetry.recordMaintenanceReport(summary);
    return summary;
  }

  suggestCandidateModels(stackId) {
    const stack = this.registry.getStack(stackId);
    if (!stack) return [];
    const existing = new Set(stack.models);
    return this.registry
      .getAllModels()
      .filter((model) => !existing.has(model.id))
      .filter((model) => model.modality === stack.modality)
      .filter((model) => model.pricing?.class !== 'premium' || (stack.premiumPolicy || 'never') !== 'never')
      .slice(0, 5)
      .map((model) => ({
        modelId: model.id,
        pricingClass: model.pricing?.class || 'unknown',
        provider: model.provider,
        reason: 'candidate_from_registry_pool',
      }));
  }
}
