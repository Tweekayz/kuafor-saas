-- =============================================================================
-- Modül 3 — Yönetici ve personel paneli raporları
-- =============================================================================
--   public.get_salon_dashboard     -> yönetici: ciro, randevu sayıları, günlük seri
--   public.get_barber_performance  -> yönetici: personel bazında performans
--   public.get_barber_earnings     -> personel (veya yönetici): hizmet bazlı prim
--
-- Fonksiyonlar security invoker çalışır; yani RLS aynen geçerlidir. Yönetici
-- raporları ayrıca private.is_salon_admin ile korunur: yetkisiz çağrı hata
-- değil boş sonuç (NULL / 0 satır) alır.
-- Tarih aralıkları salonun yerel takvim günleridir (iki uç da dahil).
-- =============================================================================


-- =============================================================================
-- get_salon_dashboard
-- =============================================================================
-- Ciro = aralıkta başlayan 'completed' randevuların toplamı.
-- Beklenen ciro = henüz gerçekleşmemiş 'confirmed' randevuların toplamı.
create or replace function public.get_salon_dashboard(
  p_salon_id  uuid,
  p_from      date,
  p_to        date
)
returns jsonb
language sql stable set search_path = ''
as $$
  with salon as (
    select s.id,
           s.timezone,
           p_from::timestamp at time zone s.timezone       as range_start,
           (p_to + 1)::timestamp at time zone s.timezone   as range_end
    from public.salons s
    where s.id = p_salon_id
      and private.is_salon_admin(s.id)
  ),
  appts as (
    select a.id,
           a.status,
           a.total_price,
           (a.starts_at at time zone salon.timezone)::date as local_day
    from public.appointments a
    join salon on salon.id = a.salon_id
    where a.starts_at >= salon.range_start
      and a.starts_at < salon.range_end
  ),
  daily as (
    select d.day::date as day,
           coalesce(sum(ap.total_price) filter (where ap.status = 'completed'), 0) as revenue,
           count(ap.id) filter (where ap.status not in ('cancelled', 'no_show'))   as appointments
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d (day)
    left join appts ap on ap.local_day = d.day::date
    group by d.day
  )
  select jsonb_build_object(
    'revenue',           (select coalesce(sum(total_price) filter (where status = 'completed'), 0) from appts),
    'expected_revenue',  (select coalesce(sum(total_price) filter (where status = 'confirmed'), 0) from appts),
    'appointments', jsonb_build_object(
      'total',           (select count(*) from appts),
      'completed',       (select count(*) from appts where status = 'completed'),
      'confirmed',       (select count(*) from appts where status = 'confirmed'),
      'pending_payment', (select count(*) from appts where status = 'pending_payment'),
      'cancelled',       (select count(*) from appts where status = 'cancelled'),
      'no_show',         (select count(*) from appts where status = 'no_show')
    ),
    'commission_total', (
      select coalesce(sum(e.amount), 0)
      from public.barber_earnings e
      where e.salon_id = salon.id
        and e.earned_at >= salon.range_start
        and e.earned_at < salon.range_end
    ),
    'deposits_collected', (
      select coalesce(sum(p.amount), 0)
      from public.payments p
      where p.salon_id = salon.id
        and p.kind = 'deposit'
        and p.status = 'paid'
        and p.paid_at >= salon.range_start
        and p.paid_at < salon.range_end
    ),
    'new_customers', (
      select count(*)
      from public.customers c
      where c.salon_id = salon.id
        and c.created_at >= salon.range_start
        and c.created_at < salon.range_end
    ),
    'daily', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('day', day, 'revenue', revenue, 'appointments', appointments)
          order by day
        ),
        '[]'::jsonb
      )
      from daily
    )
  )
  from salon;
$$;


-- =============================================================================
-- get_barber_performance
-- =============================================================================
-- Her personel için bir satır (aralıkta randevusu olmasa da), ciroya göre sıralı.
create or replace function public.get_barber_performance(
  p_salon_id  uuid,
  p_from      date,
  p_to        date
)
returns table (
  barber_id        uuid,
  display_name     text,
  is_active        boolean,
  completed_count  bigint,
  upcoming_count   bigint,
  no_show_count    bigint,
  cancelled_count  bigint,
  revenue          numeric,
  commission       numeric,
  booked_minutes   bigint
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
    b.id,
    b.display_name,
    b.is_active,
    count(a.id) filter (where a.status = 'completed'),
    count(a.id) filter (where a.status in ('confirmed', 'pending_payment')),
    count(a.id) filter (where a.status = 'no_show'),
    count(a.id) filter (where a.status = 'cancelled'),
    coalesce(sum(a.total_price) filter (where a.status = 'completed'), 0),
    coalesce((
      select sum(e.amount)
      from public.barber_earnings e
      where e.barber_id = b.id
        and e.earned_at >= salon.range_start
        and e.earned_at < salon.range_end
    ), 0),
    coalesce(sum(a.total_duration_minutes) filter (where a.status = 'completed'), 0)
  from public.barbers b
  join salon on salon.id = b.salon_id
  left join public.appointments a
         on a.barber_id = b.id
        and a.starts_at >= salon.range_start
        and a.starts_at < salon.range_end
  group by b.id, b.display_name, b.is_active, salon.range_start, salon.range_end
  order by 8 desc, b.display_name;
$$;


-- =============================================================================
-- get_barber_earnings
-- =============================================================================
-- Hizmet bazında prim özeti. RLS sayesinde personel yalnızca kendi kayıtlarını,
-- yönetici salonundaki herkesinkini görür; başkası için 0 satır döner.
create or replace function public.get_barber_earnings(
  p_barber_id  uuid,
  p_from       date,
  p_to         date
)
returns table (
  service_name       text,
  item_count         bigint,
  base_amount        numeric,
  commission_amount  numeric,
  paid_out_amount    numeric
)
language sql stable set search_path = ''
as $$
  select
    aps.service_name,
    count(*),
    sum(e.base_amount),
    sum(e.amount),
    coalesce(sum(e.amount) filter (where e.paid_out_at is not null), 0)
  from public.barber_earnings e
  join public.salons s                 on s.id = e.salon_id
  join public.appointment_services aps on aps.id = e.appointment_service_id
  where e.barber_id = p_barber_id
    and e.earned_at >= p_from::timestamp at time zone s.timezone
    and e.earned_at < (p_to + 1)::timestamp at time zone s.timezone
  group by aps.service_name
  order by 4 desc, aps.service_name;
$$;


-- =============================================================================
-- Yetkiler
-- =============================================================================
revoke execute on function public.get_salon_dashboard(uuid, date, date)    from public, anon;
revoke execute on function public.get_barber_performance(uuid, date, date) from public, anon;
revoke execute on function public.get_barber_earnings(uuid, date, date)    from public, anon;

grant execute on function public.get_salon_dashboard(uuid, date, date)    to authenticated, service_role;
grant execute on function public.get_barber_performance(uuid, date, date) to authenticated, service_role;
grant execute on function public.get_barber_earnings(uuid, date, date)    to authenticated, service_role;
