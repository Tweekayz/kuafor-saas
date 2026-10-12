import "server-only";

// Müşterinin yüklediği saç / tırnak / makyaj fotoğrafından stil önerisi üretir (Google
// Gemini, görsel analiz). Yalnızca müşterinin açık onayıyla ve randevu başına
// bir kez çağrılır. GEMINI_API_KEY tanımlı değilse özellik kapalıdır.

/**
 * Kullanılacak Gemini modeli; GEMINI_MODEL ile değiştirilebilir. Varsayılan,
 * ücretsiz katmanı olan ve görsel girdi kabul eden düşük maliyetli modeldir
 * (gemini-1.5-flash ve gemini-2.0-flash Google'ın güncel model listesinde yoktur).
 */
const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 45_000;

const SYSTEM_PROMPT = `Bir kuaför ve güzellik salonunda çalışan deneyimli bir stilistsin ve müşterilere randevu öncesi fikir veriyorsun. Müşteri kendi saçının, tırnaklarının ya da makyajının fotoğrafını, bazen de beğendiği bir modelin görselini yükler; sen bu görsellere ve varsa müşterinin notuna bakarak kısa, uygulanabilir öneriler yazarsın.

Önerilerin fotoğrafta gerçekten görünen şeylere dayanmalı: saçın uzunluğu, dokusu, yoğunluğu ve mevcut rengi; yüz hatlarının genel biçimi; tırnakların uzunluğu ve şekli; makyajda kullanılan tonlar ve ten alt tonu. Görselde net seçemediğin bir şeyi varsayma; emin değilsen bunu söyle ve salonda birlikte bakılmasını öner.

Yanıtın üç kısa bölümden oluşsun ve her bölüm kendi adıyla başlasın: "Stil önerisi" (hangi model ya da şekil, neden uygun), "Renk tavsiyesi" (hangi tonlar yakışır, mevcut renkten oraya nasıl gidilir) ve "Bakım ipuçları" (bu görünümü korumak için evde yapılabilecek bir iki şey). Müşteriye doğrudan hitap eden sade bir Türkçeyle, düz metin olarak yaz; yıldız, kare işareti gibi biçimlendirme sembolleri kullanma. Salonun verdiği hizmetler listelenmişse önerilerini mümkün olduğunca onlarla ilişkilendir. Müşterinin beğendiği model görseli varsa, mevcut durumdan o modele nasıl gidileceğini ve gerçekçi olup olmadığını belirt. Toplam uzunluk 180 kelimeyi geçmesin.

Fotoğraftaki kişinin kim olduğunu tahmin etme. Yaş, kilo, sağlık, köken ya da çekicilik hakkında yorum yapma; yalnızca saç, tırnak, makyaj ve stil konuş. Cilt ya da saç derisi hastalığı gibi tıbbi bir konuda teşhis koyma; gerekirse bir uzmana danışılmasını öner. Görsel saç, tırnak ya da makyaj fotoğrafı değilse nazikçe uygun bir fotoğraf istendiğini söyle. Kesin fiyat ya da süre verme; bunları salon belirler. Son cümlende bunun bir ön fikir olduğunu ve son kararın randevuda uzmanla birlikte verileceğini hatırlat.`;

export type StyleImage = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

export type StyleAdviceResult = { ok: true; text: string } | { ok: false; message: string };

export function isAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// generateContent yanıtının kullandığımız kısmı.
type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; status?: string; message?: string };
};

const BLOCKED = "Bu görsel için öneri üretilemedi. Dilerseniz personelimizden yorum isteyin.";

export async function generateStyleAdvice(input: {
  images: StyleImage[];
  note: string | null;
  salonName: string;
  services: string[];
}): Promise<StyleAdviceResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, message: "Yapay zekâ önerisi şu anda kullanılamıyor" };

  const context = [
    `Salon: ${input.salonName}`,
    input.services.length > 0 ? `Salonun hizmetleri: ${input.services.join(", ")}` : null,
    input.note ? `Müşterinin notu: ${input.note}` : "Müşteri not yazmadı.",
  ]
    .filter(Boolean)
    .join("\n");

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${encodeURIComponent(MODEL)}:generateContent`, {
      method: "POST",
      // Anahtar adres satırına değil başlığa yazılır (günlüklere düşmesin).
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              ...input.images.map((image) => ({
                inline_data: { mime_type: image.mediaType, data: image.data },
              })),
              { text: context },
            ],
          },
        ],
        // Modelin düşünme payı da bu sınırdan düşer; kısa yanıt için bol tutulur.
        generationConfig: { maxOutputTokens: 4096 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.error("style advice: request failed", error);
    return { ok: false, message: "Öneri üretilemedi, lütfen daha sonra tekrar deneyin" };
  }

  const data = (await response.json().catch(() => ({}))) as GeminiResponse;

  if (!response.ok) {
    console.error("style advice failed", response.status, data.error?.status, data.error?.message);
    if (response.status === 429) {
      // Ücretsiz katmanın dakikalık / günlük kotası dolduğunda da bu döner.
      return { ok: false, message: "Şu anda yoğunluk var, lütfen birkaç dakika sonra tekrar deneyin" };
    }
    if (response.status === 400) {
      return { ok: false, message: "Görsel işlenemedi. Lütfen farklı bir fotoğraf deneyin." };
    }
    return { ok: false, message: "Öneri üretilemedi, lütfen daha sonra tekrar deneyin" };
  }

  // Güvenlik filtresi isteği ya da yanıtı engellediyse aday dönmez.
  if (data.promptFeedback?.blockReason) return { ok: false, message: BLOCKED };
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) {
    console.error("style advice: empty response", candidate?.finishReason);
    return {
      ok: false,
      message:
        candidate?.finishReason && candidate.finishReason !== "STOP"
          ? BLOCKED
          : "Öneri üretilemedi, lütfen tekrar deneyin",
    };
  }
  return { ok: true, text };
}
