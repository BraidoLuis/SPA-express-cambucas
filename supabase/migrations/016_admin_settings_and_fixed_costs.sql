-- Estrutura de configuracoes e custos. Nao altera agenda, appointments ou payments.
create table if not exists public.spa_settings (
  id boolean primary key default true check (id),
  business jsonb not null default '{}'::jsonb check (jsonb_typeof(business) = 'object'),
  business_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(business_hours) = 'object'),
  booking_rules jsonb not null default '{}'::jsonb check (jsonb_typeof(booking_rules) = 'object'),
  notifications jsonb not null default '{}'::jsonb check (jsonb_typeof(notifications) = 'object'),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.spa_settings (id,business,business_hours,booking_rules,notifications) values (
 true,
 '{"name":"SPA Express Cambucás","phone":"","email":"","postalCode":"25940-000","street":"Avenida Dedo de Deus","number":"1200","complement":"em frente à Prefeitura","district":"Centro","city":"Guapimirim","state":"RJ","description":"Beleza, cuidado e bem-estar em cada atendimento.","mapAddress":"Avenida Dedo de Deus, 1200, Centro, Guapimirim - RJ","whatsappUrl":"","instagramUrl":"","timezone":"America/Sao_Paulo"}',
 '{"0":{"open":false,"start":"09:00","end":"18:00"},"1":{"open":true,"start":"09:00","end":"18:00"},"2":{"open":true,"start":"09:00","end":"18:00"},"3":{"open":true,"start":"09:00","end":"18:00"},"4":{"open":true,"start":"09:00","end":"18:00"},"5":{"open":true,"start":"09:00","end":"18:00"},"6":{"open":true,"start":"09:00","end":"18:00"}}',
 '{"minimumNoticeHours":2,"maximumAdvanceDays":90,"cancellationEnabled":true,"cancellationNoticeHours":2,"defaultGridMinutes":30,"allowSameDay":true,"paymentText":"Pagamento realizado no local."}',
 '{"inApp":true,"clientEmail":false,"professionalEmail":false,"clientWhatsapp":false,"professionalWhatsapp":false,"reminder":false,"reminderHours":24,"cancellation":true,"newAppointment":true,"paymentConfirmed":true}'
) on conflict (id) do nothing;

create table if not exists public.fixed_costs (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(trim(name)) between 1 and 120),
 category text not null check (char_length(trim(category)) between 1 and 80),
 amount numeric(12,2) not null check (amount >= 0),
 recurrence text not null check (recurrence in ('monthly','annual')),
 due_day smallint not null check (due_day between 1 and 31),
 annual_due_month smallint check (annual_due_month between 1 and 12),
 starts_on date not null, ends_on date, active boolean not null default true,
 notes text check (char_length(notes) <= 500),
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (ends_on is null or ends_on >= starts_on),
 check ((recurrence='monthly' and annual_due_month is null) or (recurrence='annual' and annual_due_month is not null))
);
create unique index if not exists fixed_costs_accidental_duplicate on public.fixed_costs
 (lower(name),lower(category),amount,recurrence,due_day,coalesce(annual_due_month,0),starts_on) where active;
create index if not exists fixed_costs_period_idx on public.fixed_costs (starts_on,ends_on,active);
alter table public.spa_settings enable row level security;
alter table public.fixed_costs enable row level security;

do $$ begin
 if not exists(select 1 from pg_trigger where tgname='spa_settings_updated_at' and tgrelid='public.spa_settings'::regclass) then
  create trigger spa_settings_updated_at before update on public.spa_settings for each row execute function public.set_updated_at();
 end if;
 if not exists(select 1 from pg_trigger where tgname='fixed_costs_updated_at' and tgrelid='public.fixed_costs'::regclass) then
  create trigger fixed_costs_updated_at before update on public.fixed_costs for each row execute function public.set_updated_at();
 end if;
end $$;

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='spa_settings' and policyname='spa_settings_admin_select') then create policy spa_settings_admin_select on public.spa_settings for select using(public.is_admin()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='spa_settings' and policyname='spa_settings_admin_insert') then create policy spa_settings_admin_insert on public.spa_settings for insert with check(public.is_admin() and updated_by=auth.uid()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='spa_settings' and policyname='spa_settings_admin_update') then create policy spa_settings_admin_update on public.spa_settings for update using(public.is_admin()) with check(public.is_admin() and updated_by=auth.uid()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='fixed_costs' and policyname='fixed_costs_admin_select') then create policy fixed_costs_admin_select on public.fixed_costs for select using(public.is_admin()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='fixed_costs' and policyname='fixed_costs_admin_insert') then create policy fixed_costs_admin_insert on public.fixed_costs for insert with check(public.is_admin() and created_by=auth.uid()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='fixed_costs' and policyname='fixed_costs_admin_update') then create policy fixed_costs_admin_update on public.fixed_costs for update using(public.is_admin()) with check(public.is_admin()); end if;
end $$;

create or replace function public.get_public_spa_settings() returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
  'business',jsonb_build_object(
   'name',business->>'name','phone',business->>'phone','email',business->>'email',
   'postalCode',business->>'postalCode','street',business->>'street','number',business->>'number',
   'complement',business->>'complement','district',business->>'district','city',business->>'city',
   'state',business->>'state','description',business->>'description','mapAddress',business->>'mapAddress',
   'whatsappUrl',business->>'whatsappUrl','instagramUrl',business->>'instagramUrl','timezone',business->>'timezone'
  ),'businessHours',business_hours
 ) from public.spa_settings where id=true;
$$;
revoke all on function public.get_public_spa_settings() from public;
grant execute on function public.get_public_spa_settings() to anon,authenticated;
