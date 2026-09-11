import type { SupabaseClient } from '@supabase/supabase-js';
import type { PncpDocumentMetadata } from './documents-client.ts';

const BUCKET = 'procurement-documents';

export type ProcurementDocumentCandidate = {
  id: string;
  externalId: string;
  sourceUrl: string;
};

export type RegisteredDocument = {
  documentId: string;
  changeType: 'document_added' | 'document_changed' | 'unchanged';
};

export function createPncpDocumentsRepository(supabase: SupabaseClient) {
  return {
    async listCandidates(
      limit: number,
    ): Promise<ProcurementDocumentCandidate[]> {
      const { data, error } = await supabase
        .from('procurements')
        .select('id,external_id,source_url')
        .eq('source_id', 'pncp')
        .order('documents_checked_at', { ascending: true, nullsFirst: true })
        .limit(limit);
      if (error) throw new Error(`document_candidates_failed:${error.code}`);
      return (data ?? []).map((record) => ({
        id: String(record.id),
        externalId: String(record.external_id),
        sourceUrl: String(record.source_url),
      }));
    },

    async findVersion(procurementId: string, url: string, contentHash: string) {
      const { data, error } = await supabase
        .from('procurement_documents')
        .select('id,storage_path')
        .eq('procurement_id', procurementId)
        .eq('url', url)
        .eq('content_hash', contentHash)
        .maybeSingle();
      if (error) throw new Error(`document_version_read_failed:${error.code}`);
      return data
        ? { id: String(data.id), storagePath: String(data.storage_path ?? '') }
        : null;
    },

    async verifyExisting(documentId: string, checkedAt: string) {
      const { error } = await supabase
        .from('procurement_documents')
        .update({ last_verified_at: checkedAt })
        .eq('id', documentId);
      if (error) throw new Error(`document_verify_failed:${error.code}`);
    },

    async registerVersion(input: {
      procurementId: string;
      metadata: PncpDocumentMetadata;
      contentHash: string;
      bytes: Uint8Array;
      fetchedAt: string;
    }): Promise<RegisteredDocument> {
      const storagePath = `${input.procurementId}/${input.contentHash}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, input.bytes, {
          contentType: 'application/pdf',
          upsert: true,
        });
      if (uploadError)
        throw new Error(`document_storage_failed:${uploadError.message}`);

      const { data, error } = await supabase.rpc(
        'register_procurement_document_version',
        {
          target_procurement_id: input.procurementId,
          target_url: input.metadata.url,
          target_document_type: input.metadata.documentType,
          target_title: input.metadata.title,
          target_content_hash: input.contentHash,
          target_storage_path: storagePath,
          target_byte_size: input.bytes.byteLength,
          target_published_at: input.metadata.publishedAt,
          target_fetched_at: input.fetchedAt,
        },
      );
      if (error) throw new Error(`document_register_failed:${error.code}`);
      if (
        !data ||
        typeof data !== 'object' ||
        !('documentId' in data) ||
        !('changeType' in data)
      )
        throw new Error('document_register_invalid_response');
      return {
        documentId: String(data.documentId),
        changeType: data.changeType as RegisteredDocument['changeType'],
      };
    },

    async markChecked(procurementId: string, checkedAt: string) {
      const { error } = await supabase
        .from('procurements')
        .update({ documents_checked_at: checkedAt })
        .eq('id', procurementId);
      if (error) throw new Error(`document_scan_mark_failed:${error.code}`);
    },
  };
}

export type PncpDocumentsRepository = ReturnType<
  typeof createPncpDocumentsRepository
>;
