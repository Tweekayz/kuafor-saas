import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import { site } from "@/lib/site";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Giriş",
  robots: { index: false },
};

export default function LoginPage({ searchParams }: PageProps<"/giris">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 text-sm text-zinc-500 underline-offset-4 hover:underline">
        ← {site.name}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Salon paneline giriş</h1>
      <p className="mt-1 mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        Salon hesabınızın e-posta ve şifresiyle giriş yapın.
      </p>
      <Suspense fallback={<LoginForm next="/panel" />}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginFormWithNext({ searchParams }: Pick<PageProps<"/giris">, "searchParams">) {
  const next = safeNext((await searchParams).next);

  // Zaten oturum açmış kullanıcıya formu tekrar gösterme.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next);

  return <LoginForm next={next} />;
}
