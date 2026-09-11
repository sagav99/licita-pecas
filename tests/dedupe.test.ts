import assert from 'node:assert/strict';
import test from 'node:test';
import {
  alertDedupeKey,
  documentDedupeKey,
  procurementDedupeKey,
} from '../domain/dedupe.ts';

void test('creates a stable key for the same procurement from a source', () => {
  assert.equal(
    procurementDedupeKey(' PNCP ', '123/2026'),
    'procurement:pncp:123_2026',
  );
});

void test('distinguishes document versions by content hash', () => {
  assert.notEqual(
    documentDedupeKey('pe-14/2026', 'abc123'),
    documentDedupeKey('pe-14/2026', 'def456'),
  );
});

void test('includes organization and event version in alert keys', () => {
  assert.equal(
    alertDedupeKey('org-1', 'pe-14/2026', 'changed', 'hash-2'),
    'alert:org-1:pe-14_2026:changed:hash-2',
  );
});
