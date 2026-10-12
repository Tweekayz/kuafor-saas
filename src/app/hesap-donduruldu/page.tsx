import type { Metadata } from "next";

import { signOut } from "@/lib/auth/actions";
import { site, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Hesap donduruldu",
  robots: { index: false },
};

export default function FrozenPage() {
  const whatsapp = whatsappLink(`Merhaba, ${site.name} hesabım dondurulmuş görünüyor.`);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Hesabınız donduruldu</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Salonunuzun paneli ve online randevu sayfası geçici olarak kapatıldı. Verileriniz
        silinmedi. Hesabınızı yeniden açmak için bizimle iletişime geçin.
      </p>
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          className="mt-6 rounded-full bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700"
        >
          WhatsApp Destek Hattı
        </a>
      )}
      <form action={signOut} className="mt-4">
        <button type="submit" className="text-sm font-medium underline underline-offset-4">
          Çıkış yap
        </button>
      </form>
    </main>
  );
}
