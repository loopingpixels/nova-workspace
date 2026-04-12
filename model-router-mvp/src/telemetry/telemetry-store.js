import { computeHealthScore, deriveRoutingStatus } from '../health/health-scorer.js';

function nowIso() {
  return new Date().toISOString();
}

export class TelemetryStore {
  constructor(db, configPolicy = {}) {
    this.db = db;
    this.configPolicy = configPolicy;
  }

  getModelSummary(modelId, model, stackPremiumPolicy = 'never') {
    const row = this.db
      .prepare('SELECT * FROM model_stats WHERE model_id = ?')
      .get(modelId);

    const summary = {
      modelId,
      total: 0,
      successes: 0,
      failures: 0,
      retryableFailures: 0,
      retryableFailuresRecent: 0,
      timeouts: 0,
      consecutiveFailures: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      pricingClass: model?.pricing?.class || row?.pricing_class || 'unknown',
      lifecycleState: row?.lifecycle_state || model?.lifecycle?.state || 'active',
      disabledReason: row?.disabled_reason || null,
      lastStatus: row?.last_status || null,
      lastErrorCode: row?.last_error_code || null,
      stackPremiumPolicy,
    };

    if (row) {
      summary.successes = row.successes;
      summary.failures = row.failures;
      summary.retryableFailures = row.retryable_failures;
      summary.retryableFailuresRecent = row.retryable_failures_recent;
      summary.timeouts = row.timeouts;
      summary.consecutiveFailures = row.consecutive_failures;
      summary.p95LatencyMs = row.p95_latency_ms;
      summary.total = row.successes + row.failures;
      summary.avgLatencyMs = summary.total ? Math.round(row.total_latency_ms / summary.total) : 0;
    }

    summary.healthScore = computeHealthScore(summary);
    summary.routingStatus = deriveRoutingStatus({
      ...summary,
      retryableFailuresRecent: summary.retryableFailuresRecent,
      consecutiveFailures: summary.consecutiveFailures,
      pricingClass: summary.pricingClass,
      lifecycleState: summary.lifecycleState,
      stackPremiumPolicy,
      healthScore: summary.healthScore,
    }, this.configPolicy);

    return summary;
  }

  recordAttempt({ requestId, stackId, model, attemptNumber, outcome, errorCode, latencyMs = 0, isMock = false, wasFallback = false, requestSummary = {}, responseSummary = {} }) {
    const createdAt = nowIso();
    this.db.prepare(`
      INSERT INTO route_attempts (
        request_id, stack_id, model_id, provider, attempt_number, outcome,
        error_code, latency_ms, is_mock, was_fallback, created_at,
        request_summary_json, response_summary_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      requestId,
      stackId,
      model.id,
      model.provider,
      attemptNumber,
      outcome,
      errorCode || null,
      latencyMs,
      isMock ? 1 : 0,
      wasFallback ? 1 : 0,
      createdAt,
      JSON.stringify(requestSummary),
      JSON.stringify(responseSummary),
    );

    const existing = this.db.prepare('SELECT * FROM model_stats WHERE model_id = ?').get(model.id);
    const base = existing || {
      successes: 0,
      failures: 0,
      retryable_failures: 0,
      retryable_failures_recent: 0,
      timeouts: 0,
      consecutive_failures: 0,
      total_latency_ms: 0,
      p95_latency_ms: 0,
      lifecycle_state: model.lifecycle?.state || 'active',
    };

    const isSuccess = outcome === 'success';
    const isTimeout = outcome === 'timeout';
    const isRetryable = ['retryable_error', 'timeout', 'rate_limited', 'unavailable'].includes(outcome);
    const successes = base.successes + (isSuccess ? 1 : 0);
    const failures = base.failures + (isSuccess ? 0 : 1);
    const retryableFailures = base.retryable_failures + (isRetryable && !isSuccess ? 1 : 0);
    const retryableFailuresRecent = isSuccess ? 0 : Math.min(base.retryable_failures_recent + (isRetryable ? 1 : 0), 9999);
    const timeouts = base.timeouts + (isTimeout ? 1 : 0);
    const consecutiveFailures = isSuccess ? 0 : base.consecutive_failures + 1;
    const totalLatencyMs = base.total_latency_ms + latencyMs;
    const p95LatencyMs = Math.max(base.p95_latency_ms || 0, latencyMs);

    if (existing) {
      this.db.prepare(`
        UPDATE model_stats
        SET successes = ?, failures = ?, retryable_failures = ?, retryable_failures_recent = ?,
            timeouts = ?, consecutive_failures = ?, total_latency_ms = ?, p95_latency_ms = ?,
            last_status = ?, last_error_code = ?, pricing_class = ?, updated_at = ?
        WHERE model_id = ?
      `).run(
        successes,
        failures,
        retryableFailures,
        retryableFailuresRecent,
        timeouts,
        consecutiveFailures,
        totalLatencyMs,
        p95LatencyMs,
        outcome,
        errorCode || null,
        model.pricing?.class || 'unknown',
        createdAt,
        model.id,
      );
    } else {
      this.db.prepare(`
        INSERT INTO model_stats (
          model_id, successes, failures, retryable_failures, retryable_failures_recent,
          timeouts, consecutive_failures, total_latency_ms, p95_latency_ms, last_status,
          last_error_code, pricing_class, lifecycle_state, disabled_reason, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        model.id,
        successes,
        failures,
        retryableFailures,
        retryableFailuresRecent,
        timeouts,
        consecutiveFailures,
        totalLatencyMs,
        p95LatencyMs,
        outcome,
        errorCode || null,
        model.pricing?.class || 'unknown',
        model.lifecycle?.state || 'active',
        null,
        createdAt,
      );
    }
  }

  setLifecycle(modelId, lifecycleState, disabledReason = null) {
    this.db.prepare(`
      INSERT INTO model_stats (model_id, pricing_class, lifecycle_state, disabled_reason, updated_at)
      VALUES (?, 'unknown', ?, ?, ?)
      ON CONFLICT(model_id) DO UPDATE SET lifecycle_state = excluded.lifecycle_state,
        disabled_reason = excluded.disabled_reason,
        updated_at = excluded.updated_at
    `).run(modelId, lifecycleState, disabledReason, nowIso());
  }

  listModelSummaries(models, stacks) {
    return models.map((model) => {
      const stackEntry = Object.entries(stacks).find(([, stack]) => stack.models.includes(model.id));
      const stackPremiumPolicy = stackEntry?.[1]?.premiumPolicy || 'never';
      return this.getModelSummary(model.id, model, stackPremiumPolicy);
    });
  }

  getRecentAttempts(limit = 50) {
    return this.db.prepare(`
      SELECT id, request_id as requestId, stack_id as stackId, model_id as modelId, provider,
             attempt_number as attemptNumber, outcome, error_code as errorCode, latency_ms as latencyMs,
             is_mock as isMock, was_fallback as wasFallback, created_at as createdAt
      FROM route_attempts
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);
  }

  recordMaintenanceReport(summary) {
    this.db.prepare('INSERT INTO maintenance_reports (created_at, summary_json) VALUES (?, ?)').run(nowIso(), JSON.stringify(summary));
  }

  getLatestMaintenanceReport() {
    const row = this.db.prepare('SELECT * FROM maintenance_reports ORDER BY id DESC LIMIT 1').get();
    return row ? { id: row.id, createdAt: row.created_at, summary: JSON.parse(row.summary_json) } : null;
  }
}
