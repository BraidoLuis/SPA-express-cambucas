\set ON_ERROR_STOP on
-- SOMENTE clone local. Abrir OUTRO psql na mesma spa_payment_test.
-- -v operation=complete|cancel|admin -v appointment_id=UUID
-- -v professional_id=UUID_DO_PERFIL -v admin_id=UUID_DO_PERFIL
do $guard$ begin
  if current_database() <> 'spa_payment_test' then raise exception 'Somente spa_payment_test.'; end if;
end $guard$;
select :'operation'='complete' as do_complete, :'operation'='cancel' as do_cancel,
       :'operation'='admin' as do_admin \gset
begin;
set local lock_timeout='30s';
set local statement_timeout='120s';
\if :do_admin
  select set_config('request.jwt.claim.sub', :'admin_id', true),
         set_config('request.jwt.claims', json_build_object('sub',:'admin_id','role','authenticated')::text,true);
\else
  select set_config('request.jwt.claim.sub', :'professional_id', true),
         set_config('request.jwt.claims', json_build_object('sub',:'professional_id','role','authenticated')::text,true);
\endif
set local role authenticated;
\if :do_complete
  select public.complete_professional_appointment(:'appointment_id'::uuid,true,'dinheiro','Profissional B teste');
\else
  \if :do_cancel
    select public.update_professional_appointment_status(:'appointment_id'::uuid,'cancelled','Motivo B teste');
  \else
    \if :do_admin
      update public.payments set status='paid',method='pix',notes='Admin B teste',
        confirmed_by=auth.uid(),paid_at=now(),updated_at=now()
      where appointment_id=:'appointment_id'::uuid and status='pending'
      returning id,status,method,confirmed_by,paid_at;
    \else
      rollback;
      \quit
    \endif
  \endif
\endif
commit;
-- Nos cenários de erro esperado, ON_ERROR_STOP aborta; se usado via \ir, executar ROLLBACK.
-- Erro/timeout não é sucesso. Registrar SQLSTATE e conferir os resultados como owner.
