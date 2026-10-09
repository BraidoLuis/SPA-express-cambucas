\set ON_ERROR_STOP on
-- SOMENTE clone local isolado, sem workers/crons ou credenciais de e-mail.
-- psql -h 127.0.0.1 -U postgres -d spa_payment_test -v scenario=admin_first
--   -v appointment_id=UUID -v professional_id=UUID_DO_PERFIL -v admin_id=UUID_DO_PERFIL -f este-arquivo
-- Usar fixture nova confirmed/iniciada/payment pending em CADA cenário.
do $guard$ begin
  if current_database() <> 'spa_payment_test' then raise exception 'Somente spa_payment_test.'; end if;
end $guard$;
select :'scenario'='admin_first' as admin_first,
       :'scenario'='professional_first' as professional_first,
       :'scenario'='cancel_first' as cancel_first \gset
begin;
set local lock_timeout='30s';
set local statement_timeout='120s';
\if :admin_first
  select set_config('request.jwt.claim.sub', :'admin_id', true),
         set_config('request.jwt.claims', json_build_object('sub',:'admin_id','role','authenticated')::text,true);
\else
  select set_config('request.jwt.claim.sub', :'professional_id', true),
         set_config('request.jwt.claims', json_build_object('sub',:'professional_id','role','authenticated')::text,true);
\endif
set local role authenticated;
\if :admin_first
  -- Bloquear pagamento ANTES de escrever. A sessão B obterá atendimento e aguardará aqui.
  select id from public.payments where appointment_id=:'appointment_id'::uuid for no key update;
\else
  \if :professional_first
    select public.complete_professional_appointment(:'appointment_id'::uuid,true,'dinheiro','Profissional teste');
  \else
    \if :cancel_first
      select public.update_professional_appointment_status(:'appointment_id'::uuid,'cancelled','Motivo teste');
    \else
      rollback;
      \quit
    \endif
  \endif
\endif
\prompt 'Inicie a sessão B agora e confirme que aguarda lock; depois pressione Enter para liberar A: ' release_a
\if :admin_first
  -- O trigger de notificação/FK também roda aqui. Não deve bloquear no atendimento de B.
  update public.payments set status='paid',method='pix',notes='Admin teste',
    confirmed_by=auth.uid(),paid_at=now(),updated_at=now()
  where appointment_id=:'appointment_id'::uuid and status='pending'
  returning id,status,method,confirmed_by,paid_at;
\endif
commit;
