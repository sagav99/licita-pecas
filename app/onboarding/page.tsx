import { redirect } from 'next/navigation';
import { Building2, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/server';
import { createOrganization } from './actions';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect('/login');
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (membership) redirect('/');
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f5f2] px-5 py-12 text-[#14201d]">
      <div className="w-full max-w-lg rounded-2xl border border-[#dce2de] bg-white p-7 shadow-[0_24px_70px_rgb(16_41_35/10%)] sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#d7ff57] text-[#102923]">
            <Gauge className="h-6 w-6" />
          </span>
          <span className="font-extrabold">LICITA PEÇAS</span>
        </div>
        <Building2 className="h-7 w-7 text-[#507719]" />
        <h1 className="mt-4 text-3xl font-black tracking-[-0.04em]">
          Configure sua empresa
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#60716b]">
          Esta organização será a fronteira de segurança do catálogo, matches e
          alertas.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {error}
          </p>
        )}
        <form action={createOrganization} className="mt-7 space-y-4">
          <label htmlFor="legal_name" className="block text-sm font-semibold">
            Razão social ou nome da empresa
            <Input
              className="mt-2 h-11"
              id="legal_name"
              name="legal_name"
              required
              minLength={3}
            />
          </label>
          <label htmlFor="cnpj" className="block text-sm font-semibold">
            CNPJ{' '}
            <span className="font-normal text-[#74847f]">
              (opcional no piloto)
            </span>
            <Input
              className="mt-2 h-11"
              id="cnpj"
              name="cnpj"
              inputMode="numeric"
              maxLength={18}
            />
          </label>
          <Button
            type="submit"
            className="h-11 w-full bg-[#173d34] text-white hover:bg-[#102923]"
          >
            Criar organização
          </Button>
        </form>
      </div>
    </main>
  );
}
