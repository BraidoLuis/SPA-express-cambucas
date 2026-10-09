-- Proposta para revisão e execução MANUAL; não aplicada.
-- Origem: auditoria fornecida pelo usuário; SHA-256 63684dd96ffa8568b8b2e366e0a874ceeeda953cab60744d894025b094eecb98
-- Não usar migrations antigas como referência de produção.

-- SOMENTE LEITURA. Conferir ACLs, RLS e efeitos; não chama nenhum RPC.
select p.oid::regprocedure as signature, pg_get_function_result(p.oid) as result,
       pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.proconfig,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('complete_professional_appointment','update_professional_appointment_status')
order by signature;

-- Esperado: authenticated=true, anon=false, service_role=false nos dois RPCs.
select r.rolname,p.oid::regprocedure as signature,
       has_function_privilege(r.oid,p.oid,'EXECUTE') as execute
from pg_roles r cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace
where r.rolname in ('anon','authenticated','service_role')
  and n.nspname='public' and p.proname in
    ('complete_professional_appointment','update_professional_appointment_status')
order by signature,r.rolname;

-- payments_professional_update deve desaparecer. SELECT e admin permanecem.
-- appointments_completed_rpc_only deve ser RESTRICTIVE, para authenticated.
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename in ('appointments','payments')
order by tablename,policyname;

-- Comparar com preflight: nenhum trigger/constraint/índice foi alterado.
select c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname='public'
  and c.relname in ('appointments','payments','profiles','professionals')
order by c.relname,t.tgname;
select c.relname,con.conname,pg_get_constraintdef(con.oid) as definition
from pg_constraint con join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('appointments','payments','professionals')
order by c.relname,con.conname;
select tablename,indexname,indexdef from pg_indexes where schemaname='public'
  and tablename in ('appointments','payments','professionals')
order by tablename,indexname;

-- current_professional_id e is_admin devem continuar idênticos ao anexo/preflight.
select p.oid::regprocedure as signature,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('current_professional_id','is_admin')
order by signature;
-- Bloqueios/atomicidade não se provam lendo definições: executar o roteiro em clone.
