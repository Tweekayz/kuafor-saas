import "server-only";

// Barındırma (Vercel) proje alan adları. Yalnızca süper yönetici işlemlerinden
// çağrılır. Gerekli ortam değişkenleri: VERCEL_AUTH_TOKEN, VERCEL_PROJECT_ID;
// proje bir takıma aitse ayrıca VERCEL_TEAM_ID.

const API = "https://api.vercel.com";

export type DomainResult =
  | { ok: true; verified: boolean; note?: string }
  | { ok: false; message: string };

export function isVercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_AUTH_TOKEN && process.env.VERCEL_PROJECT_ID);
}

async function call(method: string, path: string, body?: unknown): Promise<Response> {
  const url = new URL(path, API);
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set("teamId", process.env.VERCEL_TEAM_ID);
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
}

type VercelError = { error?: { code?: string; message?: string } };

/** Alan adını projeye ekler. Zaten bu projede ekliyse başarılı sayılır. */
export async function addProjectDomain(name: string): Promise<DomainResult> {
  if (!isVercelConfigured()) {
    return { ok: false, message: "VERCEL_AUTH_TOKEN ve VERCEL_PROJECT_ID tanımlı değil" };
  }
  const project = encodeURIComponent(process.env.VERCEL_PROJECT_ID!);

  try {
    const response = await call("POST", `/v10/projects/${project}/domains`, { name });
    const data = (await response.json().catch(() => ({}))) as VercelError & {
      verified?: boolean;
    };

    if (response.ok) {
      return {
        ok: true,
        verified: data.verified !== false,
        note:
          data.verified === false
            ? "Alan adı eklendi ancak sahiplik doğrulaması bekliyor; barındırma panelinden doğrulama kaydını kontrol edin."
            : undefined,
      };
    }

    // Alan adı bu projede zaten varsa işlem tekrarlanabilir olsun.
    if (response.status === 409 || data.error?.code === "domain_already_in_use") {
      const existing = await call(
        "GET",
        `/v9/projects/${project}/domains/${encodeURIComponent(name)}`,
      );
      if (existing.ok) return { ok: true, verified: true, note: "Alan adı projede zaten kayıtlıydı." };
      return {
        ok: false,
        message: "Bu alan adı başka bir projede ya da hesapta kullanılıyor",
      };
    }

    console.error("vercel addProjectDomain failed", response.status, data.error);
    return {
      ok: false,
      message: data.error?.message ?? `Barındırma servisi hata döndürdü (${response.status})`,
    };
  } catch (error) {
    console.error("vercel addProjectDomain failed", error);
    return { ok: false, message: "Barındırma servisine ulaşılamadı" };
  }
}

/** Alan adını projeden kaldırır. Projede yoksa başarılı sayılır. */
export async function removeProjectDomain(name: string): Promise<DomainResult> {
  if (!isVercelConfigured()) {
    return { ok: false, message: "VERCEL_AUTH_TOKEN ve VERCEL_PROJECT_ID tanımlı değil" };
  }
  const project = encodeURIComponent(process.env.VERCEL_PROJECT_ID!);

  try {
    const response = await call(
      "DELETE",
      `/v9/projects/${project}/domains/${encodeURIComponent(name)}`,
    );
    if (response.ok || response.status === 404) return { ok: true, verified: false };

    const data = (await response.json().catch(() => ({}))) as VercelError;
    console.error("vercel removeProjectDomain failed", response.status, data.error);
    return {
      ok: false,
      message: data.error?.message ?? `Barındırma servisi hata döndürdü (${response.status})`,
    };
  } catch (error) {
    console.error("vercel removeProjectDomain failed", error);
    return { ok: false, message: "Barındırma servisine ulaşılamadı" };
  }
}
