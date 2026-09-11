import { createSupabaseAdminClient } from '../integrations/supabase/admin.ts';
import { createPncpRepository } from '../integrations/pncp/repository.ts';
import { isLicitaPecasDiscoveryCandidate } from '../domain/verticals/licita-pecas/discovery.ts';
import {
  brasiliaDate,
  runPncpCollection,
} from '../integrations/pncp/run-collection.ts';

const date = brasiliaDate();
const modalityCodes = (process.env.PNCP_MODALITY_CODES ?? '6,7,8')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0);
const result = await runPncpCollection({
  repository: createPncpRepository(createSupabaseAdminClient()),
  startDate: date,
  endDate: date,
  modalityCodes,
  baseUrl: process.env.PNCP_BASE_URL || undefined,
  candidateFilter: isLicitaPecasDiscoveryCandidate,
});

console.log(JSON.stringify(result));
