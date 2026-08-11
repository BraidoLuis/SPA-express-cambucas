-- Criação segura de agendamentos pelas clientes.
-- Execute uma única vez depois da migration 003_available_slots.sql.

-- Enquanto as profissionais ainda não possuem login, não tentamos criar
-- notificações destinadas a um profile_id inexistente.
create or replace function public.queue_appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  professional_profile uuid;
begin
  select profile_id
    into professional_profile
  from public.professionals
  where id = new.professional_id;

  if new.client_id is not null then
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
      new.client_id,
      channel,
      'appointment_created',
      'Agendamento confirmado',
      'Seu horário foi reservado no SPA Express Cambucás.'
    from unnest(
      array['in_app', 'email', 'whatsapp']::public.notification_channel[]
    ) channel;
  end if;

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
      array['in_app', 'email', 'whatsapp']::public.notification_channel[]
    ) channel;
  end if;

  return new;
end;
$$;

create or replace function public.create_client_appointment(
  p_professional_id uuid,
  p_service_id uuid,
  p_slot_start timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  client_profile public.profiles%rowtype;
  appointment_id uuid;
  appointment_end timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Você precisa entrar na sua conta para agendar';
  end if;

  select *
    into client_profile
  from public.profiles
  where id = auth.uid()
    and role = 'client'
    and active;

  if client_profile.id is null then
    raise exception 'Conta de cliente inválida ou inativa';
  end if;

  select slot_end
    into appointment_end
  from public.get_available_slots(
    p_professional_id,
    p_service_id,
    (p_slot_start at time zone 'America/Sao_Paulo')::date
  )
  where slot_start = p_slot_start
  limit 1;

  if appointment_end is null then
    raise exception 'Este horário não está mais disponível';
  end if;

  insert into public.appointments (
    client_id,
    professional_id,
    service_id,
    client_name,
    client_email,
    client_phone,
    start_at,
    end_at,
    status,
    notes,
    outside_schedule,
    created_by
  )
  values (
    client_profile.id,
    p_professional_id,
    p_service_id,
    client_profile.full_name,
    client_profile.email,
    client_profile.phone,
    p_slot_start,
    appointment_end,
    'confirmed',
    nullif(trim(p_notes), ''),
    false,
    client_profile.id
  )
  returning id into appointment_id;

  return appointment_id;
exception
  when exclusion_violation then
    raise exception 'Este horário acabou de ser reservado por outra cliente';
end;
$$;

revoke all on function public.create_client_appointment(uuid, uuid, timestamptz, text) from public;
grant execute on function public.create_client_appointment(uuid, uuid, timestamptz, text) to authenticated;
