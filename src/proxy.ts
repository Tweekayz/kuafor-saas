import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Supabase oturumunu tazeler. Server Component'ler çerez yazamadığı için süresi
// dolan erişim anahtarı burada yenilenip yanıta yazılır. Yetkilendirme burada
// yapılmaz; her sayfa ve Server Action kendi kontrolünü yapar.
export async function proxy(request: NextRequest) {
  // Oturum çerezi yoksa (kamuya açık sayfaların ziyaretçileri) ağ çağrısı yapma.
  if (!request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
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
