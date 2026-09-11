import { createProductionDocumentServices } from '../integrations/documents/production-pipeline.ts';
import { createDocumentProcessingRepository } from '../integrations/documents/processing-repository.ts';
import { runDocumentProcessing } from '../integrations/documents/run-processing.ts';
import { createSupabaseAdminClient } from '../integrations/supabase/admin.ts';

const services = createProductionDocumentServices();
const result = await runDocumentProcessing({
  repository: createDocumentProcessingRepository(createSupabaseAdminClient()),
  ...services,
  limit: Number(process.env.GEMINI_DOCUMENT_LIMIT ?? 1),
});

console.log(JSON.stringify(result));
