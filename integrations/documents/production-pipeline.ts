import { createGeminiExtractionAdapter } from '../gemini/adapter.ts';
import { createGoogleGeminiClientFromEnv } from '../gemini/google-client.ts';
import { createGoogleGeminiPdfOcrFromEnv } from '../gemini/pdf-ocr.ts';
import { createPdfDocumentReader } from './pdf-reader.ts';
import { processProcurementDocument } from './process-document.ts';

/** Composição exclusiva de servidor: texto nativo, OCR sob demanda e estruturação. */
export function createProductionDocumentServices(
  env: NodeJS.ProcessEnv = process.env,
) {
  return {
    reader: createPdfDocumentReader(createGoogleGeminiPdfOcrFromEnv(env)),
    extractor: createGeminiExtractionAdapter(
      createGoogleGeminiClientFromEnv(env),
    ),
  };
}

export function createProductionDocumentPipeline(
  env: NodeJS.ProcessEnv = process.env,
) {
  const { reader, extractor } = createProductionDocumentServices(env);
  return (input: { bytes: Uint8Array; sourceUrl: string }) =>
    processProcurementDocument({ ...input, reader, extractor });
}
