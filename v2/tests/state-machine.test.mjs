import test from 'node:test';import assert from 'node:assert/strict';import {assertTransition} from '../core/state-machine.mjs';
test('valid execution path',()=>{for(const [a,b] of [['QUEUED','ROUTING'],['ROUTING','PLANNING'],['PLANNING','WORKING'],['WORKING','REVIEWING'],['REVIEWING','COMPLETED']])assert.equal(assertTransition(a,b),true);});
test('completed task cannot restart silently',()=>assert.throws(()=>assertTransition('COMPLETED','WORKING'),/INVALID_TASK_TRANSITION/));
test('temporary failure can pause and resume',()=>{assert.equal(assertTransition('WORKING','PAUSED_EXTERNAL'),true);assert.equal(assertTransition('PAUSED_EXTERNAL','QUEUED'),true);});

