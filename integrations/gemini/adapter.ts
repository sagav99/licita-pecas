import {
  buildExtractionPrompt,
  hasUsableEvidence,
  type ProcurementExtraction,
} from './extraction-contract.ts';

export type GeminiClient = {
  generate: (input: { prompt: string; text: string }) => Promise<string>;
};

export type ExtractionAdapter = {
  extract: (input: {
    sourceUrl: string;
    text: string;
  }) => Promise<ProcurementExtraction>;
};

/** Adapter server-side; o cliente real deve ser injetado somente no runtime. */
export function createGeminiExtractionAdapter(
  client: GeminiClient,
): ExtractionAdapter {
  return {
    async extract(input) {
      const raw = await client.generate({
        prompt: buildExtractionPrompt(input.sourceUrl),
        text: input.text,
      });
      let parsed: ProcurementExtraction;
      try {
        parsed = JSON.parse(raw) as ProcurementExtraction;
      } catch {
        throw new Error('gemini_invalid_json');
      }
      if (!hasUsableEvidence(parsed))
        throw new Error('gemini_missing_evidence');
      return parsed;
    },
  };
}
