export class ModelRegistry {
  constructor(config) {
    this.models = new Map(config.models.map((model) => [model.id, model]));
    this.providers = config.providers;
    this.stacks = config.stacks;
    this.profiles = config.profiles || {};
    this.policy = config.policy || {};
    this.taskTypeToStack = config.taskTypeToStack || {};
  }

  getModel(id) {
    return this.models.get(id);
  }

  getAllModels() {
    return [...this.models.values()];
  }

  getStack(id) {
    return this.stacks[id];
  }

  getProfile(id) {
    return this.profiles[id];
  }

  resolveStackId(taskType, profileId, overrides = {}) {
    if (overrides.forceStackId) return overrides.forceStackId;
    if (profileId && this.profiles[profileId]?.stack) return this.profiles[profileId].stack;
    return this.taskTypeToStack[taskType] || 'fast-simple-text';
  }
}
