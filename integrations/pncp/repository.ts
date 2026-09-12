import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildProcurementChangeEvent,
  type ProcurementSnapshot,
} from '../../domain/ingestion.ts';
import type { NormalizedProcurement } from './client.ts';
import { nextSourceHealth } from '../sources/health.ts';

type StoredProcurement = {
  id: string;
  external_id: string;
  agency: string;
  municipality: string | null;
  state: string | null;
  modality: string | null;
  status: string;
  source_url: string;
  object: string;
  published_at: string | null;
  session_at: string | null;
  deadline_at: string | null;
  total_value: number | null;
};

export type PersistenceSummary = {
  inserted: number;
  updated: number;
  unchanged: number;
  changeEvents: number;
};

function snapshot(
  record: StoredProcurement,
  sourceKey: string,
): ProcurementSnapshot {
  return {
    sourceId: sourceKey,
    externalId: record.external_id,
    agency: record.agency,
    municipality: record.municipality,
    state: record.state,
    modality: record.modality,
    status: record.status,
    sourceUrl: record.source_url,
    object: record.object,
    publishedAt: record.published_at,
    sessionAt: record.session_at,
    deadlineAt: record.deadline_at,
    totalValue: record.total_value,
  };
}

function incomingSnapshot(
  record: NormalizedProcurement,
  sourceKey: string,
): ProcurementSnapshot {
  return {
    sourceId: sourceKey,
    externalId: record.externalId,
    agency: record.agency,
    municipality: record.municipality,
    state: record.state,
    modality: record.modality,
    status: record.status,
    sourceUrl: record.sourceUrl,
    object: record.object,
    publishedAt: record.publishedAt,
    sessionAt: record.sessionAt,
    deadlineAt: record.deadlineAt,
    totalValue: record.totalValue,
  };
}

export function toProcurementRow(
  record: NormalizedProcurement,
  sourceKey = 'pncp',
) {
  return {
    source_id: sourceKey,
    external_id: record.externalId,
    agency: record.agency,
    municipality: record.municipality,
    state: record.state,
    modality: record.modality,
    status: record.status,
    object: record.object,
    published_at: record.publishedAt,
    session_at: record.sessionAt,
    deadline_at: record.deadlineAt,
    total_value: record.totalValue,
    source_url: record.sourceUrl,
    updated_at: new Date().toISOString(),
  };
}

export function createProcurementRepository(
  supabase: SupabaseClient,
  options: {
    sourceKey: string;
    recordSourceKey?: string;
    insertOnly?: boolean;
  },
) {
  const { sourceKey } = options;
  const recordSourceKey = options.recordSourceKey ?? sourceKey;
  return {
    async claim() {
      const { data, error } = await supabase.rpc('claim_source_collection', {
        target_source_key: sourceKey,
        lease_minutes: 10,
      });
      if (error)
        throw new Error(`${sourceKey}_claim_failed:${error.code ?? 'unknown'}`);
      return data === true;
    },

    async persist(
      records: NormalizedProcurement[],
    ): Promise<PersistenceSummary> {
      if (!records.length)
        return { inserted: 0, updated: 0, unchanged: 0, changeEvents: 0 };
      const ids = records.map((record) => record.externalId);
      const existing: StoredProcurement[] = [];
      for (let index = 0; index < ids.length; index += 100) {
        const { data, error } = await supabase
          .from('procurements')
          .select(
            'id,external_id,agency,municipality,state,modality,status,source_url,object,published_at,session_at,deadline_at,total_value',
          )
          .eq('source_id', recordSourceKey)
          .in('external_id', ids.slice(index, index + 100));
        if (error)
          throw new Error(`${sourceKey}_existing_failed:${error.code}`);
        existing.push(...((data ?? []) as StoredProcurement[]));
      }
      const byExternalId = new Map(
        existing.map((record) => [record.external_id, record]),
      );
      const changed: NormalizedProcurement[] = [];
      const events = [];
      for (const record of records) {
        const previous = byExternalId.get(record.externalId);
        if (!previous) {
          changed.push(record);
          continue;
        }
        if (options.insertOnly) continue;
        const event = await buildProcurementChangeEvent(
          previous.id,
          snapshot(previous, recordSourceKey),
          incomingSnapshot(record, recordSourceKey),
        );
        if (event) {
          changed.push(record);
          events.push({ procurementId: previous.id, event });
        }
      }
      for (let index = 0; index < changed.length; index += 200) {
        const { error } = await supabase.from('procurements').upsert(
          changed
            .slice(index, index + 200)
            .map((record) => toProcurementRow(record, recordSourceKey)),
          {
            onConflict: 'source_id,external_id',
            ignoreDuplicates: options.insertOnly === true,
          },
        );
        if (error) throw new Error(`${sourceKey}_upsert_failed:${error.code}`);
      }
      for (let index = 0; index < events.length; index += 200) {
        const { error } = await supabase.from('source_events').upsert(
          events.slice(index, index + 200).map(({ procurementId, event }) => ({
            procurement_id: procurementId,
            event_type: event.type,
            previous_hash: event.previousHash,
            current_hash: event.currentHash,
            changed_fields: event.changedFields,
            dedupe_key: event.dedupeKey,
          })),
          { onConflict: 'dedupe_key', ignoreDuplicates: true },
        );
        if (error) throw new Error(`${sourceKey}_events_failed:${error.code}`);
      }
      const inserted = records.filter(
        (record) => !byExternalId.has(record.externalId),
      ).length;
      const updated = events.length;
      return {
        inserted,
        updated,
        unchanged: records.length - inserted - updated,
        changeEvents: events.length,
      };
    },

    async succeed() {
      const { error } = await supabase
        .from('sources')
        .update({
          health_status: 'healthy',
          consecutive_failures: 0,
          retry_after: null,
          lease_until: null,
          last_error_code: null,
          last_success_at: new Date().toISOString(),
        })
        .eq('source_key', sourceKey);
      if (error) throw new Error(`${sourceKey}_success_failed:${error.code}`);
    },

    async fail(errorCode: string) {
      const { data, error } = await supabase
        .from('sources')
        .select('consecutive_failures')
        .eq('source_key', sourceKey)
        .single();
      if (error)
        throw new Error(`${sourceKey}_failure_read_failed:${error.code}`);
      const failures = Number(data.consecutive_failures ?? 0) + 1;
      const health = nextSourceHealth(failures);
      const retryAfter = new Date(
        Date.now() + health.retryAfterMinutes * 60_000,
      ).toISOString();
      const { error: updateError } = await supabase
        .from('sources')
        .update({
          health_status: health.status,
          consecutive_failures: failures,
          retry_after: retryAfter,
          lease_until: null,
          last_error_code: errorCode.slice(0, 120),
        })
        .eq('source_key', sourceKey);
      if (updateError)
        throw new Error(
          `${sourceKey}_failure_write_failed:${updateError.code}`,
        );
    },
  };
}

export function createPncpRepository(supabase: SupabaseClient) {
  return createProcurementRepository(supabase, { sourceKey: 'pncp' });
}

export type PncpRepository = ReturnType<typeof createPncpRepository>;
