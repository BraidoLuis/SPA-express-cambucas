\set ON_ERROR_STOP on
-- SOMENTE dados sintéticos no cluster descartável. Não cria contas via Auth.
do $guard$ begin
 if current_database()<>'spa_payment_test' or inet_server_addr() is distinct from '127.0.0.1'::inet then
  raise exception 'Somente spa_payment_test em localhost.';
 end if;
end $guard$;
insert into auth.users(id) select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,8) i;
insert into profiles(id,full_name,email,role,active) values
 ('10000000-0000-4000-8000-000000000001','Profissional Teste','pro@example.invalid','professional',true),
 ('10000000-0000-4000-8000-000000000002','Admin Teste','admin@example.invalid','admin',true),
 ('10000000-0000-4000-8000-000000000003','Perfil Inativo','inactive@example.invalid','professional',false),
 ('10000000-0000-4000-8000-000000000004','Cliente Teste','client@example.invalid','client',true),
 ('10000000-0000-4000-8000-000000000005','Sem Vinculo','unlinked@example.invalid','professional',true),
 ('10000000-0000-4000-8000-000000000006','Outra Profissional','other@example.invalid','professional',true),
 ('10000000-0000-4000-8000-000000000007','Vinculo Inativo','link@example.invalid','professional',true),
 ('10000000-0000-4000-8000-000000000008','Cliente com Vinculo','linkedclient@example.invalid','client',true);
insert into professionals(id,profile_id,display_name,active) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Profissional Teste',true),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','Perfil Inativo',true),
 ('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000006','Outra Profissional',true),
 ('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000007','Vinculo Inativo',false),
 ('20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000008','Cliente com Vinculo',true);
insert into services(id,slug,name,price,duration_minutes) values
 ('30000000-0000-4000-8000-000000000001','servico-ficticio','Servico ficticio',123.45,60);
insert into professional_services(professional_id,service_id) select id,'30000000-0000-4000-8000-000000000001' from professionals;
insert into spa_settings(id,booking_rules) values(true,'{"cancellationEnabled":true,"cancellationNoticeHours":2}');
-- outside_schedule = true é o contrato auditado para fixtures no passado.
insert into appointments(id,client_id,client_name,professional_id,service_id,start_at,end_at,
 status,outside_schedule,created_by) values
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','Cliente ficticia',
 '20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 now()-interval '3 hours',now()-interval '2 hours','confirmed',true,'10000000-0000-4000-8000-000000000002');
