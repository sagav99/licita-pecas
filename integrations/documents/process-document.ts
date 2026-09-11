import { extractDocumentText, type DocumentReader } from './extractor.ts';
import type { ExtractionAdapter } from '../gemini/adapter.ts';

export const MAX_STRUCTURING_CHARACTERS = 300_000;

export async function processProcurementDocument(input: {
  bytes: Uint8Array;
  sourceUrl: string;
  reader: DocumentReader;
  extractor: ExtractionAdapter;
}) {
  const read = await extractDocumentText(input.bytes, input.reader);
  if (read.text.length > MAX_STRUCTURING_CHARACTERS) {
    throw new Error('document_text_too_large');
  }
  const structured = await input.extractor.extract({
    sourceUrl: input.sourceUrl,
    text: read.text,
  });
  return { read, structured };
}
