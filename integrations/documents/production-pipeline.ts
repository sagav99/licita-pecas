import { createGeminiExtractionAdapter } from '../gemini/adapter.ts';
import { createGoogleGeminiClientFromEnv } from '../gemini/google-client.ts';
import { createGoogleGeminiPdfOcrFromEnv } from '../gemini/pdf-ocr.ts';
import { createPdfDocumentReader } from './pdf-reader.ts';
import { processProcurementDocument } from './process-document.ts';

/** Composição exclusiva de servidor: texto nativo, OCR sob demanda e estruturação. */
export function createProductionDocumentPipeline(
  env: NodeJS.ProcessEnv = process.env,
) {
  const reader = createPdfDocumentReader(createGoogleGeminiPdfOcrFromEnv(env));
  const extractor = createGeminiExtractionAdapter(
    createGoogleGeminiClientFromEnv(env),
  );
  return (input: { bytes: Uint8Array; sourceUrl: string }) =>
    processProcurementDocument({ ...input, reader, extractor });
}
