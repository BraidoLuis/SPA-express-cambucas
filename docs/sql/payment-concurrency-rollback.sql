-- Proposta para revisão e execução MANUAL; não aplicada.
-- Origem: auditoria fornecida pelo usuário; SHA-256 63684dd96ffa8568b8b2e366e0a874ceeeda953cab60744d894025b094eecb98
-- Não usar migrations antigas como referência de produção.
-- REABRE as vulnerabilidades originais. Preferir reverter somente a aplicação.
-- Usar apenas se preflight/backup ainda coincidir exatamente com a auditoria anexada.
-- Revisar e autorizar separadamente antes de executar em produção.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
lock table public.profiles, public.professionals, public.appointments, public.payments in share row exclusive mode;
do $rollback_guard$
begin
  if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.complete_professional_appointment(uuid,boolean,text,text)')), E'\r\n', E'\n')) is distinct from '694704ac3d4af6cfbb75dc0f7be7ce08' then
    raise exception 'Função alterada desde esta proposta: não sobrescrever com rollback.';
  end if;
  if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.update_professional_appointment_status(uuid,public.appointment_status,text)')), E'\r\n', E'\n')) is distinct from '640223622a1d5f0b0b3092dc05174cfe' then
    raise exception 'Função alterada desde esta proposta: não sobrescrever com rollback.';
  end if;
end;
$rollback_guard$;

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
$function$;

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
$function$;

drop policy appointments_completed_rpc_only on public.appointments;
create policy payments_professional_update on public.payments for update to public
using (exists(select 1 from public.appointments a where a.id=payments.appointment_id and a.professional_id=public.current_professional_id()))
with check (exists(select 1 from public.appointments a where a.id=payments.appointment_id and a.professional_id=public.current_professional_id()));
revoke all on function public.complete_professional_appointment(uuid,boolean,text,text) from public, anon, authenticated, service_role;
grant execute on function public.complete_professional_appointment(uuid,boolean,text,text) to anon, authenticated, service_role;

revoke all on function public.update_professional_appointment_status(uuid,public.appointment_status,text) from public, anon, authenticated, service_role;
grant execute on function public.update_professional_appointment_status(uuid,public.appointment_status,text) to anon, authenticated, service_role;

commit;
