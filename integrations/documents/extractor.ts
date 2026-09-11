export type DocumentExtraction = {
  text: string;
  method: 'native' | 'ocr';
  confidence: 'confirmed' | 'fallback';
};

export type DocumentReader = {
  readNative: (input: Uint8Array) => Promise<string>;
  readOcr: (input: Uint8Array) => Promise<string>;
};

/** Extrai texto nativo primeiro e só chama OCR quando não há texto útil. */
export async function extractDocumentText(
  input: Uint8Array,
  reader: DocumentReader,
): Promise<DocumentExtraction> {
  const native = (await reader.readNative(input)).trim();
  if (native.length >= 32)
    return { text: native, method: 'native', confidence: 'confirmed' };
  const ocr = (await reader.readOcr(input)).trim();
  if (!ocr) throw new Error('document_without_text');
  return { text: ocr, method: 'ocr', confidence: 'fallback' };
}
