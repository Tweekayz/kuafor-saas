"use client";

import { useState, useTransition } from "react";

import { ImageDropzone, uploadImages } from "@/components/image-upload";
import { submitReview } from "@/lib/customer/actions";
import { MAX_REVIEW_PHOTOS } from "@/lib/customer/types";

const STAR_PATH =
  "M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.100 1.200-6.600L2.500 9.500l6.600-.900L12 2.500Z";

/** Yıldızlı puan gösterimi (yalnızca okunur). */
export function Stars({ value, className = "size-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`5 üzerinden ${value} yıldız`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`${className} ${star <= Math.round(value) ? "fill-amber-500 text-amber-500" : "fill-none text-zinc-400"}`}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}

function StarInput({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              className="peer sr-only"
            />
            <svg
              viewBox="0 0 24 24"
              className={`size-9 rounded peer-focus-visible:outline-2 peer-focus-visible:outline-zinc-900 dark:peer-focus-visible:outline-zinc-100 ${
                value !== null && star <= value
                  ? "fill-amber-500 text-amber-500"
                  : "fill-none text-zinc-400"
              }`}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            >
              <title>{`${star} yıldız`}</title>
              <path d={STAR_PATH} />
            </svg>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewForm({ token, barberName }: { token: string; barberName: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [staffRating, setStaffRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === null) {
      setError("Lütfen bir puan seçin.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const uploaded = await uploadImages(token, "reviews", photos);
      if (!uploaded.ok) {
        setError(uploaded.message);
        return;
      }
      const result = await submitReview(token, {
        rating,
        staffRating,
        comment,
        paths: uploaded.paths,
      });
      if (result.ok) setDone(true);
      else setError(result.message);
    });
  }

  if (done) {
    return (
      <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50">
        Değerlendirmeniz için teşekkür ederiz!
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <StarInput label="Genel memnuniyetiniz" name="rating" value={rating} onChange={setRating} />
      {barberName && (
        <StarInput
          label={`${barberName} için puanınız (isteğe bağlı)`}
          name="staff_rating"
          value={staffRating}
          onChange={setStaffRating}
        />
      )}
      <label className="block text-sm font-medium">
        Yorumunuz <span className="font-normal text-zinc-500">(isteğe bağlı)</span>
        <textarea
          rows={3}
          maxLength={1000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
        />
      </label>
      <div>
        <p className="mb-2 text-sm font-medium">
          İşlem sonrası fotoğraf <span className="font-normal text-zinc-500">(isteğe bağlı)</span>
        </p>
        <ImageDropzone
          images={photos}
          onChange={setPhotos}
          max={MAX_REVIEW_PHOTOS}
          disabled={isPending}
          hint="Yorumunuz yayınlanırsa fotoğraflar salonun sayfasında herkese görünür."
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending || rating === null}
        className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Gönderiliyor…" : "Değerlendirmeyi gönder"}
      </button>
    </form>
  );
}
