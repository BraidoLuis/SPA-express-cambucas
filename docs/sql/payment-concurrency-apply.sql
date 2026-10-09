-- Proposta para revisão e execução MANUAL; não aplicada.
-- Origem: auditoria fornecida pelo usuário; SHA-256 63684dd96ffa8568b8b2e366e0a874ceeeda953cab60744d894025b094eecb98
-- Não usar migrations antigas como referência de produção.
-- Antes: salvar preflight/backups, validar em clone e drenar requisições antigas.
-- O arquivo inteiro é uma única transação. Falha/timeout: ROLLBACK e investigar.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.profiles, public.professionals, public.appointments, public.payments in share row exclusive mode;

do $precheck$
begin
  if exists (
    select 1 from (values
      ('profiles','id'),
      ('profiles','role'),
      ('profiles','active'),
      ('professionals','id'),
      ('professionals','profile_id'),
      ('professionals','active'),
      ('appointments','id'),
      ('appointments','professional_id'),
      ('appointments','status'),
      ('appointments','start_at'),
      ('appointments','updated_at'),
      ('appointments','cancelled_at'),
      ('appointments','cancellation_reason'),
      ('payments','id'),
      ('payments','appointment_id'),
      ('payments','status'),
      ('payments','amount'),
      ('payments','method'),
      ('payments','notes'),
      ('payments','confirmed_by'),
      ('payments','paid_at'),
      ('payments','updated_at'),
      ('audit_logs','actor_id'),
      ('audit_logs','action'),
      ('audit_logs','entity_type'),
      ('audit_logs','entity_id'),
      ('audit_logs','metadata')
    ) required(table_name,column_name)
    where not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name=required.table_name and c.column_name=required.column_name)
  ) then raise exception 'Colunas indispensáveis ausentes: executar e revisar o preflight.'; end if;
  if to_regprocedure('public.complete_professional_appointment(uuid,boolean,text,text)') is null or
    md5(replace(pg_get_functiondef(to_regprocedure('public.complete_professional_appointment(uuid,boolean,text,text)')), E'\r\n', E'\n')) <> '943cea9e0ea657ace328db46d34ce47d' then
    raise exception 'Contrato complete_professional_appointment divergiu da auditoria: não aplicar.';
  end if;
  if to_regprocedure('public.update_professional_appointment_status(uuid,public.appointment_status,text)') is null or
    md5(replace(pg_get_functiondef(to_regprocedure('public.update_professional_appointment_status(uuid,public.appointment_status,text)')), E'\r\n', E'\n')) <> 'a59f05173ea6811e1c22e5eec3539ce9' then
    raise exception 'Contrato update_professional_appointment_status divergiu da auditoria: não aplicar.';
  end if;
  if exists(select 1 from pg_class c where c.oid in ('public.appointments'::regclass,'public.payments'::regclass) and (not c.relrowsecurity or c.relforcerowsecurity or pg_get_userbyid(c.relowner)<>'postgres')) then
    raise exception 'Owner/RLS divergiu da auditoria.';
  end if;
  if (select count(*) from pg_policy where polrelid='public.payments'::regclass)<>3 or not exists(select 1 from pg_policy where polrelid='public.payments'::regclass and polname='payments_professional_update' and polcmd='w' and polpermissive) then
    raise exception 'Políticas de pagamentos divergiram: revisar preflight.';
  end if;
  if exists(select 1 from pg_policy where polrelid='public.appointments'::regclass and polname='appointments_completed_rpc_only') then raise exception 'A política de conclusão já existe: revisar antes de reaplicar.'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.payments'::regclass and conname='payments_appointment_id_key' and contype='u' and convalidated and not condeferrable) or not exists(select 1 from pg_constraint where conrelid='public.professionals'::regclass and conname='professionals_profile_id_key' and contype='u' and convalidated and not condeferrable) then
    raise exception 'Unicidade de pagamento/vínculo divergiu da auditoria.';
  end if;
  if not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename='appointments' and p.policyname='appointments_client_cancel' and p.cmd='UPDATE' and p.permissive='PERMISSIVE' and p.roles::text[]=array['public']::text[] and replace(p.qual, E'\r\n', E'\n') is not distinct from replace('((client_id = auth.uid()) AND (start_at > now()))', E'\r\n', E'\n') and replace(p.with_check, E'\r\n', E'\n') is not distinct from replace('((client_id = auth.uid()) AND (status = ''cancelled''::appointment_status))', E'\r\n', E'\n')) then
    raise exception 'Política appointments_client_cancel divergiu da auditoria: não aplicar.';
  end if;
  if not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename='appointments' and p.policyname='appointments_client_insert' and p.cmd='INSERT' and p.permissive='PERMISSIVE' and p.roles::text[]=array['public']::text[] and replace(p.qual, E'\r\n', E'\n') is not distinct from replace(null, E'\r\n', E'\n') and replace(p.with_check, E'\r\n', E'\n') is not distinct from replace('((client_id = auth.uid()) AND (created_by = auth.uid()) AND (start_at > now()) AND (outside_schedule = false))', E'\r\n', E'\n')) then
    raise exception 'Política appointments_client_insert divergiu da auditoria: não aplicar.';
  end if;
  if not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename='appointments' and p.policyname='appointments_select' and p.cmd='SELECT' and p.permissive='PERMISSIVE' and p.roles::text[]=array['public']::text[] and replace(p.qual, E'\r\n', E'\n') is not distinct from replace('((client_id = auth.uid()) OR is_admin() OR (professional_id = current_professional_id()))', E'\r\n', E'\n') and replace(p.with_check, E'\r\n', E'\n') is not distinct from replace(null, E'\r\n', E'\n')) then
    raise exception 'Política appointments_select divergiu da auditoria: não aplicar.';
  end if;
  if not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename='appointments' and p.policyname='appointments_team_insert' and p.cmd='INSERT' and p.permissive='PERMISSIVE' and p.roles::text[]=array['public']::text[] and replace(p.qual, E'\r\n', E'\n') is not distinct from replace(null, E'\r\n', E'\n') and replace(p.with_check, E'\r\n', E'\n') is not distinct from replace('(is_admin() OR ((professional_id = current_professional_id()) AND (created_by = auth.uid())))', E'\r\n', E'\n')) then
    raise exception 'Política appointments_team_insert divergiu da auditoria: não aplicar.';
  end if;
  if not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename='appointments' and p.policyname='appointments_team_update' and p.cmd='UPDATE' and p.permissive='PERMISSIVE' and p.roles::text[]=array['public']::text[] and replace(p.qual, E'\r\n', E'\n') is not distinct from replace('(is_admin() OR (professional_id = current_professional_id()))', E'\r\n', E'\n') and replace(p.with_check, E'\r\n', E'\n') is not distinct from replace('(is_admin() OR (professional_id = current_professional_id()))', E'\r\n', E'\n')) then
    raise exception 'Política appointments_team_update divergiu da auditoria: não aplicar.';
  end if;
  if not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename='payments' and p.policyname='payments_admin_update' and p.cmd='UPDATE' and p.permissive='PERMISSIVE' and p.roles::text[]=array['public']::text[] and replace(p.qual, E'\r\n', E'\n') is not distinct from replace('is_admin()', E'\r\n', E'\n') and replace(p.with_check, E'\r\n', E'\n') is not distinct from replace('is_admin()', E'\r\n', E'\n')) then
    raise exception 'Política payments_admin_update divergiu da auditoria: não aplicar.';
  end if;
  if not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename='payments' and p.policyname='payments_professional_update' and p.cmd='UPDATE' and p.permissive='PERMISSIVE' and p.roles::text[]=array['public']::text[] and replace(p.qual, E'\r\n', E'\n') is not distinct from replace('(EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = payments.appointment_id) AND (a.professional_id = current_professional_id()))))', E'\r\n', E'\n') and replace(p.with_check, E'\r\n', E'\n') is not distinct from replace('(EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = payments.appointment_id) AND (a.professional_id = current_professional_id()))))', E'\r\n', E'\n')) then
    raise exception 'Política payments_professional_update divergiu da auditoria: não aplicar.';
  end if;
  if not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename='payments' and p.policyname='payments_select' and p.cmd='SELECT' and p.permissive='PERMISSIVE' and p.roles::text[]=array['public']::text[] and replace(p.qual, E'\r\n', E'\n') is not distinct from replace('(is_admin() OR (EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = payments.appointment_id) AND ((a.client_id = auth.uid()) OR (a.professional_id = current_professional_id()))))))', E'\r\n', E'\n') and replace(p.with_check, E'\r\n', E'\n') is not distinct from replace(null, E'\r\n', E'\n')) then
    raise exception 'Política payments_select divergiu da auditoria: não aplicar.';
  end if;
  if md5(replace(pg_get_functiondef(to_regprocedure('public.is_admin()')), E'\r\n', E'\n')) is distinct from 'bb2406153d1a444c1f0a681b55e85a00' then raise exception 'Helper is_admin divergiu da auditoria.'; end if;
  if md5(replace(pg_get_functiondef(to_regprocedure('public.current_professional_id()')), E'\r\n', E'\n')) is distinct from 'b4d5c343afcf391341b68bec17e0447f' then raise exception 'Helper current_professional_id divergiu da auditoria.'; end if;
  if exists(select 1 from pg_proc where oid in (to_regprocedure('public.complete_professional_appointment(uuid,boolean,text,text)'),to_regprocedure('public.update_professional_appointment_status(uuid,public.appointment_status,text)'),to_regprocedure('public.is_admin()'),to_regprocedure('public.current_professional_id()')) and pg_get_userbyid(proowner)<>'postgres') then raise exception 'Owner de RPC/helper divergiu da auditoria.'; end if;
end;
$precheck$;

create or replace function public.complete_professional_appointment(
  p_appointment_id uuid, p_payment_received boolean,
  p_payment_method text default null, p_payment_notes text default null
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_actor_id uuid := auth.uid();
  actor_profile public.profiles%rowtype;
  actor_professional public.professionals%rowtype;
  current_appointment public.appointments%rowtype;
  current_payment public.payments%rowtype;
  audit_rows integer;
  normalized_method text;
  payment_updated boolean := false;
begin
  -- payment_concurrency_security_v1
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Sessão profissional inválida.';
  end if;

  -- Ordem comum aos dois RPCs: perfil, vínculo, atendimento, pagamento.
  select * into actor_profile from public.profiles
  where id = v_actor_id for share;
  if not found or actor_profile.active is distinct from true
    or actor_profile.role::text is distinct from 'professional' then
    raise exception using errcode = '42501', message = 'Acesso profissional não autorizado.';
  end if;

  select * into actor_professional from public.professionals
  where profile_id = v_actor_id for share;
  if not found or actor_professional.active is distinct from true then
    raise exception using errcode = '42501', message = 'Vínculo profissional inválido.';
  end if;

  -- NO KEY UPDATE bloqueia mutações, mas permite o KEY SHARE das FKs dos avisos.
  select * into current_appointment from public.appointments
  where id = p_appointment_id and professional_id = actor_professional.id for no key update;
  if not found then
    raise exception using errcode = '42501', message = 'Agendamento não encontrado para esta profissional.';
  end if;
  select * into current_payment from public.payments
  where appointment_id = current_appointment.id for no key update;

  -- Verificar os registros bloqueados, não um snapshot anterior à espera.
  if actor_profile.active is distinct from true
    or actor_profile.role::text is distinct from 'professional'
    or actor_professional.active is distinct from true
    or actor_professional.profile_id is distinct from v_actor_id
    or current_appointment.professional_id is distinct from actor_professional.id then
    raise exception using errcode = '42501', message = 'Acesso profissional não autorizado.';
  end if;
  if current_appointment.status::text is distinct from 'confirmed' then
    raise exception 'Somente atendimentos confirmados podem ser concluídos.';
  end if;
  if current_appointment.start_at > now() then
    raise exception 'Um atendimento futuro não pode ser concluído.';
  end if;
  if p_payment_received then
    if current_payment.id is null then
      raise exception 'Pagamento do atendimento não encontrado.';
    elsif current_payment.status::text = 'pending' then
      normalized_method := lower(trim(coalesce(p_payment_method, '')));
      if normalized_method not in ('pix', 'dinheiro', 'cartao', 'outro') then
        raise exception 'Informe uma forma de pagamento válida.';
      end if;
    elsif current_payment.status::text is distinct from 'paid' then
      raise exception 'O pagamento não está elegível para confirmação.';
    end if;
    -- paid: concluir sem regravar NENHUMA coluna do pagamento.
  end if;

  update public.appointments
  set status = 'completed', updated_at = now()
  where id = current_appointment.id
    and professional_id = actor_professional.id and status = 'confirmed'
  returning * into current_appointment;
  if not found or current_appointment.status::text is distinct from 'completed' then
    raise exception using errcode = '40001', message = 'A conclusão não foi confirmada.';
  end if;

  if p_payment_received and current_payment.status::text = 'pending' then
    update public.payments
    set status = 'paid', method = normalized_method,
        notes = nullif(trim(coalesce(p_payment_notes, '')), ''),
        confirmed_by = v_actor_id, paid_at = coalesce(paid_at, now()), updated_at = now()
    where id = current_payment.id
      and appointment_id = current_appointment.id and status = 'pending'
    returning * into current_payment;
    if not found or current_payment.status::text is distinct from 'paid'
      or current_payment.method is distinct from normalized_method
      or current_payment.confirmed_by is distinct from v_actor_id
      or current_payment.paid_at is null then
      raise exception using errcode = '40001', message = 'O recebimento não foi confirmado.';
    end if;
    payment_updated := true;
  end if;

  -- Falha aqui ou em qualquer trigger aborta também os dois UPDATEs.
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor_id, 'appointment_completed', 'appointment', current_appointment.id::text,
    jsonb_build_object(
      'payment_received', payment_updated,
      'payment_method', case when payment_updated then current_payment.method else null end,
      'payment_amount', current_payment.amount));

  get diagnostics audit_rows = row_count;
  if audit_rows <> 1 then
    raise exception using errcode = '40001', message = 'A auditoria da conclusão não foi confirmada.';
  end if;

  return jsonb_build_object(
    'appointment_id', current_appointment.id,
    'appointment_status', current_appointment.status::text,
    'payment_status', coalesce(current_payment.status::text, 'pending'),
    'payment_updated', payment_updated,
    'payment_id', current_payment.id);
end;
$function$;

create or replace function public.update_professional_appointment_status(
  p_appointment_id uuid, p_status public.appointment_status, p_reason text default null
) returns public.appointments language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_actor_id uuid := auth.uid();
  actor_profile public.profiles%rowtype;
  actor_professional public.professionals%rowtype;
  current_appointment public.appointments%rowtype;
  current_payment public.payments%rowtype;
  audit_rows integer;
  updated_appointment public.appointments%rowtype;
begin
  -- payment_concurrency_security_v1
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Sessão profissional inválida.';
  end if;
  select * into actor_profile from public.profiles
  where id = v_actor_id for share;
  if not found or actor_profile.active is distinct from true
    or actor_profile.role::text is distinct from 'professional' then
    raise exception using errcode = '42501', message = 'Acesso profissional não autorizado.';
  end if;
  select * into actor_professional from public.professionals
  where profile_id = v_actor_id for share;
  if not found or actor_professional.active is distinct from true then
    raise exception using errcode = '42501', message = 'Vínculo profissional inválido.';
  end if;
  select * into current_appointment from public.appointments
  where id = p_appointment_id and professional_id = actor_professional.id for no key update;
  if not found then
    raise exception using errcode = '42501', message = 'Agendamento não encontrado para esta profissional.';
  end if;
  -- O trigger de cancelamento também altera pagamentos: obter o mesmo bloqueio primeiro.
  select * into current_payment from public.payments
  where appointment_id = current_appointment.id for no key update;

  if actor_profile.active is distinct from true
    or actor_profile.role::text is distinct from 'professional'
    or actor_professional.active is distinct from true
    or actor_professional.profile_id is distinct from v_actor_id
    or current_appointment.professional_id is distinct from actor_professional.id then
    raise exception using errcode = '42501', message = 'Acesso profissional não autorizado.';
  end if;
  if p_status is null then
    raise exception using errcode = '22023', message = 'Informe o estado do atendimento.';
  end if;
  if current_appointment.status = p_status then
    return current_appointment; -- repetição sem UPDATE, trigger ou nova auditoria
  end if;
  -- Mesmas transições de produção. Nenhuma regra de cancelamento foi acrescentada.
  if not (
    (current_appointment.status = 'pending' and p_status in ('confirmed', 'cancelled'))
    or (current_appointment.status = 'confirmed' and p_status in ('completed', 'cancelled', 'no_show'))
  ) then
    raise exception 'Transição de status não permitida.';
  end if;
  if p_status in ('completed', 'no_show') and current_appointment.start_at > now() then
    raise exception 'Um atendimento futuro não pode ser concluído ou marcado como ausência.';
  end if;
  if p_status = 'cancelled' and char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  update public.appointments
  set status = p_status,
      cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
      cancellation_reason = case when p_status = 'cancelled' then trim(p_reason) else cancellation_reason end,
      updated_at = now()
  where id = current_appointment.id and professional_id = actor_professional.id
    and status = current_appointment.status
  returning * into updated_appointment;
  if not found or updated_appointment.status is distinct from p_status then
    raise exception using errcode = '40001', message = 'A alteração não foi confirmada.';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor_id, 'appointment_status_changed', 'appointment', updated_appointment.id::text,
    jsonb_build_object(
      'previous_status', current_appointment.status,
      'new_status', updated_appointment.status,
      'reason', nullif(trim(coalesce(p_reason, '')), '')));

  get diagnostics audit_rows = row_count;
  if audit_rows <> 1 then
    raise exception using errcode = '40001', message = 'A auditoria da alteração não foi confirmada.';
  end if;
  return updated_appointment;
end;
$function$;

-- Somente o RPC de conclusão pode escrever o pagamento como profissional.
-- SELECT e UPDATE administrativo permanecem como na auditoria.
drop policy payments_professional_update on public.payments;

-- Fecha o atalho de UPDATE direto que poderia contornar o RPC ou cancelar completed.
-- Não altera a política da cliente, as transições do RPC ou o UPDATE administrativo.
create policy appointments_completed_rpc_only on public.appointments
as restrictive for update to authenticated
using (public.is_admin() or status <> 'completed')
with check (public.is_admin() or status <> 'completed');

revoke all on function public.complete_professional_appointment(uuid,boolean,text,text) from public, anon, authenticated, service_role;
grant execute on function public.complete_professional_appointment(uuid,boolean,text,text) to authenticated;

revoke all on function public.update_professional_appointment_status(uuid,public.appointment_status,text) from public, anon, authenticated, service_role;
grant execute on function public.update_professional_appointment_status(uuid,public.appointment_status,text) to authenticated;

commit;
-- Depois: executar payment-concurrency-verify.sql e os testes no clone.
