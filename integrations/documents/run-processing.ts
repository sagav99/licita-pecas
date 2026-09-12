import { extractDocumentText, type DocumentReader } from './extractor.ts';
import {
  retainVerifiedDocumentEvidence,
  selectStructuringText,
} from './select-structuring-text.ts';
import type {
  DocumentProcessingRepository,
  StoredExtractionMethod,
} from './processing-repository.ts';
import type { ExtractionAdapter } from '../gemini/adapter.ts';

function safeErrorCode(error: unknown) {
  return error instanceof Error
    ? error.message.split(':')[0].slice(0, 120)
    : 'unknown_error';
}

export async function runDocumentProcessing(input: {
  repository: DocumentProcessingRepository;
  reader: DocumentReader;
  extractor: ExtractionAdapter;
  limit?: number;
}) {
  const limit = input.limit ?? 1;
  if (!Number.isInteger(limit) || limit < 1 || limit > 5)
    throw new Error('invalid_document_processing_limit');
  const pending = await input.repository.listPending(limit);
  const summary = {
    attempted: 0,
    completed: 0,
    failed: 0,
    errorCodes: [] as string[],
  };
  for (const document of pending) {
    summary.attempted += 1;
    let text = document.extractedText;
    let method: StoredExtractionMethod | null =
      document.extractionStatus === 'native_text' ||
      document.extractionStatus === 'ocr'
        ? document.extractionStatus
        : null;
    try {
      if (!text) {
        const bytes = await input.repository.download(document.storagePath);
        const read = await extractDocumentText(bytes, input.reader);
        text = read.text;
        method = read.method === 'native' ? 'native_text' : 'ocr';
        await input.repository.saveText(document.id, text, method);
      }
      const selected = selectStructuringText(text);
      const result = await input.extractor.extract({
        sourceUrl: document.sourceUrl,
        text: selected.text,
        scope: selected.scope,
      });
      const structured = retainVerifiedDocumentEvidence(result, text);
      await input.repository.complete(
        document.id,
        structured,
        method ?? 'native_text',
        document.processingAttempts + 1,
        selected.scope,
        selected.text.length,
      );
      summary.completed += 1;
    } catch (error) {
      const code = safeErrorCode(error);
      await input.repository.fail(
        document.id,
        code,
        document.processingAttempts + 1,
        method,
      );
      summary.failed += 1;
      if (!summary.errorCodes.includes(code)) summary.errorCodes.push(code);
    }
  }
  if (summary.attempted > 0 && summary.completed === 0)
    throw new Error(
      `document_processing_all_failed:${summary.errorCodes.join(',')}`,
    );
  return summary;
}
