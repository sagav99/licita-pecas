import { extractDocumentText, type DocumentReader } from './extractor.ts';
import type { ExtractionAdapter } from '../gemini/adapter.ts';
import {
  retainVerifiedDocumentEvidence,
  selectStructuringText,
} from './select-structuring-text.ts';

export async function processProcurementDocument(input: {
  bytes: Uint8Array;
  sourceUrl: string;
  reader: DocumentReader;
  extractor: ExtractionAdapter;
}) {
  const read = await extractDocumentText(input.bytes, input.reader);
  const selected = selectStructuringText(read.text);
  const result = await input.extractor.extract({
    sourceUrl: input.sourceUrl,
    text: selected.text,
    scope: selected.scope,
  });
  const structured = retainVerifiedDocumentEvidence(result, read.text);
  return { read, structured, scope: selected.scope };
}
