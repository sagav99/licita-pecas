import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProcurementExtraction } from '../gemini/extraction-contract.ts';

export type StoredExtractionMethod = 'native_text' | 'ocr';

export type PendingDocument = {
  id: string;
  sourceUrl: string;
  storagePath: string;
  extractedText: string | null;
  extractionStatus: 'pending' | StoredExtractionMethod | 'failed';
  processingAttempts: number;
};

export function createDocumentProcessingRepository(supabase: SupabaseClient) {
  return {
    async listPending(limit: number): Promise<PendingDocument[]> {
      const { data, error } = await supabase
        .from('procurement_documents')
        .select(
          'id,url,storage_path,extracted_text,extraction_status,processing_attempts',
        )
        .is('structured_data', null)
        .not('storage_path', 'is', null)
        .lt('processing_attempts', 3)
        .order('processing_attempts', { ascending: true })
        .order('fetched_at', { ascending: true })
        .limit(limit);
      if (error)
        throw new Error(`document_processing_queue_failed:${error.code}`);
      return (data ?? []).map((document) => ({
        id: String(document.id),
        sourceUrl: String(document.url),
        storagePath: String(document.storage_path),
        extractedText:
          typeof document.extracted_text === 'string'
            ? document.extracted_text
            : null,
        extractionStatus:
          document.extraction_status as PendingDocument['extractionStatus'],
        processingAttempts: Number(document.processing_attempts ?? 0),
      }));
    },

    async download(storagePath: string) {
      const { data, error } = await supabase.storage
        .from('procurement-documents')
        .download(storagePath);
      if (error)
        throw new Error(`document_storage_download_failed:${error.message}`);
      return new Uint8Array(await data.arrayBuffer());
    },

    async saveText(
      documentId: string,
      text: string,
      method: StoredExtractionMethod,
    ) {
      const { error } = await supabase
        .from('procurement_documents')
        .update({
          extracted_text: text,
          extraction_status: method,
          extraction_error_code: null,
        })
        .eq('id', documentId);
      if (error) throw new Error(`document_text_save_failed:${error.code}`);
    },

    async complete(
      documentId: string,
      structured: ProcurementExtraction,
      method: StoredExtractionMethod,
      attempts: number,
    ) {
      const { error } = await supabase
        .from('procurement_documents')
        .update({
          structured_data: structured,
          extraction_status: method,
          extraction_error_code: null,
          processing_attempts: attempts,
        })
        .eq('id', documentId);
      if (error)
        throw new Error(`document_processing_save_failed:${error.code}`);
    },

    async fail(
      documentId: string,
      errorCode: string,
      attempts: number,
      extractedMethod: StoredExtractionMethod | null,
    ) {
      const { error } = await supabase
        .from('procurement_documents')
        .update({
          extraction_status: extractedMethod ?? 'failed',
          extraction_error_code: errorCode.slice(0, 120),
          processing_attempts: attempts,
        })
        .eq('id', documentId);
      if (error)
        throw new Error(`document_processing_fail_save_failed:${error.code}`);
    },
  };
}

export type DocumentProcessingRepository = ReturnType<
  typeof createDocumentProcessingRepository
>;
