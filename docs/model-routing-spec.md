# Model Routing System Spec

## 1) Problem statement

Roshan needs a reusable model-routing layer that sits in front of LLM/image providers and aggressively minimizes paid-token usage without making the system brittle.

Today, model choice is usually hardcoded per workflow or picked ad hoc. That creates a few problems:

- free/cheap models are not used consistently
- premium models get used too early
- failures cause dead ends instead of clean fallback
- model quality, cost, and availability drift over time but routing rules do not
- new projects cannot easily choose an appropriate model stack
- there is no central telemetry to answer: what worked, what failed, what got expensive, and what should be retired

The system should prefer OpenRouter as the first integration target because it exposes a large, changing model marketplace, but the design should remain provider-agnostic enough to support direct providers later.

---

## 2) Goals

### Primary goals

- Build a standalone routing system first, before wiring it into many projects.
- Route requests by task category and constraints instead of hardcoding a single model.
- Maintain model stacks per purpose, with at least 3 models in priority order for most stacks.
- Prefer free or cheap models first, with premium escalation only when justified.
- Support automatic fallback across models when a request fails or a model becomes degraded.
- Track model health, cost behavior, latency, and availability over time.
- Automatically reduce, disable, or retire bad models based on evidence.
- Run recurring maintenance to review performance and suggest replacements.
- Discover candidate replacement models when a stack becomes weak.
- Support manual overrides at workflow, agent, project, and request level.
- Provide telemetry and logs detailed enough to tune routing decisions.

### Secondary goals

- Keep routing explainable: the system should be able to say why it picked a model.
- Make onboarding for new projects easy via named stacks and routing profiles.
- Support text first, image generation next, and leave room for video later.

---

## 3) Non-goals

- Building a full benchmark lab for academic model evaluation.
- Automatically changing production routes every few minutes based on tiny sample sizes.
- Perfect quality scoring in MVP.
- Solving prompt engineering for every downstream workflow.
- Supporting every provider on day one.
- Full autonomous web scraping of the model ecosystem without review.
- Replacing human judgment for high-stakes or expensive workloads.

---

## 4) User stories / use cases

### Core routing

- As a workflow author, I want to say `taskType=short_reply` and let the router choose the cheapest acceptable model.
- As an agent, I want to request `reasoningDepth=high` and `costCeiling=low` so the system tries cheap reasoning-capable models before escalating.
- As a project owner, I want to select a named stack like `coding-hard` or `general-writing-long` instead of knowing model IDs.

### Fallback and resilience

- As a workflow, if the first model errors, times out, or rate-limits, I want the router to try the next eligible model automatically.
- As an operator, if a model starts failing repeatedly, I want it deprioritized without breaking existing workflows.
- As a user, I want premium models used only when lower-cost options fail policy checks or capability requirements.

### Operations and maintenance

- As an operator, I want weekly reports showing which models should be disabled, retired, or replaced.
- As an operator, I want the system to notice when a model becomes paid-only or loses availability.
- As an operator, I want candidate discovery when a stack has too few healthy options.

### Overrides and governance

- As a project owner, I want a manual allow/deny list for specific providers or models.
- As an agent author, I want a route override for one task without changing global policy.
- As Roshan, I want hard guardrails so premium models are not silently burned on low-value tasks.

---

## 5) Functional requirements

### 5.1 Model registry and metadata

The system must:

- maintain a central registry of known models
- support metadata for:
  - provider
  - model ID
  - modality (`text`, `image`, later `video`)
  - pricing status (`free`, `cheap`, `premium`, `unknown`)
  - pricing details if known
  - max context / output limits if known
  - reasoning suitability
  - coding suitability
  - writing suitability
  - speed tier
  - reliability tier
  - availability status
  - deprecation / retirement state
- allow metadata from both static config and observed runtime stats

### 5.2 Stack management

The system must:

- support named stacks by purpose/task category
- allow priority-ordered model lists within each stack
- support separate stacks for at least:
  - simple short text replies
  - longer text / general writing
  - hard reasoning / coding
  - image generation
  - video generation placeholder for later
- require a configured minimum healthy pool threshold per stack
- support inheritance or templating so similar stacks can share defaults

### 5.3 Routing engine

The routing engine must:

- accept a normalized route request including:
  - task type
  - modality
  - reasoning depth
  - expected output length
  - speed sensitivity
  - reliability requirement
  - cost ceiling
  - premium permission policy
  - project/workflow/agent identity
  - manual overrides
- resolve the correct stack or profile
- filter ineligible models based on capability and policy
- rank eligible models using config + observed health data
- attempt models in order until success or terminal failure
- return structured routing metadata with the chosen model and fallback history

### 5.4 Fallback handling

The system must:

- distinguish retryable vs non-retryable failures
- support fallback to the next model in stack for retryable failures
- apply capped per-request attempts and capped total stack attempts
- avoid retrying the same model in a tight loop for the same request
- log every attempt and final outcome

### 5.5 Health tracking

The system must:

- track per-model success rate, error rate, timeout rate, p95 latency, recent availability, and observed cost behavior
- track these over multiple time windows, e.g. 1 day, 7 day, 30 day
- maintain a health score and routing status such as:
  - `active`
  - `degraded`
  - `cooldown`
  - `disabled`
  - `retired`
- lower routing priority automatically when health degrades

### 5.6 Pricing and policy awareness

The system must:

- store current pricing classification for each model
- detect when a previously free/cheap model becomes premium or unknown
- enforce route-level cost ceilings
- require explicit permission before using premium models except in whitelisted stacks/profiles

### 5.7 Maintenance and discovery

The system must:

- run a weekly maintenance job
- review model stats and propose actions
- detect weak stacks below healthy-pool minimum
- find new candidate free/cheap models, especially from OpenRouter catalog data
- stage candidates as `candidate` before enabling them broadly

### 5.8 Overrides

The system must support overrides at:

- global policy level
- project level
- workflow level
- agent level
- per-request level

Override examples:

- force one stack
- force one model
- ban premium
- allow premium for this task only
- deny a provider
- raise reliability requirement

### 5.9 Telemetry and reporting

The system must:

- log request-level routing decisions
- expose aggregate stats by model, stack, project, workflow, provider, and modality
- produce weekly reports and machine-readable summaries
- support auditability: why was this model chosen, and why was another skipped?

---

## 6) Non-functional requirements

### Reliability

- Routing layer should degrade gracefully when a provider is unstable.
- One provider outage should not break the whole system if alternatives exist.
- The router should be safe to run in unattended automation.

### Performance

- Route selection should be fast enough to not dominate request latency.
- Target router overhead: ideally under 50 ms for config + ranking decisions in typical cases.

### Maintainability

- Configuration should be human-readable and versionable.
- Core ranking logic should be testable without live providers.
- Provider integrations should be pluggable.

### Explainability

- Each routing decision should include machine-readable reasons.
- Health and retirement actions should be explainable from data.

### Extensibility

- Design should support additional modalities and providers later.
- Discovery/maintenance workflows should be replaceable without changing the routing API.

### Safety

- Hard caps must exist to prevent runaway retries and surprise premium spend.
- Premium escalation must be explicit, not accidental.

---

## 7) Architecture proposal

## High-level components

1. **Model Registry**
   - source of truth for model metadata, policy status, and configured stack membership

2. **Routing Policy Engine**
   - resolves a request into a stack/profile
   - applies overrides, cost rules, and eligibility filters

3. **Ranker / Scorer**
   - scores eligible models using static config + dynamic health data

4. **Provider Adapters**
   - standardized interface for OpenRouter first, then direct providers later

5. **Execution Orchestrator**
   - executes attempts, handles fallback, enforces retry limits, collects outcomes

6. **Telemetry Pipeline**
   - writes request/attempt logs and rollups

7. **Health Evaluator**
   - periodically recomputes health scores and route status per model

8. **Maintenance Worker**
   - weekly review, retirement recommendations, candidate discovery, replacement suggestions

9. **Admin/Inspection Layer**
   - read-only reports, route-debug output, maybe later a lightweight UI or CLI

## Reference flow

1. Caller submits normalized route request.
2. Policy engine maps request to a stack/profile.
3. Eligibility filter removes disallowed or unsuitable models.
4. Ranker sorts remaining models.
5. Orchestrator attempts the top model.
6. On failure, orchestrator decides whether to fallback.
7. Telemetry is written for each attempt and final result.
8. Health evaluator updates rolling scores asynchronously.
9. Weekly maintenance reviews trends and proposes changes.

---

## 8) Data model / config schema proposal

Use versioned JSON or YAML config plus a small SQLite/Postgres backing store for telemetry. For MVP, JSON/YAML + SQLite is enough.

### 8.1 Registry config example

```yaml
version: 1
providers:
  openrouter:
    type: openrouter
    enabled: true
    baseUrl: https://openrouter.ai/api/v1

models:
  - id: openrouter:meta-llama/llama-3.3-70b-instruct
    provider: openrouter
    remoteModelId: meta-llama/llama-3.3-70b-instruct
    modality: text
    pricing:
      class: cheap
      inputPer1M: 0.12
      outputPer1M: 0.30
      lastVerifiedAt: 2026-04-11T00:00:00Z
    capabilities:
      shortReply: true
      longWriting: true
      coding: medium
      reasoning: medium
    constraints:
      maxContext: 131072
      maxOutputTokens: 8192
    policy:
      enabled: true
      premiumAllowedOnlyWhenExplicit: false
    lifecycle:
      state: active
      source: curated
```

### 8.2 Stack config example

```yaml
stacks:
  short-reply:
    modality: text
    minHealthyModels: 3
    premiumPolicy: never
    selectionDefaults:
      reasoningDepth: low
      outputLength: short
      speedSensitivity: high
    models:
      - openrouter:mistralai/mistral-small
      - openrouter:meta-llama/llama-3.3-70b-instruct
      - openrouter:qwen/qwen-2.5-72b-instruct

  coding-hard:
    modality: text
    minHealthyModels: 3
    premiumPolicy: explicit-or-escalated
    selectionDefaults:
      reasoningDepth: high
      outputLength: medium
      reliabilityRequirement: high
    models:
      - openrouter:deepseek/deepseek-chat
      - openrouter:qwen/qwen-2.5-coder-32b-instruct
      - openrouter:anthropic/claude-3.7-sonnet
```

### 8.3 Route profile example

```yaml
profiles:
  default-agent-reply:
    stack: short-reply
    maxAttempts: 3
    maxCostUsd: 0.01
    premiumPolicy: never

  important-debug-task:
    stack: coding-hard
    maxAttempts: 4
    maxCostUsd: 0.50
    premiumPolicy: explicit-or-escalated
```

### 8.4 Runtime telemetry tables

Suggested MVP tables:

- `route_requests`
- `route_attempts`
- `model_health_daily`
- `model_status_events`
- `maintenance_runs`
- `candidate_models`

Key fields:

#### `route_requests`
- request_id
- timestamp
- project_id
- workflow_id
- agent_id
- modality
- task_type
- reasoning_depth
- output_length
- speed_sensitivity
- reliability_requirement
- cost_ceiling_usd
- premium_policy
- chosen_stack
- final_model_id
- final_status
- attempts_count
- estimated_cost_usd
- actual_cost_usd

#### `route_attempts`
- request_id
- attempt_number
- model_id
- provider
- rank_score
- start_time
- end_time
- duration_ms
- outcome (`success`, `timeout`, `provider_error`, `rate_limited`, `policy_blocked`, etc.)
- retryable boolean
- tokens_in
- tokens_out
- cost_usd
- failure_reason

#### `model_health_daily`
- model_id
- date
- requests
- successes
- failures
- timeouts
- rate_limits
- p50_latency_ms
- p95_latency_ms
- avg_cost_usd
- health_score
- routing_status

---

## 9) Routing strategy

Be opinionated: routing should be stack-first, policy-constrained, evidence-adjusted.

### 9.1 Step 1: map request to stack/profile

Inputs:

- modality
- task type
- reasoning depth
- output length
- speed sensitivity
- reliability requirement
- cost ceiling
- project/workflow/agent defaults

Rules:

- Prefer explicit profile if caller supplies one.
- Else map by task type.
- Else use modality default.

Example mapping:

- `short_reply` -> `short-reply`
- `general_writing_long` -> `writing-long`
- `coding_debug` with `reasoning=high` -> `coding-hard`
- `image_generate` -> `image-gen`

### 9.2 Step 2: filter for eligibility

Exclude models that are:

- disabled or retired
- below required capability threshold
- above request cost ceiling
- premium when premium is not allowed
- in cooldown for current failure mode
- missing required modality or token limits
- explicitly denied by override

### 9.3 Step 3: score and rank

Suggested score formula for MVP:

```text
route_score =
  priority_weight
  + capability_fit
  + health_weight
  + cost_efficiency_weight
  + latency_weight
  + reliability_weight
  - premium_penalty
  - recent_failure_penalty
```

Practical ranking bias:

- default bias toward cheaper healthy models
- strong penalty for recent failures/timeouts
- strong penalty for premium models when a cheaper healthy model meets constraints
- boost models that have proven good in the same stack/task category

### 9.4 Step 4: escalate only when justified

Escalation from free/cheap to premium should happen only if:

- no free/cheap models remain eligible, or
- cheap models fail on this request and premium is allowed, or
- stack/profile explicitly marks the task as premium-eligible for quality/reliability reasons

### 9.5 Routing output

The router should return:

```json
{
  "requestId": "...",
  "selectedStack": "coding-hard",
  "chosenModel": "openrouter:qwen/qwen-2.5-coder-32b-instruct",
  "attemptedModels": ["..."],
  "premiumEscalated": false,
  "decisionReasons": [
    "matched_stack:coding-hard",
    "excluded:premium_policy_block",
    "preferred:lower_cost_healthy_model"
  ]
}
```

---

## 10) Fallback strategy

Fallback should be deterministic, capped, and safe.

### Retry classes

#### Retry same model once at most

Only for clearly transient cases such as:

- connection reset
- 5xx provider errors
- short-lived rate-limit with retry-after <= configured threshold

#### Fallback to next model

For:

- timeout
- repeated 5xx
- provider unavailable
- model overloaded
- response malformed
- policy change detected mid-run

#### Do not retry / do not fallback automatically

For:

- invalid prompt/request payload
- auth failure due to misconfiguration
- explicit policy block
- cost ceiling exceeded before first attempt

### Hard limits

- max 1 retry on same model for transient errors
- max N unique model attempts per request, default 3 for standard tasks, 4 for high-value tasks
- no model may be attempted twice after fallback to a different model
- total request wall-clock timeout should be capped

### Cooldown behavior

If a model fails multiple times recently:

- place it in temporary cooldown for routing
- keep it out of candidate list for a short window
- reintroduce only after cooldown or maintenance review

---

## 11) Health scoring / retirement rules

Health should be based on rolling evidence, not vibes.

### 11.1 Health score inputs

Suggested inputs:

- success rate
- timeout rate
- provider error rate
- rate-limit frequency
- p95 latency
- observed cost consistency
- freshness of last successful response
- stack-specific performance signal
- manual operator adjustments

### 11.2 Example health score

```text
health_score = 100
  - failure_penalty
  - timeout_penalty
  - latency_penalty
  - rate_limit_penalty
  - cost_anomaly_penalty
  - stale_success_penalty
  + operator_bonus_or_penalty
```

### 11.3 Routing states

- `active`: freely routable
- `degraded`: still routable but lower rank
- `cooldown`: temporarily skipped unless forced
- `disabled`: excluded from routing until reviewed
- `retired`: removed from normal routing, kept only for historical reference
- `candidate`: not part of standard routing yet

### 11.4 Suggested thresholds

These should be configurable, but a solid starting point:

- degrade if 7-day success rate < 92%
- cooldown if last 20 attempts contain >= 5 retryable failures
- disable if model is unavailable/paid-policy-incompatible for 7 consecutive days
- retire if:
  - explicitly deprecated by provider, or
  - disabled for 30+ days with no recovery case, or
  - consistently worse than alternatives with enough sample size

### 11.5 Paid-status retirement rules

If a model changes class from `free` to `premium`:

- immediately remove it from free-only stacks
- mark affected stacks for replacement review
- keep it only in premium-eligible stacks if still strategically useful

---

## 12) Weekly cron / maintenance workflow

Run once weekly, ideally off-peak.

### Inputs

- last 7-day and 30-day route stats
- current stack configuration
- current provider/model catalog snapshots
- candidate model list

### Workflow

1. Refresh provider catalogs and pricing snapshots.
2. Recompute health summaries per model.
3. Flag models with:
   - repeated failures
   - worsening latency
   - changed pricing class
   - deprecation or removal
4. Review each stack:
   - count healthy models
   - detect gaps below `minHealthyModels`
   - detect premium leakage in low-cost stacks
5. Generate recommendations:
   - deprioritize model
   - disable model
   - retire model
   - promote candidate
   - search for replacement
6. Write maintenance report.
7. Optionally create a proposed config patch for review.

### Outputs

- machine-readable JSON report
- human-readable Markdown summary
- optional patch file with recommended config changes

### Guardrail

Weekly maintenance should not auto-promote risky replacements into production without either:

- passing canary thresholds, or
- explicit config allowing auto-promotion

---

## 13) Candidate model discovery workflow

This is important because OpenRouter changes constantly.

### Discovery triggers

- weekly scheduled scan
- stack healthy count below threshold
- multiple recent retirements in one category
- manual operator request

### Candidate sources

- OpenRouter model catalog / metadata
- curated allowlists from config
- later: direct-provider catalogs

### Candidate filters

Look for models that match:

- modality
- price class preference (`free` first, then `cheap`)
- required capabilities for stack
- context/output minimums
- provider availability signals

### Candidate lifecycle

1. discovered
2. normalized into registry as `candidate`
3. dry-run ranked against target stacks
4. optional canary usage at low traffic share or maintenance test prompts
5. promote to active stack position if results are acceptable

### Practical policy

Do not throw unknown models straight into the top of production stacks.

Suggested onboarding path:

- add to bottom of stack or candidate-only pool
- run maintenance probes / canary prompts
- promote if stable over enough attempts

---

## 14) Telemetry and logs needed

### Per request

- request metadata
- selected stack/profile
- filtered-out models and reasons
- ranked candidate list
- final chosen model
- whether premium escalation happened
- final result and latency
- token/cost usage if available

### Per attempt

- model/provider
- attempt order
- start/end timestamps
- raw failure class
- retryability decision
- tokens/cost
- response metadata

### Aggregate metrics

- success rate by model, stack, provider, task type
- premium usage rate by project/workflow
- fallback frequency
- average attempts per request
- p50/p95 latency
- estimated and actual spend
- unhealthy-stack alerts

### Recommended logs/artifacts

- structured JSONL event logs for easy append
- SQLite rollups for MVP querying
- weekly Markdown summaries for human review

---

## 15) Safety / guardrails

### Cost guardrails

- never use premium when `premiumPolicy=never`
- require explicit opt-in or escalation rule for premium
- enforce per-request and optional per-project cost ceilings
- log any premium escalation as a policy event

### Retry guardrails

- hard cap total attempts
- hard cap same-model retries
- no unbounded backoff loops
- abort on non-retryable request errors immediately

### Quality / routing guardrails

- do not route image tasks to text-only stacks
- do not route long-output tasks to models with inadequate output limits
- do not use stale/retired models except via explicit override

### Operational guardrails

- config changes should be versioned
- automatic retirement/promotion should be conservative
- manual overrides should always win, but be logged

---

## 16) MVP vs later phases

## MVP

Ship this first:

- OpenRouter provider adapter
- static registry + stack config
- route request normalization
- eligibility filtering
- priority + health-aware ranking
- fallback orchestration
- request/attempt telemetry
- basic health scoring
- weekly maintenance report
- candidate discovery from OpenRouter catalog metadata
- manual overrides at project/workflow/request level
- text + image generation support

## Phase 2

- direct provider adapters beyond OpenRouter
- better quality scoring by task category
- canary traffic allocation for candidates
- automatic config patch generation
- small CLI / dashboard for route inspection
- project-specific learned preferences

## Phase 3

- video generation routing
- adaptive traffic splitting
- benchmark prompt suites per stack
- smarter replacement recommendation engine
- budget-aware monthly planning and anomaly alerts

---

## 17) Open questions / risks

### Open questions

- What exact cost thresholds define `cheap` vs `premium` for Roshan’s use cases?
- Which premium models are allowed as final backstops for coding/reasoning?
- Should maintenance auto-disable on thresholds alone, or only propose changes?
- How much canary traffic is acceptable for candidate testing?
- Should there be separate stacks per provider region/performance profile?

### Risks

- OpenRouter catalog/pricing metadata may be incomplete or change quickly.
- Some “free” models may be technically available but practically unreliable.
- Comparing quality across providers is messy without task-specific evaluation.
- Overreacting to small sample sizes can churn stacks too aggressively.
- Too many override layers can make routing hard to reason about unless debug output is clean.

---

## 18) Suggested API surface for internal use

Opinion: keep the public API small and boring.

### Core APIs

```ts
interface RouteRequest {
  modality: 'text' | 'image' | 'video';
  taskType: string;
  reasoningDepth?: 'low' | 'medium' | 'high';
  outputLength?: 'short' | 'medium' | 'long';
  speedSensitivity?: 'low' | 'medium' | 'high';
  reliabilityRequirement?: 'low' | 'medium' | 'high';
  costCeilingUsd?: number;
  premiumPolicy?: 'never' | 'explicit-only' | 'explicit-or-escalated';
  profileId?: string;
  projectId?: string;
  workflowId?: string;
  agentId?: string;
  overrides?: RouteOverrides;
  payload: unknown;
}

interface RouteOverrides {
  forceStackId?: string;
  forceModelId?: string;
  denyProviders?: string[];
  denyModels?: string[];
  allowPremium?: boolean;
  maxAttempts?: number;
}

interface RouteResult {
  requestId: string;
  selectedStack: string;
  finalModelId?: string;
  finalStatus: 'success' | 'failed' | 'blocked';
  attempts: RouteAttemptResult[];
  premiumEscalated: boolean;
  decisionReasons: string[];
  output?: unknown;
}
```

### Service methods

```ts
route(request: RouteRequest): Promise<RouteResult>
rankCandidates(request: RouteRequest): Promise<RankedCandidate[]>
getModelHealth(modelId: string): Promise<ModelHealth>
runWeeklyMaintenance(): Promise<MaintenanceReport>
discoverCandidates(input?: DiscoveryOptions): Promise<CandidateModel[]>
explainRoute(request: RouteRequest): Promise<RouteExplanation>
```

### Nice-to-have utilities

```ts
validateConfig()
estimateCost(request, modelId)
getStackStatus(stackId)
applyManualOverride(scope, override)
```

---

## 19) Suggested file/module structure for a Node/OpenClaw-style repo

```text
src/
  routing/
    route-service.ts
    request-normalizer.ts
    stack-resolver.ts
    eligibility.ts
    ranker.ts
    fallback-orchestrator.ts
    explain.ts

  providers/
    base-provider.ts
    openrouter/
      openrouter-provider.ts
      openrouter-catalog.ts
      openrouter-pricing.ts

  registry/
    model-registry.ts
    stack-registry.ts
    config-loader.ts
    config-schema.ts

  health/
    health-scorer.ts
    status-evaluator.ts
    cooldown-manager.ts

  telemetry/
    event-logger.ts
    sqlite-store.ts
    rollups.ts
    reports.ts

  maintenance/
    weekly-maintenance.ts
    candidate-discovery.ts
    candidate-evaluator.ts
    replacement-suggester.ts

  policy/
    premium-policy.ts
    override-resolver.ts
    cost-policy.ts

  api/
    route-types.ts
    route-api.ts

  cli/
    route-debug.ts
    maintenance-run.ts
    stack-status.ts

config/
  providers.yaml
  models.yaml
  stacks.yaml
  profiles.yaml
  policy.yaml

data/
  routing.sqlite
  reports/
  snapshots/

docs/
  model-routing-spec.md
  routing-config-examples.md

tests/
  routing/
  providers/
  maintenance/
```

---

## 20) Recommended implementation decisions

These are the opinionated calls I’d make for the first build:

- **Use OpenRouter first**, but keep provider interface narrow and swappable.
- **Use SQLite for MVP telemetry** because it is dead simple and plenty good enough early on.
- **Prefer static curated stacks plus dynamic health adjustment**, not fully dynamic auto-routing from scratch.
- **Require at least 3 models per stack where feasible**, but allow temporary degraded operation if only 2 healthy models remain.
- **Keep premium models out of default low-value stacks entirely.**
- **Make weekly maintenance recommend changes first**, with optional auto-apply later once trust is earned.
- **Log every routing decision structurally** so the system can be tuned from real evidence.
- **Treat model discovery as candidate generation, not immediate production routing.**

---

## 21) Definition of done for MVP

The MVP is done when:

- a workflow can call one routing API instead of hardcoding a model
- the router selects from named stacks
- failed primary models fall back automatically to backups
- premium usage is policy-gated
- telemetry shows which models worked, failed, and cost money
- weekly maintenance identifies weak or paid models and proposes replacements
- adding a new project mostly means choosing a profile/stack, not redesigning routing

That gets Roshan a practical routing substrate he can reuse across projects without bleeding tokens or babysitting model churn.