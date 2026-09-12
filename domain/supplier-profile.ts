export const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

export type SupplierProfileInput = {
  regions: string[];
  deliveryRadiusKm: number | null;
  brands: string[];
  categories: string[];
  exclusions: string[];
};

function normalizeTerms(value: unknown, maximum: number): string[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const terms: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const term = item.trim().replace(/\s+/g, ' ');
    if (
      !term ||
      term.length > 80 ||
      /[<>]/.test(term) ||
      Array.from(term).some((character) => character.charCodeAt(0) < 32)
    )
      return null;
    if (
      !terms.some(
        (existing) =>
          existing.toLocaleLowerCase('pt-BR') ===
          term.toLocaleLowerCase('pt-BR'),
      )
    )
      terms.push(term);
  }
  return terms;
}

export function validateSupplierProfile(
  input: unknown,
): SupplierProfileInput | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<SupplierProfileInput>;
  const regions = normalizeTerms(candidate.regions, 27)?.map((region) =>
    region.toUpperCase(),
  );
  const brands = normalizeTerms(candidate.brands, 30);
  const categories = normalizeTerms(candidate.categories, 30);
  const exclusions = normalizeTerms(candidate.exclusions, 20);
  if (
    !regions ||
    !brands ||
    !categories ||
    !exclusions ||
    regions.some(
      (region) =>
        !BRAZILIAN_STATES.includes(region as (typeof BRAZILIAN_STATES)[number]),
    )
  )
    return null;
  const radius = candidate.deliveryRadiusKm;
  if (
    radius !== null &&
    (typeof radius !== 'number' ||
      !Number.isInteger(radius) ||
      radius < 0 ||
      radius > 2000)
  )
    return null;
  return {
    regions: [...new Set(regions)],
    deliveryRadiusKm: radius ?? null,
    brands,
    categories,
    exclusions,
  };
}

export function storedProfileTerms(value: unknown, maximum: number): string[] {
  return normalizeTerms(value, maximum) ?? [];
}
