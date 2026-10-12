"use client";

import { useState } from "react";

import type { Plan } from "@/lib/site";

const priceFormat = new Intl.NumberFormat("tr-TR");

/**
 * Aylık / yıllık geçişli paket kartları. `trialLinks` her paketin deneme
 * butonunun adresidir (paket adıyla eşleşir).
 */
export function PricingPlans({
  plans,
  trialDays,
  trialLinks,
}: {
  plans: Plan[];
  trialDays: number;
  trialLinks: Record<string, string>;
}) {
  const [yearly, setYearly] = useState(false);

  return (
    <div>
      <div
        role="group"
        aria-label="Ödeme dönemi"
        className="inline-flex rounded-full border border-zinc-300 p-1 text-sm dark:border-zinc-700"
      >
        {[
          [false, "Aylık"],
          [true, "Yıllık (2 Ay Ücretsiz)"],
        ].map(([value, label]) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={yearly === value}
            onClick={() => setYearly(value as boolean)}
            className="rounded-full px-4 py-1.5 font-medium transition-colors aria-pressed:bg-zinc-900 aria-pressed:text-white dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900"
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="mt-8 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <li
            key={plan.name}
            className={`relative flex flex-col rounded-2xl border p-8 ${
              plan.popular
                ? "border-amber-600 ring-1 ring-amber-600 dark:border-amber-500 dark:ring-amber-500"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-8 rounded-full bg-amber-700 px-3 py-1 text-xs font-semibold text-white dark:bg-amber-500 dark:text-zinc-950">
                Popüler
              </span>
            )}
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="mt-1 text-sm text-zinc-500">{plan.tagline}</p>

            <p className="mt-6" aria-live="polite">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">
                {priceFormat.format(yearly ? plan.yearly : plan.monthly)} TL
              </span>
              <span className="text-zinc-500"> / {yearly ? "yıl" : "ay"}</span>
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {yearly
                ? `12 ay kullanın, 10 ay ödeyin (${priceFormat.format(plan.monthly * 12 - plan.yearly)} TL kazanç)`
                : `Yıllık ödemede ${priceFormat.format(plan.yearly)} TL`}
            </p>

            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-3">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            <a
              href={trialLinks[plan.name]}
              className={`mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 font-medium transition-colors ${
                plan.popular
                  ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
                  : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              {trialDays} Gün Ücretsiz Deneyin
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
