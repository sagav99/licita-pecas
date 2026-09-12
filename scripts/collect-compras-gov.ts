import { createSupabaseAdminClient } from '../integrations/supabase/admin.ts';
import { createComprasGovRepository } from '../integrations/compras-gov/repository.ts';
import { isLicitaPecasDiscoveryCandidate } from '../domain/verticals/licita-pecas/discovery.ts';
import {
  comprasGovDate,
  runComprasGovCollection,
} from '../integrations/compras-gov/run-collection.ts';

const date = comprasGovDate();
const modalityCodes = (process.env.COMPRAS_GOV_MODALITY_CODES ?? '5,6')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0);
const result = await runComprasGovCollection({
  repository: createComprasGovRepository(createSupabaseAdminClient()),
  startDate: date,
  endDate: date,
  modalityCodes,
  baseUrl: process.env.COMPRAS_GOV_BASE_URL || undefined,
  candidateFilter: isLicitaPecasDiscoveryCandidate,
});

console.log(JSON.stringify(result));
