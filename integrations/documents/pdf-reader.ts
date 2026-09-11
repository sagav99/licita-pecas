import { extractText } from 'unpdf';
import type { DocumentReader } from './extractor.ts';

export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

export type PdfOcr = (input: Uint8Array) => Promise<string>;

export function assertPdf(input: Uint8Array) {
  if (!input.length) throw new Error('document_empty');
  if (input.length > MAX_DOCUMENT_BYTES) throw new Error('document_too_large');
  if (new TextDecoder('ascii').decode(input.slice(0, 5)) !== '%PDF-') {
    throw new Error('document_not_pdf');
  }
}

export async function readNativePdf(input: Uint8Array) {
  assertPdf(input);
  const result = await extractText(input, { mergePages: true });
  return result.text;
}

export function createPdfDocumentReader(ocr: PdfOcr): DocumentReader {
  return {
    readNative: readNativePdf,
    async readOcr(input) {
      assertPdf(input);
      return ocr(input);
    },
  };
}
