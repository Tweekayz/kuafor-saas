-- =============================================================================
-- Modül 2 — Akıllı slot hesaplama ve atomik randevu oluşturma
-- =============================================================================
--   public.get_available_slots  -> bir gün için boş başlangıç saatleri
--   public.book_appointment     -> slotu doğrular, müşteriyi bulur/oluşturur,
--                                  kaporayı hesaplar, randevuyu tek işlemde yazar
--
-- İkisi de security definer: çağıran kişi appointments / time_off tablolarını
-- okuyamasa da doğru sonucu alır; dışarıya yalnızca boş saatler sızar.
-- =============================================================================


-- =============================================================================
-- get_available_slots
-- =============================================================================
-- p_service_ids : seçilen hizmetler (örn. saç kesimi + sakal). Süre, personele
--                 özel süre varsa o, yoksa hizmetin standart süresi toplanarak
--                 bulunur.
-- p_date        : salonun yerel takvim günü.
-- p_barber_id   : NULL ise hizmetlerin tamamını verebilen tüm personel döner
--                 ("fark etmez" seçeneği).
--
-- Bir slot şu koşulların hepsini sağlıyorsa döner:
--   * personelin o günkü çalışma saatleri içinde başlar ve biter
--   * salonun slot aralığına (slot_interval_minutes) hizalıdır
--   * en erken rezervasyon süresinden (min_booking_notice_minutes) sonradır
--   * mola, izin/tatil ve mevcut randevularla kesişmez
-- Kapora süresi dolmuş pending_payment randevular slotu tutmaz.
create or replace function public.get_available_slots(
  p_salon_id     uuid,
  p_service_ids  uuid[],
  p_date         date,
  p_barber_id    uuid default null
)
returns table (barber_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with salon as (
    select s.id, s.timezone, s.slot_interval_minutes, s.min_booking_notice_minutes
    from public.salons s
    where s.id = p_salon_id
      and s.is_active
      and p_date between (now() at time zone s.timezone)::date
                     and (now() at time zone s.timezone)::date + s.max_booking_days_ahead
  ),
  requested as (
    select distinct u.service_id
    from unnest(p_service_ids) as u (service_id)
  ),
  -- İstenen hizmetlerin TAMAMINI verebilen personel ve toplam süre
  candidates as (
    select b.id as barber_id,
           sum(coalesce(bs.duration_override, sv.duration_minutes))::int as duration_minutes
    from public.barbers b
    join salon                     on salon.id = b.salon_id
    join public.barber_services bs on bs.barber_id = b.id
    join public.services sv        on sv.id = bs.service_id and sv.is_active
    join requested r               on r.service_id = sv.id
    where b.is_active
      and (p_barber_id is null or b.id = p_barber_id)
    group by b.id
    having count(*) = (select count(*) from requested)
  ),
  -- Çalışma saatleri içinde, hizmet bitişi mesaiyi aşmayacak şekilde ızgara
  grid as (
    select c.barber_id,
           g.local_start,
           g.local_start + make_interval(mins => c.duration_minutes) as local_end
    from candidates c
    cross join salon
    join public.working_hours w
      on w.barber_id = c.barber_id
     and w.day_of_week = extract(dow from p_date)::int
    cross join lateral generate_series(
      p_date + w.start_time,
      p_date + w.end_time - make_interval(mins => c.duration_minutes),
      make_interval(mins => salon.slot_interval_minutes)
    ) as g (local_start)
  ),
  slots as (
    select g.barber_id,
           g.local_start,
           g.local_end,
           g.local_start at time zone salon.timezone as starts_at,
           g.local_end   at time zone salon.timezone as ends_at
    from grid g
    cross join salon
  )
  select sl.barber_id, sl.starts_at, sl.ends_at
  from slots sl
  cross join salon
  where sl.starts_at >= now() + make_interval(mins => salon.min_booking_notice_minutes)
    and not exists (
      select 1
      from public.working_hour_breaks br
      where br.barber_id = sl.barber_id
        and br.day_of_week = extract(dow from p_date)::int
        and br.start_time < sl.local_end::time
        and br.end_time > sl.local_start::time
    )
    and not exists (
      select 1
      from public.time_off t
      where t.salon_id = p_salon_id
        and (t.barber_id = sl.barber_id or t.barber_id is null)
        and t.starts_at < sl.ends_at
        and t.ends_at > sl.starts_at
    )
    and not exists (
      select 1
      from public.appointments a
      where a.barber_id = sl.barber_id
        and a.status not in ('cancelled', 'no_show')
        and not (a.status = 'pending_payment' and a.hold_expires_at < now())
        and a.starts_at < sl.ends_at
        and a.ends_at > sl.starts_at
    )
  order by sl.starts_at, sl.barber_id;
$$;


-- =============================================================================
-- book_appointment
-- =============================================================================
-- Online rezervasyonun tek giriş noktası. Slot, get_available_slots ile yeniden
-- doğrulanır; yani arayüzde gösterilmeyen bir saate randevu alınamaz. Aynı slota
-- eşzamanlı iki istek gelirse appointments_no_overlap kısıtı ikincisini reddeder
-- ve çağıran SLOT_TAKEN hatası alır.
--
-- p_barber_id NULL ise o saatte müsait personelden o gün en az randevusu olan
-- atanır.
--
-- Müşteri eşleştirme:
--   1. Oturum açmış müşteri -> kendi müşteri kaydı (salon + user_id)
--   2. Aksi halde telefon numarasıyla mevcut kayıt (bilgileri DEĞİŞTİRİLMEZ)
--   3. Yoksa yeni müşteri kaydı
-- Salon çalışanı çağırırsa kendi hesabıyla eşleştirme yapılmaz; müşteri her
-- zaman telefonla bulunur ve kaynak 'staff' olur.
--
-- Hata kodları (PostgREST yanıtında "details" alanı):
--   INVALID_INPUT, SALON_NOT_FOUND, SLOT_UNAVAILABLE, SLOT_TAKEN,
--   CUSTOMER_INFO_REQUIRED, INVALID_PHONE, CUSTOMER_BLOCKED
create or replace function public.book_appointment(
  p_salon_id        uuid,
  p_service_ids     uuid[],
  p_starts_at       timestamptz,
  p_barber_id       uuid default null,
  p_customer_name   text default null,
  p_customer_phone  text default null,
  p_customer_email  text default null,
  p_customer_note   text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_is_staff     boolean;
  v_salon        public.salons%rowtype;
  v_service_ids  uuid[];
  v_local_date   date;
  v_day_start    timestamptz;
  v_barber_id    uuid;
  v_ends_at      timestamptz;
  v_total        numeric(10,2);
  v_deposit      numeric(10,2) := 0;
  v_phone        text := nullif(regexp_replace(coalesce(p_customer_phone, ''), '[\s()-]', '', 'g'), '');
  v_name         text := nullif(trim(coalesce(p_customer_name, '')), '');
  v_customer_id  uuid;
  v_blocked      boolean;
  v_appt         public.appointments%rowtype;
begin
  -- 1. Girdi ve salon ---------------------------------------------------------
  if p_starts_at is null or coalesce(cardinality(p_service_ids), 0) = 0 then
    raise exception 'Hizmet ve başlangıç saati zorunludur'
      using errcode = 'P0001', detail = 'INVALID_INPUT';
  end if;

  select * into v_salon
  from public.salons s
  where s.id = p_salon_id and s.is_active;

  if not found then
    raise exception 'Salon bulunamadı'
      using errcode = 'P0001', detail = 'SALON_NOT_FOUND';
  end if;

  v_is_staff := private.is_salon_member(p_salon_id);

  -- Tekrarlanan hizmetleri ayıkla, gönderilen sırayı koru
  select array_agg(u.id order by u.ord) into v_service_ids
  from (
    select t.id, min(t.ord) as ord
    from unnest(p_service_ids) with ordinality as t (id, ord)
    group by t.id
  ) u;

  -- 2. Slot doğrulama ve personel seçimi --------------------------------------
  v_local_date := (p_starts_at at time zone v_salon.timezone)::date;
  v_day_start  := v_local_date::timestamp at time zone v_salon.timezone;

  select s.barber_id, s.ends_at
    into v_barber_id, v_ends_at
  from public.get_available_slots(p_salon_id, v_service_ids, v_local_date, p_barber_id) s
  where s.starts_at = p_starts_at
  order by (
    select count(*)
    from public.appointments a
    where a.barber_id = s.barber_id
      and a.status not in ('cancelled', 'no_show')
      and a.starts_at >= v_day_start
      and a.starts_at < v_day_start + interval '1 day'
  ), random()
  limit 1;

  if v_barber_id is null then
    raise exception 'Seçilen saat müsait değil'
      using errcode = 'P0001', detail = 'SLOT_UNAVAILABLE';
  end if;

  -- 3. Tutar ve kapora --------------------------------------------------------
  -- (appointment_services tetikleyicisiyle aynı kural: personele özel fiyat öncelikli)
  select sum(coalesce(bs.price_override, sv.price)) into v_total
  from public.services sv
  left join public.barber_services bs
         on bs.service_id = sv.id and bs.barber_id = v_barber_id
  where sv.id = any (v_service_ids);

  v_deposit := case v_salon.deposit_type
    when 'fixed'   then least(v_salon.deposit_value, v_total)
    when 'percent' then round(v_total * v_salon.deposit_value / 100, 2)
    else 0
  end;

  -- 4. Müşteri ----------------------------------------------------------------
  if v_uid is not null and not v_is_staff then
    select c.id, c.is_blocked into v_customer_id, v_blocked
    from public.customers c
    where c.salon_id = p_salon_id and c.user_id = v_uid;
  end if;

  if v_customer_id is null then
    if v_phone is null then
      raise exception 'Telefon numarası zorunludur'
        using errcode = 'P0001', detail = 'CUSTOMER_INFO_REQUIRED';
    end if;
    if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
      raise exception 'Telefon numarası +905xxxxxxxxx biçiminde olmalıdır'
        using errcode = 'P0001', detail = 'INVALID_PHONE';
    end if;

    select c.id, c.is_blocked into v_customer_id, v_blocked
    from public.customers c
    where c.salon_id = p_salon_id and c.phone = v_phone;

    if v_customer_id is null then
      if v_name is null then
        raise exception 'Ad soyad zorunludur'
          using errcode = 'P0001', detail = 'CUSTOMER_INFO_REQUIRED';
      end if;

      insert into public.customers (salon_id, user_id, full_name, phone, email)
      values (
        p_salon_id,
        case when v_is_staff then null else v_uid end,
        v_name,
        v_phone,
        nullif(trim(coalesce(p_customer_email, '')), '')
      )
      on conflict (salon_id, phone) do nothing
      returning id into v_customer_id;

      -- Aynı telefonla eşzamanlı bir kayıt araya girdiyse onu kullan
      if v_customer_id is null then
        select c.id, c.is_blocked into v_customer_id, v_blocked
        from public.customers c
        where c.salon_id = p_salon_id and c.phone = v_phone;
      end if;
    end if;
  end if;

  if coalesce(v_blocked, false) then
    raise exception 'Bu salon için online randevu alamazsınız, lütfen salonla iletişime geçin'
      using errcode = 'P0001', detail = 'CUSTOMER_BLOCKED';
  end if;

  -- 5. Randevu ----------------------------------------------------------------
  -- Kapora süresi dolmuş ama henüz iptal edilmemiş tutmaları serbest bırak;
  -- aksi halde çakışma kısıtına takılırlar.
  update public.appointments a
  set status = 'cancelled',
      cancel_reason = 'Kapora süresi doldu'
  where a.barber_id = v_barber_id
    and a.status = 'pending_payment'
    and a.hold_expires_at < now()
    and a.starts_at < v_ends_at
    and a.ends_at > p_starts_at;

  begin
    insert into public.appointments (
      salon_id, barber_id, customer_id, starts_at, ends_at,
      status, source, deposit_amount, hold_expires_at, customer_note, created_by
    )
    values (
      p_salon_id,
      v_barber_id,
      v_customer_id,
      p_starts_at,
      v_ends_at,
      case when v_deposit > 0 then 'pending_payment' else 'confirmed' end::public.appointment_status,
      case when v_is_staff then 'staff' else 'online' end::public.appointment_source,
      v_deposit,
      case when v_deposit > 0
           then now() + make_interval(mins => v_salon.deposit_hold_minutes)
      end,
      nullif(trim(coalesce(p_customer_note, '')), ''),
      v_uid
    )
    returning * into v_appt;
  exception
    when exclusion_violation then
      raise exception 'Bu saat az önce başka bir müşteri tarafından alındı'
        using errcode = 'P0001', detail = 'SLOT_TAKEN';
  end;

  -- Ad/süre/fiyat fill_appointment_service tetikleyicisiyle doldurulur,
  -- toplamlar sync_appointment_totals ile randevuya yazılır.
  insert into public.appointment_services (salon_id, appointment_id, service_id, sort_order)
  select p_salon_id, v_appt.id, t.id, t.ord::smallint
  from unnest(v_service_ids) with ordinality as t (id, ord);

  return jsonb_build_object(
    'appointment_id',   v_appt.id,
    'status',           v_appt.status,
    'barber_id',        v_appt.barber_id,
    'customer_id',      v_appt.customer_id,
    'starts_at',        v_appt.starts_at,
    'ends_at',          v_appt.ends_at,
    'total_price',      v_total,
    'deposit_amount',   v_appt.deposit_amount,
    'requires_payment', v_appt.status = 'pending_payment',
    'hold_expires_at',  v_appt.hold_expires_at,
    'manage_token',     v_appt.manage_token
  );
end;
$$;


-- =============================================================================
-- Yetkiler
-- =============================================================================
-- Boş saatleri herkes sorgulayabilir (salt okunur).
revoke execute on function public.get_available_slots(uuid, uuid[], date, uuid) from public;
grant  execute on function public.get_available_slots(uuid, uuid[], date, uuid) to anon, authenticated, service_role;

-- Randevu oluşturma anonim anahtarla çağrılamaz: aksi halde herkes salonun
-- takvimini sahte randevularla doldurabilir. Hesapsız (misafir) rezervasyonlar
-- sunucu tarafından (Server Action + service role) hız sınırı / OTP sonrası yapılır.
revoke execute on function public.book_appointment(uuid, uuid[], timestamptz, uuid, text, text, text, text) from public, anon;
grant  execute on function public.book_appointment(uuid, uuid[], timestamptz, uuid, text, text, text, text) to authenticated, service_role;
