-- Limites globais adicionais; preserva a disponibilidade individual e RPCs auxiliares.
create or replace function public.get_available_slots(p_professional_id uuid,p_service_id uuid,p_date date)
returns table(slot_start timestamptz,slot_end timestamptz,slot_label text)
language sql stable security definer set search_path=public as $$
 with raw_settings as (
  select booking_rules,business_hours from public.spa_settings where id=true
 ), settings as (
  select
   case when coalesce(booking_rules->>'minimumNoticeHours','') ~ '^\d+$' then greatest((booking_rules->>'minimumNoticeHours')::int,0) else 0 end minimum_notice_hours,
   case when coalesce(booking_rules->>'maximumAdvanceDays','') ~ '^\d+$' then greatest((booking_rules->>'maximumAdvanceDays')::int,0) else null end maximum_advance_days,
   case when jsonb_typeof(booking_rules->'allowSameDay')='boolean' then (booking_rules->>'allowSameDay')::boolean else true end allow_same_day,
   business_hours from raw_settings
  union all select 0,null::integer,true,'{}'::jsonb where not exists(select 1 from raw_settings)
 ), service_config as (
  select coalesce(ps.custom_duration_minutes,s.duration_minutes) duration_minutes,p.default_slot_minutes
  from public.professional_services ps
  join public.services s on s.id=ps.service_id and s.active
  join public.professionals p on p.id=ps.professional_id and p.active
  where ps.professional_id=p_professional_id and ps.service_id=p_service_id and ps.active
 ), date_exception as (
  select e.available,e.start_time,e.end_time from public.availability_exceptions e
  where e.professional_id=p_professional_id and e.exception_date=p_date order by e.created_at desc limit 1
 ), working_windows as (
  select e.start_time,e.end_time,c.default_slot_minutes step_minutes from date_exception e cross join service_config c where e.available
  union all
  select r.start_time,r.end_time,r.slot_minutes from public.availability_rules r
  where r.professional_id=p_professional_id and r.active
   and r.weekday=extract(dow from p_date)::smallint
   and (r.valid_from is null or r.valid_from<=p_date)
   and (r.valid_until is null or r.valid_until>=p_date)
   and not exists(select 1 from date_exception)
 ), bounded_windows as (
  select
   greatest(w.start_time,case when coalesce(s.business_hours->extract(dow from p_date)::int::text->>'start','') ~ '^([01]\d|2[0-3]):[0-5]\d$' then (s.business_hours->extract(dow from p_date)::int::text->>'start')::time else w.start_time end) start_time,
   least(w.end_time,case when coalesce(s.business_hours->extract(dow from p_date)::int::text->>'end','') ~ '^([01]\d|2[0-3]):[0-5]\d$' then (s.business_hours->extract(dow from p_date)::int::text->>'end')::time else w.end_time end) end_time,
   w.step_minutes
  from working_windows w cross join settings s
  where case when jsonb_typeof(s.business_hours->extract(dow from p_date)::int::text->'open')='boolean' then (s.business_hours->extract(dow from p_date)::int::text->>'open')::boolean else true end
 ), generated_slots as (
  select candidate at time zone 'America/Sao_Paulo' starts_at,
   (candidate+make_interval(mins=>c.duration_minutes)) at time zone 'America/Sao_Paulo' ends_at
  from bounded_windows w cross join service_config c
  cross join lateral generate_series(p_date+w.start_time,p_date+w.end_time-make_interval(mins=>c.duration_minutes),make_interval(mins=>w.step_minutes)) candidate
  where w.end_time>w.start_time
 )
 select g.starts_at,g.ends_at,to_char(g.starts_at at time zone 'America/Sao_Paulo','HH24:MI')
 from generated_slots g cross join settings s
 where g.starts_at>now()+make_interval(hours=>s.minimum_notice_hours)
  and (s.maximum_advance_days is null or p_date<=(now() at time zone 'America/Sao_Paulo')::date+s.maximum_advance_days)
  and (s.allow_same_day or p_date>(now() at time zone 'America/Sao_Paulo')::date)
  and not exists(select 1 from public.appointments a where a.professional_id=p_professional_id and a.status in('pending','confirmed') and tstzrange(a.start_at,a.end_at,'[)')&&tstzrange(g.starts_at,g.ends_at,'[)'))
  and not exists(select 1 from public.schedule_blocks b where b.professional_id=p_professional_id and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(g.starts_at,g.ends_at,'[)'))
 order by g.starts_at;
$$;
revoke all on function public.get_available_slots(uuid,uuid,date) from public;
grant execute on function public.get_available_slots(uuid,uuid,date) to authenticated;

create or replace function public.validate_configured_client_cancellation_notice_017()
returns trigger language plpgsql security definer set search_path=public as $$
declare rules jsonb; rule_enabled boolean:=false; notice_hours integer:=0;
begin
 if old.status is distinct from 'cancelled' and new.status='cancelled' and auth.uid()=old.client_id then
  select booking_rules into rules from public.spa_settings where id=true;
  if jsonb_typeof(rules->'cancellationEnabled')='boolean' then rule_enabled:=(rules->>'cancellationEnabled')::boolean; end if;
  if coalesce(rules->>'cancellationNoticeHours','') ~ '^\d+$' then notice_hours:=greatest((rules->>'cancellationNoticeHours')::int,0); end if;
  if rule_enabled and old.start_at<=now()+make_interval(hours=>notice_hours) then
   raise exception 'O prazo mínimo configurado para cancelar este agendamento foi ultrapassado';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function public.validate_configured_client_cancellation_notice_017() from public;

do $$ begin
 if not exists(select 1 from pg_trigger where tgname='validate_configured_client_cancellation_notice_017' and tgrelid='public.appointments'::regclass) then
  create trigger validate_configured_client_cancellation_notice_017 before update of status on public.appointments
  for each row execute function public.validate_configured_client_cancellation_notice_017();
 end if;
end $$;
