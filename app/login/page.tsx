import { Gauge, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signIn, signUp } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  return (
    <main className="grid min-h-screen bg-[#f3f5f2] text-[#14201d] lg:grid-cols-[0.9fr_1.1fr]">
      <section className="hidden bg-[#102923] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#d7ff57] text-[#102923]">
            <Gauge className="h-6 w-6" />
          </span>
          <span className="text-xl font-extrabold tracking-[-0.04em]">
            LICITA PEÇAS
          </span>
        </div>
        <div className="max-w-xl">
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-[#d7ff57]">
            Radar comercial
          </p>
          <h1 className="text-5xl font-black leading-[1.04] tracking-[-0.055em]">
            Decida quais editais combinam com sua operação.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#b8cbc5]">
            Catálogo, região, prazo e evidência oficial reunidos antes da
            sessão.
          </p>
        </div>
        <p className="flex items-center gap-2 text-sm text-[#9db4ad]">
          <ShieldCheck className="h-4 w-4" /> Dados separados por organização
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[#dce2de] bg-white p-7 shadow-[0_24px_70px_rgb(16_41_35/10%)] sm:p-9">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d7ff57] text-[#102923]">
              <Gauge className="h-5 w-5" />
            </span>
            <span className="font-extrabold">LICITA PEÇAS</span>
          </div>
          <h2 className="text-3xl font-black tracking-[-0.04em]">
            Acesse seu radar
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#60716b]">
            Entre ou crie sua conta piloto. Você configurará a empresa no
            próximo passo.
          </p>

          {(error || message) && (
            <output
              className={`mt-5 rounded-xl px-4 py-3 text-sm ${error ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}
            >
              {error ?? message}
            </output>
          )}

          <form className="mt-7 space-y-4">
            <label htmlFor="email" className="block text-sm font-semibold">
              E-mail profissional
              <Input
                className="mt-2 h-11"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </label>
            <label htmlFor="password" className="block text-sm font-semibold">
              Senha
              <Input
                className="mt-2 h-11"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={8}
                required
              />
            </label>
            <Button
              type="submit"
              formAction={signIn}
              className="h-11 w-full bg-[#173d34] text-white hover:bg-[#102923]"
            >
              Entrar
            </Button>
            <Button
              type="submit"
              formAction={signUp}
              variant="outline"
              className="h-11 w-full"
            >
              Criar conta piloto
            </Button>
          </form>
          <p className="mt-5 text-xs leading-relaxed text-[#74847f]">
            O edital oficial sempre prevalece. A plataforma auxilia a triagem
            comercial e não substitui análise jurídica.
          </p>
        </div>
      </section>
    </main>
  );
}
