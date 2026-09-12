export type OpportunityExplanation = {
  reasons: string[];
  missing: string[];
  evidenceQuote: string;
  evidenceSourceUrl: string;
  evidenceType: 'document' | 'item' | 'object';
};

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === 'string' && Boolean(item.trim()),
      )
    : [];
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function explainStoredMatch(input: {
  reasons: unknown;
  missingData: unknown;
  evidence: unknown;
  evidenceQuote: string | null;
  object: string;
  sourceUrl: string;
}): OpportunityExplanation {
  const evidence = Array.isArray(input.evidence) ? input.evidence[0] : null;
  const evidenceUrl = safeHttpsUrl(evidence?.sourceUrl);
  const evidenceType =
    evidenceUrl &&
    (evidence?.field === 'document' || evidence?.field === 'item')
      ? evidence.field
      : 'object';
  return {
    reasons: strings(input.reasons),
    missing: strings(input.missingData),
    evidenceQuote: input.evidenceQuote?.trim() || input.object,
    evidenceSourceUrl: evidenceUrl ?? safeHttpsUrl(input.sourceUrl) ?? '',
    evidenceType,
  };
}
