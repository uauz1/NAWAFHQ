import test from 'node:test';import assert from 'node:assert/strict';import {parsePaperOrder} from '../core/paper-broker.mjs';
test('parses Arabic paper buy',()=>assert.deepEqual(parsePaperOrder('راكان اشترِ AAPL بـ 250 دولار في المحفظة التجريبية'),{symbol:'AAPL',notional:250,side:'BUY'}));
test('rejects incomplete order',()=>assert.throws(()=>parsePaperOrder('اشتر سهم تجريبي'),/SYMBOL_AND_NOTIONAL/));

