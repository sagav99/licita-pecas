'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function credentials(formData: FormData) {
  const rawEmail = formData.get('email');
  const rawPassword = formData.get('password');
  const email = (typeof rawEmail === 'string' ? rawEmail : '')
    .trim()
    .toLowerCase();
  const password = typeof rawPassword === 'string' ? rawPassword : '';
  if (!email.includes('@') || password.length < 8)
    redirect(
      '/login?error=Confira o e-mail e use uma senha com pelo menos 8 caracteres.',
    );
  return { email, password };
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(
    credentials(formData),
  );
  if (error) redirect('/login?error=E-mail ou senha inválidos.');
  redirect('/');
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const origin =
    (await headers()).get('origin') ?? 'https://licita-pecas.vercel.app';
  const { data, error } = await supabase.auth.signUp({
    ...credentials(formData),
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error)
    redirect('/login?error=Não foi possível criar a conta. Tente novamente.');
  if (data.session) redirect('/onboarding');
  redirect('/login?message=Confira seu e-mail para confirmar a conta.');
}
