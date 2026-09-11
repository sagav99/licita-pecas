import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryOpportunityRepository } from '../data/repository.ts';

void test('keeps saved opportunities isolated by organization', async () => {
  const repository = createMemoryOpportunityRepository();
  await repository.save({
    organizationId: 'org-a',
    procurementId: 'p-1',
    workflow: 'avaliando',
  });
  await repository.save({
    organizationId: 'org-b',
    procurementId: 'p-1',
    workflow: 'vai disputar',
  });
  assert.deepEqual(await repository.listSaved('org-a'), [
    { organizationId: 'org-a', procurementId: 'p-1', workflow: 'avaliando' },
  ]);
});

void test('updates workflow idempotently and removes only the tenant record', async () => {
  const repository = createMemoryOpportunityRepository();
  await repository.save({
    organizationId: 'org-a',
    procurementId: 'p-1',
    workflow: 'avaliando',
  });
  await repository.save({
    organizationId: 'org-a',
    procurementId: 'p-1',
    workflow: 'perdida',
  });
  await repository.remove('org-a', 'p-1');
  assert.deepEqual(await repository.listSaved('org-a'), []);
});
