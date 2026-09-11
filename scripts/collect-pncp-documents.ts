import { createPncpDocumentsRepository } from '../integrations/pncp/documents-repository.ts';
import { runPncpDocumentIngestion } from '../integrations/pncp/run-documents.ts';
import { createSupabaseAdminClient } from '../integrations/supabase/admin.ts';

const result = await runPncpDocumentIngestion({
  repository: createPncpDocumentsRepository(createSupabaseAdminClient()),
  maxProcurements: Number(process.env.PNCP_DOCUMENT_PROCUREMENTS ?? 5),
  maxDocuments: Number(process.env.PNCP_DOCUMENT_LIMIT ?? 8),
});

console.log(JSON.stringify(result));
