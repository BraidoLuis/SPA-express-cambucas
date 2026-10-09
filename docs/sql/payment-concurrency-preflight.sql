-- Proposta para revisão e execução MANUAL; não aplicada.
-- Origem: auditoria fornecida pelo usuário; SHA-256 63684dd96ffa8568b8b2e366e0a874ceeeda953cab60744d894025b094eecb98
-- Não usar migrations antigas como referência de produção.

-- SOMENTE LEITURA. Executar primeiro e guardar o resultado junto ao backup.
select version() as postgres_version, current_database() as database_name;
-- Colunas/defaults NÃO constam do anexo. Não há valores de clientes nesta consulta.
select table_name, column_name, data_type, udt_schema, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name in
  ('profiles','professionals','appointments','payments','audit_logs','notifications')
order by table_name, ordinal_position;

select c.relname as table_name, a.attname as column_name, e.enumlabel, e.enumsortorder
from pg_attribute a join pg_class c on c.oid=a.attrelid
join pg_namespace n on n.oid=c.relnamespace join pg_enum e on e.enumtypid=a.atttypid
where n.nspname='public' and c.relname in ('profiles','appointments','payments')
  and a.attname in ('role','status') and not a.attisdropped
order by c.relname,a.attname,e.enumsortorder;

-- Backups reais dos dois RPCs, dos helpers e dos efeitos acionados por seus UPDATEs.
select p.oid::regprocedure as signature, pg_get_function_result(p.oid) as result,
       pg_get_userbyid(p.proowner) as owner, p.prosecdef, p.proconfig, p.proacl,
       pg_get_functiondef(p.oid) as definition,
       md5(replace(pg_get_functiondef(p.oid), E'\r\n', E'\n')) as normalized_md5
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f' and p.proname in (
  'complete_professional_appointment','update_professional_appointment_status',
  'is_admin','current_professional_id','cancel_pending_payment_with_appointment',
  'queue_admin_appointment_notifications_018','queue_admin_payment_notifications_018',
  'queue_appointment_cancellation_notifications','validate_appointment',
  'enforce_appointment_buffer','set_updated_at','protect_profile_sensitive_fields')
order by signature;

select p.oid::regprocedure as signature,
       case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end as grantee,
       x.privilege_type, x.is_grantable
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
where n.nspname='public' and p.proname in
  ('complete_professional_appointment','update_professional_appointment_status')
order by signature,grantee;

select c.relname, pg_get_userbyid(c.relowner) as owner, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('profiles','professionals','appointments','payments');
select * from pg_policies where schemaname='public'
  and tablename in ('appointments','payments') order by tablename,policyname;
select c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname='public'
  and c.relname in ('profiles','professionals','appointments','payments','audit_logs')
order by c.relname,t.tgname;

select c.relname,con.conname,con.convalidated,con.condeferrable,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
  ('profiles','professionals','appointments','payments','audit_logs','notifications')
order by c.relname,con.conname;
select tablename,indexname,indexdef from pg_indexes where schemaname='public'
  and tablename in ('appointments','payments','professionals') order by tablename,indexname;

select r.rolname,c.relname,
  has_table_privilege(r.oid,c.oid,'SELECT') as can_select,
  has_table_privilege(r.oid,c.oid,'UPDATE') as can_update,
  has_table_privilege(r.oid,c.oid,'TRUNCATE') as can_truncate
from pg_roles r cross join pg_class c join pg_namespace n on n.oid=c.relnamespace
where r.rolname in ('anon','authenticated','service_role')
  and n.nspname='public' and c.relname in ('appointments','payments','profiles','professionals')
order by r.rolname,c.relname;

-- Existência de outros escritores precisa ser revista se o estado divergir do anexo.
select p.oid::regprocedure as signature
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f'
  and (p.prosrc ilike '%update%payments%' or p.prosrc ilike '%update%appointments%')
order by signature;

-- Dados apenas agregados. Única associação de pagamento/vínculo é indispensável.
select count(*) as duplicate_appointments_with_payments
from (select appointment_id from public.payments group by appointment_id having count(*)>1) d;
select count(*) as duplicate_profiles_with_professionals
from (select profile_id from public.professionals group by profile_id having count(*)>1) d;
