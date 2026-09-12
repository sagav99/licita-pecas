'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  BRAZILIAN_STATES,
  type SupplierProfileInput,
} from '@/domain/supplier-profile';

type Props = {
  initialProfile: SupplierProfileInput;
  updateProfile: (
    input: SupplierProfileInput,
  ) => Promise<{ ok: boolean; error?: string }>;
};

function commaList(values: string[]) {
  return values.join(', ');
}

function parseList(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function SupplierProfileView({
  initialProfile,
  updateProfile,
}: Props) {
  const [regions, setRegions] = useState(initialProfile.regions);
  const [radius, setRadius] = useState(
    initialProfile.deliveryRadiusKm?.toString() ?? '',
  );
  const [brands, setBrands] = useState(commaList(initialProfile.brands));
  const [categories, setCategories] = useState(
    commaList(initialProfile.categories),
  );
  const [exclusions, setExclusions] = useState(
    commaList(initialProfile.exclusions),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await updateProfile({
        regions,
        deliveryRadiusKm: radius.trim() === '' ? null : Number(radius),
        brands: parseList(brands),
        categories: parseList(categories),
        exclusions: parseList(exclusions),
      });
      if (!result.ok)
        setError(result.error ?? 'Não foi possível salvar o perfil.');
      else
        setMessage(
          'Perfil salvo. As próximas atualizações do radar usarão suas preferências.',
        );
    } catch {
      setError('Não foi possível salvar o perfil. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-5 py-7 md:px-8 md:py-8">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#527066]">
        Operação comercial
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">
        Meu perfil
      </h1>
      <p className="mt-2 text-[#60716b]">
        Informe onde entrega e quais linhas quer priorizar. O catálogo continua
        sendo a prova do que você fornece.
      </p>

      <section className="mt-7 rounded-2xl border bg-white p-5">
        <h2 className="font-bold">Estados atendidos</h2>
        <p className="mt-1 text-sm text-[#687a74]">
          A localização do edital influencia o score; não confirma a viabilidade
          da entrega.
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-9">
          {BRAZILIAN_STATES.map((state) => (
            <label
              key={state}
              className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-sm font-semibold focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#315d50] ${regions.includes(state) ? 'border-[#4c7922] bg-[#edf4dc] text-[#31551b]' : 'bg-white text-[#52665f]'}`}
            >
              <input
                className="sr-only"
                type="checkbox"
                checked={regions.includes(state)}
                onChange={(event) =>
                  setRegions((current) =>
                    event.target.checked
                      ? [...current, state]
                      : current.filter((region) => region !== state),
                  )
                }
              />
              {state}
            </label>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5">
          <label htmlFor="delivery-radius" className="font-bold">
            Raio de entrega (km)
          </label>
          <p className="mt-1 text-sm text-[#687a74]">
            Opcional; mantido no perfil, mas não avaliado automaticamente até
            haver origem e destino geocodificados.
          </p>
          <input
            id="delivery-radius"
            type="number"
            min="0"
            max="2000"
            step="1"
            value={radius}
            onChange={(event) => setRadius(event.target.value)}
            className="mt-4 h-11 w-full rounded-lg border px-3 text-sm"
            placeholder="Ex.: 250"
          />
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <label htmlFor="profile-brands" className="font-bold">
            Marcas atendidas
          </label>
          <p className="mt-1 text-sm text-[#687a74]">
            Separe por vírgula. Quando preenchidas, restringem quais SKUs entram
            no match.
          </p>
          <input
            id="profile-brands"
            value={brands}
            onChange={(event) => setBrands(event.target.value)}
            className="mt-4 h-11 w-full rounded-lg border px-3 text-sm"
            placeholder="Ex.: Bosch, Mann, Nakata"
          />
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <label htmlFor="profile-categories" className="font-bold">
            Tipos de peça
          </label>
          <p className="mt-1 text-sm text-[#687a74]">
            Use os nomes das categorias do catálogo. Vazio significa todas.
          </p>
          <input
            id="profile-categories"
            value={categories}
            onChange={(event) => setCategories(event.target.value)}
            className="mt-4 h-11 w-full rounded-lg border px-3 text-sm"
            placeholder="Ex.: filtros, freios, suspensão"
          />
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <label htmlFor="profile-exclusions" className="font-bold">
            Termos a revisar
          </label>
          <p className="mt-1 text-sm text-[#687a74]">
            Editais que citarem estes termos não serão marcados compatíveis sem
            revisão. Lotes mistos não são descartados.
          </p>
          <input
            id="profile-exclusions"
            value={exclusions}
            onChange={(event) => setExclusions(event.target.value)}
            className="mt-4 h-11 w-full rounded-lg border px-3 text-sm"
            placeholder="Ex.: pneus, instalação"
          />
        </div>
      </section>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar perfil'}
        </Button>
        {message && (
          <output className="text-sm text-emerald-800">{message}</output>
        )}
        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
