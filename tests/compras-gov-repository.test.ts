import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createComprasGovRepository } from '../integrations/compras-gov/repository.ts';
import type { NormalizedProcurement } from '../integrations/pncp/client.ts';

const opportunity: NormalizedProcurement = {
  externalId: '08993917000146-1-000214/2026',
  agency: 'Órgão público',
  municipality: 'Campina Grande',
  state: 'PB',
  modality: 'Dispensa',
  status: 'Divulgada no PNCP',
  object: 'Aquisição de peças automotivas',
  publishedAt: null,
  sessionAt: null,
  deadlineAt: null,
  totalValue: 12000,
  sourceUrl: 'https://pncp.gov.br/app/editais/08993917000146/2026/214',
};

function repositoryFixture(existing: boolean) {
  const writes: Array<{
    rows: Array<Record<string, unknown>>;
    options: Record<string, unknown>;
  }> = [];
  const selected = existing
    ? [
        {
          id: 'existing-id',
          external_id: opportunity.externalId,
          agency: opportunity.agency,
          municipality: opportunity.municipality,
          state: opportunity.state,
          modality: opportunity.modality,
          status: opportunity.status,
          object: opportunity.object,
          published_at: null,
          session_at: null,
          deadline_at: null,
          total_value: opportunity.totalValue,
          source_url: opportunity.sourceUrl,
        },
      ]
    : [];
  const client = {
    from(table: string) {
      assert.equal(table, 'procurements');
      return {
        select() {
          return {
            eq(column: string, value: string) {
              assert.equal(column, 'source_id');
              assert.equal(value, 'pncp');
              return {
                async in() {
                  return { data: selected, error: null };
                },
              };
            },
          };
        },
        async upsert(
          rows: Array<Record<string, unknown>>,
          options: Record<string, unknown>,
        ) {
          writes.push({ rows, options });
          return { error: null };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { repository: createComprasGovRepository(client), writes };
}

void test('complementary discovery inserts a canonical PNCP record', async () => {
  const fixture = repositoryFixture(false);
  const result = await fixture.repository.persist([opportunity]);
  assert.equal(result.inserted, 1);
  assert.equal(fixture.writes[0]?.rows[0]?.source_id, 'pncp');
  assert.equal(fixture.writes[0]?.options.ignoreDuplicates, true);
});

void test('complementary discovery never overwrites a canonical PNCP record', async () => {
  const fixture = repositoryFixture(true);
  const result = await fixture.repository.persist([opportunity]);
  assert.deepEqual(result, {
    inserted: 0,
    updated: 0,
    unchanged: 1,
    changeEvents: 0,
  });
  assert.equal(fixture.writes.length, 0);
});
