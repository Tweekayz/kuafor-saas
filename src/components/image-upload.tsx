"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { createUploadTargets } from "@/lib/customer/actions";
import { createClient } from "@/lib/supabase/browser";

// Sürükle-bırak görsel seçimi ve yükleme. Görseller tarayıcıda JPEG'e çevrilip
// küçültülür (telefon fotoğrafları 5 MB sınırını aşmasın, yükleme hızlı olsun),
// sonra sunucunun verdiği tek kullanımlık izinle doğrudan depoya yüklenir.

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

/** Görseli en uzun kenarı MAX_EDGE olacak şekilde JPEG'e çevirir; çözülemezse null. */
async function toJpeg(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  } catch {
    return null;
  }
}

/** Seçilen görselleri randevunun klasörüne yükler; depodaki yollarını döner. */
export async function uploadImages(
  token: string,
  bucket: "consultations" | "reviews",
  images: Blob[],
): Promise<{ ok: true; paths: string[] } | { ok: false; message: string }> {
  if (images.length === 0) return { ok: true, paths: [] };

  const targets = await createUploadTargets(token, bucket, images.length);
  if (!targets.ok) return targets;

  const storage = createClient().storage.from(bucket);
  const results = await Promise.all(
    targets.targets.map((target, index) =>
      storage.uploadToSignedUrl(target.path, target.token, images[index], {
        contentType: "image/jpeg",
      }),
    ),
  );
  if (results.some((result) => result.error)) {
    return { ok: false, message: "Görsel yüklenemedi, lütfen tekrar deneyin" };
  }
  return { ok: true, paths: targets.targets.map((target) => target.path) };
}

export function ImageDropzone({
  images,
  onChange,
  max,
  disabled = false,
  hint,
}: {
  images: Blob[];
  onChange: (images: Blob[]) => void;
  max: number;
  disabled?: boolean;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Önizleme adresleri görsel listesi değiştikçe yenilenir ve serbest bırakılır.
  const previews = useMemo(() => images.map((image) => URL.createObjectURL(image)), [images]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  async function add(fileList: FileList | null) {
    if (!fileList || disabled) return;
    setError(null);
    const room = max - images.length;
    const files = [...fileList].filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) {
      setError("Lütfen bir görsel dosyası seçin (JPEG, PNG ya da WebP).");
      return;
    }
    if (files.length > room) setError(`En fazla ${max} görsel ekleyebilirsiniz.`);

    setBusy(true);
    const converted = await Promise.all(files.slice(0, room).map(toJpeg));
    setBusy(false);
    const usable = converted.filter((blob): blob is Blob => blob !== null);
    if (usable.length < converted.length) {
      setError("Bazı görseller okunamadı. Lütfen JPEG ya da PNG deneyin.");
    }
    if (usable.length > 0) onChange([...images, ...usable]);
  }

  const full = images.length >= max;

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void add(event.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          dragging
            ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-900"
            : "border-zinc-300 dark:border-zinc-700"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple={max > 1}
          hidden
          onChange={(event) => {
            void add(event.target.files);
            event.target.value = "";
          }}
        />
        <p className="text-sm">
          {full ? (
            `${max} görsel eklendi.`
          ) : (
            <>
              Görselleri buraya sürükleyin ya da{" "}
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => inputRef.current?.click()}
                className="font-medium underline underline-offset-4"
              >
                dosya seçin
              </button>
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {busy ? "Görseller hazırlanıyor…" : (hint ?? `En fazla ${max} görsel · JPEG, PNG ya da WebP`)}
        </p>

        {previews.length > 0 && (
          <ul className="mt-4 flex flex-wrap justify-center gap-3">
            {previews.map((url, index) => (
              <li key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- yerel önizleme (blob:) */}
                <img
                  src={url}
                  alt={`Seçilen görsel ${index + 1}`}
                  className="size-24 rounded-lg object-cover"
                />
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Görsel ${index + 1} kaldır`}
                  onClick={() => onChange(images.filter((_, i) => i !== index))}
                  className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-zinc-900 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
