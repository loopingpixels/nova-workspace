export function computeHealthScore(summary) {
  const successRate = summary.total ? summary.successes / summary.total : 1;
  let score = 100;
  score -= (1 - successRate) * 60;
  score -= Math.min(summary.timeouts * 4, 20);
  score -= Math.min(summary.retryableFailures * 3, 20);
  score -= Math.min(Math.max((summary.p95LatencyMs || 0) - 2000, 0) / 200, 15);
  score -= Math.min(summary.consecutiveFailures * 6, 30);
  return Math.max(0, Math.round(score));
}

export function deriveRoutingStatus(summary, configPolicy = {}) {
  if (summary.lifecycleState === 'retired') return 'retired';
  if (summary.lifecycleState === 'disabled') return 'disabled';
  if (summary.pricingClass === 'premium' && configPolicy.disableOnPaidClassForFreeStacks && summary.stackPremiumPolicy === 'never') {
    return 'disabled';
  }
  if (summary.consecutiveFailures >= (configPolicy.disableAfterConsecutiveFailures || 4)) return 'disabled';
  if (summary.retryableFailuresRecent >= (configPolicy.cooldownAfterRetryableFailures || 3)) return 'cooldown';
  if (summary.healthScore < 75) return 'degraded';
  return 'active';
}
