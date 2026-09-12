import type { SupabaseClient } from '@supabase/supabase-js';
import { createProcurementRepository } from '../pncp/repository.ts';

export function createComprasGovRepository(supabase: SupabaseClient) {
  return createProcurementRepository(supabase, {
    sourceKey: 'compras-gov',
    // O endpoint atual expõe o número de controle do PNCP. Mantemos uma única
    // identidade para que os coletores de documentos e itens usem o registro.
    recordSourceKey: 'pncp',
    // O complemento descobre registros ausentes, mas não substitui dados mais
    // recentes obtidos diretamente da fonte-base.
    insertOnly: true,
  });
}

export type ComprasGovRepository = ReturnType<
  typeof createComprasGovRepository
>;
