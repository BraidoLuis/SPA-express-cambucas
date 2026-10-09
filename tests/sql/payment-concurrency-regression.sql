\set ON_ERROR_STOP on
-- TESTE REAL PostgreSQL, executado no modelo local 17.6. SOMENTE spa_payment_test.
-- Clone local descartável, schema atual completo, SQL proposto já aplicado,
-- fixtures sintéticas, sem workers/crons/integrações externas.
-- Variáveis psql obrigatórias: appointment_id, professional_id, admin_id,
-- inactive_id, client_id, unlinked_id, other_professional_id, inactive_link_id.
-- IDs professional_id/other_professional_id são de profiles, NÃO professionals.
-- Fixture: atendimento confirmed já iniciado, vinculado à profissional ativa,
-- serviço/vínculo ativos e horário sem bloqueios; pagamento pending.
begin;
do $guard$ begin
  if current_database() <> 'spa_payment_test' then raise exception 'Somente spa_payment_test.'; end if;
end $guard$;
set local lock_timeout='5s';
set local statement_timeout='60s';
select set_config('spa.test_appointment', :'appointment_id', true),
       set_config('spa.test_actors', json_build_object(
         'professional',:'professional_id','admin',:'admin_id',
         'inactive',:'inactive_id','client',:'client_id','unlinked',:'unlinked_id',
         'other',:'other_professional_id','inactive_link',:'inactive_link_id')::text,true);

-- Validar fixtures, não permitir que IDs ausentes façam os testes passarem por acaso.
do $fixtures$
declare ids jsonb := current_setting('spa.test_actors')::jsonb;
        a public.appointments%rowtype; k text; v uuid;
begin
  foreach k in array array['professional','admin','inactive','client','unlinked','other','inactive_link'] loop
    v := (ids->>k)::uuid;
    if v is null or not exists(select 1 from public.profiles where id=v) then
      raise exception 'Fixture de perfil ausente: %', k;
    end if;
  end loop;
  select * into strict a from public.appointments where id=current_setting('spa.test_appointment')::uuid;
  if a.status <> 'confirmed' or a.start_at > now()
    or not exists(select 1 from public.professionals p join public.profiles r on r.id=p.profile_id
      where p.id=a.professional_id and r.id=(ids->>'professional')::uuid and p.active and r.active and r.role::text='professional')
    or not exists(select 1 from public.payments where appointment_id=a.id and status='pending') then
    raise exception 'Fixture principal incompatível.';
  end if;
  if not exists(select 1 from public.profiles where id=(ids->>'admin')::uuid and active and role::text='admin')
    or not exists(select 1 from public.profiles where id=(ids->>'inactive')::uuid and not active)
    or not exists(select 1 from public.profiles where id=(ids->>'client')::uuid and role::text='client')
    or not exists(select 1 from public.profiles where id=(ids->>'unlinked')::uuid and active and role::text='professional')
    or exists(select 1 from public.professionals where profile_id=(ids->>'unlinked')::uuid and active)
    or not exists(select 1 from public.professionals p join public.profiles r on r.id=p.profile_id
      where r.id=(ids->>'other')::uuid and r.active and r.role::text='professional' and p.active and p.id<>a.professional_id)
    or not exists(select 1 from public.professionals p join public.profiles r on r.id=p.profile_id
      where r.id=(ids->>'inactive_link')::uuid and r.active and r.role::text='professional' and not p.active) then
    raise exception 'Fixtures negativas incompatíveis.';
  end if;
end $fixtures$;

-- Validação de identidade explícita nos DO/RPCs. Executar como owner apenas para
-- preparar/ler fixtures; o RPC SECURITY DEFINER usa auth.uid() do ator sintético.
do $identity$
declare ids jsonb := current_setting('spa.test_actors')::jsonb; k text; denied boolean;
begin
  foreach k in array array['inactive','client','unlinked','other','inactive_link'] loop
    perform set_config('request.jwt.claim.sub',ids->>k,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',ids->>k,'role','authenticated')::text,true);
    denied := false;
    begin
      perform public.complete_professional_appointment(current_setting('spa.test_appointment')::uuid,false);
    exception when insufficient_privilege then denied := true;
    end;
    if not denied then raise exception 'Conclusão aceitou identidade inválida: %',k; end if;
    denied := false;
    begin
      perform public.update_professional_appointment_status(current_setting('spa.test_appointment')::uuid,'cancelled','Teste');
    exception when insufficient_privilege then denied := true;
    end;
    if not denied then raise exception 'Status aceitou identidade inválida: %',k; end if;
  end loop;
end $identity$;
select set_config('request.jwt.claim.sub', (current_setting('spa.test_actors')::jsonb)->>'professional', true),
       set_config('request.jwt.claims', jsonb_build_object('sub',(current_setting('spa.test_actors')::jsonb)->>'professional','role','authenticated')::text,true);

-- Cada bloco interno termina com P0999 para desfazer sua preparação/sucesso.
-- Um erro inesperado não é capturado e falha o roteiro.
do $payments$
declare aid uuid := current_setting('spa.test_appointment')::uuid;
        state public.payment_status; received boolean; result jsonb;
        before_payment jsonb; after_payment jsonb; audits bigint; denied boolean;
begin
  for state in select unnest(enum_range(null::public.payment_status)) loop
    foreach received in array array[false,true] loop
      begin
        update public.payments set status=state,method='pix',notes='Admin teste',
          confirmed_by=(current_setting('spa.test_actors')::jsonb->>'admin')::uuid,
          paid_at='2026-01-01T12:00:00Z'::timestamptz where appointment_id=aid;
        select to_jsonb(p) into before_payment from public.payments p where appointment_id=aid;
        select count(*) into audits from public.audit_logs where entity_id=aid::text;
        denied := false;
        begin
          result := public.complete_professional_appointment(aid,received,'dinheiro','Profissional teste');
        exception when raise_exception then denied := true;
        end;
        if received and state::text not in ('pending','paid') then
          if not denied or (select status::text from public.appointments where id=aid)<>'confirmed' then
            raise exception 'Pagamento não elegível aceito ou atendimento parcialmente concluído.';
          end if;
        else
          if denied or result->>'appointment_status'<>'completed'
            or (result->>'payment_updated')::boolean is distinct from (received and state::text='pending')
            or (select status::text from public.appointments where id=aid)<>'completed'
            or (select count(*) from public.audit_logs where entity_id=aid::text)<>audits+1 then
            raise exception 'Conclusão/contrato/auditoria incompatível.';
          end if;
          select to_jsonb(p) into after_payment from public.payments p where appointment_id=aid;
          if not received or state::text='paid' then
            if after_payment is distinct from before_payment then raise exception 'Pagamento preservado foi alterado.'; end if;
          elsif after_payment->>'status'<>'paid' or after_payment->>'method'<>'dinheiro'
            or after_payment->>'confirmed_by'<>(current_setting('spa.test_actors')::jsonb->>'professional')
            or after_payment->'amount' is distinct from before_payment->'amount' then
            raise exception 'Pagamento pendente não confirmado corretamente.';
          end if;
          denied := false;
          begin perform public.complete_professional_appointment(aid,received,'outro','Repetido');
          exception when raise_exception then denied := true; end;
          if not denied or (select count(*) from public.audit_logs where entity_id=aid::text)<>audits+1 then
            raise exception 'Repetição aceitou nova conclusão/auditoria.';
          end if;
        end if;
        raise exception using errcode='P0999',message='rollback do caso';
      exception when sqlstate 'P0999' then null;
      end;
    end loop;
  end loop;
  foreach received in array array[false,true] loop
    begin
      delete from public.payments where appointment_id=aid;
      denied := false;
      begin result := public.complete_professional_appointment(aid,received,'pix');
      exception when raise_exception then denied := true; end;
      if received then
        if not denied or (select status::text from public.appointments where id=aid)<>'confirmed' then raise exception 'Ausência de pagamento não bloqueou recebimento.'; end if;
      elsif denied or result->>'payment_status'<>'pending' or result->'payment_id'<>'null'::jsonb then
        raise exception 'Conclusão sem recebimento/registro não preservou fallback.';
      end if;
      raise exception using errcode='P0999',message='rollback do caso';
    exception when sqlstate 'P0999' then null; end;
  end loop;
end $payments$;

do $states$
declare aid uuid := current_setting('spa.test_appointment')::uuid;
        state public.appointment_status; denied boolean;
begin
  foreach state in array array['pending','cancelled','completed','no_show']::public.appointment_status[] loop
    begin
      update public.appointments set status=state where id=aid;
      denied := false;
      begin perform public.complete_professional_appointment(aid,false);
      exception when raise_exception then denied := true; end;
      if not denied then raise exception 'Estado inelegível foi concluído: %',state; end if;
      raise exception using errcode='P0999',message='rollback do caso';
    exception when sqlstate 'P0999' then null; end;
  end loop;
  begin
    update public.appointments set end_at=now()+interval '30 days'+(end_at-start_at),
      start_at=now()+interval '30 days' where id=aid;
    denied := false;
    begin perform public.complete_professional_appointment(aid,false);
    exception when raise_exception then denied := true; end;
    if not denied then raise exception 'Atendimento futuro foi concluído.'; end if;
    raise exception using errcode='P0999',message='rollback do caso';
  exception when sqlstate 'P0999' then null; end;
end $states$;

-- Contrato de status, conclusão sem recebimento e repetição sem auditoria nova.
do $status_confirmation$
declare aid uuid := current_setting('spa.test_appointment')::uuid;
        result public.appointments%rowtype; before_payment jsonb; audits bigint;
begin
  begin
    select to_jsonb(p) into before_payment from public.payments p where appointment_id=aid;
    select count(*) into audits from public.audit_logs where entity_id=aid::text;
    result := public.update_professional_appointment_status(aid,'completed');
    if result.id is distinct from aid or result.status::text is distinct from 'completed'
      or (select status::text from public.appointments where id=aid) is distinct from 'completed'
      or (select to_jsonb(p) from public.payments p where appointment_id=aid) is distinct from before_payment
      or (select count(*) from public.audit_logs where entity_id=aid::text)<>audits+1 then
      raise exception 'RPC de status não confirmou conclusão sem recebimento.';
    end if;
    result := public.update_professional_appointment_status(aid,'completed');
    if result.id is distinct from aid or result.status::text is distinct from 'completed'
      or (select count(*) from public.audit_logs where entity_id=aid::text)<>audits+1 then
      raise exception 'Repetição do status gerou efeito novo.';
    end if;
    raise exception using errcode='P0999',message='rollback do caso';
  exception when sqlstate 'P0999' then null; end;
end $status_confirmation$;

-- Injeções apenas neste teste local/transação. Tudo, incluindo DDL, será revertido.
create function pg_temp.test_payment_failure() returns trigger language plpgsql as $inject$
begin
  -- Ramos separados: NEW tem campos distintos em cada tabela.
  if tg_table_name='appointments' then
    if new.status::text='completed' and current_setting('spa.test_failure',true)='appointment_zero' then return null; end if;
  elsif tg_table_name='payments' then
    if new.status::text='paid' then
      if current_setting('spa.test_failure',true)='payment_zero' then return null; end if;
      if current_setting('spa.test_failure',true)='payment_error' then
        raise exception using errcode='XX000',message='Falha de teste após alteração do atendimento';
      end if;
    end if;
  elsif tg_table_name='audit_logs' then
    if new.action='appointment_completed' and current_setting('spa.test_failure',true)='audit_zero' then return null; end if;
    if new.action='appointment_status_changed' and current_setting('spa.test_failure',true)='status_audit_zero' then return null; end if;
  end if;
  return new;
end $inject$;
create trigger zzz_test_appointment_zero before update on public.appointments
for each row execute function pg_temp.test_payment_failure();
create trigger zzz_test_payment_failure before update on public.payments
for each row execute function pg_temp.test_payment_failure();
create trigger zzz_test_audit_zero before insert on public.audit_logs
for each row execute function pg_temp.test_payment_failure();

do $failures$
declare aid uuid := current_setting('spa.test_appointment')::uuid;
        mode text; denied boolean; ba jsonb; bp jsonb; audits bigint; notices bigint;
begin
  select to_jsonb(a) into ba from public.appointments a where id=aid;
  select to_jsonb(p) into bp from public.payments p where appointment_id=aid;
  select count(*) into audits from public.audit_logs where entity_id=aid::text;
  select count(*) into notices from public.notifications where appointment_id=aid;
  foreach mode in array array['appointment_zero','payment_zero','payment_error','audit_zero'] loop
    perform set_config('spa.test_failure',mode,true); denied := false;
    begin perform public.complete_professional_appointment(aid,true,'pix');
    exception when sqlstate '40001' or sqlstate 'XX000' then denied := true; end;
    if not denied or (select to_jsonb(a) from public.appointments a where id=aid) is distinct from ba
      or (select to_jsonb(p) from public.payments p where appointment_id=aid) is distinct from bp
      or (select count(*) from public.audit_logs where entity_id=aid::text)<>audits
      or (select count(*) from public.notifications where appointment_id=aid)<>notices then
      raise exception 'Falha intermediária/zero linhas não reverteu tudo: %',mode;
    end if;
  end loop;
  foreach mode in array array['appointment_zero','status_audit_zero'] loop
    perform set_config('spa.test_failure',mode,true); denied := false;
    begin perform public.update_professional_appointment_status(aid,'completed');
    exception when sqlstate '40001' then denied := true; end;
    if not denied or (select to_jsonb(a) from public.appointments a where id=aid) is distinct from ba
      or (select to_jsonb(p) from public.payments p where appointment_id=aid) is distinct from bp
      or (select count(*) from public.audit_logs where entity_id=aid::text)<>audits
      or (select count(*) from public.notifications where appointment_id=aid)<>notices then
      raise exception 'RPC de status não reverteu zero linhas/auditoria: %',mode;
    end if;
  end loop;
  perform set_config('spa.test_failure','',true);
end $failures$;

-- Grants e RLS com role API real (não owner).
set local role authenticated;
do $direct_updates$
declare changed integer;
begin
  update public.payments set method='outro' where appointment_id=current_setting('spa.test_appointment')::uuid;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Profissional ainda pode atualizar pagamento diretamente.'; end if;
  begin
    update public.appointments set status='completed' where id=current_setting('spa.test_appointment')::uuid;
    get diagnostics changed=row_count;
    if changed<>0 then raise exception 'UPDATE direto contornou conclusão.'; end if;
  exception when insufficient_privilege then null;
  end;
end $direct_updates$;
reset role;
rollback;
-- Nenhuma fixture/trigger/notificação/auditoria deste teste permanece.
