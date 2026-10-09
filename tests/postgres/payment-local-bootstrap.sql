\set ON_ERROR_STOP on
-- SOMENTE cluster local descartável; modelo mínimo, NÃO dump de produção.
-- Funções/políticas/triggers/constraints abaixo copiados da auditoria fornecida.
-- Colunas/defaults de apoio são inferidos para este teste; ver documentação.
do $guard$ begin if current_database()<>'spa_payment_test' or inet_server_addr() is distinct from '127.0.0.1'::inet then raise exception 'Somente spa_payment_test local.'; end if; end $guard$;

begin;
create schema auth authorization postgres;
create extension btree_gist with schema public;
set role postgres;
set search_path=public;
create function auth.uid() returns uuid language sql stable as $uid$
  select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
$uid$;
create table auth.users(id uuid primary key);
create type public.profile_role as enum ('client','professional','admin');
create type public.appointment_status as enum ('pending','confirmed','completed','cancelled','no_show');
create type public.payment_status as enum ('pending','paid','cancelled','refunded');
create type public.notification_channel as enum ('email','in_app');
create type public.notification_status as enum ('pending','processing','sent','failed','cancelled');
create table profiles(id uuid not null,full_name text not null,email text,phone text,
 role profile_role not null default 'client',active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table professionals(id uuid not null default gen_random_uuid(),profile_id uuid not null,
 display_name text not null,active boolean not null default true,default_slot_minutes integer default 60,
 whatsapp_number text,created_at timestamptz default now(),updated_at timestamptz default now());
create table services(id uuid not null default gen_random_uuid(),slug text not null,name text not null,
 category text default 'teste',duration_minutes integer not null default 60,price numeric(10,2) not null default 120,active boolean not null default true,
 created_by uuid,created_at timestamptz default now(),updated_at timestamptz default now());
create table professional_services(professional_id uuid not null,service_id uuid not null,
 custom_duration_minutes integer,custom_price numeric(10,2),active boolean not null default true);
create table appointments(id uuid not null default gen_random_uuid(),client_id uuid,client_name text,client_phone text,
 professional_id uuid not null,service_id uuid,start_at timestamptz not null,end_at timestamptz not null,
 status appointment_status not null default 'confirmed',outside_schedule boolean not null default false,
 created_by uuid,notes text,cancelled_at timestamptz,cancellation_reason text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table payments(id uuid not null default gen_random_uuid(),appointment_id uuid not null,amount numeric(10,2) not null,
 status payment_status not null default 'pending',method text,notes text,confirmed_by uuid,paid_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table audit_logs(id uuid not null default gen_random_uuid(),actor_id uuid,action text not null,
 entity_type text not null,entity_id text not null,metadata jsonb default '{}'::jsonb,created_at timestamptz default now());
create table notifications(id uuid not null default gen_random_uuid(),appointment_id uuid,recipient_id uuid not null,
 channel notification_channel not null,notification_type text not null,title text,body text,
 status notification_status not null default 'pending',scheduled_for timestamptz default now(),
 created_at timestamptz default now(),updated_at timestamptz default now());
create table notification_preferences(profile_id uuid not null,email_enabled boolean not null default true,
 in_app_enabled boolean not null default true);
create table schedule_blocks(id uuid not null default gen_random_uuid(),professional_id uuid not null,
 starts_at timestamptz not null,ends_at timestamptz not null,reason text,created_by uuid);
create table spa_settings(id boolean not null default true,booking_rules jsonb default '{}'::jsonb,
 business jsonb default '{}'::jsonb,business_hours jsonb default '{}'::jsonb,notifications jsonb default '{}'::jsonb,
 updated_by uuid,updated_at timestamptz default now());
alter table public.appointments add constraint appointments_check CHECK (end_at > start_at);
alter table public.appointments add constraint appointments_check1 CHECK (client_id IS NOT NULL OR char_length(TRIM(BOTH FROM client_name)) >= 3);
alter table public.appointments add constraint appointments_no_professional_overlap EXCLUDE USING gist (professional_id WITH =, tstzrange(start_at, end_at, '[)'::text) WITH &&) WHERE (status = ANY (ARRAY['pending'::appointment_status, 'confirmed'::appointment_status]));
alter table public.appointments add constraint appointments_pkey PRIMARY KEY (id);
alter table public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);
alter table public.notification_preferences add constraint notification_preferences_pkey PRIMARY KEY (profile_id);
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.payments add constraint payments_amount_check CHECK (amount >= 0::numeric);
alter table public.payments add constraint payments_appointment_id_key UNIQUE (appointment_id);
alter table public.payments add constraint payments_pkey PRIMARY KEY (id);
alter table public.professional_services add constraint professional_services_custom_duration_minutes_check CHECK (custom_duration_minutes IS NULL OR custom_duration_minutes >= 30 AND custom_duration_minutes <= 720);
alter table public.professional_services add constraint professional_services_custom_price_check CHECK (custom_price >= 0::numeric);
alter table public.professional_services add constraint professional_services_pkey PRIMARY KEY (professional_id, service_id);
alter table public.professionals add constraint professionals_default_slot_minutes_check CHECK (default_slot_minutes >= 10 AND default_slot_minutes <= 480);
alter table public.professionals add constraint professionals_pkey PRIMARY KEY (id);
alter table public.professionals add constraint professionals_profile_id_key UNIQUE (profile_id);
alter table public.professionals add constraint professionals_whatsapp_number_format CHECK (whatsapp_number IS NULL OR whatsapp_number ~ '^[1-9][0-9]{10,14}$'::text);
alter table public.profiles add constraint profiles_full_name_check CHECK (char_length(TRIM(BOTH FROM full_name)) >= 3);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.schedule_blocks add constraint schedule_blocks_check CHECK (ends_at > starts_at);
alter table public.schedule_blocks add constraint schedule_blocks_pkey PRIMARY KEY (id);
alter table public.services add constraint services_duration_minutes_check CHECK (duration_minutes >= 30 AND duration_minutes <= 720);
alter table public.services add constraint services_pkey PRIMARY KEY (id);
alter table public.services add constraint services_price_check CHECK (price >= 0::numeric);
alter table public.services add constraint services_slug_key UNIQUE (slug);
alter table public.spa_settings add constraint spa_settings_booking_rules_check CHECK (jsonb_typeof(booking_rules) = 'object'::text);
alter table public.spa_settings add constraint spa_settings_business_check CHECK (jsonb_typeof(business) = 'object'::text);
alter table public.spa_settings add constraint spa_settings_business_hours_check CHECK (jsonb_typeof(business_hours) = 'object'::text);
alter table public.spa_settings add constraint spa_settings_id_check CHECK (id);
alter table public.spa_settings add constraint spa_settings_notifications_check CHECK (jsonb_typeof(notifications) = 'object'::text);
alter table public.spa_settings add constraint spa_settings_pkey PRIMARY KEY (id);
alter table public.appointments add constraint appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.appointments add constraint appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.appointments add constraint appointments_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE RESTRICT;
alter table public.appointments add constraint appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT;
alter table public.audit_logs add constraint audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.notification_preferences add constraint notification_preferences_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.professional_services add constraint professional_services_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE;
alter table public.professional_services add constraint professional_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;
alter table public.professionals add constraint professionals_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.schedule_blocks add constraint schedule_blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.schedule_blocks add constraint schedule_blocks_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE;
alter table public.services add constraint services_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.spa_settings add constraint spa_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id);
CREATE INDEX appointments_client_idx ON public.appointments USING btree (client_id, start_at DESC);
CREATE INDEX appointments_professional_idx ON public.appointments USING btree (professional_id, start_at);
CREATE INDEX appointments_status_idx ON public.appointments USING btree (status);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at DESC);
CREATE UNIQUE INDEX notifications_appointment_reminder_unique ON public.notifications USING btree (appointment_id, recipient_id, channel, notification_type) WHERE ((appointment_id IS NOT NULL) AND (notification_type = 'appointment_reminder'::text));
CREATE INDEX notifications_queue_idx ON public.notifications USING btree (status, scheduled_for);
CREATE INDEX notifications_recipient_idx ON public.notifications USING btree (recipient_id, created_at DESC);
CREATE INDEX payments_status_paid_at_idx ON public.payments USING btree (status, paid_at DESC);
CREATE UNIQUE INDEX profiles_email_unique ON public.profiles USING btree (lower(email));
CREATE INDEX profiles_role_idx ON public.profiles USING btree (role);
CREATE INDEX schedule_blocks_professional_time_idx ON public.schedule_blocks USING btree (professional_id, starts_at, ends_at);
CREATE INDEX services_active_category_idx ON public.services USING btree (active, category);

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and active); $function$
;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to postgres;
grant execute on function public.is_admin() to service_role;

CREATE OR REPLACE FUNCTION public.current_professional_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select id from public.professionals where profile_id = auth.uid() and active limit 1; $function$
;
revoke all on function public.current_professional_id() from public;
grant execute on function public.current_professional_id() to anon;
grant execute on function public.current_professional_id() to authenticated;
grant execute on function public.current_professional_id() to postgres;
grant execute on function public.current_professional_id() to service_role;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at = now(); return new; end;
$function$
;
revoke all on function public.set_updated_at() from public;
grant execute on function public.set_updated_at() to anon;
grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.set_updated_at() to postgres;
grant execute on function public.set_updated_at() to PUBLIC;
grant execute on function public.set_updated_at() to service_role;

CREATE OR REPLACE FUNCTION public.enforce_appointment_buffer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;

  /*
   * Serializa alterações da mesma profissional para
   * impedir duas reservas simultâneas dentro do intervalo.
   */
  perform pg_advisory_xact_lock(
    hashtextextended(new.professional_id::text, 0)
  );

  if exists (
    select 1
    from public.appointments existing
    where existing.professional_id =
      new.professional_id
      and existing.id is distinct from new.id
      and existing.status in (
        'pending',
        'confirmed'
      )
      and existing.start_at <
        new.end_at
      and new.start_at <
        existing.end_at
  ) then
    raise exception using
      errcode = '23P01',
      message =
        'O horário selecionado está ocupado por outro atendimento';
  end if;

  return new;
end;
$function$
;
revoke all on function public.enforce_appointment_buffer() from public;
grant execute on function public.enforce_appointment_buffer() to anon;
grant execute on function public.enforce_appointment_buffer() to authenticated;
grant execute on function public.enforce_appointment_buffer() to postgres;
grant execute on function public.enforce_appointment_buffer() to PUBLIC;
grant execute on function public.enforce_appointment_buffer() to service_role;

CREATE OR REPLACE FUNCTION public.validate_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  expected_duration integer;
  service_is_allowed boolean;
begin
  if tg_op = 'INSERT' and new.start_at <= now() and coalesce(new.outside_schedule, false) = false then
    raise exception 'Nao e permitido agendar no passado';
  end if;

  if new.service_id is not null then
    select coalesce(ps.custom_duration_minutes, s.duration_minutes), ps.active and s.active
      into expected_duration, service_is_allowed
    from public.professional_services ps
    join public.services s on s.id = ps.service_id
    where ps.professional_id = new.professional_id and ps.service_id = new.service_id;

    if not coalesce(service_is_allowed, false) then
      raise exception 'O profissional nao presta este servico';
    end if;

    if new.end_at is null then
      new.end_at := new.start_at + make_interval(mins => expected_duration);
    end if;
  end if;

  if new.end_at <= new.start_at then
    raise exception 'O termino deve ocorrer depois do inicio';
  end if;

  if exists (
    select 1 from public.schedule_blocks b
    where b.professional_id = new.professional_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(new.start_at, new.end_at, '[)')
  ) then
    raise exception 'O horario esta bloqueado na agenda da profissional';
  end if;

  return new;
end;
$function$
;
revoke all on function public.validate_appointment() from public;
grant execute on function public.validate_appointment() to anon;
grant execute on function public.validate_appointment() to authenticated;
grant execute on function public.validate_appointment() to postgres;
grant execute on function public.validate_appointment() to PUBLIC;
grant execute on function public.validate_appointment() to service_role;

CREATE OR REPLACE FUNCTION public.validate_client_booking_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  same_professional_day_count integer;
  future_active_count integer;
begin
  -- Encaixes de admin e profissionais não são limitados.
  if new.client_id is null
    or new.created_by is distinct from new.client_id
    or new.outside_schedule = true
  then
    return new;
  end if;

  -- Impede requisições simultâneas da mesma cliente.
  perform pg_advisory_xact_lock(
    hashtextextended(new.client_id::text, 0)
  );

  select count(*)
  into same_professional_day_count
  from public.appointments a
  where a.client_id = new.client_id
    and a.professional_id = new.professional_id
    and a.status in ('pending', 'confirmed')
    and (
      a.start_at at time zone 'America/Sao_Paulo'
    )::date = (
      new.start_at at time zone 'America/Sao_Paulo'
    )::date;

  if same_professional_day_count >= 1 then
    raise exception
      'Você já possui um horário ativo com esta profissional neste dia.';
  end if;

  select count(*)
  into future_active_count
  from public.appointments a
  where a.client_id = new.client_id
    and a.status in ('pending', 'confirmed')
    and a.start_at > now();

  if future_active_count >= 3 then
    raise exception
      'Você atingiu o limite de 3 agendamentos futuros ativos.';
  end if;

  return new;
end;
$function$
;
revoke all on function public.validate_client_booking_limits() from public;
grant execute on function public.validate_client_booking_limits() to anon;
grant execute on function public.validate_client_booking_limits() to authenticated;
grant execute on function public.validate_client_booking_limits() to postgres;
grant execute on function public.validate_client_booking_limits() to PUBLIC;
grant execute on function public.validate_client_booking_limits() to service_role;

CREATE OR REPLACE FUNCTION public.validate_configured_client_cancellation_notice_017()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  rules jsonb;
  rule_enabled boolean := false;
  notice_hours integer := 0;
begin
  if old.status is distinct from 'cancelled'
    and new.status = 'cancelled'
    and auth.uid() = old.client_id
  then
    select booking_rules
    into rules
    from public.spa_settings
    where id = true
    limit 1;

    if jsonb_typeof(rules -> 'cancellationEnabled') = 'boolean'
    then
      rule_enabled :=
        (rules ->> 'cancellationEnabled')::boolean;
    end if;

    if coalesce(
      rules ->> 'cancellationNoticeHours',
      ''
    ) ~ '^[0-9]{1,5}$'
    then
      notice_hours := greatest(
        (
          rules ->> 'cancellationNoticeHours'
        )::integer,
        0
      );
    end if;

    if rule_enabled
      and old.start_at <= now()
        + make_interval(hours => notice_hours)
    then
      raise exception
        'O cancelamento deve ser solicitado com pelo menos % hora(s) de antecedência.',
        notice_hours;
    end if;
  end if;

  return new;
end;
$function$
;
revoke all on function public.validate_configured_client_cancellation_notice_017() from public;
grant execute on function public.validate_configured_client_cancellation_notice_017() to postgres;
grant execute on function public.validate_configured_client_cancellation_notice_017() to service_role;

CREATE OR REPLACE FUNCTION public.queue_admin_appointment_notifications_018()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  notification_title text;
  notification_body text;
  notification_kind text;
  service_name text;
  professional_name text;
begin
  select
    s.name,
    p.display_name
  into
    service_name,
    professional_name
  from public.services s
  join public.professionals p
    on p.id = new.professional_id
  where s.id = new.service_id;

  if tg_op = 'INSERT' then
    notification_kind := 'admin_appointment_created';
    notification_title := 'Novo agendamento confirmado';

    notification_body :=
      coalesce(new.client_name, 'Uma cliente')
      || ' agendou '
      || coalesce(service_name, 'um serviço')
      || ' com '
      || coalesce(professional_name, 'a profissional')
      || '.';

  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status::text in ('cancelled', 'completed', 'no_show')
  then
    notification_kind :=
      case new.status::text
        when 'cancelled' then 'admin_appointment_cancelled'
        when 'completed' then 'admin_appointment_completed'
        when 'no_show' then 'admin_appointment_no_show'
      end;

    notification_title :=
      case new.status::text
        when 'cancelled' then 'Agendamento cancelado'
        when 'completed' then 'Atendimento concluído'
        when 'no_show' then 'Cliente não compareceu'
      end;

    notification_body :=
      coalesce(new.client_name, 'Cliente')
      || ' · '
      || coalesce(service_name, 'Serviço')
      || ' com '
      || coalesce(professional_name, 'profissional')
      || '.';

  else
    return new;
  end if;

  insert into public.notifications (
    appointment_id,
    recipient_id,
    channel,
    notification_type,
    title,
    body,
    status,
    scheduled_for
  )
  select
    new.id,
    admin_profile.id,
    'in_app'::public.notification_channel,
    notification_kind,
    notification_title,
    notification_body,
    'pending'::public.notification_status,
    now()
  from public.profiles admin_profile
  left join public.notification_preferences preferences
    on preferences.profile_id = admin_profile.id
  where admin_profile.role = 'admin'
    and admin_profile.active
    and coalesce(preferences.in_app_enabled, true)
    and not exists (
      select 1
      from public.notifications existing
      where existing.appointment_id = new.id
        and existing.recipient_id = admin_profile.id
        and existing.channel = 'in_app'
        and existing.notification_type = notification_kind
    );

  return new;
end;
$function$
;
revoke all on function public.queue_admin_appointment_notifications_018() from public;
grant execute on function public.queue_admin_appointment_notifications_018() to anon;
grant execute on function public.queue_admin_appointment_notifications_018() to authenticated;
grant execute on function public.queue_admin_appointment_notifications_018() to postgres;
grant execute on function public.queue_admin_appointment_notifications_018() to service_role;

CREATE OR REPLACE FUNCTION public.queue_admin_payment_notifications_018()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  client_name text;
  service_name text;
  professional_name text;
  notification_body text;
begin
  if old.status is not distinct from new.status
    or new.status::text <> 'paid'
  then
    return new;
  end if;

  select
    a.client_name,
    s.name,
    p.display_name
  into
    client_name,
    service_name,
    professional_name
  from public.appointments a
  join public.services s
    on s.id = a.service_id
  join public.professionals p
    on p.id = a.professional_id
  where a.id = new.appointment_id;

  notification_body :=
    coalesce(client_name, 'Cliente')
    || ' pagou R$ '
    || replace(
      to_char(new.amount, 'FM999999990D00'),
      '.',
      ','
    )
    || ' por '
    || coalesce(service_name, 'um serviço')
    || ' com '
    || coalesce(professional_name, 'a profissional')
    || '.';

  insert into public.notifications (
    appointment_id,
    recipient_id,
    channel,
    notification_type,
    title,
    body,
    status,
    scheduled_for
  )
  select
    new.appointment_id,
    admin_profile.id,
    'in_app'::public.notification_channel,
    'admin_payment_confirmed',
    'Pagamento registrado',
    notification_body,
    'pending'::public.notification_status,
    now()
  from public.profiles admin_profile
  left join public.notification_preferences preferences
    on preferences.profile_id = admin_profile.id
  where admin_profile.role = 'admin'
    and admin_profile.active
    and coalesce(preferences.in_app_enabled, true)
    and not exists (
      select 1
      from public.notifications existing
      where existing.appointment_id = new.appointment_id
        and existing.recipient_id = admin_profile.id
        and existing.channel = 'in_app'
        and existing.notification_type = 'admin_payment_confirmed'
    );

  return new;
end;
$function$
;
revoke all on function public.queue_admin_payment_notifications_018() from public;
grant execute on function public.queue_admin_payment_notifications_018() to anon;
grant execute on function public.queue_admin_payment_notifications_018() to authenticated;
grant execute on function public.queue_admin_payment_notifications_018() to postgres;
grant execute on function public.queue_admin_payment_notifications_018() to service_role;

CREATE OR REPLACE FUNCTION public.queue_appointment_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  professional_profile uuid;
begin
  select profile_id
  into professional_profile
  from public.professionals
  where id = new.professional_id;

  /*
   * Clientes recebem somente e-mail.
   */
  if new.client_id is not null then
    insert into public.notifications (
      appointment_id,
      recipient_id,
      channel,
      notification_type,
      title,
      body
    )
    values (
      new.id,
      new.client_id,
      'email',
      'appointment_created',
      'Agendamento confirmado',
      'Seu horário foi reservado no SPA Express Cambucás.'
    );
  end if;

  /*
   * Profissionais recebem e-mail e notificação interna.
   */
  if professional_profile is not null then
    insert into public.notifications (
      appointment_id,
      recipient_id,
      channel,
      notification_type,
      title,
      body
    )
    select
      new.id,
      professional_profile,
      channel,
      'appointment_created',
      'Novo agendamento',
      new.client_name || ' reservou um horário na sua agenda.'
    from unnest(
      array[
        'in_app',
        'email'
      ]::public.notification_channel[]
    ) as channel;
  end if;

  return new;
end;
$function$
;
revoke all on function public.queue_appointment_notifications() from public;
grant execute on function public.queue_appointment_notifications() to anon;
grant execute on function public.queue_appointment_notifications() to authenticated;
grant execute on function public.queue_appointment_notifications() to postgres;
grant execute on function public.queue_appointment_notifications() to PUBLIC;
grant execute on function public.queue_appointment_notifications() to service_role;

CREATE OR REPLACE FUNCTION public.queue_appointment_cancellation_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  professional_profile uuid;
begin
  /*
   * Segurança adicional: somente processa a transição
   * de outro status para cancelled.
   */
  if old.status is not distinct from new.status
    or new.status <> 'cancelled'
  then
    return new;
  end if;

  select profile_id
  into professional_profile
  from public.professionals
  where id = new.professional_id;

  /*
   * A cliente recebe somente e-mail.
   */
  if new.client_id is not null then
    insert into public.notifications (
      appointment_id,
      recipient_id,
      channel,
      notification_type,
      title,
      body,
      status,
      scheduled_for
    )
    select
      new.id,
      new.client_id,
      'email'::public.notification_channel,
      'appointment_cancelled',
      'Agendamento cancelado',
      'O cancelamento do seu horário foi confirmado.',
      'pending'::public.notification_status,
      now()
    where not exists (
      select 1
      from public.notifications existing
      where existing.appointment_id = new.id
        and existing.recipient_id = new.client_id
        and existing.channel = 'email'
        and existing.notification_type = 'appointment_cancelled'
    );
  end if;

  /*
   * A profissional recebe e-mail e aviso interno.
   */
  if professional_profile is not null then
    insert into public.notifications (
      appointment_id,
      recipient_id,
      channel,
      notification_type,
      title,
      body,
      status,
      scheduled_for
    )
    select
      new.id,
      professional_profile,
      selected_channel,
      'appointment_cancelled',
      'Agendamento cancelado',
      'O agendamento de '
        || coalesce(new.client_name, 'uma cliente')
        || ' foi cancelado.',
      'pending'::public.notification_status,
      now()
    from unnest(
      array[
        'email',
        'in_app'
      ]::public.notification_channel[]
    ) as selected_channel
    where not exists (
      select 1
      from public.notifications existing
      where existing.appointment_id = new.id
        and existing.recipient_id = professional_profile
        and existing.channel = selected_channel
        and existing.notification_type = 'appointment_cancelled'
    );
  end if;

  return new;
end;
$function$
;
revoke all on function public.queue_appointment_cancellation_notifications() from public;
grant execute on function public.queue_appointment_cancellation_notifications() to anon;
grant execute on function public.queue_appointment_cancellation_notifications() to authenticated;
grant execute on function public.queue_appointment_cancellation_notifications() to postgres;
grant execute on function public.queue_appointment_cancellation_notifications() to PUBLIC;
grant execute on function public.queue_appointment_cancellation_notifications() to service_role;

CREATE OR REPLACE FUNCTION public.create_payment_for_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare appointment_price numeric(10,2);
begin
  if new.service_id is null then return new; end if;
  select coalesce(ps.custom_price, s.price) into appointment_price
  from public.professional_services ps
  join public.services s on s.id = ps.service_id
  where ps.professional_id = new.professional_id and ps.service_id = new.service_id;

  insert into public.payments (appointment_id, amount)
  values (new.id, coalesce(appointment_price, 0))
  on conflict (appointment_id) do nothing;
  return new;
end;
$function$
;
revoke all on function public.create_payment_for_appointment() from public;
grant execute on function public.create_payment_for_appointment() to anon;
grant execute on function public.create_payment_for_appointment() to authenticated;
grant execute on function public.create_payment_for_appointment() to postgres;
grant execute on function public.create_payment_for_appointment() to PUBLIC;
grant execute on function public.create_payment_for_appointment() to service_role;

CREATE OR REPLACE FUNCTION public.cancel_pending_payment_with_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'cancelled'
    and old.status is distinct from new.status
  then
    update public.payments
    set
      status = 'cancelled'::text::public.payment_status,
      notes = case
        when notes is null or trim(notes) = ''
          then 'Cancelado junto com o agendamento'
        else notes || E'\nCancelado junto com o agendamento'
      end,
      updated_at = now()
    where appointment_id = new.id
      and status = 'pending';
  end if;

  return new;
end;
$function$
;
revoke all on function public.cancel_pending_payment_with_appointment() from public;
grant execute on function public.cancel_pending_payment_with_appointment() to anon;
grant execute on function public.cancel_pending_payment_with_appointment() to authenticated;
grant execute on function public.cancel_pending_payment_with_appointment() to postgres;
grant execute on function public.cancel_pending_payment_with_appointment() to PUBLIC;
grant execute on function public.cancel_pending_payment_with_appointment() to service_role;

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  /*
   * Operações internas com service_role ou executadas
   * diretamente pelo banco não possuem auth.uid().
   */
  if auth.uid() is null then
    return new;
  end if;

  /*
   * Administradores ativos podem gerenciar os campos
   * administrativos dos perfis.
   */
  if public.is_admin() then
    return new;
  end if;

  /*
   * Clientes e profissionais não podem alterar campos
   * de identidade, acesso ou controle administrativo.
   */
  if new.id is distinct from old.id then
    raise exception using
      errcode = '42501',
      message = 'Não é permitido alterar o identificador do perfil.';
  end if;

  if new.email is distinct from old.email then
    raise exception using
      errcode = '42501',
      message = 'O e-mail do perfil não pode ser alterado por esta operação.';
  end if;

  if new.role is distinct from old.role then
    raise exception using
      errcode = '42501',
      message = 'Não é permitido alterar o tipo de acesso do perfil.';
  end if;

  if new.active is distinct from old.active then
    raise exception using
      errcode = '42501',
      message = 'Não é permitido alterar a situação do perfil.';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '42501',
      message = 'Não é permitido alterar a data de criação do perfil.';
  end if;

  return new;
end;
$function$
;
revoke all on function public.protect_profile_sensitive_fields() from public;
grant execute on function public.protect_profile_sensitive_fields() to postgres;
grant execute on function public.protect_profile_sensitive_fields() to service_role;

CREATE OR REPLACE FUNCTION public.complete_professional_appointment(p_appointment_id uuid, p_payment_received boolean, p_payment_method text DEFAULT NULL::text, p_payment_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  current_appointment public.appointments;
  current_payment public.payments;
  normalized_method text;
begin
  select *
  into current_appointment
  from public.appointments
  where id = p_appointment_id
    and professional_id =
      public.current_professional_id();

  if current_appointment.id is null then
    raise exception
      'Agendamento não encontrado para esta profissional.';
  end if;

  if current_appointment.status <> 'confirmed' then
    raise exception
      'Somente atendimentos confirmados podem ser concluídos.';
  end if;

  if current_appointment.start_at > now() then
    raise exception
      'Um atendimento futuro não pode ser concluído.';
  end if;

  normalized_method :=
    lower(trim(coalesce(p_payment_method, '')));

  if
    p_payment_received
    and normalized_method not in (
      'pix',
      'dinheiro',
      'cartao',
      'outro'
    )
  then
    raise exception
      'Informe uma forma de pagamento válida.';
  end if;

  update public.appointments
  set
    status = 'completed',
    updated_at = now()
  where id = current_appointment.id;

  select *
  into current_payment
  from public.payments
  where appointment_id = current_appointment.id;

  if p_payment_received then
    if current_payment.id is null then
      raise exception
        'Pagamento do atendimento não encontrado.';
    end if;

    update public.payments
    set
      status = 'paid',
      method = normalized_method,
      notes = nullif(
        trim(coalesce(p_payment_notes, '')),
        ''
      ),
      confirmed_by = auth.uid(),
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
    where id = current_payment.id
    returning * into current_payment;
  end if;

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    auth.uid(),
    'appointment_completed',
    'appointment',
    current_appointment.id::text,
    jsonb_build_object(
      'payment_received',
      p_payment_received,
      'payment_method',
      case
        when p_payment_received
        then normalized_method
        else null
      end,
      'payment_amount',
      current_payment.amount
    )
  );

  return jsonb_build_object(
    'appointment_id',
    current_appointment.id,
    'appointment_status',
    'completed',
    'payment_status',
    case
      when p_payment_received
      then 'paid'
      else coalesce(
        current_payment.status::text,
        'pending'
      )
    end
  );
end;
$function$
;
revoke all on function public.complete_professional_appointment(p_appointment_id uuid, p_payment_received boolean, p_payment_method text, p_payment_notes text) from public;
grant execute on function public.complete_professional_appointment(p_appointment_id uuid, p_payment_received boolean, p_payment_method text, p_payment_notes text) to anon;
grant execute on function public.complete_professional_appointment(p_appointment_id uuid, p_payment_received boolean, p_payment_method text, p_payment_notes text) to authenticated;
grant execute on function public.complete_professional_appointment(p_appointment_id uuid, p_payment_received boolean, p_payment_method text, p_payment_notes text) to postgres;
grant execute on function public.complete_professional_appointment(p_appointment_id uuid, p_payment_received boolean, p_payment_method text, p_payment_notes text) to service_role;

CREATE OR REPLACE FUNCTION public.update_professional_appointment_status(p_appointment_id uuid, p_status appointment_status, p_reason text DEFAULT NULL::text)
 RETURNS appointments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  current_appointment public.appointments;
  updated_appointment public.appointments;
begin
  select *
  into current_appointment
  from public.appointments
  where id = p_appointment_id
    and professional_id =
      public.current_professional_id();

  if current_appointment.id is null then
    raise exception
      'Agendamento não encontrado para esta profissional.';
  end if;

  if current_appointment.status = p_status then
    return current_appointment;
  end if;

  if not (
    (
      current_appointment.status = 'pending'
      and p_status in ('confirmed', 'cancelled')
    )
    or
    (
      current_appointment.status = 'confirmed'
      and p_status in (
        'completed',
        'cancelled',
        'no_show'
      )
    )
  ) then
    raise exception
      'Transição de status não permitida.';
  end if;

  if
    p_status in ('completed', 'no_show')
    and current_appointment.start_at > now()
  then
    raise exception
      'Um atendimento futuro não pode ser concluído ou marcado como ausência.';
  end if;

  if
    p_status = 'cancelled'
    and char_length(
      trim(coalesce(p_reason, ''))
    ) < 3
  then
    raise exception
      'Informe o motivo do cancelamento.';
  end if;

  update public.appointments
  set
    status = p_status,
    cancelled_at = case
      when p_status = 'cancelled'
      then now()
      else cancelled_at
    end,
    cancellation_reason = case
      when p_status = 'cancelled'
      then trim(p_reason)
      else cancellation_reason
    end,
    updated_at = now()
  where id = current_appointment.id
  returning * into updated_appointment;

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    auth.uid(),
    'appointment_status_changed',
    'appointment',
    updated_appointment.id::text,
    jsonb_build_object(
      'previous_status',
      current_appointment.status,
      'new_status',
      updated_appointment.status,
      'reason',
      nullif(trim(coalesce(p_reason, '')), '')
    )
  );

  return updated_appointment;
end;
$function$
;
revoke all on function public.update_professional_appointment_status(p_appointment_id uuid, p_status appointment_status, p_reason text) from public;
grant execute on function public.update_professional_appointment_status(p_appointment_id uuid, p_status appointment_status, p_reason text) to anon;
grant execute on function public.update_professional_appointment_status(p_appointment_id uuid, p_status appointment_status, p_reason text) to authenticated;
grant execute on function public.update_professional_appointment_status(p_appointment_id uuid, p_status appointment_status, p_reason text) to postgres;
grant execute on function public.update_professional_appointment_status(p_appointment_id uuid, p_status appointment_status, p_reason text) to service_role;
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles as PERMISSIVE for SELECT to authenticated using (((id = ( SELECT auth.uid() AS uid)) OR is_admin()));
create policy profiles_update_own on public.profiles as PERMISSIVE for UPDATE to authenticated using (((id = ( SELECT auth.uid() AS uid)) OR is_admin())) with check (((id = ( SELECT auth.uid() AS uid)) OR is_admin()));
grant SELECT on public.profiles to authenticated;
grant UPDATE on public.profiles to authenticated;
grant DELETE on public.profiles to postgres;
grant INSERT on public.profiles to postgres;
grant MAINTAIN on public.profiles to postgres;
grant REFERENCES on public.profiles to postgres;
grant SELECT on public.profiles to postgres;
grant TRIGGER on public.profiles to postgres;
grant TRUNCATE on public.profiles to postgres;
grant UPDATE on public.profiles to postgres;
grant DELETE on public.profiles to service_role;
grant INSERT on public.profiles to service_role;
grant MAINTAIN on public.profiles to service_role;
grant REFERENCES on public.profiles to service_role;
grant SELECT on public.profiles to service_role;
grant TRIGGER on public.profiles to service_role;
grant TRUNCATE on public.profiles to service_role;
grant UPDATE on public.profiles to service_role;
alter table public.professionals enable row level security;
create policy professionals_admin_all on public.professionals as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());
create policy professionals_public_read on public.professionals as PERMISSIVE for SELECT to public using ((active OR is_admin()));
create policy professionals_update_self on public.professionals as PERMISSIVE for UPDATE to public using ((profile_id = auth.uid())) with check ((profile_id = auth.uid()));
grant DELETE on public.professionals to anon;
grant INSERT on public.professionals to anon;
grant MAINTAIN on public.professionals to anon;
grant REFERENCES on public.professionals to anon;
grant SELECT on public.professionals to anon;
grant TRIGGER on public.professionals to anon;
grant TRUNCATE on public.professionals to anon;
grant UPDATE on public.professionals to anon;
grant DELETE on public.professionals to authenticated;
grant INSERT on public.professionals to authenticated;
grant MAINTAIN on public.professionals to authenticated;
grant REFERENCES on public.professionals to authenticated;
grant SELECT on public.professionals to authenticated;
grant TRIGGER on public.professionals to authenticated;
grant TRUNCATE on public.professionals to authenticated;
grant UPDATE on public.professionals to authenticated;
grant DELETE on public.professionals to postgres;
grant INSERT on public.professionals to postgres;
grant MAINTAIN on public.professionals to postgres;
grant REFERENCES on public.professionals to postgres;
grant SELECT on public.professionals to postgres;
grant TRIGGER on public.professionals to postgres;
grant TRUNCATE on public.professionals to postgres;
grant UPDATE on public.professionals to postgres;
grant DELETE on public.professionals to service_role;
grant INSERT on public.professionals to service_role;
grant MAINTAIN on public.professionals to service_role;
grant REFERENCES on public.professionals to service_role;
grant SELECT on public.professionals to service_role;
grant TRIGGER on public.professionals to service_role;
grant TRUNCATE on public.professionals to service_role;
grant UPDATE on public.professionals to service_role;
alter table public.services enable row level security;
create policy services_admin_all on public.services as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());
create policy services_professional_insert on public.services as PERMISSIVE for INSERT to public with check (((created_by = auth.uid()) AND (current_professional_id() IS NOT NULL)));
create policy services_professional_update on public.services as PERMISSIVE for UPDATE to public using ((created_by = auth.uid())) with check ((created_by = auth.uid()));
create policy services_public_read on public.services as PERMISSIVE for SELECT to public using ((active OR is_admin()));
grant DELETE on public.services to anon;
grant INSERT on public.services to anon;
grant MAINTAIN on public.services to anon;
grant REFERENCES on public.services to anon;
grant SELECT on public.services to anon;
grant TRIGGER on public.services to anon;
grant TRUNCATE on public.services to anon;
grant UPDATE on public.services to anon;
grant DELETE on public.services to authenticated;
grant INSERT on public.services to authenticated;
grant MAINTAIN on public.services to authenticated;
grant REFERENCES on public.services to authenticated;
grant SELECT on public.services to authenticated;
grant TRIGGER on public.services to authenticated;
grant TRUNCATE on public.services to authenticated;
grant UPDATE on public.services to authenticated;
grant DELETE on public.services to postgres;
grant INSERT on public.services to postgres;
grant MAINTAIN on public.services to postgres;
grant REFERENCES on public.services to postgres;
grant SELECT on public.services to postgres;
grant TRIGGER on public.services to postgres;
grant TRUNCATE on public.services to postgres;
grant UPDATE on public.services to postgres;
grant DELETE on public.services to service_role;
grant INSERT on public.services to service_role;
grant MAINTAIN on public.services to service_role;
grant REFERENCES on public.services to service_role;
grant SELECT on public.services to service_role;
grant TRIGGER on public.services to service_role;
grant TRUNCATE on public.services to service_role;
grant UPDATE on public.services to service_role;
alter table public.professional_services enable row level security;
create policy professional_services_admin_all on public.professional_services as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());
create policy professional_services_public_read on public.professional_services as PERMISSIVE for SELECT to public using ((active OR is_admin()));
create policy professional_services_self_all on public.professional_services as PERMISSIVE for ALL to public using ((professional_id = current_professional_id())) with check ((professional_id = current_professional_id()));
grant DELETE on public.professional_services to anon;
grant INSERT on public.professional_services to anon;
grant MAINTAIN on public.professional_services to anon;
grant REFERENCES on public.professional_services to anon;
grant SELECT on public.professional_services to anon;
grant TRIGGER on public.professional_services to anon;
grant TRUNCATE on public.professional_services to anon;
grant UPDATE on public.professional_services to anon;
grant DELETE on public.professional_services to authenticated;
grant INSERT on public.professional_services to authenticated;
grant MAINTAIN on public.professional_services to authenticated;
grant REFERENCES on public.professional_services to authenticated;
grant SELECT on public.professional_services to authenticated;
grant TRIGGER on public.professional_services to authenticated;
grant TRUNCATE on public.professional_services to authenticated;
grant UPDATE on public.professional_services to authenticated;
grant DELETE on public.professional_services to postgres;
grant INSERT on public.professional_services to postgres;
grant MAINTAIN on public.professional_services to postgres;
grant REFERENCES on public.professional_services to postgres;
grant SELECT on public.professional_services to postgres;
grant TRIGGER on public.professional_services to postgres;
grant TRUNCATE on public.professional_services to postgres;
grant UPDATE on public.professional_services to postgres;
grant DELETE on public.professional_services to service_role;
grant INSERT on public.professional_services to service_role;
grant MAINTAIN on public.professional_services to service_role;
grant REFERENCES on public.professional_services to service_role;
grant SELECT on public.professional_services to service_role;
grant TRIGGER on public.professional_services to service_role;
grant TRUNCATE on public.professional_services to service_role;
grant UPDATE on public.professional_services to service_role;
alter table public.appointments enable row level security;
create policy appointments_client_cancel on public.appointments as PERMISSIVE for UPDATE to public using (((client_id = auth.uid()) AND (start_at > now()))) with check (((client_id = auth.uid()) AND (status = 'cancelled'::appointment_status)));
create policy appointments_client_insert on public.appointments as PERMISSIVE for INSERT to public with check (((client_id = auth.uid()) AND (created_by = auth.uid()) AND (start_at > now()) AND (outside_schedule = false)));
create policy appointments_select on public.appointments as PERMISSIVE for SELECT to public using (((client_id = auth.uid()) OR is_admin() OR (professional_id = current_professional_id())));
create policy appointments_team_insert on public.appointments as PERMISSIVE for INSERT to public with check ((is_admin() OR ((professional_id = current_professional_id()) AND (created_by = auth.uid()))));
create policy appointments_team_update on public.appointments as PERMISSIVE for UPDATE to public using ((is_admin() OR (professional_id = current_professional_id()))) with check ((is_admin() OR (professional_id = current_professional_id())));
grant DELETE on public.appointments to anon;
grant INSERT on public.appointments to anon;
grant MAINTAIN on public.appointments to anon;
grant REFERENCES on public.appointments to anon;
grant SELECT on public.appointments to anon;
grant TRIGGER on public.appointments to anon;
grant TRUNCATE on public.appointments to anon;
grant UPDATE on public.appointments to anon;
grant DELETE on public.appointments to authenticated;
grant INSERT on public.appointments to authenticated;
grant MAINTAIN on public.appointments to authenticated;
grant REFERENCES on public.appointments to authenticated;
grant SELECT on public.appointments to authenticated;
grant TRIGGER on public.appointments to authenticated;
grant TRUNCATE on public.appointments to authenticated;
grant UPDATE on public.appointments to authenticated;
grant DELETE on public.appointments to postgres;
grant INSERT on public.appointments to postgres;
grant MAINTAIN on public.appointments to postgres;
grant REFERENCES on public.appointments to postgres;
grant SELECT on public.appointments to postgres;
grant TRIGGER on public.appointments to postgres;
grant TRUNCATE on public.appointments to postgres;
grant UPDATE on public.appointments to postgres;
grant DELETE on public.appointments to service_role;
grant INSERT on public.appointments to service_role;
grant MAINTAIN on public.appointments to service_role;
grant REFERENCES on public.appointments to service_role;
grant SELECT on public.appointments to service_role;
grant TRIGGER on public.appointments to service_role;
grant TRUNCATE on public.appointments to service_role;
grant UPDATE on public.appointments to service_role;
alter table public.payments enable row level security;
create policy payments_admin_update on public.payments as PERMISSIVE for UPDATE to public using (is_admin()) with check (is_admin());
create policy payments_professional_update on public.payments as PERMISSIVE for UPDATE to public using ((EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = payments.appointment_id) AND (a.professional_id = current_professional_id()))))) with check ((EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = payments.appointment_id) AND (a.professional_id = current_professional_id())))));
create policy payments_select on public.payments as PERMISSIVE for SELECT to public using ((is_admin() OR (EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = payments.appointment_id) AND ((a.client_id = auth.uid()) OR (a.professional_id = current_professional_id())))))));
grant DELETE on public.payments to anon;
grant INSERT on public.payments to anon;
grant MAINTAIN on public.payments to anon;
grant REFERENCES on public.payments to anon;
grant SELECT on public.payments to anon;
grant TRIGGER on public.payments to anon;
grant TRUNCATE on public.payments to anon;
grant UPDATE on public.payments to anon;
grant DELETE on public.payments to authenticated;
grant INSERT on public.payments to authenticated;
grant MAINTAIN on public.payments to authenticated;
grant REFERENCES on public.payments to authenticated;
grant SELECT on public.payments to authenticated;
grant TRIGGER on public.payments to authenticated;
grant TRUNCATE on public.payments to authenticated;
grant UPDATE on public.payments to authenticated;
grant DELETE on public.payments to postgres;
grant INSERT on public.payments to postgres;
grant MAINTAIN on public.payments to postgres;
grant REFERENCES on public.payments to postgres;
grant SELECT on public.payments to postgres;
grant TRIGGER on public.payments to postgres;
grant TRUNCATE on public.payments to postgres;
grant UPDATE on public.payments to postgres;
grant DELETE on public.payments to service_role;
grant INSERT on public.payments to service_role;
grant MAINTAIN on public.payments to service_role;
grant REFERENCES on public.payments to service_role;
grant SELECT on public.payments to service_role;
grant TRIGGER on public.payments to service_role;
grant TRUNCATE on public.payments to service_role;
grant UPDATE on public.payments to service_role;
alter table public.audit_logs enable row level security;
create policy audit_admin_read on public.audit_logs as PERMISSIVE for SELECT to public using (is_admin());
grant DELETE on public.audit_logs to anon;
grant INSERT on public.audit_logs to anon;
grant MAINTAIN on public.audit_logs to anon;
grant REFERENCES on public.audit_logs to anon;
grant SELECT on public.audit_logs to anon;
grant TRIGGER on public.audit_logs to anon;
grant TRUNCATE on public.audit_logs to anon;
grant UPDATE on public.audit_logs to anon;
grant DELETE on public.audit_logs to authenticated;
grant INSERT on public.audit_logs to authenticated;
grant MAINTAIN on public.audit_logs to authenticated;
grant REFERENCES on public.audit_logs to authenticated;
grant SELECT on public.audit_logs to authenticated;
grant TRIGGER on public.audit_logs to authenticated;
grant TRUNCATE on public.audit_logs to authenticated;
grant UPDATE on public.audit_logs to authenticated;
grant DELETE on public.audit_logs to postgres;
grant INSERT on public.audit_logs to postgres;
grant MAINTAIN on public.audit_logs to postgres;
grant REFERENCES on public.audit_logs to postgres;
grant SELECT on public.audit_logs to postgres;
grant TRIGGER on public.audit_logs to postgres;
grant TRUNCATE on public.audit_logs to postgres;
grant UPDATE on public.audit_logs to postgres;
grant DELETE on public.audit_logs to service_role;
grant INSERT on public.audit_logs to service_role;
grant MAINTAIN on public.audit_logs to service_role;
grant REFERENCES on public.audit_logs to service_role;
grant SELECT on public.audit_logs to service_role;
grant TRIGGER on public.audit_logs to service_role;
grant TRUNCATE on public.audit_logs to service_role;
grant UPDATE on public.audit_logs to service_role;
alter table public.notifications enable row level security;
create policy notifications_own_read on public.notifications as PERMISSIVE for SELECT to public using (((recipient_id = auth.uid()) OR is_admin()));
create policy notifications_own_update on public.notifications as PERMISSIVE for UPDATE to public using (((recipient_id = auth.uid()) OR is_admin())) with check (((recipient_id = auth.uid()) OR is_admin()));
grant DELETE on public.notifications to anon;
grant INSERT on public.notifications to anon;
grant MAINTAIN on public.notifications to anon;
grant REFERENCES on public.notifications to anon;
grant SELECT on public.notifications to anon;
grant TRIGGER on public.notifications to anon;
grant TRUNCATE on public.notifications to anon;
grant UPDATE on public.notifications to anon;
grant DELETE on public.notifications to authenticated;
grant INSERT on public.notifications to authenticated;
grant MAINTAIN on public.notifications to authenticated;
grant REFERENCES on public.notifications to authenticated;
grant SELECT on public.notifications to authenticated;
grant TRIGGER on public.notifications to authenticated;
grant TRUNCATE on public.notifications to authenticated;
grant UPDATE on public.notifications to authenticated;
grant DELETE on public.notifications to postgres;
grant INSERT on public.notifications to postgres;
grant MAINTAIN on public.notifications to postgres;
grant REFERENCES on public.notifications to postgres;
grant SELECT on public.notifications to postgres;
grant TRIGGER on public.notifications to postgres;
grant TRUNCATE on public.notifications to postgres;
grant UPDATE on public.notifications to postgres;
grant DELETE on public.notifications to service_role;
grant INSERT on public.notifications to service_role;
grant MAINTAIN on public.notifications to service_role;
grant REFERENCES on public.notifications to service_role;
grant SELECT on public.notifications to service_role;
grant TRIGGER on public.notifications to service_role;
grant TRUNCATE on public.notifications to service_role;
grant UPDATE on public.notifications to service_role;
alter table public.notification_preferences enable row level security;
create policy preferences_own_all on public.notification_preferences as PERMISSIVE for ALL to public using (((profile_id = auth.uid()) OR is_admin())) with check (((profile_id = auth.uid()) OR is_admin()));
grant DELETE on public.notification_preferences to anon;
grant INSERT on public.notification_preferences to anon;
grant MAINTAIN on public.notification_preferences to anon;
grant REFERENCES on public.notification_preferences to anon;
grant SELECT on public.notification_preferences to anon;
grant TRIGGER on public.notification_preferences to anon;
grant TRUNCATE on public.notification_preferences to anon;
grant UPDATE on public.notification_preferences to anon;
grant DELETE on public.notification_preferences to authenticated;
grant INSERT on public.notification_preferences to authenticated;
grant MAINTAIN on public.notification_preferences to authenticated;
grant REFERENCES on public.notification_preferences to authenticated;
grant SELECT on public.notification_preferences to authenticated;
grant TRIGGER on public.notification_preferences to authenticated;
grant TRUNCATE on public.notification_preferences to authenticated;
grant UPDATE on public.notification_preferences to authenticated;
grant DELETE on public.notification_preferences to postgres;
grant INSERT on public.notification_preferences to postgres;
grant MAINTAIN on public.notification_preferences to postgres;
grant REFERENCES on public.notification_preferences to postgres;
grant SELECT on public.notification_preferences to postgres;
grant TRIGGER on public.notification_preferences to postgres;
grant TRUNCATE on public.notification_preferences to postgres;
grant UPDATE on public.notification_preferences to postgres;
grant DELETE on public.notification_preferences to service_role;
grant INSERT on public.notification_preferences to service_role;
grant MAINTAIN on public.notification_preferences to service_role;
grant REFERENCES on public.notification_preferences to service_role;
grant SELECT on public.notification_preferences to service_role;
grant TRIGGER on public.notification_preferences to service_role;
grant TRUNCATE on public.notification_preferences to service_role;
grant UPDATE on public.notification_preferences to service_role;
alter table public.schedule_blocks enable row level security;
create policy blocks_manage on public.schedule_blocks as PERMISSIVE for ALL to authenticated using ((is_admin() OR (professional_id = current_professional_id()))) with check ((is_admin() OR (professional_id = current_professional_id())));
grant DELETE on public.schedule_blocks to authenticated;
grant INSERT on public.schedule_blocks to authenticated;
grant SELECT on public.schedule_blocks to authenticated;
grant UPDATE on public.schedule_blocks to authenticated;
grant DELETE on public.schedule_blocks to postgres;
grant INSERT on public.schedule_blocks to postgres;
grant MAINTAIN on public.schedule_blocks to postgres;
grant REFERENCES on public.schedule_blocks to postgres;
grant SELECT on public.schedule_blocks to postgres;
grant TRIGGER on public.schedule_blocks to postgres;
grant TRUNCATE on public.schedule_blocks to postgres;
grant UPDATE on public.schedule_blocks to postgres;
grant DELETE on public.schedule_blocks to service_role;
grant INSERT on public.schedule_blocks to service_role;
grant MAINTAIN on public.schedule_blocks to service_role;
grant REFERENCES on public.schedule_blocks to service_role;
grant SELECT on public.schedule_blocks to service_role;
grant TRIGGER on public.schedule_blocks to service_role;
grant TRUNCATE on public.schedule_blocks to service_role;
grant UPDATE on public.schedule_blocks to service_role;
alter table public.spa_settings enable row level security;
create policy spa_settings_admin_insert on public.spa_settings as PERMISSIVE for INSERT to public with check ((is_admin() AND (updated_by = auth.uid())));
create policy spa_settings_admin_select on public.spa_settings as PERMISSIVE for SELECT to public using (is_admin());
create policy spa_settings_admin_update on public.spa_settings as PERMISSIVE for UPDATE to public using (is_admin()) with check ((is_admin() AND (updated_by = auth.uid())));
grant DELETE on public.spa_settings to authenticated;
grant INSERT on public.spa_settings to authenticated;
grant MAINTAIN on public.spa_settings to authenticated;
grant REFERENCES on public.spa_settings to authenticated;
grant SELECT on public.spa_settings to authenticated;
grant TRIGGER on public.spa_settings to authenticated;
grant TRUNCATE on public.spa_settings to authenticated;
grant UPDATE on public.spa_settings to authenticated;
grant DELETE on public.spa_settings to postgres;
grant INSERT on public.spa_settings to postgres;
grant MAINTAIN on public.spa_settings to postgres;
grant REFERENCES on public.spa_settings to postgres;
grant SELECT on public.spa_settings to postgres;
grant TRIGGER on public.spa_settings to postgres;
grant TRUNCATE on public.spa_settings to postgres;
grant UPDATE on public.spa_settings to postgres;
grant DELETE on public.spa_settings to service_role;
grant INSERT on public.spa_settings to service_role;
grant MAINTAIN on public.spa_settings to service_role;
grant REFERENCES on public.spa_settings to service_role;
grant SELECT on public.spa_settings to service_role;
grant TRIGGER on public.spa_settings to service_role;
grant TRUNCATE on public.spa_settings to service_role;
grant UPDATE on public.spa_settings to service_role;
CREATE TRIGGER appointments_enforce_buffer BEFORE INSERT OR UPDATE OF professional_id, start_at, end_at, status ON appointments FOR EACH ROW EXECUTE FUNCTION enforce_appointment_buffer();
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER cancel_payment_after_appointment_cancellation AFTER UPDATE OF status ON appointments FOR EACH ROW EXECUTE FUNCTION cancel_pending_payment_with_appointment();
CREATE TRIGGER create_payment_after_appointment AFTER INSERT ON appointments FOR EACH ROW EXECUTE FUNCTION create_payment_for_appointment();
CREATE TRIGGER queue_admin_appointment_notifications_018 AFTER INSERT OR UPDATE OF status ON appointments FOR EACH ROW EXECUTE FUNCTION queue_admin_appointment_notifications_018();
CREATE TRIGGER queue_notifications_after_appointment AFTER INSERT ON appointments FOR EACH ROW EXECUTE FUNCTION queue_appointment_notifications();
CREATE TRIGGER queue_notifications_after_appointment_cancellation AFTER UPDATE OF status ON appointments FOR EACH ROW WHEN (old.status IS DISTINCT FROM new.status AND new.status = 'cancelled'::appointment_status) EXECUTE FUNCTION queue_appointment_cancellation_notifications();
CREATE TRIGGER validate_appointment_before_write BEFORE INSERT OR UPDATE OF professional_id, service_id, start_at, end_at, status ON appointments FOR EACH ROW EXECUTE FUNCTION validate_appointment();
CREATE TRIGGER validate_client_booking_limits_before_insert BEFORE INSERT ON appointments FOR EACH ROW EXECUTE FUNCTION validate_client_booking_limits();
CREATE TRIGGER validate_configured_client_cancellation_notice_017 BEFORE UPDATE OF status ON appointments FOR EACH ROW EXECUTE FUNCTION validate_configured_client_cancellation_notice_017();
CREATE TRIGGER notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER queue_admin_payment_notifications_018 AFTER UPDATE OF status ON payments FOR EACH ROW EXECUTE FUNCTION queue_admin_payment_notifications_018();
CREATE TRIGGER professionals_updated_at BEFORE UPDATE ON professionals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_protect_sensitive_fields BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION protect_profile_sensitive_fields();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER spa_settings_updated_at BEFORE UPDATE ON spa_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
reset role;
commit;
