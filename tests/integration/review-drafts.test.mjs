import test from 'node:test';
import assert from 'node:assert/strict';
import { listReviewDrafts } from '../../src/lib/review-drafts.mjs';

const files = [{ path: 'src/PaymentService.ts' }, { path: 'src/shared:policy.ts' }];
const refs = JSON.stringify(['base', 'start', 'head']);
test('Draft navigation includes file and line notes without confusing AI assessments with comments', () => {
  const drafts = {
    'src/PaymentService.ts:new:21': '  Verify retry re-entry.  ',
    'src/PaymentService.ts:new:file': 'Add one integration scenario.',
    'src/shared:policy.ts:new:3': 'Review shared limit.',
    'checkpoint:source:high': 'checked',
    'src/PaymentService.ts:new:11': ' ',
    'src/Unknown.ts:new:4': 'Unknown file',
    'src/PaymentService.ts:old:0': 'Invalid line',
    'src/PaymentService.ts:new:-1': 'Invalid line',
    'src/PaymentService.ts:new:9007199254740992': 'Unsafe line',
    'src/PaymentService.ts:new:7:refs:invalid': 'Malformed key',
    'src/PaymentService.ts:old:7:refs:invalid': 'Malformed refs',
    'src/PaymentService.ts:new:8': false,
  };
  assert.deepEqual(listReviewDrafts(drafts, files, refs), [
    { key: 'src/PaymentService.ts:new:21', path: files[0].path, line: 21, side: 'new', text: '  Verify retry re-entry.  ', current: true },
    { key: 'src/PaymentService.ts:new:file', path: files[0].path, line: null, side: 'new', text: 'Add one integration scenario.', current: true },
    { key: 'src/shared:policy.ts:new:3', path: files[1].path, line: 3, side: 'new', text: 'Review shared limit.', current: true },
  ]);
});

test('Only the exact diff base can resume an old-side draft; earlier and unverified text remains separate', () => {
  const previous = JSON.stringify(['earlier-base', 'start', 'head']);
  const drafts = {
    [`src/PaymentService.ts:old:21:refs:${refs}`]: 'Current old-side observation.',
    [`src/PaymentService.ts:old:21:refs:${previous}`]: 'Earlier base observation.',
    'src/PaymentService.ts:old:21': 'Legacy unverified observation.',
  };
  const result = listReviewDrafts(drafts, files, refs);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(item => item.current), [true, false, false]);
  assert.deepEqual(listReviewDrafts(null, files, refs), []);
  assert.deepEqual(listReviewDrafts([], files, refs), []);
});
