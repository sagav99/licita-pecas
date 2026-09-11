import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProcurementChangeEvent,
  buildSourceEvent,
  changedProcurementFields,
  compareDocumentHash,
  procurementKey,
} from '../domain/ingestion.ts';

const snapshot = {
  sourceId: 'pncp',
  externalId: '123/2026',
  sourceUrl: 'https://pncp.gov.br/app/editais/123',
  object: 'Filtros automotivos',
  publishedAt: '2026-09-10T08:00:00-03:00',
  sessionAt: '2026-09-12T09:00:00-03:00',
  deadlineAt: null,
  totalValue: 84730,
};

void test('uses the same source/external identity for repeated ingestion', () => {
  assert.equal(procurementKey(snapshot), 'procurement:pncp:123_2026');
});

void test('does not emit an event for an identical document hash', () => {
  assert.equal(compareDocumentHash('abc', 'abc'), 'unchanged');
  assert.equal(buildSourceEvent('proc-1', 'abc', 'abc'), null);
});

void test('emits a version event when the official document changes', () => {
  assert.deepEqual(buildSourceEvent('proc-1', 'abc', 'def'), {
    type: 'document_changed',
    previousHash: 'abc',
    currentHash: 'def',
    dedupeKey: 'document:proc-1:def',
  });
});

void test('reports only fields that changed between procurement snapshots', () => {
  assert.deepEqual(
    changedProcurementFields(snapshot, {
      ...snapshot,
      deadlineAt: '2026-09-13T09:00:00-03:00',
    }),
    ['deadlineAt'],
  );
});

void test('creates a deterministic event for a changed procurement deadline', async () => {
  const event = await buildProcurementChangeEvent('proc-1', snapshot, {
    ...snapshot,
    deadlineAt: '2026-09-13T09:00:00-03:00',
  });
  assert.equal(event?.type, 'procurement_changed');
  assert.deepEqual(event?.changedFields, ['deadlineAt']);
  assert.match(
    event?.dedupeKey ?? '',
    /^procurement-change:proc-1:[a-f0-9]{64}$/,
  );
});
