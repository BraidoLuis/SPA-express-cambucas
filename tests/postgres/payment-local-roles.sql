\set ON_ERROR_STOP on
-- Executar somente no cluster local recém-inicializado com -U spa_test_root.
do $guard$ begin
 if current_database()<>'postgres' or current_user<>'spa_test_root'
   or inet_server_addr() is distinct from '127.0.0.1'::inet then
  raise exception 'Somente bootstrap do cluster local fictício.';
 end if;
end $guard$;
create role postgres login nosuperuser createdb createrole bypassrls inherit;
create role anon nologin nosuperuser nobypassrls inherit;
create role authenticated nologin nosuperuser nobypassrls inherit;
create role service_role nologin nosuperuser bypassrls inherit;
create role authenticator login nosuperuser nobypassrls noinherit;
grant anon,authenticated,service_role to authenticator;
grant anon,authenticated,service_role to postgres with admin option;
create database spa_payment_test owner postgres;
