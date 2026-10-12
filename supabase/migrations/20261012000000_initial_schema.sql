-- =============================================================================
-- Akıllı Kuaför Randevu ve Yönetim SaaS — Başlangıç Şeması (Supabase / PG 15+)
-- =============================================================================
-- Bölümler:
--   1. Eklentiler, şemalar, enum tipleri
--   2. Tablolar (kimlik/kiracı, katalog, takvim, müşteri, randevu, finans, bildirim)
--   3. İndeksler
--   4. Yardımcı fonksiyonlar (RLS için)
--   5. Tetikleyiciler
--   6. Görünümler
--   7. RLS politikaları ve yetkiler
--
-- Çok kiracılı (multi-tenant) model: her iş tablosu salon_id taşır. Bileşik
-- yabancı anahtarlar (id, salon_id) bir salonun kaydının başka bir salonun
-- personeline/müşterisine/hizmetine bağlanmasını veritabanı seviyesinde engeller.
-- =============================================================================


-- =============================================================================
-- 1. EKLENTİLER, ŞEMALAR, ENUM TİPLERİ
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- API'ye açık olmayan şema: security definer fonksiyonlar burada durur.
create schema if not exists private;

create type public.member_role as enum ('owner', 'manager', 'receptionist', 'barber');

create type public.appointment_status as enum (
  'pending_payment',  -- kapora bekleniyor, slot geçici olarak tutuluyor
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

create type public.appointment_source as enum ('online', 'walk_in', 'phone', 'staff');
create type public.deposit_type as enum ('none', 'fixed', 'percent');
create type public.payment_kind as enum ('deposit', 'balance', 'refund');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.notification_channel as enum ('whatsapp', 'sms', 'email');

create type public.notification_type as enum (
  'booking_confirmation',
  'reminder_24h',
  'reminder_2h',
  'rescheduled',
  'cancellation'
);

create type public.notification_status as enum ('pending', 'sending', 'sent', 'failed', 'cancelled');


-- =============================================================================
-- 2. TABLOLAR
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 2.1 Kimlik ve kiracı
-- ---------------------------------------------------------------------------

-- auth.users'ın uygulama tarafındaki profili (tetikleyici ile otomatik oluşur).
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text not null default '',
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.salons (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.users (id) on delete restrict,
  name        text not null check (length(trim(name)) > 0),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  phone       text,
  address     text,
  city        text,
  timezone    text not null default 'Europe/Istanbul',
  currency    char(3) not null default 'TRY',

  -- Randevu kuralları (slot algoritması bunları okur)
  slot_interval_minutes       smallint not null default 15 check (slot_interval_minutes between 5 and 120),
  min_booking_notice_minutes  integer  not null default 60 check (min_booking_notice_minutes >= 0),
  max_booking_days_ahead      smallint not null default 60 check (max_booking_days_ahead > 0),
  cancellation_window_hours   smallint not null default 24 check (cancellation_window_hours >= 0),

  -- Kapora / ön ödeme
  deposit_type          public.deposit_type not null default 'none',
  deposit_value         numeric(10,2) not null default 0 check (deposit_value >= 0),
  deposit_hold_minutes  smallint not null default 15 check (deposit_hold_minutes > 0),

  notification_channel  public.notification_channel not null default 'whatsapp',
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint salons_deposit_percent_max check (deposit_type <> 'percent' or deposit_value <= 100)
);

-- Rol tabanlı erişimin kaynağı: kim hangi salonda hangi rolde.
create table public.salon_members (
  salon_id    uuid not null references public.salons (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  role        public.member_role not null,
  created_at  timestamptz not null default now(),
  primary key (salon_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 2.2 Katalog: personel ve hizmetler
-- ---------------------------------------------------------------------------

-- Randevu alınabilen personel. user_id boş olabilir (henüz hesabı olmayan personel).
create table public.barbers (
  id            uuid primary key default gen_random_uuid(),
  salon_id      uuid not null references public.salons (id) on delete cascade,
  user_id       uuid references public.users (id) on delete set null,
  display_name  text not null check (length(trim(display_name)) > 0),
  title         text,
  bio           text,
  avatar_url    text,
  sort_order    smallint not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, salon_id),
  unique (salon_id, user_id)
);

create table public.services (
  id                uuid primary key default gen_random_uuid(),
  salon_id          uuid not null references public.salons (id) on delete cascade,
  name              text not null check (length(trim(name)) > 0),
  category          text,
  description       text,
  duration_minutes  smallint not null check (duration_minutes between 5 and 600),
  price             numeric(10,2) not null check (price >= 0),
  sort_order        smallint not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, salon_id)
);

-- Hangi personel hangi hizmeti veriyor (+ kişiye özel süre/fiyat).
create table public.barber_services (
  barber_id          uuid not null,
  service_id         uuid not null,
  salon_id           uuid not null,
  duration_override  smallint check (duration_override between 5 and 600),
  price_override     numeric(10,2) check (price_override >= 0),
  primary key (barber_id, service_id),
  foreign key (barber_id, salon_id)  references public.barbers (id, salon_id)  on delete cascade,
  foreign key (service_id, salon_id) references public.services (id, salon_id) on delete cascade
);

-- Prim oranları. service_id NULL = personelin varsayılan oranı.
-- Müşterilerin okuyabildiği tablolardan bilinçli olarak ayrı tutuldu.
create table public.barber_commission_rules (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null,
  barber_id   uuid not null,
  service_id  uuid,
  rate        numeric(5,2) not null check (rate between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique nulls not distinct (barber_id, service_id),
  foreign key (barber_id, salon_id)  references public.barbers (id, salon_id)  on delete cascade,
  foreign key (service_id, salon_id) references public.services (id, salon_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- 2.3 Takvim: çalışma saatleri, molalar, izinler
-- ---------------------------------------------------------------------------
-- Saatler salonun yerel saatindedir (salons.timezone). day_of_week: 0 = Pazar.
-- Bir gün için satır yoksa personel o gün çalışmıyor demektir.

create table public.working_hours (
  id           uuid primary key default gen_random_uuid(),
  salon_id     uuid not null,
  barber_id    uuid not null,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  check (start_time < end_time),
  unique (barber_id, day_of_week),
  foreign key (barber_id, salon_id) references public.barbers (id, salon_id) on delete cascade
);

create table public.working_hour_breaks (
  id           uuid primary key default gen_random_uuid(),
  salon_id     uuid not null,
  barber_id    uuid not null,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  label        text,
  check (start_time < end_time),
  foreign key (barber_id, salon_id) references public.barbers (id, salon_id) on delete cascade
);

-- Tarihe özel kapalılık: izin, rapor, resmi tatil. barber_id NULL = tüm salon kapalı.
create table public.time_off (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.salons (id) on delete cascade,
  barber_id   uuid,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text,
  created_at  timestamptz not null default now(),
  check (starts_at < ends_at),
  foreign key (barber_id, salon_id) references public.barbers (id, salon_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- 2.4 Müşteri kartı
-- ---------------------------------------------------------------------------

-- Salona özel müşteri kaydı. user_id boş olabilir (telefonla/elden gelen müşteri).
create table public.customers (
  id                 uuid primary key default gen_random_uuid(),
  salon_id           uuid not null references public.salons (id) on delete cascade,
  user_id            uuid references public.users (id) on delete set null,
  full_name          text not null check (length(trim(full_name)) > 0),
  phone              text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),  -- E.164 (WhatsApp/SMS için)
  email              text,
  birth_date         date,
  allergies          text,
  tags               text[] not null default '{}',
  marketing_consent  boolean not null default false,
  is_blocked         boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, salon_id),
  unique (salon_id, phone),
  unique (salon_id, user_id)
);

-- Personelin müşteri hakkındaki özel notları (müşteri göremez).
create table public.customer_notes (
  id           uuid primary key default gen_random_uuid(),
  salon_id     uuid not null,
  customer_id  uuid not null,
  author_id    uuid references public.users (id) on delete set null,
  note         text not null check (length(trim(note)) > 0),
  is_pinned    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (customer_id, salon_id) references public.customers (id, salon_id) on delete cascade
);

-- 2.5 Randevular (customer_color_records buna referans verdiği için önce tanımlanır)

create table public.appointments (
  id           uuid primary key default gen_random_uuid(),
  salon_id     uuid not null references public.salons (id) on delete cascade,
  barber_id    uuid not null,
  customer_id  uuid not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       public.appointment_status not null default 'confirmed',
  source       public.appointment_source not null default 'online',

  -- appointment_services satırlarından tetikleyici ile hesaplanır
  total_price             numeric(10,2) not null default 0 check (total_price >= 0),
  total_duration_minutes  integer not null default 0 check (total_duration_minutes >= 0),

  deposit_amount    numeric(10,2) not null default 0 check (deposit_amount >= 0),
  hold_expires_at   timestamptz,  -- pending_payment için slot tutma süresi

  customer_note     text,  -- müşterinin yazdığı not; personelin iç notları customer_notes'ta

  -- Tek tıkla iptal/erteleme linkindeki gizli anahtar
  manage_token      text not null unique
                    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),

  rescheduled_from_id  uuid references public.appointments (id) on delete set null,
  cancelled_at         timestamptz,
  cancel_reason        text,
  created_by           uuid references public.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (id, salon_id),
  check (starts_at < ends_at),
  foreign key (barber_id, salon_id)   references public.barbers (id, salon_id)   on delete restrict,
  foreign key (customer_id, salon_id) references public.customers (id, salon_id) on delete restrict,

  -- ÇAKIŞMA ENGELİ: aynı personelin aktif randevuları zaman aralığında kesişemez.
  -- [) aralığı sayesinde 10:00-10:30 ile 10:30-11:00 çakışmaz. Eşzamanlı iki
  -- istek aynı slotu denerse ikincisi 23P01 (exclusion_violation) ile reddedilir.
  constraint appointments_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status not in ('cancelled', 'no_show'))
);

-- Randevudaki hizmet kalemleri. Ad/süre/fiyat o anki değerlerin kopyasıdır;
-- hizmet sonradan değişse de geçmiş kayıt bozulmaz.
create table public.appointment_services (
  id                uuid primary key default gen_random_uuid(),
  salon_id          uuid not null,
  appointment_id    uuid not null,
  service_id        uuid not null,
  service_name      text not null,
  duration_minutes  smallint not null check (duration_minutes > 0),
  price             numeric(10,2) not null check (price >= 0),
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id) on delete cascade,
  foreign key (service_id, salon_id)     references public.services (id, salon_id)     on delete restrict
);

-- Boya/renk formülü geçmişi (müşteri kartının parçası).
create table public.customer_color_records (
  id                  uuid primary key default gen_random_uuid(),
  salon_id            uuid not null,
  customer_id         uuid not null,
  appointment_id      uuid references public.appointments (id) on delete set null,
  barber_id           uuid references public.barbers (id) on delete set null,
  brand               text not null,
  product_line        text,
  color_code          text not null,           -- örn. "7.1", "6/0 + 7/3"
  developer_volume    smallint,                -- oksidan: 10/20/30/40 vol
  mix_ratio           text,                    -- örn. "1:1.5"
  processing_minutes  smallint check (processing_minutes > 0),
  notes               text,
  applied_at          timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  foreign key (customer_id, salon_id) references public.customers (id, salon_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- 2.6 Finans: ödemeler ve prim defteri
-- ---------------------------------------------------------------------------

-- Ödeme sağlayıcısından (iyzico, PayTR, Stripe...) bağımsız kayıt.
-- Yalnızca sunucu tarafı (service role / webhook) yazar.
create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  salon_id             uuid not null,
  appointment_id       uuid not null,
  kind                 public.payment_kind not null,
  status               public.payment_status not null default 'pending',
  amount               numeric(10,2) not null check (amount > 0),
  currency             char(3) not null default 'TRY',
  provider             text not null,           -- 'iyzico', 'paytr', 'stripe', 'cash'...
  provider_payment_id  text,
  provider_payload     jsonb,
  paid_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (provider, provider_payment_id),       -- webhook tekrarlarına karşı idempotency
  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id) on delete restrict
);

-- Randevu "completed" olduğunda tetikleyici ile yazılan prim kayıtları.
-- Oran kayıt anında dondurulur; sonradan değişen oran geçmişi etkilemez.
create table public.barber_earnings (
  id                      uuid primary key default gen_random_uuid(),
  salon_id                uuid not null,
  barber_id               uuid not null,
  appointment_id          uuid not null,
  appointment_service_id  uuid not null unique references public.appointment_services (id) on delete cascade,
  base_amount             numeric(10,2) not null check (base_amount >= 0),
  commission_rate         numeric(5,2) not null check (commission_rate between 0 and 100),
  amount                  numeric(10,2) generated always as (round(base_amount * commission_rate / 100, 2)) stored,
  earned_at               timestamptz not null,
  paid_out_at             timestamptz,           -- prim personele ödendiğinde doldurulur
  created_at              timestamptz not null default now(),
  foreign key (barber_id, salon_id)      references public.barbers (id, salon_id)      on delete restrict,
  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- 2.7 Bildirim kuyruğu (outbox)
-- ---------------------------------------------------------------------------
-- Randevu tetikleyicisi satır ekler; bir worker (pg_cron + Edge Function)
-- status = 'pending' ve scheduled_at <= now() olanları alıp gönderir.

create table public.notifications (
  id                   uuid primary key default gen_random_uuid(),
  salon_id             uuid not null,
  appointment_id       uuid not null,
  customer_id          uuid not null,
  channel              public.notification_channel not null,
  type                 public.notification_type not null,
  status               public.notification_status not null default 'pending',
  scheduled_at         timestamptz not null default now(),
  sent_at              timestamptz,
  attempts             smallint not null default 0,
  provider_message_id  text,
  last_error           text,
  created_at           timestamptz not null default now(),
  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id) on delete cascade,
  foreign key (customer_id, salon_id)    references public.customers (id, salon_id)    on delete cascade
);


-- =============================================================================
-- 3. İNDEKSLER
-- =============================================================================

create index salon_members_user_idx        on public.salon_members (user_id);
create index salons_owner_idx              on public.salons (owner_id);
create index barbers_salon_idx             on public.barbers (salon_id) where is_active;
create index barbers_user_idx              on public.barbers (user_id) where user_id is not null;
create index services_salon_idx            on public.services (salon_id) where is_active;
create index barber_services_service_idx   on public.barber_services (service_id);
create index commission_rules_salon_idx    on public.barber_commission_rules (salon_id);
create index working_hours_salon_idx       on public.working_hours (salon_id);
create index breaks_barber_day_idx         on public.working_hour_breaks (barber_id, day_of_week);
create index time_off_barber_idx           on public.time_off (barber_id, starts_at, ends_at);
create index time_off_salon_idx            on public.time_off (salon_id, starts_at, ends_at);

create index customers_user_idx            on public.customers (user_id) where user_id is not null;
create index customers_salon_name_idx      on public.customers (salon_id, full_name);
create index customer_notes_customer_idx   on public.customer_notes (customer_id, created_at desc);
create index color_records_customer_idx    on public.customer_color_records (customer_id, applied_at desc);

create index appointments_salon_time_idx     on public.appointments (salon_id, starts_at);
create index appointments_barber_time_idx    on public.appointments (barber_id, starts_at);
create index appointments_customer_time_idx  on public.appointments (customer_id, starts_at desc);
create index appointments_hold_idx           on public.appointments (hold_expires_at) where status = 'pending_payment';
create index appointment_services_appt_idx   on public.appointment_services (appointment_id);
create index appointment_services_svc_idx    on public.appointment_services (service_id);

create index payments_appointment_idx      on public.payments (appointment_id);
create index payments_salon_paid_idx       on public.payments (salon_id, paid_at) where status = 'paid';
create index earnings_barber_time_idx      on public.barber_earnings (barber_id, earned_at desc);
create index earnings_salon_time_idx       on public.barber_earnings (salon_id, earned_at desc);
create index earnings_appointment_idx      on public.barber_earnings (appointment_id);

create index notifications_queue_idx       on public.notifications (scheduled_at) where status = 'pending';
create index notifications_appointment_idx on public.notifications (appointment_id);
-- Aynı randevu için aynı tipte tek bir bekleyen bildirim olabilir.
create unique index notifications_pending_uniq
  on public.notifications (appointment_id, type) where status = 'pending';


-- =============================================================================
-- 4. YARDIMCI FONKSİYONLAR (RLS)
-- =============================================================================
-- security definer: salon_members üzerindeki RLS'e takılmadan (ve politika
-- özyinelemesine girmeden) üyelik kontrolü yapar.

create or replace function private.has_salon_role(p_salon_id uuid, p_roles public.member_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.salon_members m
    where m.salon_id = p_salon_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

-- Salonun herhangi bir çalışanı
create or replace function private.is_salon_member(p_salon_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_salon_role(p_salon_id, array['owner', 'manager', 'receptionist', 'barber']::public.member_role[]);
$$;

-- Yönetici: ciro, prim, ayarlar
create or replace function private.is_salon_admin(p_salon_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_salon_role(p_salon_id, array['owner', 'manager']::public.member_role[]);
$$;

-- Tüm salonun takvimini yönetebilenler
create or replace function private.is_salon_frontdesk(p_salon_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_salon_role(p_salon_id, array['owner', 'manager', 'receptionist']::public.member_role[]);
$$;

-- Oturumdaki kullanıcının personel kayıtları
create or replace function private.my_barber_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select b.id from public.barbers b where b.user_id = (select auth.uid());
$$;

-- Oturumdaki kullanıcının müşteri kayıtları
create or replace function private.my_customer_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select c.id from public.customers c where c.user_id = (select auth.uid());
$$;

-- İki kullanıcı aynı salonda çalışıyor mu (ekip arkadaşının profilini görmek için)
create or replace function private.shares_salon_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.salon_members me
    join public.salon_members other on other.salon_id = me.salon_id
    where me.user_id = (select auth.uid())
      and other.user_id = p_user_id
  );
$$;


-- =============================================================================
-- 5. TETİKLEYİCİLER
-- =============================================================================
-- Tetikleyici fonksiyonları security definer çalışır: çağıran kullanıcının RLS
-- yetkisi olmasa da türetilmiş veriler (toplamlar, primler, bildirimler) yazılır.

-- ---------------------------------------------------------------------------
-- 5.1 updated_at
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.users                   for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.salons                  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.barbers                 for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.services                for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.barber_commission_rules for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.customers               for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.customer_notes          for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.appointments            for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.payments                for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5.2 auth.users -> public.users
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5.3 Üyelik otomasyonu
-- ---------------------------------------------------------------------------

-- Salonu oluşturan kişi otomatik olarak 'owner' üyesi olur.
create or replace function private.handle_new_salon()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.salon_members (salon_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (salon_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

create trigger on_salon_created
  after insert on public.salons
  for each row execute function private.handle_new_salon();

-- Personel kaydı bir kullanıcı hesabına bağlandığında 'barber' üyeliği açılır
-- (mevcut owner/manager rolü varsa dokunulmaz).
create or replace function private.handle_barber_user_link()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.user_id is not null then
    insert into public.salon_members (salon_id, user_id, role)
    values (new.salon_id, new.user_id, 'barber')
    on conflict (salon_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_barber_user_linked
  after insert or update of user_id on public.barbers
  for each row execute function private.handle_barber_user_link();

-- ---------------------------------------------------------------------------
-- 5.4 Randevu doğrulama: çalışma saati, mola, izin
-- ---------------------------------------------------------------------------
-- Çakışmayı exclusion constraint garanti eder; bu tetikleyici randevunun
-- personelin müsait olduğu bir zamana denk geldiğini doğrular.
-- Not: gece yarısını aşan randevular (yerel saatle) desteklenmez.
create or replace function private.validate_appointment()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_tz           text;
  v_local_start  timestamp;
  v_local_end    timestamp;
  v_dow          smallint;
begin
  if new.status in ('cancelled', 'no_show') then
    return new;
  end if;

  -- Zamanı/personeli değişmeyen güncellemeler (örn. "tamamlandı" işaretleme)
  -- yeniden doğrulanmaz; çalışma saatleri sonradan değişmiş olabilir.
  if tg_op = 'UPDATE'
     and new.starts_at = old.starts_at
     and new.ends_at = old.ends_at
     and new.barber_id = old.barber_id
     and old.status not in ('cancelled', 'no_show') then
    return new;
  end if;

  select s.timezone into v_tz from public.salons s where s.id = new.salon_id;

  v_local_start := new.starts_at at time zone v_tz;
  v_local_end   := new.ends_at at time zone v_tz;
  v_dow         := extract(dow from v_local_start);

  if v_local_start::date <> v_local_end::date then
    raise exception 'Randevu tek bir gün içinde başlayıp bitmelidir'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1
    from public.working_hours w
    where w.barber_id = new.barber_id
      and w.day_of_week = v_dow
      and w.start_time <= v_local_start::time
      and w.end_time >= v_local_end::time
  ) then
    raise exception 'Randevu personelin çalışma saatleri dışında'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.working_hour_breaks b
    where b.barber_id = new.barber_id
      and b.day_of_week = v_dow
      and b.start_time < v_local_end::time
      and b.end_time > v_local_start::time
  ) then
    raise exception 'Randevu personelin mola saatiyle çakışıyor'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.time_off t
    where t.salon_id = new.salon_id
      and (t.barber_id = new.barber_id or t.barber_id is null)
      and t.starts_at < new.ends_at
      and t.ends_at > new.starts_at
  ) then
    raise exception 'Personel bu tarihte izinli veya salon kapalı'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger validate_appointment
  before insert or update of starts_at, ends_at, barber_id, status on public.appointments
  for each row execute function private.validate_appointment();

-- İptal zaman damgası
create or replace function private.stamp_appointment_cancel()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;
  return new;
end;
$$;

create trigger stamp_appointment_cancel
  before update of status on public.appointments
  for each row execute function private.stamp_appointment_cancel();

-- ---------------------------------------------------------------------------
-- 5.5 Randevu kalemleri: anlık kopya (snapshot) ve toplamlar
-- ---------------------------------------------------------------------------

-- Ad/süre/fiyat verilmediyse hizmetten (varsa personele özel değerden) doldurur.
create or replace function private.fill_appointment_service()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name      text;
  v_duration  smallint;
  v_price     numeric(10,2);
begin
  select s.name,
         coalesce(bs.duration_override, s.duration_minutes),
         coalesce(bs.price_override, s.price)
    into v_name, v_duration, v_price
  from public.services s
  left join public.appointments a
         on a.id = new.appointment_id
  left join public.barber_services bs
         on bs.service_id = s.id and bs.barber_id = a.barber_id
  where s.id = new.service_id;

  new.service_name     := coalesce(new.service_name, v_name);
  new.duration_minutes := coalesce(new.duration_minutes, v_duration);
  new.price            := coalesce(new.price, v_price);
  return new;
end;
$$;

create trigger fill_appointment_service
  before insert on public.appointment_services
  for each row execute function private.fill_appointment_service();

create or replace function private.sync_appointment_totals()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_appointment_id uuid := coalesce(new.appointment_id, old.appointment_id);
begin
  update public.appointments a
  set total_price = t.price,
      total_duration_minutes = t.duration
  from (
    select coalesce(sum(s.price), 0) as price,
           coalesce(sum(s.duration_minutes), 0) as duration
    from public.appointment_services s
    where s.appointment_id = v_appointment_id
  ) t
  where a.id = v_appointment_id;
  return null;
end;
$$;

create trigger sync_appointment_totals
  after insert or update or delete on public.appointment_services
  for each row execute function private.sync_appointment_totals();

-- ---------------------------------------------------------------------------
-- 5.6 Prim defteri
-- ---------------------------------------------------------------------------
-- Randevu 'completed' olunca her kalem için prim yazılır. Oran önceliği:
-- personel+hizmet kuralı > personelin varsayılan kuralı > 0.
-- Tamamlanma geri alınırsa henüz ödenmemiş primler silinir.
create or replace function private.sync_barber_earnings()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    insert into public.barber_earnings
      (salon_id, barber_id, appointment_id, appointment_service_id, base_amount, commission_rate, earned_at)
    select
      new.salon_id,
      new.barber_id,
      new.id,
      aps.id,
      aps.price,
      coalesce(
        (select r.rate from public.barber_commission_rules r
          where r.barber_id = new.barber_id and r.service_id = aps.service_id),
        (select r.rate from public.barber_commission_rules r
          where r.barber_id = new.barber_id and r.service_id is null),
        0
      ),
      new.ends_at
    from public.appointment_services aps
    where aps.appointment_id = new.id
    on conflict (appointment_service_id) do nothing;

  elsif old.status = 'completed' and new.status <> 'completed' then
    delete from public.barber_earnings e
    where e.appointment_id = new.id
      and e.paid_out_at is null;
  end if;

  return null;
end;
$$;

create trigger sync_barber_earnings
  after update of status on public.appointments
  for each row execute function private.sync_barber_earnings();

-- ---------------------------------------------------------------------------
-- 5.7 Kapora: ödeme onayı ve süresi dolan tutmalar
-- ---------------------------------------------------------------------------

-- Kapora 'paid' olduğunda bekleyen randevu onaylanır.
create or replace function private.handle_payment_paid()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'paid'
     and new.kind = 'deposit'
     and (tg_op = 'INSERT' or old.status <> 'paid') then
    update public.appointments a
    set status = 'confirmed',
        hold_expires_at = null
    where a.id = new.appointment_id
      and a.status = 'pending_payment';
  end if;
  return null;
end;
$$;

create trigger on_payment_paid
  after insert or update of status on public.payments
  for each row execute function private.handle_payment_paid();

-- Kaporası süresinde ödenmeyen randevuları iptal edip slotu serbest bırakır.
-- pg_cron ile çalıştırın:
--   select cron.schedule('expire-unpaid', '* * * * *', 'select private.expire_unpaid_appointments()');
create or replace function private.expire_unpaid_appointments()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.appointments
  set status = 'cancelled',
      cancel_reason = 'Kapora süresi doldu'
  where status = 'pending_payment'
    and hold_expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function private.expire_unpaid_appointments() from public;

-- ---------------------------------------------------------------------------
-- 5.8 Bildirim kuyruğu
-- ---------------------------------------------------------------------------
-- Onay    -> onay mesajı + 24 saat ve 2 saat kala hatırlatma
-- Erteleme -> bekleyen hatırlatmalar iptal, yeni saate göre yeniden planlanır
-- İptal / gelmedi -> bekleyen hatırlatmalar iptal (+ iptalde bilgilendirme)
create or replace function private.enqueue_appointment_notifications()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_channel      public.notification_channel;
  v_confirmed    boolean;
  v_rescheduled  boolean;
  v_closed       boolean;
begin
  if tg_op = 'INSERT' then
    v_confirmed   := new.status = 'confirmed';
    v_rescheduled := false;
    v_closed      := false;
  else
    v_confirmed   := new.status = 'confirmed' and old.status <> 'confirmed';
    v_rescheduled := new.status = 'confirmed' and old.status = 'confirmed'
                     and new.starts_at <> old.starts_at;
    v_closed      := new.status in ('cancelled', 'no_show')
                     and old.status not in ('cancelled', 'no_show');
  end if;

  if not (v_confirmed or v_rescheduled or v_closed) then
    return null;
  end if;

  select s.notification_channel into v_channel
  from public.salons s where s.id = new.salon_id;

  if v_rescheduled or v_closed then
    update public.notifications n
    set status = 'cancelled'
    where n.appointment_id = new.id
      and n.status = 'pending';
  end if;

  if v_confirmed then
    insert into public.notifications (salon_id, appointment_id, customer_id, channel, type)
    values (new.salon_id, new.id, new.customer_id, v_channel, 'booking_confirmation')
    on conflict do nothing;
  end if;

  if v_rescheduled then
    insert into public.notifications (salon_id, appointment_id, customer_id, channel, type)
    values (new.salon_id, new.id, new.customer_id, v_channel, 'rescheduled')
    on conflict do nothing;
  end if;

  if v_confirmed or v_rescheduled then
    insert into public.notifications (salon_id, appointment_id, customer_id, channel, type, scheduled_at)
    select new.salon_id, new.id, new.customer_id, v_channel, r.type, r.scheduled_at
    from (values
      ('reminder_24h'::public.notification_type, new.starts_at - interval '24 hours'),
      ('reminder_2h'::public.notification_type,  new.starts_at - interval '2 hours')
    ) as r (type, scheduled_at)
    where r.scheduled_at > now()
    on conflict do nothing;
  end if;

  if v_closed and new.status = 'cancelled' then
    insert into public.notifications (salon_id, appointment_id, customer_id, channel, type)
    values (new.salon_id, new.id, new.customer_id, v_channel, 'cancellation')
    on conflict do nothing;
  end if;

  return null;
end;
$$;

create trigger enqueue_appointment_notifications
  after insert or update of status, starts_at on public.appointments
  for each row execute function private.enqueue_appointment_notifications();


-- =============================================================================
-- 6. GÖRÜNÜMLER
-- =============================================================================

-- Müşteri kartı özeti. security_invoker: sorgulayan kullanıcının RLS'i geçerlidir.
create view public.customer_stats
with (security_invoker = true)
as
select
  c.id       as customer_id,
  c.salon_id,
  count(a.id) filter (where a.status = 'completed')                         as total_visits,
  count(a.id) filter (where a.status = 'no_show')                           as no_show_count,
  count(a.id) filter (where a.status = 'cancelled')                         as cancelled_count,
  coalesce(sum(a.total_price) filter (where a.status = 'completed'), 0)     as total_spent,
  max(a.starts_at) filter (where a.status = 'completed')                    as last_visit_at
from public.customers c
left join public.appointments a on a.customer_id = c.id
group by c.id;


-- =============================================================================
-- 7. RLS POLİTİKALARI VE YETKİLER
-- =============================================================================
-- Roller:
--   owner / manager  -> salonun tamamı (ciro, prim, ayarlar)
--   receptionist     -> tüm takvim ve müşteriler; prim ve ayarlar hariç
--   barber           -> yalnızca kendi randevuları ve kendi primleri
--   müşteri          -> yalnızca kendi randevuları ve ödemeleri
--   anon             -> yalnızca aktif salonların vitrin verisi
-- Online randevu oluşturma, ödeme ve bildirim yazımı service role / security
-- definer RPC üzerinden yapılır; bu yüzden müşteriye doğrudan INSERT yetkisi yok.

alter table public.users                   enable row level security;
alter table public.salons                  enable row level security;
alter table public.salon_members           enable row level security;
alter table public.barbers                 enable row level security;
alter table public.services                enable row level security;
alter table public.barber_services         enable row level security;
alter table public.barber_commission_rules enable row level security;
alter table public.working_hours           enable row level security;
alter table public.working_hour_breaks     enable row level security;
alter table public.time_off                enable row level security;
alter table public.customers               enable row level security;
alter table public.customer_notes          enable row level security;
alter table public.customer_color_records  enable row level security;
alter table public.appointments            enable row level security;
alter table public.appointment_services    enable row level security;
alter table public.payments                enable row level security;
alter table public.barber_earnings         enable row level security;
alter table public.notifications           enable row level security;

-- Yetkiler: anon yalnızca vitrin tablolarını okur; gerisini RLS belirler.
grant usage on schema private to anon, authenticated;

revoke all on all tables in schema public from anon;
grant select on
  public.salons,
  public.barbers,
  public.services,
  public.barber_services,
  public.working_hours,
  public.working_hour_breaks
to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create policy users_select on public.users
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_salon_with(id));

create policy users_update_own on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- salons
-- ---------------------------------------------------------------------------
create policy salons_select on public.salons
  for select to anon, authenticated
  using (is_active or private.is_salon_member(id));

create policy salons_insert on public.salons
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy salons_update on public.salons
  for update to authenticated
  using (private.is_salon_admin(id))
  with check (private.is_salon_admin(id));

create policy salons_delete on public.salons
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- salon_members
-- ---------------------------------------------------------------------------
create policy salon_members_select on public.salon_members
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_salon_admin(salon_id));

-- Yöneticiler ekibi yönetir; 'owner' satırlarına yalnızca owner dokunabilir
-- (manager kendini owner yapamaz).
create policy salon_members_write on public.salon_members
  for all to authenticated
  using (
    private.is_salon_admin(salon_id)
    and (role <> 'owner' or private.has_salon_role(salon_id, array['owner']::public.member_role[]))
  )
  with check (
    private.is_salon_admin(salon_id)
    and (role <> 'owner' or private.has_salon_role(salon_id, array['owner']::public.member_role[]))
  );

-- ---------------------------------------------------------------------------
-- Vitrin tabloları: herkes okur, yönetici yazar
-- ---------------------------------------------------------------------------
create policy barbers_select on public.barbers
  for select to anon, authenticated
  using (is_active or private.is_salon_member(salon_id));

create policy barbers_write on public.barbers
  for all to authenticated
  using (private.is_salon_admin(salon_id))
  with check (private.is_salon_admin(salon_id));

create policy services_select on public.services
  for select to anon, authenticated
  using (is_active or private.is_salon_member(salon_id));

create policy services_write on public.services
  for all to authenticated
  using (private.is_salon_admin(salon_id))
  with check (private.is_salon_admin(salon_id));

create policy barber_services_select on public.barber_services
  for select to anon, authenticated
  using (true);

create policy barber_services_write on public.barber_services
  for all to authenticated
  using (private.is_salon_admin(salon_id))
  with check (private.is_salon_admin(salon_id));

create policy working_hours_select on public.working_hours
  for select to anon, authenticated
  using (true);

create policy working_hours_write on public.working_hours
  for all to authenticated
  using (private.is_salon_admin(salon_id))
  with check (private.is_salon_admin(salon_id));

create policy breaks_select on public.working_hour_breaks
  for select to anon, authenticated
  using (true);

create policy breaks_write on public.working_hour_breaks
  for all to authenticated
  using (private.is_salon_admin(salon_id))
  with check (private.is_salon_admin(salon_id));

-- ---------------------------------------------------------------------------
-- time_off: ekip okur, yönetici yazar
-- ---------------------------------------------------------------------------
create policy time_off_select on public.time_off
  for select to authenticated
  using (private.is_salon_member(salon_id));

create policy time_off_write on public.time_off
  for all to authenticated
  using (private.is_salon_admin(salon_id))
  with check (private.is_salon_admin(salon_id));

-- ---------------------------------------------------------------------------
-- barber_commission_rules: yönetici yönetir, personel kendi oranını görür
-- ---------------------------------------------------------------------------
create policy commission_rules_select on public.barber_commission_rules
  for select to authenticated
  using (
    private.is_salon_admin(salon_id)
    or barber_id in (select private.my_barber_ids())
  );

create policy commission_rules_write on public.barber_commission_rules
  for all to authenticated
  using (private.is_salon_admin(salon_id))
  with check (private.is_salon_admin(salon_id));

-- ---------------------------------------------------------------------------
-- customers + müşteri kartı
-- ---------------------------------------------------------------------------
create policy customers_select on public.customers
  for select to authenticated
  using (private.is_salon_member(salon_id) or user_id = (select auth.uid()));

create policy customers_insert on public.customers
  for insert to authenticated
  with check (private.is_salon_member(salon_id));

create policy customers_update on public.customers
  for update to authenticated
  using (private.is_salon_member(salon_id))
  with check (private.is_salon_member(salon_id));

create policy customers_delete on public.customers
  for delete to authenticated
  using (private.is_salon_admin(salon_id));

-- Notlar ve boya kayıtları salonun iç verisidir; müşteri erişemez.
create policy customer_notes_all on public.customer_notes
  for all to authenticated
  using (private.is_salon_member(salon_id))
  with check (private.is_salon_member(salon_id));

create policy color_records_all on public.customer_color_records
  for all to authenticated
  using (private.is_salon_member(salon_id))
  with check (private.is_salon_member(salon_id));

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create policy appointments_select on public.appointments
  for select to authenticated
  using (
    private.is_salon_frontdesk(salon_id)
    or barber_id in (select private.my_barber_ids())
    or customer_id in (select private.my_customer_ids())
  );

create policy appointments_insert on public.appointments
  for insert to authenticated
  with check (
    private.is_salon_frontdesk(salon_id)
    or barber_id in (select private.my_barber_ids())
  );

create policy appointments_update on public.appointments
  for update to authenticated
  using (
    private.is_salon_frontdesk(salon_id)
    or barber_id in (select private.my_barber_ids())
  )
  with check (
    private.is_salon_frontdesk(salon_id)
    or barber_id in (select private.my_barber_ids())
  );

create policy appointments_delete on public.appointments
  for delete to authenticated
  using (private.is_salon_admin(salon_id));

-- ---------------------------------------------------------------------------
-- appointment_services: görünürlük randevudan miras alınır
-- (alt sorgu appointments üzerindeki RLS'e tabidir)
-- ---------------------------------------------------------------------------
create policy appointment_services_select on public.appointment_services
  for select to authenticated
  using (
    exists (select 1 from public.appointments a where a.id = appointment_id)
  );

create policy appointment_services_write on public.appointment_services
  for all to authenticated
  using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and (private.is_salon_frontdesk(a.salon_id) or a.barber_id in (select private.my_barber_ids()))
    )
  )
  with check (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and (private.is_salon_frontdesk(a.salon_id) or a.barber_id in (select private.my_barber_ids()))
    )
  );

-- ---------------------------------------------------------------------------
-- payments: salt okunur (yazma yalnızca service role)
-- ---------------------------------------------------------------------------
create policy payments_select on public.payments
  for select to authenticated
  using (
    private.is_salon_frontdesk(salon_id)
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and a.customer_id in (select private.my_customer_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- barber_earnings: yönetici hepsini, personel yalnızca kendininkini görür
-- ---------------------------------------------------------------------------
create policy earnings_select on public.barber_earnings
  for select to authenticated
  using (
    private.is_salon_admin(salon_id)
    or barber_id in (select private.my_barber_ids())
  );

-- Yönetici primi "ödendi" olarak işaretleyebilir.
create policy earnings_update on public.barber_earnings
  for update to authenticated
  using (private.is_salon_admin(salon_id))
  with check (private.is_salon_admin(salon_id));

-- ---------------------------------------------------------------------------
-- notifications: yönetici/resepsiyon izler (yazma yalnızca service role)
-- ---------------------------------------------------------------------------
create policy notifications_select on public.notifications
  for select to authenticated
  using (private.is_salon_frontdesk(salon_id));
