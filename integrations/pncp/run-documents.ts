import {
  downloadPncpPdf,
  fetchPncpDocuments,
  parsePncpProcurementCoordinates,
  prioritizePncpDocuments,
  sha256,
} from './documents-client.ts';
import type { PncpDocumentsRepository } from './documents-repository.ts';

export type DocumentIngestionSummary = {
  procurementsScanned: number;
  documentsAttempted: number;
  documentsFetched: number;
  added: number;
  changed: number;
  unchanged: number;
  failed: number;
  skipped: number;
  errorCodes: string[];
};

function safeErrorCode(error: unknown) {
  return error instanceof Error
    ? error.message.split(':')[0].slice(0, 120)
    : 'unknown_error';
}

export async function runPncpDocumentIngestion(input: {
  repository: PncpDocumentsRepository;
  maxProcurements?: number;
  maxDocuments?: number;
  documentsPerProcurement?: number;
  fetchMetadata?: typeof fetchPncpDocuments;
  download?: typeof downloadPncpPdf;
  sleep?: (delayMs: number) => Promise<void>;
  now?: () => Date;
}): Promise<DocumentIngestionSummary> {
  const maxProcurements = input.maxProcurements ?? 5;
  const maxDocuments = input.maxDocuments ?? 8;
  const documentsPerProcurement = input.documentsPerProcurement ?? 3;
  if (
    !Number.isInteger(maxProcurements) ||
    maxProcurements < 1 ||
    maxProcurements > 20 ||
    !Number.isInteger(maxDocuments) ||
    maxDocuments < 1 ||
    maxDocuments > 20 ||
    !Number.isInteger(documentsPerProcurement) ||
    documentsPerProcurement < 1 ||
    documentsPerProcurement > 10
  )
    throw new Error('invalid_document_ingestion_limits');
  const fetchMetadata = input.fetchMetadata ?? fetchPncpDocuments;
  const download = input.download ?? downloadPncpPdf;
  const sleep =
    input.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  const now = input.now ?? (() => new Date());
  const candidates = await input.repository.listCandidates(maxProcurements);
  const summary: DocumentIngestionSummary = {
    procurementsScanned: 0,
    documentsAttempted: 0,
    documentsFetched: 0,
    added: 0,
    changed: 0,
    unchanged: 0,
    failed: 0,
    skipped: 0,
    errorCodes: [],
  };
  const recordError = (error: unknown) => {
    const code = safeErrorCode(error);
    if (!summary.errorCodes.includes(code) && summary.errorCodes.length < 10)
      summary.errorCodes.push(code);
  };

  for (const candidate of candidates) {
    const checkedAt = now().toISOString();
    const coordinates = parsePncpProcurementCoordinates(
      candidate.sourceUrl,
      candidate.externalId,
    );
    if (!coordinates) {
      summary.skipped += 1;
      await input.repository.markChecked(candidate.id, checkedAt);
      continue;
    }
    try {
      const documents = prioritizePncpDocuments(
        await fetchMetadata(coordinates),
        documentsPerProcurement,
      );
      for (const metadata of documents) {
        if (summary.documentsAttempted >= maxDocuments) break;
        summary.documentsAttempted += 1;
        try {
          const bytes = await download(metadata.url);
          summary.documentsFetched += 1;
          const contentHash = await sha256(bytes);
          const existing = await input.repository.findVersion(
            candidate.id,
            metadata.url,
            contentHash,
          );
          if (existing) {
            await input.repository.verifyExisting(existing.id, checkedAt);
            summary.unchanged += 1;
          } else {
            const registered = await input.repository.registerVersion({
              procurementId: candidate.id,
              metadata,
              contentHash,
              bytes,
              fetchedAt: checkedAt,
            });
            if (registered.changeType === 'document_added') summary.added += 1;
            else if (registered.changeType === 'document_changed')
              summary.changed += 1;
            else summary.unchanged += 1;
          }
        } catch (error) {
          summary.failed += 1;
          recordError(error);
        }
        if (summary.documentsAttempted < maxDocuments) await sleep(500);
      }
      summary.procurementsScanned += 1;
    } catch (error) {
      summary.failed += 1;
      recordError(error);
    } finally {
      await input.repository.markChecked(candidate.id, checkedAt);
    }
    if (summary.documentsAttempted >= maxDocuments) break;
  }
  if (
    candidates.length > 0 &&
    summary.failed > 0 &&
    summary.documentsFetched === 0
  )
    throw new Error(
      `pncp_documents_all_failed:${summary.errorCodes.join(',')}`,
    );
  return summary;
}
