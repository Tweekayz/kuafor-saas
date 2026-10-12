-- =============================================================================
-- Modül 5 — Platform yönetimi (süper yönetici): paket, domain onayı, istatistik
-- =============================================================================
--   1. salons.plan, salons.custom_domain_status
--   2. Platform alanlarının koruması: salon sahibi kendi paketini, dondurulma
--      durumunu ya da domain onayını değiştiremez
--   3. public.get_platform_stats -> platform geneli sayılar (yalnızca service role)
--
-- Süper yönetici paneli (/supervisor) veritabanına service role ile erişir; kimin
-- süper yönetici olduğu uygulamada SUPERVISOR_EMAILS ortam değişkeniyle belirlenir.
-- Dosya yeniden çalıştırılabilir (idempotent) yazılmıştır ve
-- 20261013000000_business_modules.sql uygulanmamış olsa da tek başına çalışır.
-- =============================================================================


-- =============================================================================
-- 1. SÜTUNLAR
-- =============================================================================

-- (business_modules ile aynı tanım; o dosya çalıştırılmadıysa burada oluşur.)
alter table public.salons
  add column if not exists custom_domain text;

create unique index if not exists salons_custom_domain_key
  on public.salons (custom_domain) where custom_domain is not null;

-- Domain talebinin durumu. NULL = alan adı girilmemiş.
--   pending  -> salon sahibi girdi, süper yönetici onayı bekleniyor
--   active   -> onaylandı ve barındırma tarafına eklendi; istekler yönlendirilir
--   rejected -> reddedildi ya da kaldırıldı
alter table public.salons
  add column if not exists custom_domain_status text
    check (custom_domain_status in ('pending', 'active', 'rejected'));

alter table public.salons
  add column if not exists plan text not null default 'starter'
    check (plan in ('starter', 'professional', 'premium'));

-- Bu güncellemeden önce girilmiş alan adları onay kuyruğuna alınır.
update public.salons
set custom_domain_status = 'pending'
where custom_domain is not null
  and custom_domain_status is null;


-- =============================================================================
-- 2. PLATFORM ALANLARININ KORUMASI
-- =============================================================================
-- salons_update politikası yöneticiye satırın tamamını güncelleme izni verir.
-- Bu tetikleyiciler, API üzerinden gelen (rolü 'authenticated' olan) isteklerde
-- platforma ait alanları sabitler:
--   * plan ve is_active değiştirilemez
--   * custom_domain değişirse durum 'pending' olur; kimse kendini 'active' yapamaz
-- Service role (süper yönetici paneli) ve SQL Editor bu kısıtın dışındadır.
create or replace function private.guard_salon_platform_fields()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.plan := 'starter';
      new.is_active := true;
      new.custom_domain_status :=
        case when new.custom_domain is null then null else 'pending' end;
    else
      new.plan := old.plan;
      new.is_active := old.is_active;
      if new.custom_domain is distinct from old.custom_domain then
        new.custom_domain_status :=
          case when new.custom_domain is null then null else 'pending' end;
      else
        new.custom_domain_status := old.custom_domain_status;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_salon_platform_fields on public.salons;
create trigger guard_salon_platform_fields
  before insert or update on public.salons
  for each row execute function private.guard_salon_platform_fields();


-- =============================================================================
-- 3. PLATFORM İSTATİSTİKLERİ
-- =============================================================================
-- p_from / p_to: dönemin başı (dahil) ve sonu (hariç).
-- Ciro = dönemde başlayan 'completed' randevuların toplamı.
create or replace function public.get_platform_stats(
  p_from  timestamptz,
  p_to    timestamptz
)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'salons_total',   (select count(*) from public.salons),
    'salons_active',  (select count(*) from public.salons where is_active),
    'salons_new',     (select count(*) from public.salons
                        where created_at >= p_from and created_at < p_to),
    'plans', (
      select coalesce(jsonb_object_agg(t.plan, t.n), '{}'::jsonb)
      from (select s.plan, count(*) as n from public.salons s group by s.plan) t
    ),
    'appointments_created', (
      select count(*) from public.appointments
      where created_at >= p_from and created_at < p_to
    ),
    'appointments_completed', (
      select count(*) from public.appointments
      where status = 'completed' and starts_at >= p_from and starts_at < p_to
    ),
    'revenue', (
      select coalesce(sum(total_price), 0) from public.appointments
      where status = 'completed' and starts_at >= p_from and starts_at < p_to
    ),
    'customers_total', (select count(*) from public.customers),
    'domains_pending', (
      select count(*) from public.salons where custom_domain_status = 'pending'
    )
  );
$$;

-- Tüm salonların verisini özetler: yalnızca service role çağırabilir.
revoke execute on function public.get_platform_stats(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_platform_stats(timestamptz, timestamptz)
  to service_role;
