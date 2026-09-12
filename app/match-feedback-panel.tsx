'use client';

import { useState } from 'react';
import type { MatchFeedbackInput } from '@/domain/match-feedback';

type Rating = MatchFeedbackInput['rating'];
type Props = {
  matchId: string;
  initialRating: Rating | null;
  submit: (
    input: MatchFeedbackInput,
  ) => Promise<{ ok: boolean; error?: string }>;
};

const options: Array<[Rating, string]> = [
  ['correto', 'Acertou'],
  ['parcial', 'Parcial'],
  ['incorreto', 'Errou'],
];

export default function MatchFeedbackPanel({
  matchId,
  initialRating,
  submit,
}: Props) {
  const [savedRating, setSavedRating] = useState(initialRating);
  const [rating, setRating] = useState<Rating | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!rating || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await submit({
        matchId,
        rating,
        reason: reason.trim() || null,
      });
      if (result.ok) setSavedRating(rating);
      else setError(result.error ?? 'Não foi possível salvar sua avaliação.');
    } catch {
      setError('Não foi possível salvar sua avaliação. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="mt-5 border-t border-white/15 pt-5"
      aria-label="Avaliar qualidade do match"
    >
      <h3 className="text-sm font-bold">Este match ajudou?</h3>
      {savedRating ? (
        <output className="mt-2 block text-sm text-[#d7ff57]">
          Avaliação registrada:{' '}
          {options.find(([value]) => value === savedRating)?.[1]}.
        </output>
      ) : (
        <>
          <p className="mt-1 text-xs text-[#abc0b9]">
            Seu retorno ajuda a ajustar as regras; não altera o edital.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {options.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                disabled={saving}
                aria-pressed={rating === value}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d7ff57] ${rating === value ? 'border-[#d7ff57] bg-[#d7ff57] text-[#102923]' : 'border-white/20 text-white hover:bg-white/10'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label
            htmlFor={`feedback-reason-${matchId}`}
            className="mt-3 block text-xs font-semibold text-[#c9d6d2]"
          >
            Motivo (opcional)
          </label>
          <textarea
            id={`feedback-reason-${matchId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Ex.: marca aceita, mas prazo inviável"
            className="mt-1 w-full rounded-lg border border-white/20 bg-white/[0.05] p-2 text-sm text-white placeholder:text-[#819b93]"
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={!rating || saving}
            className="mt-2 rounded-lg border border-white/30 px-3 py-2 text-xs font-bold disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Enviar avaliação'}
          </button>
          {error && (
            <p role="alert" className="mt-2 text-xs text-rose-300">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
