const ROLES = new Set(['ENGINEER', 'QA']);

export function normalizeAgentResult(input = {}) {
  const status = ['RUNNING','PASSED','FAILED','WAITING_FOR_APPROVAL'].includes(input.status)
    ? input.status : 'FAILED';
  return {
    jobId: String(input.jobId || ''),
    status,
    summary: String(input.summary || ''),
    changedFiles: Array.isArray(input.changedFiles) ? input.changedFiles : [],
    commands: Array.isArray(input.commands) ? input.commands : [],
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
    artifacts: Array.isArray(input.artifacts) ? input.artifacts : [],
    nextActions: Array.isArray(input.nextActions) ? input.nextActions : []
  };
}

export function validateAgentRequest(input = {}) {
  if (!input.taskId) throw new Error('AGENT_TASK_ID_REQUIRED');
  if (!ROLES.has(input.role)) throw new Error('AGENT_ROLE_INVALID');
  if (!input.repository) throw new Error('AGENT_REPOSITORY_REQUIRED');
  if (!input.instruction) throw new Error('AGENT_INSTRUCTION_REQUIRED');
  return {
    taskId: String(input.taskId),
    role: input.role,
    projectId: String(input.projectId || ''),
    repository: String(input.repository),
    instruction: String(input.instruction),
    context: input.context && typeof input.context === 'object' ? input.context : {},
    approval: {
      codeWrite: Boolean(input.approval?.codeWrite),
      deploy: Boolean(input.approval?.deploy),
      destructive: Boolean(input.approval?.destructive),
      cost: Boolean(input.approval?.cost)
    }
  };
}

export async function runAgent(input, provider) {
  const request = validateAgentRequest(input);
  if (!provider || typeof provider.run !== 'function') {
    return normalizeAgentResult({
      status: 'WAITING_FOR_APPROVAL',
      summary: 'No execution provider is connected yet.',
      nextActions: ['Connect an execution provider to the NAWAF HQ agent adapter.']
    });
  }
  return normalizeAgentResult(await provider.run(request));
}
