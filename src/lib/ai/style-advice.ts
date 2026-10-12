import "server-only";

import Anthropic from "@anthropic-ai/sdk";

// Müşterinin yüklediği saç / tırnak fotoğrafından stil önerisi üretir (Claude,
// görsel analiz). Yalnızca müşterinin açık onayıyla ve randevu başına bir kez
// çağrılır. ANTHROPIC_API_KEY tanımlı değilse özellik kapalıdır.

const MODEL = "claude-opus-5-5";

const SYSTEM_PROMPT = `Bir kuaför ve güzellik salonunun müşterilerine randevu öncesi fikir veren stil danışmanısın. Müşteri kendi saçının ya da tırnaklarının fotoğrafını, bazen de beğendiği bir modelin görselini yükler; sen bu görsellere ve varsa müşterinin notuna bakarak kısa, uygulanabilir öneriler yazarsın.

Önerilerin fotoğrafta gerçekten görünen şeylere dayanmalı: saçın uzunluğu, dokusu, yoğunluğu ve mevcut rengi; yüz hatlarının genel biçimi; tırnakların uzunluğu ve şekli. Görselde net seçemediğin bir şeyi varsayma; emin değilsen bunu söyle ve salonda birlikte bakılmasını öner.

Yanıtını müşteriye doğrudan hitap eden sade bir Türkçeyle, düz metin olarak yaz (başlık işaretleri ya da madde imleri için özel sembol kullanma). En fazla üç öneri ver; her biri için neden uygun olduğunu bir cümleyle açıkla. Salonun verdiği hizmetler listelenmişse önerilerini mümkün olduğunca onlarla ilişkilendir. Müşterinin beğendiği model görseli varsa, mevcut saç ya da tırnak durumundan o modele nasıl gidileceğini ve gerçekçi olup olmadığını belirt. Toplam uzunluk 150 kelimeyi geçmesin.

Fotoğraftaki kişinin kim olduğunu tahmin etme. Yaş, kilo, sağlık, köken ya da çekicilik hakkında yorum yapma; yalnızca saç, tırnak ve stil konuş. Görsel bir saç ya da tırnak fotoğrafı değilse nazikçe uygun bir fotoğraf istendiğini söyle. Kesin fiyat ya da süre verme; bunları salon belirler. Son cümlende bunun bir ön fikir olduğunu ve son kararın randevuda uzmanla birlikte verileceğini hatırlat.`;

export type StyleImage = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

export type StyleAdviceResult = { ok: true; text: string } | { ok: false; message: string };

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function generateStyleAdvice(input: {
  images: StyleImage[];
  note: string | null;
  salonName: string;
  services: string[];
}): Promise<StyleAdviceResult> {
  if (!isAiConfigured()) return { ok: false, message: "Yapay zekâ önerisi şu anda kullanılamıyor" };

  const context = [
    `Salon: ${input.salonName}`,
    input.services.length > 0 ? `Salonun hizmetleri: ${input.services.join(", ")}` : null,
    input.note ? `Müşterinin notu: ${input.note}` : "Müşteri not yazmadı.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Güvenlik sınıflandırıcısı isteği reddederse sunucu, uygun bir yedek
      // modelde aynı isteği yeniden dener.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // Kısa, tek seferlik bir öneri: düşük efor yeterli ve hızlı.
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...input.images.map((image) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: image.mediaType, data: image.data },
            })),
            { type: "text" as const, text: context },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return {
        ok: false,
        message: "Bu görsel için öneri üretilemedi. Dilerseniz personelimizden yorum isteyin.",
      };
    }

    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n")
      .trim();
    if (!text) return { ok: false, message: "Öneri üretilemedi, lütfen tekrar deneyin" };
    return { ok: true, text };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, message: "Şu anda yoğunluk var, lütfen birkaç dakika sonra tekrar deneyin" };
    }
    if (error instanceof Anthropic.BadRequestError) {
      console.error("style advice rejected", error.message);
      return { ok: false, message: "Görsel işlenemedi. Lütfen farklı bir fotoğraf deneyin." };
    }
    if (error instanceof Anthropic.APIError) {
      console.error("style advice failed", error.status, error.message);
    } else {
      console.error("style advice failed", error);
    }
    return { ok: false, message: "Öneri üretilemedi, lütfen daha sonra tekrar deneyin" };
  }
}
