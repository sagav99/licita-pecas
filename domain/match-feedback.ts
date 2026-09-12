export type MatchFeedbackRating = 'correto' | 'parcial' | 'incorreto';

export type MatchFeedbackInput = {
  matchId: string;
  rating: MatchFeedbackRating;
  reason: string | null;
};

export function validateMatchFeedback(
  input: unknown,
): MatchFeedbackInput | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<MatchFeedbackInput>;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      candidate.matchId ?? '',
    )
  )
    return null;
  if (
    candidate.rating !== 'correto' &&
    candidate.rating !== 'parcial' &&
    candidate.rating !== 'incorreto'
  )
    return null;
  if (candidate.reason !== null && typeof candidate.reason !== 'string')
    return null;
  const reason = candidate.reason?.trim().replace(/\s+/g, ' ') || null;
  if (
    reason &&
    (reason.length > 500 ||
      Array.from(reason).some((character) => character.charCodeAt(0) < 32))
  )
    return null;
  return { matchId: candidate.matchId!, rating: candidate.rating, reason };
}
