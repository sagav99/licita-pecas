import { generateLicitaPecasMatches } from '../integrations/matching/generate.ts';
import { createSupabaseAdminClient } from '../integrations/supabase/admin.ts';

console.log(
  JSON.stringify(await generateLicitaPecasMatches(createSupabaseAdminClient())),
);
