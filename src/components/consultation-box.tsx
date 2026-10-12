"use client";

import { useState, useTransition } from "react";

import { ImageDropzone, uploadImages } from "@/components/image-upload";
import { submitConsultation } from "@/lib/customer/actions";
import {
  MAX_CONSULTATIONS_PER_APPOINTMENT,
  MAX_IMAGES_PER_REQUEST,
  type Consultation,
  type ConsultationKind,
} from "@/lib/customer/types";
import { formatMoney } from "@/lib/format";

const optionBase = "rounded-xl border p-4 text-left transition-colors disabled:opacity-50";
const optionIdle = "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600";
const optionSelected =
  "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:ring-zinc-100";

/**
 * İsteğe bağlı "Görsel / İlham Yükle" bölümü: müşteri fotoğraf yükleyip ya
 * yapay zekâ stil önerisi alır ya da personelden yorum ister. Hem randevu onay
 * ekranında hem müşterinin randevu sayfasında kullanılır.
 */
export function ConsultationBox({
  token,
  currency,
  initial,
  aiAvailable,
}: {
  /** Randevunun gizli bağlantısı (manage_token). */
  token: string;
  currency: string;
  initial: Consultation[];
  aiAvailable: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [kind, setKind] = useState<ConsultationKind>("staff");
  const [images, setImages] = useState<Blob[]>([]);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const aiUsed = items.some((item) => item.kind === "ai");
  const canAdd = items.length < MAX_CONSULTATIONS_PER_APPOINTMENT;
  const aiSelectable = aiAvailable && !aiUsed;
  const activeKind: ConsultationKind = kind === "ai" && !aiSelectable ? "staff" : kind;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (images.length === 0) {
      setError("Lütfen en az bir görsel ekleyin.");
      return;
    }
    startTransition(async () => {
      const uploaded = await uploadImages(token, "consultations", images);
      if (!uploaded.ok) {
        setError(uploaded.message);
        return;
      }
      const result = await submitConsultation(token, {
        kind: activeKind,
        note,
        paths: uploaded.paths,
        aiConsent: consent,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setItems((current) => [...current, result.consultation]);
      setImages([]);
      setNote("");
      setConsent(false);
    });
  }

  return (
    <div className="space-y-6">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <p className="text-sm font-medium">
            {item.kind === "ai" ? "Yapay zekâ stil önerisi" : "Personelden yorum talebi"}
          </p>
          {item.imageUrls.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {item.imageUrls.map((url, index) => (
                <li key={url}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- kısa ömürlü imzalı adres */}
                  <img
                    src={url}
                    alt={`Yüklediğiniz görsel ${index + 1}`}
                    className="size-20 rounded-lg object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
          {item.note && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Notunuz: {item.note}</p>
          )}

          {item.aiNotes && (
            <div className="mt-3 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
              <p className="whitespace-pre-wrap">{item.aiNotes}</p>
              <p className="mt-2 text-xs text-zinc-500">
                Bu metin yapay zekâ tarafından fotoğrafınıza bakılarak üretildi; bir ön fikirdir.
                Son karar randevuda uzmanınızla birlikte verilir.
              </p>
            </div>
          )}

          {item.kind === "staff" &&
            (item.staffReply ? (
              <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50">
                <p className="text-xs font-medium">Salonun yanıtı</p>
                <p className="mt-1 whitespace-pre-wrap">{item.staffReply}</p>
                {item.priceEstimate !== null && (
                  <p className="mt-2 font-medium">
                    Tahmini fiyat: {formatMoney(item.priceEstimate, currency)}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">
                Talebiniz personele iletildi. Yanıt geldiğinde bu sayfada görünecek.
              </p>
            ))}
        </article>
      ))}

      {canAdd ? (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Ne yapmak istersiniz?">
            <button
              type="button"
              aria-pressed={activeKind === "staff"}
              onClick={() => setKind("staff")}
              className={`${optionBase} ${activeKind === "staff" ? optionSelected : optionIdle}`}
            >
              <span className="block font-medium">Personelden yorum iste</span>
              <span className="block text-sm text-zinc-500">
                Fotoğrafınız ve notunuz randevu aldığınız personele iletilir.
              </span>
            </button>
            <button
              type="button"
              aria-pressed={activeKind === "ai"}
              disabled={!aiSelectable}
              onClick={() => setKind("ai")}
              className={`${optionBase} ${activeKind === "ai" ? optionSelected : optionIdle}`}
            >
              <span className="block font-medium">Yapay zekâ stil önerisi al</span>
              <span className="block text-sm text-zinc-500">
                {!aiAvailable
                  ? "Yakında kullanıma açılacak."
                  : aiUsed
                    ? "Bu randevu için öneri alındı."
                    : "Fotoğrafınıza göre stil, renk ve bakım önerileri, hemen."}
              </span>
            </button>
          </div>

          <ImageDropzone
            images={images}
            onChange={setImages}
            max={MAX_IMAGES_PER_REQUEST}
            disabled={isPending}
            hint="Saç, tırnak ya da makyaj fotoğrafınız ve beğendiğiniz model · en fazla 3 görsel"
          />

          <label className="block text-sm font-medium">
            Notunuz <span className="font-normal text-zinc-500">(isteğe bağlı)</span>
            <textarea
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="örn. Bu modele yakın olsun ama biraz daha kısa"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
            />
          </label>

          {activeKind === "ai" && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1"
              />
              <span>
                Fotoğraflarımın stil önerisi üretmek amacıyla üçüncü taraf bir yapay zekâ
                servisine gönderilmesini ve orada işlenmesini kabul ediyorum.
              </span>
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || images.length === 0 || (activeKind === "ai" && !consent)}
            className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isPending
              ? activeKind === "ai"
                ? "Fotoğrafınız inceleniyor…"
                : "Gönderiliyor…"
              : activeKind === "ai"
                ? "Öneri al"
                : "Personele gönder"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-500">
          Bu randevu için en fazla {MAX_CONSULTATIONS_PER_APPOINTMENT} talep oluşturulabilir.
        </p>
      )}
    </div>
  );
}
