"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { safeNext } from "./redirect";

export type SignInState = { error: string } | null;

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "E-posta ve şifre zorunludur" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzdaki bağlantıya tıklayın." };
    }
    if (error.status === 429) {
      return { error: "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin." };
    }
    if (error.code !== "invalid_credentials") {
      console.error("signIn failed", error);
    }
    return { error: "E-posta veya şifre hatalı" };
  }

  redirect(safeNext(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/giris");
}
