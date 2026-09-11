import type { SupabaseClient } from '@supabase/supabase-js';
import type { PncpProcurementItem } from './items-client.ts';
import type { ProcurementDocumentCandidate } from './documents-repository.ts';

export type ItemsPersistenceResult = {
  changeType: 'items_added' | 'items_changed' | 'unchanged';
  itemCount: number;
};

export function createPncpItemsRepository(supabase: SupabaseClient) {
  return {
    async listCandidates(
      limit: number,
    ): Promise<ProcurementDocumentCandidate[]> {
      const { data, error } = await supabase
        .from('procurements')
        .select('id,external_id,source_url')
        .eq('source_id', 'pncp')
        .order('items_checked_at', { ascending: true, nullsFirst: true })
        .limit(limit);
      if (error) throw new Error(`item_candidates_failed:${error.code}`);
      return (data ?? []).map((record) => ({
        id: String(record.id),
        externalId: String(record.external_id),
        sourceUrl: String(record.source_url),
      }));
    },

    async persist(
      procurementId: string,
      items: PncpProcurementItem[],
      itemsHash: string,
      checkedAt: string,
    ): Promise<ItemsPersistenceResult> {
      const { data, error } = await supabase.rpc('replace_procurement_items', {
        target_procurement_id: procurementId,
        target_items: items,
        target_items_hash: itemsHash,
        target_checked_at: checkedAt,
      });
      if (error) throw new Error(`item_persistence_failed:${error.code}`);
      if (
        !data ||
        typeof data !== 'object' ||
        !('changeType' in data) ||
        !('itemCount' in data)
      )
        throw new Error('item_persistence_invalid_response');
      return {
        changeType: data.changeType as ItemsPersistenceResult['changeType'],
        itemCount: Number(data.itemCount),
      };
    },

    async markChecked(procurementId: string, checkedAt: string) {
      const { error } = await supabase
        .from('procurements')
        .update({ items_checked_at: checkedAt })
        .eq('id', procurementId);
      if (error) throw new Error(`item_scan_mark_failed:${error.code}`);
    },
  };
}

export type PncpItemsRepository = ReturnType<typeof createPncpItemsRepository>;
