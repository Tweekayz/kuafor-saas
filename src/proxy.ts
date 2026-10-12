import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 1) Salona özel adresler: "<slug>.<kök alan adı>" ya da salonun kendi alan adı
//    ile gelen ana sayfa isteği, adres çubuğu değişmeden o salonun randevu
//    sayfasına (/randevu/<slug>) yönlendirilir (rewrite).
// 2) Supabase oturumunu tazeler. Server Component'ler çerez yazamadığı için
//    süresi dolan erişim anahtarı burada yenilenip yanıta yazılır.
// Yetkilendirme burada yapılmaz; her sayfa ve Server Action kendi kontrolünü yapar.

/** Uygulamanın kök alan adı, örn. "saasdomain.com". Tanımsızsa subdomain eşleme kapalıdır. */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.toLowerCase();
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const DOMAIN_CACHE_MS = 5 * 60_000;

// En iyi çaba önbelleği: sunucu örneği yaşadığı sürece tekrar sorgulamayı azaltır.
const domainCache = new Map<string, { slug: string | null; expires: number }>();

async function slugForCustomDomain(host: string): Promise<string | null> {
  const cached = domainCache.get(host);
  if (cached && cached.expires > Date.now()) return cached.slug;

  let slug: string | null = null;
  try {
    const url = new URL("/rest/v1/salons", process.env.NEXT_PUBLIC_SUPABASE_URL);
    url.searchParams.set("select", "slug");
    url.searchParams.set("custom_domain", `eq.${host}`);
    url.searchParams.set("is_active", "eq.true");
    url.searchParams.set("limit", "1");
    const response = await fetch(url, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    });
    // custom_domain sütunu henüz yoksa (güncelleme uygulanmadıysa) 4xx döner.
    if (response.ok) {
      const rows = (await response.json()) as { slug: string }[];
      slug = rows[0]?.slug ?? null;
    }
  } catch {
    slug = null;
  }

  domainCache.set(host, { slug, expires: Date.now() + DOMAIN_CACHE_MS });
  return slug;
}

/** İstek bir salonun kendi adresinden geliyorsa o salonun slug'ı, değilse null. */
async function tenantSlug(request: NextRequest): Promise<string | null> {
  const host = (request.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  if (!host || host === "localhost" || /^[\d.]+$/.test(host)) return null;

  // Yerel deneme: http://<slug>.localhost:3000
  if (host.endsWith(".localhost")) {
    const slug = host.slice(0, -".localhost".length);
    return SLUG_RE.test(slug) ? slug : null;
  }

  // Uygulamanın kendi adresleri
  if (host.endsWith(".vercel.app")) return null;
  if (ROOT_DOMAIN) {
    if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) return null;
    if (host.endsWith(`.${ROOT_DOMAIN}`)) {
      const slug = host.slice(0, -(ROOT_DOMAIN.length + 1));
      return SLUG_RE.test(slug) ? slug : null;
    }
  }

  return HOST_RE.test(host) ? slugForCustomDomain(host) : null;
}

export async function proxy(request: NextRequest) {
  const slug = request.nextUrl.pathname === "/" ? await tenantSlug(request) : null;

  const respond = () => {
    if (!slug) return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = `/randevu/${slug}`;
    return NextResponse.rewrite(url, { request });
  };

  // Oturum çerezi yoksa (kamuya açık sayfaların ziyaretçileri) ağ çağrısı yapma.
  if (!request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"))) {
    return respond();
  }

  let response = respond();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = respond();
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
