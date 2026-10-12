-- =============================================================================
-- Modül 4 — İşletme modülleri: kasa, giderler, stok ve otomasyon ayarları
-- =============================================================================
--   1. Ödeme yöntemi      -> appointments.payment_method (nakit / kart / havale)
--   2. Giderler           -> public.expenses
--   3. Stok               -> public.products, public.product_movements,
--                            public.adjust_product_stock
--   4. Otomasyon ayarları -> salons.* şablon ve anahtar sütunları,
--                            'review_request' bildirim tipi ve tetikleyicileri,
--                            salons.custom_domain (salonun kendi alan adı)
--
-- Dosya yeniden çalıştırılabilir (idempotent) yazılmıştır. Supabase SQL Editor'e
-- tamamı yapıştırılıp çalıştırılabilir. Uygulama bu güncelleme yapılmadan da
-- çalışır; ilgili panel sayfaları "veritabanı güncellemesi gerekli" uyarısı verir.
-- =============================================================================


-- =============================================================================
-- 1. ÖDEME YÖNTEMİ
-- =============================================================================
-- Randevu tamamlanırken tahsilatın nasıl yapıldığı. NULL = belirtilmedi.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method'
                 and typnamespace = 'public'::regnamespace) then
    create type public.payment_method as enum ('cash', 'card', 'transfer');
  end if;
end
$$;

alter table public.appointments
  add column if not exists payment_method public.payment_method;


-- =============================================================================
-- 2. GİDERLER
-- =============================================================================
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  salon_id     uuid not null references public.salons (id) on delete cascade,
  category     text not null default 'Diğer' check (length(trim(category)) > 0),
  description  text,
  amount       numeric(10,2) not null check (amount > 0),
  spent_on     date not null default current_date,  -- salonun yerel takvim günü
  created_by   uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists expenses_salon_date_idx on public.expenses (salon_id, spent_on desc);

alter table public.expenses enable row level security;
revoke all on public.expenses from anon;
grant select, insert, update, delete on public.expenses to authenticated;

-- Giderler finans verisidir: yalnızca sahip ve yönetici.
drop policy if exists expenses_all on public.expenses;
create policy expenses_all on public.expenses
  for all to authenticated
  using (private.is_salon_admin(salon_id))
  with check (private.is_salon_admin(salon_id));


-- =============================================================================
-- 3. STOK
-- =============================================================================
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references public.salons (id) on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  category        text,
  unit            text not null default 'adet',
  quantity        numeric(10,2) not null default 0 check (quantity >= 0),
  critical_level  numeric(10,2) not null default 0 check (critical_level >= 0),
  purchase_price  numeric(10,2) check (purchase_price >= 0),
  sale_price      numeric(10,2) check (sale_price >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, salon_id)
);

-- Her stok değişikliğinin kaydı (giriş, kullanım, satış, sayım düzeltmesi).
create table if not exists public.product_movements (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null,
  product_id  uuid not null,
  delta       numeric(10,2) not null check (delta <> 0),
  reason      text not null check (reason in ('purchase', 'usage', 'sale', 'adjustment')),
  note        text,
  created_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  foreign key (product_id, salon_id) references public.products (id, salon_id) on delete cascade
);

create index if not exists products_salon_idx on public.products (salon_id, name);
create index if not exists product_movements_product_idx
  on public.product_movements (product_id, created_at desc);

drop trigger if exists set_updated_at on public.products;
create trigger set_updated_at before update on public.products
  for each row execute function private.set_updated_at();

alter table public.products enable row level security;
alter table public.product_movements enable row level security;
revoke all on public.products, public.product_movements from anon;
grant select, insert, update, delete on public.products to authenticated;
grant select on public.product_movements to authenticated;

-- Ekip stoğu görür; ürün kartını yönetici düzenler.
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated
  using (private.is_salon_member(salon_id));

drop policy if exists products_write on public.products;
create policy products_write on public.products
  for all to authenticated
  using (private.is_salon_admin(salon_id))
  with check (private.is_salon_admin(salon_id));

-- Hareketler salt okunur; yazma yalnızca adjust_product_stock üzerinden.
drop policy if exists product_movements_select on public.product_movements;
create policy product_movements_select on public.product_movements
  for select to authenticated
  using (private.is_salon_member(salon_id));

-- Stok miktarını değiştirir ve hareketi aynı işlemde kaydeder. Ön büro (sahip,
-- yönetici, resepsiyon) çağırabilir. Stok eksiye düşemez.
-- Hata kodları ("details"): NOT_FOUND, FORBIDDEN, INVALID_INPUT, INSUFFICIENT_STOCK
create or replace function public.adjust_product_stock(
  p_product_id  uuid,
  p_delta       numeric,
  p_reason      text,
  p_note        text default null
)
returns numeric
language plpgsql security definer set search_path = ''
as $$
declare
  v_product  public.products%rowtype;
begin
  select * into v_product
  from public.products p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception 'Ürün bulunamadı'
      using errcode = 'P0001', detail = 'NOT_FOUND';
  end if;

  if not private.is_salon_frontdesk(v_product.salon_id) then
    raise exception 'Bu işlem için yetkiniz yok'
      using errcode = 'P0001', detail = 'FORBIDDEN';
  end if;

  if p_delta is null or p_delta = 0
     or p_reason is null
     or p_reason not in ('purchase', 'usage', 'sale', 'adjustment') then
    raise exception 'Geçersiz stok hareketi'
      using errcode = 'P0001', detail = 'INVALID_INPUT';
  end if;

  if v_product.quantity + p_delta < 0 then
    raise exception 'Stokta yeterli ürün yok'
      using errcode = 'P0001', detail = 'INSUFFICIENT_STOCK';
  end if;

  update public.products p
  set quantity = p.quantity + p_delta
  where p.id = v_product.id;

  insert into public.product_movements (salon_id, product_id, delta, reason, note, created_by)
  values (
    v_product.salon_id,
    v_product.id,
    p_delta,
    p_reason,
    nullif(trim(coalesce(p_note, '')), ''),
    auth.uid()
  );

  return v_product.quantity + p_delta;
end;
$$;

revoke execute on function public.adjust_product_stock(uuid, numeric, text, text) from public, anon;
grant  execute on function public.adjust_product_stock(uuid, numeric, text, text) to authenticated, service_role;


-- =============================================================================
-- 4. OTOMASYON AYARLARI
-- =============================================================================
-- Şablonlar NULL ise uygulamanın varsayılan metni kullanılır. Mesajları gönderen
-- worker (SMS / WhatsApp sağlayıcısı) bu sürümde yoktur; bildirimler kuyruğa
-- (public.notifications) yazılır ve gönderilmeyi bekler.
alter table public.salons
  add column if not exists reminders_enabled       boolean not null default true,
  add column if not exists confirmation_template   text,
  add column if not exists reminder_template       text,
  add column if not exists review_request_enabled  boolean not null default false,
  add column if not exists review_template         text,
  add column if not exists review_url              text;

-- Salonun kendi alan adı (örn. randevu.salonum.com). Küçük harf, protokolsüz.
-- src/proxy.ts bu alan adından gelen isteği salonun randevu sayfasına yönlendirir.
alter table public.salons
  add column if not exists custom_domain text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'salons_custom_domain_format') then
    alter table public.salons
      add constraint salons_custom_domain_format check (
        custom_domain is null
        or custom_domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
      );
  end if;
end
$$;

create unique index if not exists salons_custom_domain_key
  on public.salons (custom_domain) where custom_domain is not null;

alter type public.notification_type add value if not exists 'review_request';

-- Hatırlatmalar kapalıysa kuyruğa giren hatırlatma satırı iptal olarak yazılır.
-- (Onay, erteleme ve iptal bildirimleri bu ayardan etkilenmez.)
create or replace function private.gate_notification()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.type::text in ('reminder_24h', 'reminder_2h')
     and not coalesce(
       (select s.reminders_enabled from public.salons s where s.id = new.salon_id),
       true
     ) then
    new.status := 'cancelled';
  end if;
  return new;
end;
$$;

drop trigger if exists gate_notification on public.notifications;
create trigger gate_notification
  before insert on public.notifications
  for each row execute function private.gate_notification();

-- Randevu tamamlandığında (ayar açıksa) 2 saat sonrası için yorum isteği
-- kuyruğa girer; tamamlanma geri alınırsa bekleyen istek iptal edilir.
create or replace function private.enqueue_review_request()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_enabled  boolean;
  v_channel  public.notification_channel;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    select s.review_request_enabled, s.notification_channel
      into v_enabled, v_channel
    from public.salons s
    where s.id = new.salon_id;

    if coalesce(v_enabled, false) then
      insert into public.notifications
        (salon_id, appointment_id, customer_id, channel, type, scheduled_at)
      values (
        new.salon_id, new.id, new.customer_id, v_channel,
        'review_request'::public.notification_type,
        now() + interval '2 hours'
      )
      on conflict do nothing;
    end if;

  elsif old.status = 'completed' and new.status <> 'completed' then
    update public.notifications n
    set status = 'cancelled'
    where n.appointment_id = new.id
      and n.type::text = 'review_request'
      and n.status = 'pending';
  end if;

  return null;
end;
$$;

drop trigger if exists enqueue_review_request on public.appointments;
create trigger enqueue_review_request
  after update of status on public.appointments
  for each row execute function private.enqueue_review_request();
