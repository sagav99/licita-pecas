import { createPncpItemsRepository } from '../integrations/pncp/items-repository.ts';
import { runPncpItemsIngestion } from '../integrations/pncp/run-items.ts';
import { createSupabaseAdminClient } from '../integrations/supabase/admin.ts';

const result = await runPncpItemsIngestion({
  repository: createPncpItemsRepository(createSupabaseAdminClient()),
  limit: Number(process.env.PNCP_ITEM_PROCUREMENTS ?? 5),
});

console.log(JSON.stringify(result));
