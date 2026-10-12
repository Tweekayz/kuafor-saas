import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Giriş",
};

export default function LoginPage({ searchParams }: PageProps<"/giris">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
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
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : "/panel"} />;
}
