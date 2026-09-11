import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAlertCandidates,
  defaultAlertTypes,
  planAlerts,
} from '../domain/alert-engine.ts';

const base = {
  organizationId: 'org-1',
  procurementId: 'proc-1',
  sourceUrl: 'https://pncp.gov.br/app/editais/exemplo',
  currentMatchStatus: 'compatível' as const,
};

void test('plans a new compatible opportunity with official source proof', () => {
  const alerts = planAlerts(
    base,
    { email: true, enabledTypes: defaultAlertTypes() },
    new Date('2026-09-11T10:00:00-03:00'),
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.type, 'new_match');
  assert.equal(alerts[0]?.sourceUrl, base.sourceUrl);
  assert.match(alerts[0]?.dedupeKey ?? '', /initial-compatible/);
});

void test('emits document change and deadline alerts with independent keys', () => {
  const alerts = planAlerts(
    {
      ...base,
      previousMatchStatus: 'compatível',
      documentChange: { kind: 'document_changed', currentHash: 'hash-v2' },
      deadlineAt: '2026-09-12T09:00:00-03:00',
      workflow: 'vai disputar',
    },
    { email: true, enabledTypes: defaultAlertTypes() },
    new Date('2026-09-11T10:00:00-03:00'),
  );
  assert.deepEqual(
    alerts.map((alert) => alert.type),
    ['procurement_changed', 'deadline_near'],
  );
  assert.equal(new Set(alerts.map((alert) => alert.dedupeKey)).size, 2);
});

void test('does not warn discarded opportunities about deadlines', () => {
  const alerts = buildAlertCandidates(
    {
      ...base,
      previousMatchStatus: 'compatível',
      deadlineAt: '2026-09-12T09:00:00-03:00',
      workflow: 'não atende',
    },
    new Date('2026-09-11T10:00:00-03:00'),
  );
  assert.equal(alerts.length, 0);
});

void test('respects disabled alert types before reaching delivery', () => {
  const alerts = planAlerts(
    {
      ...base,
      documentChange: { kind: 'document_changed', currentHash: 'v2' },
    },
    { email: true, enabledTypes: ['procurement_changed'] },
    new Date('2026-09-11T10:00:00-03:00'),
  );
  assert.deepEqual(
    alerts.map((alert) => alert.type),
    ['procurement_changed'],
  );
});
