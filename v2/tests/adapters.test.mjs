import test from 'node:test';import assert from 'node:assert/strict';import {AdapterRegistry,classifyError} from '../core/adapters.mjs';
test('registry resolves only connected capability',()=>{const r=new AdapterRegistry();r.register({id:'x',provider:'x',capabilities:['a'],execute(){},health(){return 'HEALTHY'},connectionState(){return 'CONNECTED'}});assert.equal(r.resolve('a').id,'x');assert.equal(r.resolve('b'),null);});
test('429 is temporary and retryable',()=>assert.deepEqual(classifyError(Object.assign(new Error('rate'),{status:429})).retryable,true));
test('permission failure is not retried',()=>assert.equal(classifyError(new Error('403 permission')).kind,'PERMISSION'));
test('missing private connection creates a connection requirement',()=>assert.equal(classifyError(new Error('MISSING_CONNECTION:GITHUB_PRIVATE_REPOSITORY')).kind,'CONNECTION_REQUIRED'));
