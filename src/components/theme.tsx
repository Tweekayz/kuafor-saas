"use client";

import { useLayoutEffect } from "react";

const STORAGE_KEY = "theme";

// Kayıtlı tercih yoksa cihazın tercihi kullanılır. Sayfa boyanmadan önce
// <head> içinde çalışır; böylece koyu modda açılış beyaz yanıp sönmez.
const APPLY_THEME = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

/** APPLY_THEME ile aynı kural; React yüklendikten sonra kullanılır. */
function applyTheme() {
  try {
    let theme = localStorage.getItem(STORAGE_KEY);
    if (theme !== "light" && theme !== "dark") {
      theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", theme);
  } catch {
    // Depolama kapalıysa açık görünümde kalır.
  }
}

/** Kök düzenin <head> bölümüne konur. */
export function ThemeScript() {
  // Geliştirme modunda React, <html> üzerindeki özniteliği yeniden kurulumda
  // siler; burada geri yazılır. Üretimde etkisizdir.
  useLayoutEffect(applyTheme, []);

  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: APPLY_THEME }}
    />
  );
}

/** Açık / koyu mod düğmesi. Simge CSS ile seçildiği için durum tutmaz. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Depolama kapalıysa tercih yalnızca bu sayfa için geçerli olur.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Açık / koyu görünümü değiştir"
      title="Açık / koyu görünüm"
      className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Açık modda ay (koyuya geç), koyu modda güneş (açığa geç) */}
        <path className="dark:hidden" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        <g className="hidden dark:block">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </g>
      </svg>
    </button>
  );
}
