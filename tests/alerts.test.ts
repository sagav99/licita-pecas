import assert from 'node:assert/strict';
import test from 'node:test';
import { decideAlert, isWithinDeadline } from '../domain/alerts.ts';

const candidate = {
  organizationId: 'org-1',
  procurementId: 'proc-1',
  type: 'procurement_changed' as const,
  version: 'hash-2',
};

void test('creates a deduplicable alert only when email and type are enabled', () => {
  assert.deepEqual(
    decideAlert(candidate, {
      email: true,
      enabledTypes: ['procurement_changed'],
    }),
    {
      send: true,
      reason: 'enabled',
      dedupeKey: 'alert:org-1:proc-1:procurement_changed:hash-2',
    },
  );
});

void test('honors organization opt-out before any delivery adapter runs', () => {
  assert.deepEqual(
    decideAlert(candidate, {
      email: false,
      enabledTypes: ['procurement_changed'],
    }),
    { send: false, reason: 'email_opted_out' },
  );
});

void test('detects an actionable deadline window without negative time', () => {
  const now = new Date('2026-09-10T10:00:00-03:00');
  assert.equal(
    isWithinDeadline(new Date('2026-09-12T09:00:00-03:00'), now),
    true,
  );
  assert.equal(
    isWithinDeadline(new Date('2026-09-10T09:00:00-03:00'), now),
    false,
  );
});
