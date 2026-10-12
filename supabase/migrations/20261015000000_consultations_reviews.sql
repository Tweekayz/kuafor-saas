-- =============================================================================
-- Modül 6 — Görsel danışma talepleri, müşteri değerlendirmeleri ve dosya depolama
-- =============================================================================
--   1. public.consultation_requests -> müşterinin yüklediği görseller, notu,
--                                      yapay zekâ önerisi ve personel yanıtı
--   2. public.reviews               -> 1-5 yıldız, yorum, fotoğraf, salon yanıtı
--   3. public.get_salon_rating      -> vitrin için ortalama puan
--   4. Storage: 'consultations' (kapalı) ve 'reviews' (herkese açık) kovaları
--
-- Yazma modeli: müşteriler hesapsızdır; kayıtları ve dosya yükleme izinlerini
-- sunucu, randevunun gizli bağlantısını (appointments.manage_token) doğruladıktan
-- sonra service role ile oluşturur. Bu yüzden anon/authenticated rollerine INSERT
-- yetkisi verilmez. Dosya yeniden çalıştırılabilir (idempotent) yazılmıştır.
-- =============================================================================


-- =============================================================================
-- 1. GÖRSEL DANIŞMA TALEPLERİ
-- =============================================================================
create table if not exists public.consultation_requests (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references public.salons (id) on delete cascade,
  appointment_id  uuid not null,
  customer_id     uuid not null,
  barber_id       uuid references public.barbers (id) on delete set null,

  -- 'ai'    -> yapay zekâ stil önerisi istendi (ai_notes dolar)
  -- 'staff' -> personelden yorum / fiyat tahmini istendi (staff_reply dolar)
  kind            text not null check (kind in ('ai', 'staff')),
  customer_note   text,
  images          text[] not null default '{}',   -- 'consultations' kovasındaki yollar

  ai_notes        text,
  staff_reply     text,
  price_estimate  numeric(10,2) check (price_estimate >= 0),
  status          text not null default 'open' check (status in ('open', 'answered')),
  replied_by      uuid references public.users (id) on delete set null,
  replied_at      timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id) on delete cascade,
  foreign key (customer_id, salon_id)    references public.customers (id, salon_id)    on delete cascade
);

create index if not exists consultation_requests_salon_idx
  on public.consultation_requests (salon_id, created_at desc);
create index if not exists consultation_requests_appointment_idx
  on public.consultation_requests (appointment_id);

drop trigger if exists set_updated_at on public.consultation_requests;
create trigger set_updated_at before update on public.consultation_requests
  for each row execute function private.set_updated_at();

alter table public.consultation_requests enable row level security;

-- Varsayılan yetkileri kaldır; personel yalnızca okur ve yanıt alanlarını yazar.
revoke all on public.consultation_requests from anon, authenticated;
grant select on public.consultation_requests to authenticated;
grant update (staff_reply, price_estimate, status, replied_by, replied_at)
  on public.consultation_requests to authenticated;

-- Ön büro tüm salonun taleplerini, personel kendi randevularına gelenleri görür.
drop policy if exists consultation_requests_select on public.consultation_requests;
create policy consultation_requests_select on public.consultation_requests
  for select to authenticated
  using (
    private.is_salon_frontdesk(salon_id)
    or barber_id in (select private.my_barber_ids())
  );

drop policy if exists consultation_requests_update on public.consultation_requests;
create policy consultation_requests_update on public.consultation_requests
  for update to authenticated
  using (
    private.is_salon_frontdesk(salon_id)
    or barber_id in (select private.my_barber_ids())
  )
  with check (
    private.is_salon_frontdesk(salon_id)
    or barber_id in (select private.my_barber_ids())
  );


-- =============================================================================
-- 2. DEĞERLENDİRMELER
-- =============================================================================
-- Her randevu için en fazla bir değerlendirme. author_name yazıldığı andaki
-- görünen addır ("Ayşe K."); vitrinde müşterinin tam adı ve telefonu gösterilmez.
create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references public.salons (id) on delete cascade,
  appointment_id  uuid not null unique,
  customer_id     uuid not null,
  barber_id       uuid references public.barbers (id) on delete set null,

  author_name     text not null,
  rating          smallint not null check (rating between 1 and 5),        -- salon / hizmet
  staff_rating    smallint check (staff_rating between 1 and 5),           -- personel
  comment         text,
  photos          text[] not null default '{}',   -- 'reviews' kovasındaki yollar

  is_approved     boolean not null default false,  -- vitrinde yayınlanır
  is_featured     boolean not null default false,  -- vitrinde öne çıkar
  reply           text,
  replied_at      timestamptz,

  created_at      timestamptz not null default now(),

  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id) on delete cascade,
  foreign key (customer_id, salon_id)    references public.customers (id, salon_id)    on delete cascade
);

create index if not exists reviews_salon_idx on public.reviews (salon_id, created_at desc);
create index if not exists reviews_salon_public_idx
  on public.reviews (salon_id, is_featured desc, created_at desc) where is_approved;

alter table public.reviews enable row level security;

revoke all on public.reviews from anon, authenticated;
-- Ziyaretçi yalnızca vitrin sütunlarını okuyabilir (müşteri / randevu kimliği yok).
grant select (id, salon_id, barber_id, author_name, rating, staff_rating, comment, photos,
              is_featured, reply, replied_at, created_at)
  on public.reviews to anon;
grant select on public.reviews to authenticated;
grant update (is_approved, is_featured, reply, replied_at) on public.reviews to authenticated;

-- Onaylı yorumlar herkese açık; salonun yöneticisi hepsini görür.
drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews
  for select to anon, authenticated
  using (is_approved or private.is_salon_admin(salon_id));

drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews
  for update to authenticated
  using (private.is_salon_admin(salon_id))
  with check (private.is_salon_admin(salon_id));


-- =============================================================================
-- 3. ORTALAMA PUAN
-- =============================================================================
-- Ortalama, onay durumundan bağımsız olarak salonun TÜM değerlendirmelerinden
-- hesaplanır: yalnızca beğenilen yorumları onaylayarak puan yükseltilemez.
create or replace function public.get_salon_rating(p_salon_id uuid)
returns table (average numeric, total bigint)
language sql stable security definer set search_path = ''
as $$
  select round(avg(r.rating), 1), count(*)
  from public.reviews r
  where r.salon_id = p_salon_id;
$$;

revoke execute on function public.get_salon_rating(uuid) from public;
grant  execute on function public.get_salon_rating(uuid) to anon, authenticated, service_role;


-- =============================================================================
-- 4. DOSYA DEPOLAMA
-- =============================================================================
-- consultations: KAPALI. Müşterinin yüz / saç / tırnak fotoğrafları kişisel
--   veridir; yalnızca sunucu (service role) okur ve personele kısa ömürlü
--   imzalı bağlantı üretir.
-- reviews: herkese açık okunur (onaylanan yorumların fotoğrafları vitrinde).
-- İki kovada da en fazla 5 MB, yalnızca JPEG / PNG / WebP.
--
-- storage.objects üzerinde anon / authenticated için politika TANIMLANMAZ:
-- RLS varsayılanı "reddet" olduğundan kimse doğrudan yükleyemez, listeleyemez,
-- silemez. Yüklemeler sunucunun randevuya özel ürettiği tek kullanımlık imzalı
-- yükleme bağlantısıyla yapılır.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('consultations', 'consultations', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('reviews',       'reviews',       true,  5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
