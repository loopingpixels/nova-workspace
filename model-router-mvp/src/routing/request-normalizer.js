export function normalizeRequest(body = {}) {
  return {
    modality: body.modality || 'text',
    taskType: body.taskType || 'short_reply',
    reasoningDepth: body.reasoningDepth || 'low',
    outputLength: body.outputLength || 'short',
    speedSensitivity: body.speedSensitivity || 'medium',
    reliabilityRequirement: body.reliabilityRequirement || 'medium',
    costCeilingUsd: body.costCeilingUsd ?? null,
    premiumPolicy: body.premiumPolicy || 'never',
    profileId: body.profileId,
    projectId: body.projectId || 'local-demo',
    workflowId: body.workflowId || 'manual-test',
    agentId: body.agentId || 'nova',
    overrides: body.overrides || {},
    payload: body.payload || {},
    simulate: body.simulate || {},
    mockMode: body.mockMode,
    dryRun: Boolean(body.dryRun),
  };
}
