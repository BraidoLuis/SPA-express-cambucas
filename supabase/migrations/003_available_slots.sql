-- Horários disponíveis calculados no banco.
-- Execute uma única vez depois da migration 002_client_catalog.sql.

create or replace function public.get_available_slots(
  p_professional_id uuid,
  p_service_id uuid,
  p_date date
)
returns table (
  slot_start timestamptz,
  slot_end timestamptz,
  slot_label text
)
language sql
stable
security definer
set search_path = public
as $$
  with service_config as (
    select
      coalesce(ps.custom_duration_minutes, s.duration_minutes) as duration_minutes,
      p.default_slot_minutes
    from public.professional_services ps
    join public.services s on s.id = ps.service_id and s.active
    join public.professionals p on p.id = ps.professional_id and p.active
    where ps.professional_id = p_professional_id
      and ps.service_id = p_service_id
      and ps.active
  ),
  date_exception as (
    select e.available, e.start_time, e.end_time
    from public.availability_exceptions e
    where e.professional_id = p_professional_id
      and e.exception_date = p_date
    order by e.created_at desc
    limit 1
  ),
  working_windows as (
    select
      e.start_time,
      e.end_time,
      c.default_slot_minutes as step_minutes
    from date_exception e
    cross join service_config c
    where e.available

    union all

    select
      r.start_time,
      r.end_time,
      r.slot_minutes
    from public.availability_rules r
    where r.professional_id = p_professional_id
      and r.active
      and r.weekday = extract(dow from p_date)::smallint
      and (r.valid_from is null or r.valid_from <= p_date)
      and (r.valid_until is null or r.valid_until >= p_date)
      and not exists (select 1 from date_exception)
  ),
  generated_slots as (
    select
      candidate at time zone 'America/Sao_Paulo' as starts_at,
      (candidate + make_interval(mins => c.duration_minutes)) at time zone 'America/Sao_Paulo' as ends_at
    from working_windows w
    cross join service_config c
    cross join lateral generate_series(
      p_date + w.start_time,
      p_date + w.end_time - make_interval(mins => c.duration_minutes),
      make_interval(mins => w.step_minutes)
    ) candidate
  )
  select
    g.starts_at,
    g.ends_at,
    to_char(g.starts_at at time zone 'America/Sao_Paulo', 'HH24:MI')
  from generated_slots g
  where g.starts_at > now()
    and not exists (
      select 1 from public.appointments a
      where a.professional_id = p_professional_id
        and a.status in ('pending', 'confirmed')
        and tstzrange(a.start_at, a.end_at, '[)') && tstzrange(g.starts_at, g.ends_at, '[)')
    )
    and not exists (
      select 1 from public.schedule_blocks b
      where b.professional_id = p_professional_id
        and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(g.starts_at, g.ends_at, '[)')
    )
  order by g.starts_at;
$$;

revoke all on function public.get_available_slots(uuid, uuid, date) from public;
grant execute on function public.get_available_slots(uuid, uuid, date) to authenticated;
