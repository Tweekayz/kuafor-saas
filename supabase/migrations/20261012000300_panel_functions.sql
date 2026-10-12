-- =============================================================================
-- Modül 3 — Yönetici ve personel paneli: ajanda, ek raporlar ve işlemler
-- =============================================================================
-- Okuma:
--   public.get_agenda               -> ekip: tarih aralığındaki randevular (takvim)
--   public.get_service_performance  -> yönetici: hizmet bazında adet ve ciro
--   public.get_commission_balances  -> yönetici: personel bazında ödenmemiş prim
--   public.get_barber_summary       -> personel (veya yönetici): dönem özeti
-- Yazma:
--   public.update_appointment_status -> tamamlandı / gelmedi / iptal / geri al
--   public.reschedule_appointment    -> randevuyu başka saate veya personele taşı
--   public.mark_earnings_paid        -> yönetici: primleri "ödendi" işaretle
--
-- Hepsi security invoker çalışır; yani RLS aynen geçerlidir (personel yalnızca
-- kendi randevularını ve primlerini görür/değiştirir). Okuma fonksiyonları
-- yetkisiz çağrıda hata değil boş sonuç döner; yazma fonksiyonları hata fırlatır.
-- Tarih aralıkları salonun yerel takvim günleridir (iki uç da dahil).
--
-- Hata kodları (PostgREST yanıtında "details" alanı):
--   NOT_FOUND, FORBIDDEN, INVALID_TRANSITION, APPOINTMENT_NOT_STARTED,
--   EARNINGS_PAID_OUT, NOT_RESCHEDULABLE, BARBER_UNAVAILABLE,
--   SLOT_UNAVAILABLE, SLOT_TAKEN
-- =============================================================================


-- =============================================================================
-- get_agenda
-- =============================================================================
-- Takvim/ajanda ekranının tek sorgusu. Yönetici ve resepsiyon tüm salonu,
-- personel RLS gereği yalnızca kendi randevularını alır.
-- p_include_closed: iptal edilen ve gelinmeyen randevular da dönsün mü.
create or replace function public.get_agenda(
  p_salon_id        uuid,
  p_from            date,
  p_to              date,
  p_barber_id       uuid default null,
  p_include_closed  boolean default false
)
returns table (
  appointment_id  uuid,
  barber_id       uuid,
  barber_name     text,
  customer_id     uuid,
  customer_name   text,
  customer_phone  text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  status          public.appointment_status,
  source          public.appointment_source,
  total_price     numeric,
  deposit_amount  numeric,
  customer_note   text,
  services        jsonb
)
language sql stable set search_path = ''
as $$
  with salon as (
    select s.id,
           p_from::timestamp at time zone s.timezone       as range_start,
           (p_to + 1)::timestamp at time zone s.timezone   as range_end
    from public.salons s
    where s.id = p_salon_id
      and private.is_salon_member(s.id)
  )
  select
    a.id,
    a.barber_id,
    b.display_name,
    a.customer_id,
    c.full_name,
    c.phone,
    a.starts_at,
    a.ends_at,
    a.status,
    a.source,
    a.total_price,
    a.deposit_amount,
    a.customer_note,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'service_id',       aps.service_id,
          'name',             aps.service_name,
          'duration_minutes', aps.duration_minutes,
          'price',            aps.price
        )
        order by aps.sort_order, aps.created_at
      )
      from public.appointment_services aps
      where aps.appointment_id = a.id
    ), '[]'::jsonb)
  from public.appointments a
  join salon              on salon.id = a.salon_id
  join public.barbers b   on b.id = a.barber_id
  join public.customers c on c.id = a.customer_id
  where a.starts_at >= salon.range_start
    and a.starts_at < salon.range_end
    and (p_barber_id is null or a.barber_id = p_barber_id)
    and (p_include_closed or a.status not in ('cancelled', 'no_show'))
  order by a.starts_at, b.display_name;
$$;


-- =============================================================================
-- get_service_performance
-- =============================================================================
-- Aralıkta tamamlanan randevulardaki kalemler, ciroya göre sıralı. Fiyat ve süre
-- randevu anındaki kopyadan gelir; ad ise hizmetin güncel adıdır (yeniden
-- adlandırılan hizmet tek satırda toplanır).
create or replace function public.get_service_performance(
  p_salon_id  uuid,
  p_from      date,
  p_to        date
)
returns table (
  service_id      uuid,
  service_name    text,
  category        text,
  item_count      bigint,
  revenue         numeric,
  booked_minutes  bigint
)
language sql stable set search_path = ''
as $$
  with salon as (
    select s.id,
           p_from::timestamp at time zone s.timezone       as range_start,
           (p_to + 1)::timestamp at time zone s.timezone   as range_end
    from public.salons s
    where s.id = p_salon_id
      and private.is_salon_admin(s.id)
  )
  select
    sv.id,
    sv.name,
    sv.category,
    count(*),
    sum(aps.price),
    sum(aps.duration_minutes)
  from public.appointments a
  join salon                           on salon.id = a.salon_id
  join public.appointment_services aps on aps.appointment_id = a.id
  join public.services sv              on sv.id = aps.service_id
  where a.status = 'completed'
    and a.starts_at >= salon.range_start
    and a.starts_at < salon.range_end
  group by sv.id, sv.name, sv.category
  order by 5 desc, sv.name;
$$;


-- =============================================================================
-- get_commission_balances
-- =============================================================================
-- Prim ödeme ekranı: her personelin bugüne kadar birikmiş, henüz ödenmemiş primi.
create or replace function public.get_commission_balances(p_salon_id uuid)
returns table (
  barber_id         uuid,
  display_name      text,
  is_active         boolean,
  unpaid_amount     numeric,
  unpaid_items      bigint,
  oldest_unpaid_at  timestamptz,
  last_paid_out_at  timestamptz
)
language sql stable set search_path = ''
as $$
  select
    b.id,
    b.display_name,
    b.is_active,
    coalesce(sum(e.amount) filter (where e.paid_out_at is null), 0),
    count(e.id) filter (where e.paid_out_at is null),
    min(e.earned_at) filter (where e.paid_out_at is null),
    max(e.paid_out_at)
  from public.barbers b
  left join public.barber_earnings e on e.barber_id = b.id
  where b.salon_id = p_salon_id
    and private.is_salon_admin(b.salon_id)
  group by b.id, b.display_name, b.is_active
  order by 4 desc, b.display_name;
$$;


-- =============================================================================
-- get_barber_summary
-- =============================================================================
-- Personel panelinin üst özeti. Personel kendi kaydı için, yönetici salonundaki
-- herkes için çağırabilir; başkası NULL alır.
create or replace function public.get_barber_summary(
  p_barber_id  uuid,
  p_from       date,
  p_to         date
)
returns jsonb
language sql stable set search_path = ''
as $$
  with barber as (
    select b.id,
           b.display_name,
           p_from::timestamp at time zone s.timezone       as range_start,
           (p_to + 1)::timestamp at time zone s.timezone   as range_end
    from public.barbers b
    join public.salons s on s.id = b.salon_id
    where b.id = p_barber_id
      and (b.user_id = (select auth.uid()) or private.is_salon_admin(b.salon_id))
  ),
  appts as (
    select a.status, a.total_price
    from public.appointments a
    join barber on barber.id = a.barber_id
    where a.starts_at >= barber.range_start
      and a.starts_at < barber.range_end
  ),
  earnings as (
    select e.amount, e.paid_out_at
    from public.barber_earnings e
    join barber on barber.id = e.barber_id
    where e.earned_at >= barber.range_start
      and e.earned_at < barber.range_end
  )
  select jsonb_build_object(
    'barber_id',    barber.id,
    'display_name', barber.display_name,
    'appointments', jsonb_build_object(
      'completed',  (select count(*) from appts where status = 'completed'),
      'upcoming',   (select count(*) from appts where status in ('confirmed', 'pending_payment')),
      'no_show',    (select count(*) from appts where status = 'no_show'),
      'cancelled',  (select count(*) from appts where status = 'cancelled')
    ),
    'revenue',      (select coalesce(sum(total_price) filter (where status = 'completed'), 0) from appts),
    'commission', jsonb_build_object(
      'earned',     (select coalesce(sum(amount), 0) from earnings),
      'paid_out',   (select coalesce(sum(amount) filter (where paid_out_at is not null), 0) from earnings),
      'unpaid',     (select coalesce(sum(amount) filter (where paid_out_at is null), 0) from earnings)
    ),
    'next_appointment_at', (
      select min(a.starts_at)
      from public.appointments a
      where a.barber_id = barber.id
        and a.status = 'confirmed'
        and a.starts_at > now()
    )
  )
  from barber;
$$;


-- =============================================================================
-- update_appointment_status
-- =============================================================================
-- İzin verilen geçişler:
--   pending_payment | confirmed          -> cancelled
--   confirmed                            -> completed | no_show  (başladıktan sonra)
--   pending_payment                      -> confirmed  (kapora elden alındı; ön büro)
--   completed | no_show | cancelled      -> confirmed  (geri al; ön büro)
-- Personel yalnızca kendi randevusunu tamamlayabilir / gelmedi / iptal edebilir.
-- Primi ödenmiş bir randevunun tamamlanması geri alınamaz. Kapalı bir randevu
-- geri açılırken çakışma ve çalışma saati kuralları yeniden uygulanır.
create or replace function public.update_appointment_status(
  p_appointment_id  uuid,
  p_status          public.appointment_status,
  p_reason          text default null
)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_appt       public.appointments%rowtype;
  v_previous   public.appointment_status;
  v_frontdesk  boolean;
begin
  -- for update: satır RLS'in güncelleme politikasından da geçmek zorundadır;
  -- müşteri ya da başka bir personel için randevu "yok" sayılır.
  select * into v_appt
  from public.appointments a
  where a.id = p_appointment_id
  for update;

  if not found then
    raise exception 'Randevu bulunamadı'
      using errcode = 'P0001', detail = 'NOT_FOUND';
  end if;

  v_previous  := v_appt.status;
  v_frontdesk := private.is_salon_frontdesk(v_appt.salon_id);

  if p_status = v_previous then
    return jsonb_build_object(
      'appointment_id', v_appt.id, 'status', v_appt.status, 'previous_status', v_previous
    );
  end if;

  if p_status = 'cancelled' and v_previous in ('pending_payment', 'confirmed') then
    null;

  elsif p_status in ('completed', 'no_show') and v_previous = 'confirmed' then
    if v_appt.starts_at > now() then
      raise exception 'Henüz başlamamış bir randevu kapatılamaz'
        using errcode = 'P0001', detail = 'APPOINTMENT_NOT_STARTED';
    end if;

  elsif p_status = 'confirmed' and v_previous in ('pending_payment', 'completed', 'no_show', 'cancelled') then
    if not v_frontdesk then
      raise exception 'Bu işlem için yetkiniz yok'
        using errcode = 'P0001', detail = 'FORBIDDEN';
    end if;
    if v_previous = 'completed' and exists (
      select 1 from public.barber_earnings e
      where e.appointment_id = v_appt.id and e.paid_out_at is not null
    ) then
      raise exception 'Primi ödenmiş bir randevu geri alınamaz'
        using errcode = 'P0001', detail = 'EARNINGS_PAID_OUT';
    end if;

  else
    raise exception 'Randevu % durumundan % durumuna alınamaz', v_previous, p_status
      using errcode = 'P0001', detail = 'INVALID_TRANSITION';
  end if;

  begin
    update public.appointments a
    set status          = p_status,
        hold_expires_at = null,
        cancelled_at    = case when p_status = 'cancelled' then now() end,
        cancel_reason   = case when p_status = 'cancelled'
                               then nullif(trim(coalesce(p_reason, '')), '')
                          end
    where a.id = v_appt.id
    returning * into v_appt;
  exception
    when exclusion_violation then
      raise exception 'Bu saatte personelin başka bir randevusu var'
        using errcode = 'P0001', detail = 'SLOT_TAKEN';
    when check_violation then
      raise exception '%', sqlerrm
        using errcode = 'P0001', detail = 'SLOT_UNAVAILABLE';
  end;

  return jsonb_build_object(
    'appointment_id', v_appt.id, 'status', v_appt.status, 'previous_status', v_previous
  );
end;
$$;


-- =============================================================================
-- reschedule_appointment
-- =============================================================================
-- Randevuyu aynı süreyle yeni bir saate (ve istenirse başka personele) taşır.
-- Çalışma saati / mola / izin kurallarını validate_appointment tetikleyicisi,
-- çakışmayı appointments_no_overlap kısıtı uygular. Online rezervasyondaki
-- "en erken rezervasyon süresi" ekip için geçerli değildir. Hizmet fiyatları
-- randevu anındaki kopya olarak kalır; personel değişse de yeniden hesaplanmaz.
-- Müşteriye "ertelendi" bildirimi ve yeni hatırlatmalar tetikleyiciyle kuyruğa girer.
create or replace function public.reschedule_appointment(
  p_appointment_id  uuid,
  p_starts_at       timestamptz,
  p_barber_id       uuid default null
)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_appt       public.appointments%rowtype;
  v_barber_id  uuid;
begin
  select * into v_appt
  from public.appointments a
  where a.id = p_appointment_id
  for update;

  if not found then
    raise exception 'Randevu bulunamadı'
      using errcode = 'P0001', detail = 'NOT_FOUND';
  end if;

  if v_appt.status not in ('pending_payment', 'confirmed') then
    raise exception 'Yalnızca aktif randevular ertelenebilir'
      using errcode = 'P0001', detail = 'NOT_RESCHEDULABLE';
  end if;

  if p_starts_at is null or p_starts_at < now() then
    raise exception 'Randevu geçmiş bir saate taşınamaz'
      using errcode = 'P0001', detail = 'SLOT_UNAVAILABLE';
  end if;

  v_barber_id := coalesce(p_barber_id, v_appt.barber_id);

  if v_barber_id <> v_appt.barber_id then
    if not private.is_salon_frontdesk(v_appt.salon_id) then
      raise exception 'Randevuyu başka personele taşıma yetkiniz yok'
        using errcode = 'P0001', detail = 'FORBIDDEN';
    end if;

    -- Yeni personel aynı salonda, aktif ve randevudaki tüm hizmetleri veriyor olmalı
    if not exists (
         select 1 from public.barbers b
         where b.id = v_barber_id and b.salon_id = v_appt.salon_id and b.is_active
       )
       or exists (
         select 1
         from public.appointment_services aps
         where aps.appointment_id = v_appt.id
           and not exists (
             select 1 from public.barber_services bs
             where bs.barber_id = v_barber_id and bs.service_id = aps.service_id
           )
       ) then
      raise exception 'Seçilen personel bu randevudaki hizmetleri vermiyor'
        using errcode = 'P0001', detail = 'BARBER_UNAVAILABLE';
    end if;
  end if;

  begin
    update public.appointments a
    set starts_at = p_starts_at,
        ends_at   = p_starts_at + (a.ends_at - a.starts_at),
        barber_id = v_barber_id
    where a.id = v_appt.id
    returning * into v_appt;
  exception
    when exclusion_violation then
      raise exception 'Bu saatte personelin başka bir randevusu var'
        using errcode = 'P0001', detail = 'SLOT_TAKEN';
    when check_violation then
      raise exception '%', sqlerrm
        using errcode = 'P0001', detail = 'SLOT_UNAVAILABLE';
  end;

  return jsonb_build_object(
    'appointment_id', v_appt.id,
    'status',         v_appt.status,
    'barber_id',      v_appt.barber_id,
    'starts_at',      v_appt.starts_at,
    'ends_at',        v_appt.ends_at
  );
end;
$$;


-- =============================================================================
-- mark_earnings_paid
-- =============================================================================
-- Ödenmemiş primleri "ödendi" olarak işaretler.
-- p_barber_id NULL = tüm personel; p_until NULL = bugüne kadar birikenlerin tamamı
-- (aksi halde salonun yerel takvimiyle p_until günü dahil).
create or replace function public.mark_earnings_paid(
  p_salon_id   uuid,
  p_barber_id  uuid default null,
  p_until      date default null
)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_tz      text;
  v_now     timestamptz := now();
  v_count   bigint;
  v_amount  numeric;
begin
  if not private.is_salon_admin(p_salon_id) then
    raise exception 'Bu işlem için yetkiniz yok'
      using errcode = 'P0001', detail = 'FORBIDDEN';
  end if;

  select s.timezone into v_tz from public.salons s where s.id = p_salon_id;

  with paid as (
    update public.barber_earnings e
    set paid_out_at = v_now
    where e.salon_id = p_salon_id
      and e.paid_out_at is null
      and (p_barber_id is null or e.barber_id = p_barber_id)
      and (p_until is null or e.earned_at < (p_until + 1)::timestamp at time zone v_tz)
    returning e.amount
  )
  select count(*), coalesce(sum(paid.amount), 0) into v_count, v_amount from paid;

  return jsonb_build_object('item_count', v_count, 'amount', v_amount, 'paid_out_at', v_now);
end;
$$;


-- =============================================================================
-- Yetkiler
-- =============================================================================
revoke execute on function public.get_agenda(uuid, date, date, uuid, boolean)                             from public, anon;
revoke execute on function public.get_service_performance(uuid, date, date)                               from public, anon;
revoke execute on function public.get_commission_balances(uuid)                                           from public, anon;
revoke execute on function public.get_barber_summary(uuid, date, date)                                    from public, anon;
revoke execute on function public.update_appointment_status(uuid, public.appointment_status, text)        from public, anon;
revoke execute on function public.reschedule_appointment(uuid, timestamptz, uuid)                         from public, anon;
revoke execute on function public.mark_earnings_paid(uuid, uuid, date)                                    from public, anon;

grant execute on function public.get_agenda(uuid, date, date, uuid, boolean)                              to authenticated, service_role;
grant execute on function public.get_service_performance(uuid, date, date)                                to authenticated, service_role;
grant execute on function public.get_commission_balances(uuid)                                            to authenticated, service_role;
grant execute on function public.get_barber_summary(uuid, date, date)                                     to authenticated, service_role;
grant execute on function public.update_appointment_status(uuid, public.appointment_status, text)         to authenticated, service_role;
grant execute on function public.reschedule_appointment(uuid, timestamptz, uuid)                          to authenticated, service_role;
grant execute on function public.mark_earnings_paid(uuid, uuid, date)                                     to authenticated, service_role;
