import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-sm font-medium text-zinc-500">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sayfa bulunamadı</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Aradığınız sayfa ya da salon bulunamadı. Randevu bağlantısını salonunuzdan yeniden
        isteyebilirsiniz.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-zinc-900 px-6 py-3 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Ana sayfa
      </Link>
    </main>
  );
}
