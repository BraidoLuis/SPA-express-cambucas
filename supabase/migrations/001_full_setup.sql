-- SPA EXPRESS CAMBUCAS
-- Execute este arquivo uma unica vez no SQL Editor de um projeto Supabase novo.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.user_role as enum ('client', 'professional', 'admin');
create type public.appointment_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.payment_status as enum ('pending', 'paid', 'refunded');
create type public.notification_channel as enum ('email', 'whatsapp', 'in_app');
create type public.notification_status as enum ('pending', 'processing', 'sent', 'failed', 'cancelled');
create type public.media_kind as enum ('image', 'video');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) >= 3),
  email text not null,
  phone text,
  role public.user_role not null default 'client',
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_unique on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null,
  specialty text not null,
  bio text,
  default_slot_minutes integer not null default 60 check (default_slot_minutes between 10 and 480),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null,
  description text,
  duration_minutes integer not null check (duration_minutes between 10 and 720),
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  featured boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_active_category_idx on public.services (active, category);

create table public.professional_services (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  custom_duration_minutes integer check (custom_duration_minutes between 10 and 720),
  custom_price numeric(10,2) check (custom_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (professional_id, service_id)
);

-- Disponibilidade semanal recorrente. weekday: 0=domingo e 6=sabado.
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 60 check (slot_minutes between 10 and 480),
  valid_from date,
  valid_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create index availability_professional_weekday_idx
  on public.availability_rules (professional_id, weekday, active);

-- Excecoes para folgas, feriados ou horario adicional em uma data especifica.
create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  exception_date date not null,
  available boolean not null default false,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now(),
  check (
    (available = false and start_time is null and end_time is null)
    or
    (available = true and start_time is not null and end_time is not null and end_time > start_time)
  )
);

create index availability_exception_date_idx
  on public.availability_exceptions (professional_id, exception_date);

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index schedule_blocks_professional_time_idx
  on public.schedule_blocks (professional_id, starts_at, ends_at);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete restrict,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  service_id uuid references public.services(id) on delete restrict,
  client_name text not null,
  client_email text,
  client_phone text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status public.appointment_status not null default 'pending',
  notes text,
  outside_schedule boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  check (client_id is not null or char_length(trim(client_name)) >= 3)
);

create index appointments_client_idx on public.appointments (client_id, start_at desc);
create index appointments_professional_idx on public.appointments (professional_id, start_at);
create index appointments_status_idx on public.appointments (status);

-- Impede sobreposicao real, inclusive quando um servico ocupa mais de um bloco.
alter table public.appointments
  add constraint appointments_no_professional_overlap
  exclude using gist (
    professional_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'));

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  method text,
  notes text,
  confirmed_by uuid references public.profiles(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_status_paid_at_idx on public.payments (status, paid_at desc);

create table public.service_media (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) on delete set null,
  professional_id uuid references public.professionals(id) on delete set null,
  title text not null,
  caption text,
  media_type public.media_kind not null,
  storage_path text not null unique,
  public_url text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

create index service_media_active_expiry_idx on public.service_media (active, expires_at);

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  new_appointment boolean not null default true,
  cancellation boolean not null default true,
  reminder boolean not null default true,
  payment_confirmation boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  channel public.notification_channel not null,
  notification_type text not null,
  title text not null,
  body text not null,
  status public.notification_status not null default 'pending',
  scheduled_for timestamptz not null default now(),
  attempts integer not null default 0,
  provider_id text,
  error_message text,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notifications_queue_idx on public.notifications (status, scheduled_for);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and active); $$;

create or replace function public.current_professional_id()
returns uuid language sql stable security definer set search_path = public
as $$ select id from public.professionals where profile_id = auth.uid() and active limit 1; $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare requested_role public.user_role;
begin
  -- Cadastro publico nunca pode se promover para profissional/admin.
  requested_role := case
    when new.raw_user_meta_data->>'role' = 'client' then 'client'::public.user_role
    else 'client'::public.user_role
  end;

  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Cliente'),
    coalesce(new.email, ''),
    nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), ''),
    requested_role
  );

  insert into public.notification_preferences (
    profile_id, email_enabled, whatsapp_enabled
  ) values (
    new.id,
    coalesce((new.raw_user_meta_data->>'email_notifications')::boolean, true),
    coalesce((new.raw_user_meta_data->>'whatsapp_notifications')::boolean, true)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger professionals_updated_at before update on public.professionals
for each row execute function public.set_updated_at();
create trigger services_updated_at before update on public.services
for each row execute function public.set_updated_at();
create trigger appointments_updated_at before update on public.appointments
for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments
for each row execute function public.set_updated_at();
create trigger notifications_updated_at before update on public.notifications
for each row execute function public.set_updated_at();

create or replace function public.validate_appointment()
returns trigger language plpgsql security definer set search_path = public
as $$
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
$$;

create trigger validate_appointment_before_write
before insert or update of professional_id, service_id, start_at, end_at, status
on public.appointments
for each row execute function public.validate_appointment();

create or replace function public.create_payment_for_appointment()
returns trigger language plpgsql security definer set search_path = public
as $$
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
$$;

create trigger create_payment_after_appointment
after insert on public.appointments
for each row execute function public.create_payment_for_appointment();

create or replace function public.queue_appointment_notifications()
returns trigger language plpgsql security definer set search_path = public
as $$
declare professional_profile uuid;
begin
  select profile_id into professional_profile from public.professionals where id = new.professional_id;

  if new.client_id is not null then
    insert into public.notifications (appointment_id, recipient_id, channel, notification_type, title, body)
    select new.id, new.client_id, channel, 'appointment_created', 'Agendamento recebido',
           'Seu horario foi registrado no SPA Express Cambucas.'
    from unnest(array['in_app','email','whatsapp']::public.notification_channel[]) channel;
  end if;

  insert into public.notifications (appointment_id, recipient_id, channel, notification_type, title, body)
  select new.id, professional_profile, channel, 'appointment_created', 'Novo agendamento',
         new.client_name || ' reservou um horario na sua agenda.'
  from unnest(array['in_app','email','whatsapp']::public.notification_channel[]) channel;

  return new;
end;
$$;

create trigger queue_notifications_after_appointment
after insert on public.appointments
for each row execute function public.queue_appointment_notifications();

create or replace function public.delete_expired_service_media()
returns integer language plpgsql security definer set search_path = public, storage
as $$
declare deleted_count integer;
begin
  delete from storage.objects
  where bucket_id = 'service-media'
    and name in (select storage_path from public.service_media where expires_at <= now());

  delete from public.service_media where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.delete_expired_service_media() to service_role;

-- Storage para imagens e videos da vitrine. Maximo de 20 MB por arquivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-media', 'service-media', true, 20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.profiles enable row level security;
alter table public.professionals enable row level security;
alter table public.services enable row level security;
alter table public.professional_services enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;
alter table public.service_media enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select on public.profiles for select
using (id = auth.uid() or public.is_admin() or id in (
  select profile_id from public.professionals where active
));
create policy profiles_update_own on public.profiles for update
using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy professionals_public_read on public.professionals for select using (active or public.is_admin());
create policy professionals_admin_all on public.professionals for all
using (public.is_admin()) with check (public.is_admin());
create policy professionals_update_self on public.professionals for update
using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy services_public_read on public.services for select using (active or public.is_admin());
create policy services_admin_all on public.services for all
using (public.is_admin()) with check (public.is_admin());
create policy services_professional_insert on public.services for insert
with check (created_by = auth.uid() and public.current_professional_id() is not null);
create policy services_professional_update on public.services for update
using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy professional_services_public_read on public.professional_services for select using (active or public.is_admin());
create policy professional_services_admin_all on public.professional_services for all
using (public.is_admin()) with check (public.is_admin());
create policy professional_services_self_all on public.professional_services for all
using (professional_id = public.current_professional_id())
with check (professional_id = public.current_professional_id());

create policy availability_public_read on public.availability_rules for select using (active or public.is_admin());
create policy availability_manage on public.availability_rules for all
using (public.is_admin() or professional_id = public.current_professional_id())
with check (public.is_admin() or professional_id = public.current_professional_id());
create policy exceptions_public_read on public.availability_exceptions for select using (true);
create policy exceptions_manage on public.availability_exceptions for all
using (public.is_admin() or professional_id = public.current_professional_id())
with check (public.is_admin() or professional_id = public.current_professional_id());
create policy blocks_public_read on public.schedule_blocks for select using (true);
create policy blocks_manage on public.schedule_blocks for all
using (public.is_admin() or professional_id = public.current_professional_id())
with check (public.is_admin() or professional_id = public.current_professional_id());

create policy appointments_select on public.appointments for select
using (
  client_id = auth.uid() or public.is_admin()
  or professional_id = public.current_professional_id()
);
create policy appointments_client_insert on public.appointments for insert
with check (
  client_id = auth.uid() and created_by = auth.uid()
  and start_at > now() and outside_schedule = false
);
create policy appointments_team_insert on public.appointments for insert
with check (
  public.is_admin()
  or (professional_id = public.current_professional_id() and created_by = auth.uid())
);
create policy appointments_client_cancel on public.appointments for update
using (client_id = auth.uid() and start_at > now())
with check (client_id = auth.uid() and status = 'cancelled');
create policy appointments_team_update on public.appointments for update
using (public.is_admin() or professional_id = public.current_professional_id())
with check (public.is_admin() or professional_id = public.current_professional_id());

create policy payments_select on public.payments for select
using (
  public.is_admin()
  or exists (
    select 1 from public.appointments a
    where a.id = appointment_id
      and (a.client_id = auth.uid() or a.professional_id = public.current_professional_id())
  )
);
create policy payments_admin_update on public.payments for update
using (public.is_admin()) with check (public.is_admin());
create policy payments_professional_update on public.payments for update
using (exists (
  select 1 from public.appointments a
  where a.id = appointment_id and a.professional_id = public.current_professional_id()
)) with check (exists (
  select 1 from public.appointments a
  where a.id = appointment_id and a.professional_id = public.current_professional_id()
));

create policy media_public_read on public.service_media for select
using (active and expires_at > now() or public.is_admin());
create policy media_team_insert on public.service_media for insert
with check (public.is_admin() or created_by = auth.uid() and public.current_professional_id() is not null);
create policy media_team_update on public.service_media for update
using (public.is_admin() or created_by = auth.uid())
with check (public.is_admin() or created_by = auth.uid());
create policy media_team_delete on public.service_media for delete
using (public.is_admin() or created_by = auth.uid());

create policy preferences_own_all on public.notification_preferences for all
using (profile_id = auth.uid() or public.is_admin())
with check (profile_id = auth.uid() or public.is_admin());
create policy notifications_own_read on public.notifications for select
using (recipient_id = auth.uid() or public.is_admin());
create policy notifications_own_update on public.notifications for update
using (recipient_id = auth.uid() or public.is_admin())
with check (recipient_id = auth.uid() or public.is_admin());
create policy audit_admin_read on public.audit_logs for select using (public.is_admin());

create policy storage_public_read on storage.objects for select
using (bucket_id = 'service-media');
create policy storage_team_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'service-media'
  and (public.is_admin() or public.current_professional_id() is not null)
);
create policy storage_team_update on storage.objects for update to authenticated
using (bucket_id = 'service-media' and (public.is_admin() or owner_id = auth.uid()::text))
with check (bucket_id = 'service-media' and (public.is_admin() or owner_id = auth.uid()::text));
create policy storage_team_delete on storage.objects for delete to authenticated
using (bucket_id = 'service-media' and (public.is_admin() or owner_id = auth.uid()::text));

-- Funcoes internas sao usadas por triggers e rotas de servidor.
revoke all on function public.is_admin() from public;
revoke all on function public.current_professional_id() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_professional_id() to authenticated;

-- Depois de criar as contas da administradora e das profissionais no Auth,
-- promova-as pelo SQL Editor (troque os UUIDs):
-- update public.profiles set role = 'admin' where id = 'UUID-DA-ADMIN';
-- update public.profiles set role = 'professional' where id in ('UUID-ELIANE','UUID-DAYANNE');
-- insert into public.professionals (profile_id, display_name, specialty)
-- values
-- ('UUID-ELIANE', 'Eliane Cristina', 'Massagista e Esteticista'),
-- ('UUID-DAYANNE', 'Dayanne Costa', 'Manicure e Nail Designer');
