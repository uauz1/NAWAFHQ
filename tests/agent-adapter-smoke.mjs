import assert from 'node:assert/strict';
import { runAgent, validateAgentRequest } from '../agent-adapter.mjs';

const req = validateAgentRequest({
  taskId: 'pilot-1',
  role: 'ENGINEER',
  repository: 'uauz1/NAWAFHQ',
  instruction: 'Inspect HQ health.',
  approval: {}
});
assert.equal(req.role, 'ENGINEER');
assert.equal(req.approval.deploy, false);

const waiting = await runAgent(req);
assert.equal(waiting.status, 'WAITING_FOR_APPROVAL');

const passed = await runAgent(req, {
  async run() {
    return {
      jobId: 'job-pilot-1',
      status: 'PASSED',
      summary: 'Pilot provider executed.',
      changedFiles: ['example.txt'],
      commands: ['test'],
      evidence: ['exit=0']
    };
  }
});
assert.equal(passed.status, 'PASSED');
assert.equal(passed.jobId, 'job-pilot-1');
assert.deepEqual(passed.changedFiles, ['example.txt']);
console.log('agent adapter smoke: ok');
