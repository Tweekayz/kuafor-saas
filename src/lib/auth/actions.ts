"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type SignInState = { error: string } | null;

/** Yalnızca site içi yollara yönlendir (açık yönlendirme engeli). */
function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/panel";
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/panel";
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "E-posta ve şifre zorunludur" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    return { error: "E-posta veya şifre hatalı" };
  }

  redirect(safeNext(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/giris");
}
